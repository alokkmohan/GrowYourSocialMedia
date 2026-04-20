// BoostKaro — Google Apps Script Backend
//
// Script Properties required:
//   SHEET_ID
//   RAZORPAY_KEY_ID
//   RAZORPAY_KEY_SECRET
//   META_ACCESS_TOKEN       — long-lived system user token
//   META_AD_ACCOUNT_ID      — format: act_XXXXXXXXX
//   META_PAGE_ID            — your Facebook Page ID
//   GOOGLE_ADS_DEVELOPER_TOKEN
//   GOOGLE_ADS_CUSTOMER_ID  — without dashes
//   GOOGLE_ADS_CLIENT_ID
//   GOOGLE_ADS_CLIENT_SECRET
//   GOOGLE_ADS_REFRESH_TOKEN
//   BUSINESS_NAME           — optional, default: BoostKaro
//   SITE_URL                — optional

const DEFAULT_SHEET_NAME = 'Orders';
const AD_BUDGET_RATIO = 0.80; // 80% of order goes to ads

// ─────────────────────────────────────────────
// SHEET EDIT TRIGGER — auto email on status change
// In GAS: Triggers → Add Trigger → onSheetEdit → From spreadsheet → On edit
// ─────────────────────────────────────────────

function onSheetEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== DEFAULT_SHEET_NAME) return;

    const col = e.range.getColumn();
    const row = e.range.getRow();
    if (row < 2) return; // skip header

    // Column 21 = Campaign Status
    if (col !== 21) return;

    const newStatus = String(e.value || '').trim();
    const rowData = sheet.getRange(row, 1, 1, 34).getValues()[0];

    const orderData = {
      orderId:      rowData[0],
      platform:     rowData[5],
      service:      rowData[6],
      quantity:     rowData[7],
      duration:     rowData[8],
      amount:       rowData[9],
      adBudget:     rowData[10],
      name:         rowData[13],
      email:        rowData[14],
      phone:        rowData[15],
      link:         rowData[16],
      preViews:     rowData[17],
      campaignId:   rowData[22],
      campaignStart:rowData[23],
      postViews:    rowData[25],
      viewsGained:  rowData[26],
    };

    const config = getConfig_();

    if (newStatus === 'Launched') {
      sendCampaignStartedEmail_(orderData, config);
      markNotificationSent_(row, 'email');
    }

    if (newStatus === 'Completed') {
      sendFinalReportEmail_(orderData, config);
      markNotificationSent_(row, 'report');
    }
  } catch (err) {
    Logger.log('onSheetEdit error: ' + err.message);
  }
}

// ─────────────────────────────────────────────
// ENTRY POINTS
// ─────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'getOrders') return jsonResponse_(getOrdersForDashboard_());
  return jsonResponse_({ success: true, service: 'boostkaro-payments', date: new Date().toISOString() });
}

function getOrdersForDashboard_() {
  try {
    const sheet = getOrdersSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, orders: [] };
    const values = sheet.getRange(2, 1, lastRow - 1, 34).getValues();
    const orders = values
      .filter(function(r) { return r[0]; })
      .map(function(r) {
        return {
          orderId:        r[0],
          createdAt:      r[4],
          platform:       r[5],
          service:        r[6],
          plan:           r[7],
          duration:       r[8],
          amount:         r[9],
          adBudget:       r[10],
          name:           r[13],
          email:          r[14],
          phone:          r[15],
          link:           r[16],
          preViews:       r[17],
          paymentStatus:  r[19],
          campaignStatus: r[20],
          campaignId:     r[21],
          postViews:      r[25],
          viewsGained:    r[26],
          emailSent:      r[29],
          reportSent:     r[30],
        };
      });
    return { success: true, orders: orders };
  } catch(err) {
    return { success: false, message: err.message };
  }
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const payload = parseJsonBody_(e);
    if (action === 'createOrder')    return jsonResponse_(createOrder_(payload));
    if (action === 'verifyPayment')  return jsonResponse_(verifyPayment_(payload));
    if (action === 'updateStatus')   return jsonResponse_(updateStatusFromDashboard_(payload));
    return jsonResponse_({ success: false, message: 'Unknown action.' });
  } catch (err) {
    return jsonResponse_({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────
// ORDER CREATION
// ─────────────────────────────────────────────

function createOrder_(payload) {
  validateOrderPayload_(payload);
  const config = getConfig_();
  const publicOrderId = 'BK' + Date.now();
  const amountInPaise = Math.round(Number(payload.amount) * 100);

  const razorpayOrder = createRazorpayOrder_(config, {
    amount: amountInPaise,
    currency: 'INR',
    receipt: publicOrderId,
    notes: {
      public_order_id: publicOrderId,
      platform: payload.platform || '',
      objective: payload.objective || '',
      phone: payload.phone || ''
    }
  });

  upsertOrderRow_({
    orderId: publicOrderId,
    razorpayOrderId: razorpayOrder.id,
    razorpayPaymentId: '',
    razorpaySignature: '',
    timestamp: new Date().toISOString(),
    platform: payload.platform || '',
    service: payload.objective || '',
    quantity: payload.qty || '',
    duration: payload.duration || '',
    amount: Number(payload.amount) || 0,
    name: payload.name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    link: payload.link || '',
    paymentStatus: 'Created',
    verificationStatus: 'Pending',
    campaignStatus: 'Not Started',
    campaignId: '',
    notes: payload.unit || ''
  });

  return {
    success: true,
    publicOrderId,
    razorpayOrderId: razorpayOrder.id,
    amount: amountInPaise,
    currency: razorpayOrder.currency || 'INR'
  };
}

// ─────────────────────────────────────────────
// PAYMENT VERIFICATION
// ─────────────────────────────────────────────

function verifyPayment_(payload) {
  const config = getConfig_();
  validateVerificationPayload_(payload);

  const row = findOrderRow_(payload.orderId);
  if (!row) throw new Error('Order not found.');

  const verified = verifySignature_(
    row.razorpayOrderId,
    payload.razorpayPaymentId,
    payload.razorpaySignature,
    config.razorpayKeySecret
  );

  updateOrderVerification_(row.rowNumber, {
    razorpayPaymentId: payload.razorpayPaymentId,
    razorpaySignature: payload.razorpaySignature,
    paymentStatus: verified ? 'Paid' : 'Verification Failed',
    verificationStatus: verified ? 'Verified' : 'Failed'
  });

  if (verified) {
    // Fetch pre-campaign views
    const preViews = fetchPreCampaignViews_(row.link, row.platform);
    if (preViews !== null) {
      const sheet = getOrdersSheet_();
      sheet.getRange(row.rowNumber, 17).setValue(preViews);
    }

    sendConfirmationEmail_({
      orderId: payload.orderId,
      platform: row.platform,
      qty: row.quantity,
      unit: row.notes,
      duration: row.duration,
      amount: row.amount,
      adBudget: Math.round(Number(row.amount) * AD_BUDGET_RATIO),
      email: row.email,
      phone: row.phone,
      link: row.link,
      preViews: preViews,
      razorpayPaymentId: payload.razorpayPaymentId
    }, config);
    markNotificationSent_(row.rowNumber, 'email');

    // Auto-launch ad campaign
    try {
      const adBudget = Math.round(Number(row.amount) * AD_BUDGET_RATIO);
      const campaignResult = launchCampaign_({
        orderId: payload.orderId,
        platform: row.platform,
        objective: row.service,
        link: row.link,
        duration: row.duration,
        amount: Number(row.amount),
        adBudget: adBudget
      }, config);
      updateCampaignStatus_(row.rowNumber, 'Launched', campaignResult.campaignId || '');
    } catch (campaignErr) {
      updateCampaignStatus_(row.rowNumber, 'Campaign Error: ' + campaignErr.message, '');
    }
  }

  return { success: true, verified, orderId: payload.orderId };
}

// ─────────────────────────────────────────────
// CAMPAIGN LAUNCHER — routes to Meta or Google
// ─────────────────────────────────────────────

function launchCampaign_(data, config) {
  if (data.platform === 'youtube') {
    return createGoogleAdsCampaign_(data, config);
  }
  return createMetaCampaign_(data, config);
}

// ─────────────────────────────────────────────
// META ADS — Instagram & Facebook
// ─────────────────────────────────────────────

function createMetaCampaign_(data, config) {
  const token = config.metaAccessToken;
  const adAccountId = config.metaAdAccountId; // act_XXXXXXXXX
  const pageId = config.metaPageId;
  const base = 'https://graph.facebook.com/v19.0';

  const durationDays = parseDurationDays_(data.duration);
  const dailyBudgetPaise = Math.round((data.adBudget / durationDays) * 100);

  // 1. Campaign
  const campaign = metaPost_(base + '/' + adAccountId + '/campaigns', {
    name: 'BoostKaro-' + data.orderId,
    objective: 'VIDEO_VIEWS',
    status: 'ACTIVE',
    special_ad_categories: '[]',
    access_token: token
  });

  // 2. Ad Set
  const nowSec = Math.floor(Date.now() / 1000);
  const endSec = nowSec + durationDays * 86400;

  const targeting = {
    geo_locations: { countries: ['IN'] },
    age_min: 18,
    age_max: 55,
    publisher_platforms: data.platform === 'instagram' ? ['instagram'] : ['facebook'],
    facebook_positions: data.platform === 'instagram' ? [] : ['feed', 'video_feeds'],
    instagram_positions: data.platform === 'instagram' ? ['reels', 'stream'] : []
  };

  const adSet = metaPost_(base + '/' + adAccountId + '/adsets', {
    name: 'AdSet-' + data.orderId,
    campaign_id: campaign.id,
    billing_event: 'THRUPLAY',
    optimization_goal: 'THRUPLAY',
    daily_budget: dailyBudgetPaise,
    targeting: JSON.stringify(targeting),
    start_time: nowSec,
    end_time: endSec,
    status: 'ACTIVE',
    access_token: token
  });

  // 3. Ad Creative — link to the reel
  const creative = metaPost_(base + '/' + adAccountId + '/adcreatives', {
    name: 'Creative-' + data.orderId,
    object_story_spec: JSON.stringify({
      page_id: pageId,
      link_data: {
        link: data.link,
        message: 'Ye video dekho! 👇',
        call_to_action: { type: 'WATCH_VIDEO', value: { link: data.link } }
      }
    }),
    access_token: token
  });

  // 4. Ad
  const ad = metaPost_(base + '/' + adAccountId + '/ads', {
    name: 'Ad-' + data.orderId,
    adset_id: adSet.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: 'ACTIVE',
    access_token: token
  });

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    adId: ad.id
  };
}

function metaPost_(url, params) {
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: params,
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = JSON.parse(response.getContentText());
  if (code < 200 || code >= 300 || body.error) {
    throw new Error('Meta API error: ' + (body.error ? body.error.message : 'Unknown'));
  }
  return body;
}

// ─────────────────────────────────────────────
// GOOGLE ADS — YouTube
// ─────────────────────────────────────────────

function createGoogleAdsCampaign_(data, config) {
  const accessToken = getGoogleAccessToken_(config);
  const customerId = config.googleAdsCustomerId;
  const devToken = config.googleAdsDeveloperToken;
  const durationDays = parseDurationDays_(data.duration);
  const dailyBudgetMicros = Math.round((data.adBudget / durationDays) * 1000000);

  const headers = {
    'Authorization': 'Bearer ' + accessToken,
    'developer-token': devToken,
    'Content-Type': 'application/json'
  };
  const base = 'https://googleads.googleapis.com/v18/customers/' + customerId;

  // 1. Campaign Budget
  const budgetRes = googleAdsPost_(base + '/campaignBudgets:mutate', {
    operations: [{
      create: {
        name: 'Budget-' + data.orderId,
        amountMicros: String(dailyBudgetMicros),
        deliveryMethod: 'STANDARD'
      }
    }]
  }, headers);
  const budgetName = budgetRes.results[0].resourceName;

  // 2. Campaign
  const now = new Date();
  const endDate = new Date(now.getTime() + durationDays * 86400000);

  const campaignRes = googleAdsPost_(base + '/campaigns:mutate', {
    operations: [{
      create: {
        name: 'BoostKaro-' + data.orderId,
        advertisingChannelType: 'VIDEO',
        status: 'ENABLED',
        campaignBudget: budgetName,
        startDate: formatGoogleDate_(now),
        endDate: formatGoogleDate_(endDate),
        maximizeConversions: {},
        videoBrandSafetySuitability: 'EXPANDED_INVENTORY'
      }
    }]
  }, headers);
  const campaignName = campaignRes.results[0].resourceName;

  // 3. Ad Group
  const adGroupRes = googleAdsPost_(base + '/adGroups:mutate', {
    operations: [{
      create: {
        name: 'AdGroup-' + data.orderId,
        campaign: campaignName,
        status: 'ENABLED'
      }
    }]
  }, headers);
  const adGroupName = adGroupRes.results[0].resourceName;

  // 4. Video Ad (In-Stream)
  const videoId = extractYouTubeVideoId_(data.link);
  googleAdsPost_(base + '/adGroupAds:mutate', {
    operations: [{
      create: {
        adGroup: adGroupName,
        status: 'ENABLED',
        ad: {
          finalUrls: [data.link],
          videoAd: {
            video: { resourceName: 'customers/' + customerId + '/videos/' + videoId },
            inStream: {
              actionButtonLabel: 'Dekho',
              actionHeadline: 'BoostKaro'
            }
          }
        }
      }
    }]
  }, headers);

  // 5. Targeting — India only
  googleAdsPost_(base + '/campaignCriteria:mutate', {
    operations: [{
      create: {
        campaign: campaignName,
        location: { geoTargetConstant: 'geoTargetConstants/2356' } // India
      }
    }]
  }, headers);

  return { campaignId: campaignName };
}

function googleAdsPost_(url, body, headers) {
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const result = JSON.parse(response.getContentText());
  if (code < 200 || code >= 300) {
    throw new Error('Google Ads API error (' + code + '): ' + JSON.stringify(result));
  }
  return result;
}

function getGoogleAccessToken_(config) {
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      client_id: config.googleAdsClientId,
      client_secret: config.googleAdsClientSecret,
      refresh_token: config.googleAdsRefreshToken,
      grant_type: 'refresh_token'
    },
    muteHttpExceptions: true
  });
  const data = JSON.parse(response.getContentText());
  if (!data.access_token) throw new Error('Google OAuth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// ─────────────────────────────────────────────
// RAZORPAY
// ─────────────────────────────────────────────

function createRazorpayOrder_(config, payload) {
  const response = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(config.razorpayKeyId + ':' + config.razorpayKeySecret) },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = JSON.parse(response.getContentText());
  if (code < 200 || code >= 300) {
    throw new Error(body.error && body.error.description ? body.error.description : 'Razorpay order creation failed.');
  }
  return body;
}

function verifySignature_(razorpayOrderId, paymentId, signature, secret) {
  const raw = Utilities.computeHmacSha256Signature(razorpayOrderId + '|' + paymentId, secret);
  const generated = raw.map(function (b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
  return generated === signature;
}

// ─────────────────────────────────────────────
// GOOGLE SHEET HELPERS
// ─────────────────────────────────────────────

function getOrdersSheet_() {
  const config = getConfig_();
  const ss = SpreadsheetApp.openById(config.sheetId);
  let sheet = ss.getSheetByName(DEFAULT_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(DEFAULT_SHEET_NAME);
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const headers = [[
    // Order Info
    'Order ID', 'Razorpay Order ID', 'Razorpay Payment ID', 'Razorpay Signature',
    'Created At',
    // Campaign Details
    'Platform', 'Service', 'Plan (Views)', 'Duration',
    // Money
    'Amount (₹)', 'Ad Budget (₹)', 'Profit (₹)', 'Razorpay Fee (₹)',
    // Customer
    'Customer Name', 'Email', 'Phone', 'Video/Profile Link',
    // Pre-Campaign
    'Pre-Campaign Views', 'Pre-Campaign Followers',
    // Payment
    'Payment Status', 'Verification Status',
    // Campaign Execution
    'Campaign Status', 'Campaign ID', 'Campaign Start', 'Campaign End',
    // Post-Campaign Results
    'Post-Campaign Views', 'Views Gained', 'Post-Campaign Followers', 'Followers Gained',
    // Notifications
    'Confirmation Email Sent', 'Final Report Sent', 'WhatsApp Notified',
    // Admin
    'Refund Status', 'Notes',
    // Quick Action
    'WhatsApp Link'
  ]];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.setFrozenRows(1);
    applySheetDropdowns_(sheet);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers[0].length).getValues()[0];
  if (headers[0].some(function (h, i) { return current[i] !== h; })) {
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  }
  applySheetDropdowns_(sheet);
}

function applySheetDropdowns_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 100);

  // Col 21: Campaign Status
  const campaignRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Not Started', 'Launched', 'Completed', 'Campaign Error', 'Refunded'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 21, lastRow, 1).setDataValidation(campaignRule);

  // Col 20: Verification Status
  const verifyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Verified', 'Failed'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 20, lastRow, 1).setDataValidation(verifyRule);

  // Col 19: Payment Status
  const payRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Created', 'Paid', 'Verification Failed', 'Refunded'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 19, lastRow, 1).setDataValidation(payRule);

  // Col 32: Refund Status
  const refundRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['', 'Requested', 'Processing', 'Done'], true)
    .setAllowInvalid(false).build();
  sheet.getRange(2, 32, lastRow, 1).setDataValidation(refundRule);
}

// Run this once manually to apply dropdowns to existing sheet
function setupSheetDropdowns() {
  const sheet = getOrdersSheet_();
  applySheetDropdowns_(sheet);
  Logger.log('Dropdowns applied!');
}

function upsertOrderRow_(data) {
  const sheet = getOrdersSheet_();
  const existing = findOrderRow_(data.orderId);
  const amount = Number(data.amount) || 0;
  const adBudget = Math.round(amount * AD_BUDGET_RATIO);
  const razorpayFee = Math.round(amount * 0.02);
  const profit = amount - adBudget - razorpayFee;
  const row = [
    data.orderId, data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature,
    data.timestamp,
    data.platform, data.service, data.quantity, data.duration,
    amount, adBudget, profit, razorpayFee,
    data.name || '', data.email, data.phone, data.link,
    data.preViews || '', data.preFollowers || '',
    data.paymentStatus, data.verificationStatus,
    data.campaignStatus, data.campaignId || '', data.campaignStart || '', data.campaignEnd || '',
    data.postViews || '', data.viewsGained || '', data.postFollowers || '', data.followersGained || '',
    data.confirmEmailSent || 'No', data.finalReportSent || 'No', data.whatsappNotified || 'No',
    data.refundStatus || '', data.notes || ''
  ];
  if (existing) {
    sheet.getRange(existing.rowNumber, 1, 1, row.length).setValues([row]);
    addWhatsAppFormula_(sheet, existing.rowNumber, data);
    return existing.rowNumber;
  }
  sheet.appendRow(row);
  const newRow = sheet.getLastRow();
  addWhatsAppFormula_(sheet, newRow, data);
  return newRow;
}

function addWhatsAppFormula_(sheet, rowNumber, data) {
  const phone = String(data.phone || '').replace(/\D/g, '');
  if (!phone) return;
  const msg = encodeURIComponent(
    'Namaskar ' + (data.name || '') + '! Aapka BoostKaro Order #' + data.orderId +
    ' confirm ho gaya hai. Campaign jald shuru hoga. Koi sawaal ho to batayein. 🚀'
  );
  const url = 'https://wa.me/' + phone + '?text=' + msg;
  sheet.getRange(rowNumber, 35).setFormula('=HYPERLINK("' + url + '","📱 WhatsApp Bhejo")');
}

function updateOrderVerification_(rowNumber, values) {
  const sheet = getOrdersSheet_();
  sheet.getRange(rowNumber, 3).setValue(values.razorpayPaymentId || '');
  sheet.getRange(rowNumber, 4).setValue(values.razorpaySignature || '');
  sheet.getRange(rowNumber, 19).setValue(values.paymentStatus || '');
  sheet.getRange(rowNumber, 20).setValue(values.verificationStatus || '');
}

function updateStatusFromDashboard_(payload) {
  if (!payload || !payload.orderId || !payload.status) throw new Error('Missing orderId or status.');
  const row = findOrderRow_(payload.orderId);
  if (!row) throw new Error('Order not found: ' + payload.orderId);
  const config = getConfig_();

  updateCampaignStatus_(row.rowNumber, payload.status, payload.campaignId || '');

  if (payload.status === 'Launched') {
    sendCampaignStartedEmail_(row, config);
    markNotificationSent_(row.rowNumber, 'email');
  }
  if (payload.status === 'Completed') {
    if (payload.postViews) {
      updatePostCampaignData_(row.rowNumber, Number(payload.postViews), 0);
    }
    sendFinalReportEmail_(row, config);
    markNotificationSent_(row.rowNumber, 'report');
  }
  return { success: true };
}

function updateCampaignStatus_(rowNumber, status, campaignId) {
  const sheet = getOrdersSheet_();
  const now = new Date().toISOString();
  sheet.getRange(rowNumber, 21).setValue(status);
  sheet.getRange(rowNumber, 22).setValue(campaignId || '');
  if (status === 'Launched') sheet.getRange(rowNumber, 23).setValue(now);
}

function updatePostCampaignData_(rowNumber, postViews, postFollowers) {
  const sheet = getOrdersSheet_();
  const row = sheet.getRange(rowNumber, 1, 1, 33).getValues()[0];
  const preViews = Number(row[16]) || 0;
  const preFollowers = Number(row[17]) || 0;
  sheet.getRange(rowNumber, 24).setValue(new Date().toISOString()); // Campaign End
  sheet.getRange(rowNumber, 25).setValue(postViews);
  sheet.getRange(rowNumber, 26).setValue(postViews - preViews);
  sheet.getRange(rowNumber, 27).setValue(postFollowers);
  sheet.getRange(rowNumber, 28).setValue(postFollowers - preFollowers);
  sheet.getRange(rowNumber, 21).setValue('Completed');
}

function markNotificationSent_(rowNumber, type) {
  const sheet = getOrdersSheet_();
  if (type === 'email')     sheet.getRange(rowNumber, 29).setValue('Yes');
  if (type === 'report')    sheet.getRange(rowNumber, 30).setValue('Yes');
  if (type === 'whatsapp')  sheet.getRange(rowNumber, 31).setValue('Yes');
}

function findOrderRow_(publicOrderId) {
  const sheet = getOrdersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 33).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] !== publicOrderId) continue;
    return {
      rowNumber: i + 2,
      orderId: values[i][0],
      razorpayOrderId: values[i][1],
      razorpayPaymentId: values[i][2],
      razorpaySignature: values[i][3],
      timestamp: values[i][4],
      platform: values[i][5],
      service: values[i][6],
      quantity: values[i][7],
      duration: values[i][8],
      amount: values[i][9],
      adBudget: values[i][10],
      profit: values[i][11],
      razorpayFee: values[i][12],
      email: values[i][13],
      phone: values[i][14],
      link: values[i][15],
      preViews: values[i][16],
      preFollowers: values[i][17],
      paymentStatus: values[i][18],
      verificationStatus: values[i][19],
      campaignStatus: values[i][20],
      campaignId: values[i][21],
      campaignStart: values[i][22],
      campaignEnd: values[i][23],
      postViews: values[i][24],
      viewsGained: values[i][25],
      postFollowers: values[i][26],
      followersGained: values[i][27],
      confirmEmailSent: values[i][28],
      finalReportSent: values[i][29],
      whatsappNotified: values[i][30],
      refundStatus: values[i][31],
      notes: values[i][32]
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────

function sendConfirmationEmail_(data, config) {
  if (!data.email) return;
  const subject = '✅ Order Confirmed — BoostKaro #' + data.orderId;
  const amount = '₹' + Number(data.amount || 0).toLocaleString('en-IN');
  const adBudget = '₹' + Number(data.adBudget || 0).toLocaleString('en-IN');
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">',
    '<div style="background:linear-gradient(135deg,#f97316,#ec4899);padding:28px;border-radius:14px 14px 0 0;color:#fff;text-align:center;">',
    '<h1 style="margin:0;font-size:28px;">⚡ BoostKaro</h1>',
    '<p style="margin:8px 0 0;font-size:16px;opacity:0.95;">🎉 Aapka Order Confirm Ho Gaya!</p>',
    '</div>',
    '<div style="border:1px solid #ffe8d6;border-top:none;padding:28px;border-radius:0 0 14px 14px;background:#fff;">',
    '<p style="color:#7a4f2d;font-size:15px;margin-bottom:20px;">Namaskar! Aapka campaign shuru ho raha hai. Neeche aapke order ki details hain:</p>',
    '<table style="width:100%;border-collapse:collapse;">',
    buildEmailRow_('Order ID', data.orderId),
    buildEmailRow_('Platform', data.platform ? data.platform.charAt(0).toUpperCase() + data.platform.slice(1) : ''),
    buildEmailRow_('Service', (data.qty || '') + ' ' + (data.unit || '')),
    buildEmailRow_('Duration', data.duration || ''),
    buildEmailRow_('Amount Paid', amount),
    buildEmailRow_('Ad Budget', adBudget),
    buildEmailRow_('Video/Profile Link', data.link || ''),
    data.preViews ? buildEmailRow_('Current Views (Before)', String(data.preViews)) : '',
    buildEmailRow_('Payment ID', data.razorpayPaymentId || ''),
    '</table>',
    '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin-top:20px;">',
    '<p style="margin:0;color:#166534;font-weight:700;">🚀 Campaign tatkal live ho raha hai!</p>',
    '<p style="margin:6px 0 0;color:#166534;font-size:13px;">Campaign khatam hone par aapko final report email aur WhatsApp par milegi.</p>',
    '</div>',
    '<p style="color:#a8784a;font-size:13px;margin-top:20px;">Koi sawaal ho to WhatsApp karo: <strong>+91 7054411333</strong></p>',
    '</div></div>'
  ].join('');
  GmailApp.sendEmail(data.email, subject, 'Order confirmed: ' + data.orderId, { htmlBody: html });
}

function sendCampaignStartedEmail_(data, config) {
  if (!data.email) return;
  const subject = '🚀 Aapka Campaign Live Ho Gaya! — BoostKaro #' + data.orderId;
  const name = data.name ? data.name.split(' ')[0] : 'Aap';
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">',
    '<div style="background:linear-gradient(135deg,#f97316,#ec4899);padding:28px;border-radius:14px 14px 0 0;color:#fff;text-align:center;">',
    '<h1 style="margin:0;font-size:28px;">⚡ BoostKaro</h1>',
    '<p style="margin:8px 0 0;font-size:16px;">🚀 Campaign Live Ho Gaya!</p>',
    '</div>',
    '<div style="border:1px solid #ffe8d6;border-top:none;padding:28px;border-radius:0 0 14px 14px;background:#fff;">',
    '<p style="color:#7a4f2d;font-size:15px;">Namaskar <strong>' + escapeHtml_(name) + '</strong>!</p>',
    '<p style="color:#7a4f2d;font-size:15px;margin-top:8px;">Aapka ad campaign abhi LIVE ho gaya hai. Views aane shuru ho jayenge!</p>',
    '<table style="width:100%;border-collapse:collapse;margin-top:16px;">',
    buildEmailRow_('Order ID', data.orderId),
    buildEmailRow_('Platform', data.platform || ''),
    buildEmailRow_('Views Before', String(data.preViews || 0)),
    buildEmailRow_('Campaign ID', data.campaignId || 'Processing'),
    buildEmailRow_('Video Link', data.link || ''),
    '</table>',
    '<div style="background:#fff9f5;border:1.5px solid #ffe8d6;border-radius:10px;padding:16px;margin-top:20px;">',
    '<p style="margin:0;color:#f97316;font-weight:700;">📊 Aage Kya Hoga?</p>',
    '<p style="margin:8px 0 0;color:#7a4f2d;font-size:13px;">Campaign khatam hone par aapko final report email par milegi — kitne views aaye, poori jankari ke saath.</p>',
    '</div>',
    '<p style="color:#a8784a;font-size:13px;margin-top:20px;">Koi sawaal? WhatsApp karo: <strong>+91 7054411333</strong></p>',
    '</div></div>'
  ].join('');
  GmailApp.sendEmail(data.email, subject, 'Campaign live: ' + data.orderId, { htmlBody: html });
}

function sendFinalReportEmail_(data, config) {
  if (!data.email) return;
  const subject = '📊 Campaign Report — BoostKaro #' + data.orderId;
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">',
    '<div style="background:linear-gradient(135deg,#f97316,#ec4899);padding:28px;border-radius:14px 14px 0 0;color:#fff;text-align:center;">',
    '<h1 style="margin:0;font-size:28px;">⚡ BoostKaro</h1>',
    '<p style="margin:8px 0 0;font-size:16px;opacity:0.95;">📊 Aapka Campaign Report</p>',
    '</div>',
    '<div style="border:1px solid #ffe8d6;border-top:none;padding:28px;border-radius:0 0 14px 14px;background:#fff;">',
    '<table style="width:100%;border-collapse:collapse;">',
    buildEmailRow_('Order ID', data.orderId),
    buildEmailRow_('Platform', data.platform || ''),
    buildEmailRow_('Views Before Campaign', String(data.preViews || 0)),
    buildEmailRow_('Views After Campaign', String(data.postViews || 0)),
    buildEmailRow_('Views Gained', '🎉 +' + String(data.viewsGained || 0)),
    buildEmailRow_('Campaign Duration', data.duration || ''),
    '</table>',
    '<p style="color:#a8784a;font-size:13px;margin-top:20px;">Dobara order karne ke liye: <a href="https://boostkaro.dataimpact.in">boostkaro.dataimpact.in</a></p>',
    '<p style="color:#a8784a;font-size:13px;">WhatsApp: <strong>+91 7054411333</strong></p>',
    '</div></div>'
  ].join('');
  GmailApp.sendEmail(data.email, subject, 'Campaign report: ' + data.orderId, { htmlBody: html });
}

function buildEmailRow_(label, value) {
  return '<tr><td style="padding:10px 12px;border-bottom:1px solid #ffe8d6;color:#a8784a;width:40%;">' +
    escapeHtml_(label) + '</td><td style="padding:10px 12px;border-bottom:1px solid #ffe8d6;color:#1a0a00;font-weight:700;">' +
    escapeHtml_(String(value || '-')) + '</td></tr>';
}

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const config = {
    sheetId:                  p.getProperty('SHEET_ID') || '',
    razorpayKeyId:            p.getProperty('RAZORPAY_KEY_ID') || '',
    razorpayKeySecret:        p.getProperty('RAZORPAY_KEY_SECRET') || '',
    metaAccessToken:          p.getProperty('META_ACCESS_TOKEN') || '',
    metaAdAccountId:          p.getProperty('META_AD_ACCOUNT_ID') || '',
    metaPageId:               p.getProperty('META_PAGE_ID') || '',
    googleAdsDeveloperToken:  p.getProperty('GOOGLE_ADS_DEVELOPER_TOKEN') || '',
    googleAdsCustomerId:      p.getProperty('GOOGLE_ADS_CUSTOMER_ID') || '',
    googleAdsClientId:        p.getProperty('GOOGLE_ADS_CLIENT_ID') || '',
    googleAdsClientSecret:    p.getProperty('GOOGLE_ADS_CLIENT_SECRET') || '',
    googleAdsRefreshToken:    p.getProperty('GOOGLE_ADS_REFRESH_TOKEN') || '',
    businessName:             p.getProperty('BUSINESS_NAME') || 'BoostKaro',
    siteUrl:                  p.getProperty('SITE_URL') || 'https://boostkaro.dataimpact.in/'
  };
  if (!config.sheetId)         throw new Error('SHEET_ID missing.');
  if (!config.razorpayKeyId)   throw new Error('RAZORPAY_KEY_ID missing.');
  if (!config.razorpayKeySecret) throw new Error('RAZORPAY_KEY_SECRET missing.');
  return config;
}

// ─────────────────────────────────────────────
// PRE/POST CAMPAIGN VIEW FETCHING
// ─────────────────────────────────────────────

function fetchPreCampaignViews_(link, platform) {
  try {
    if (platform === 'youtube') {
      const videoId = extractYouTubeVideoId_(link);
      if (!videoId) return null;
      const p = PropertiesService.getScriptProperties();
      const apiKey = p.getProperty('YOUTUBE_API_KEY');
      if (!apiKey) return null;
      const url = 'https://www.googleapis.com/youtube/v3/videos?part=statistics&id=' + videoId + '&key=' + apiKey;
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      if (data.items && data.items.length > 0) {
        return Number(data.items[0].statistics.viewCount) || 0;
      }
    }
    // Instagram/Facebook: needs Meta Graph API — add later when META_ACCESS_TOKEN is set
    return null;
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function parseDurationDays_(durStr) {
  // e.g. "2-3 din" → 2.5, "7-10 din" → 8
  if (!durStr) return 3;
  const nums = durStr.match(/\d+/g);
  if (!nums || nums.length === 0) return 3;
  if (nums.length === 1) return Number(nums[0]);
  return Math.ceil((Number(nums[0]) + Number(nums[1])) / 2);
}

function extractYouTubeVideoId_(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0];
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2];
    if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
  } catch (e) {}
  return '';
}

function formatGoogleDate_(date) {
  return Utilities.formatDate(date, 'Asia/Kolkata', 'yyyyMMdd');
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function validateOrderPayload_(payload) {
  if (!payload) throw new Error('Missing request body.');
  if (!payload.amount || Number(payload.amount) <= 0) throw new Error('Invalid amount.');
  if (!payload.link) throw new Error('Missing link.');
}

function validateVerificationPayload_(payload) {
  if (!payload || !payload.orderId) throw new Error('Missing order ID.');
  if (!payload.razorpayPaymentId) throw new Error('Missing payment ID.');
  if (!payload.razorpaySignature) throw new Error('Missing signature.');
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
