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
// ENTRY POINTS
// ─────────────────────────────────────────────

function doGet() {
  return jsonResponse_({ success: true, service: 'boostkaro-payments', date: new Date().toISOString() });
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const payload = parseJsonBody_(e);
    if (action === 'createOrder')   return jsonResponse_(createOrder_(payload));
    if (action === 'verifyPayment') return jsonResponse_(verifyPayment_(payload));
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
    sendConfirmationEmail_({
      orderId: payload.orderId,
      platform: row.platform,
      qty: row.quantity,
      unit: row.notes,
      duration: row.duration,
      amount: row.amount,
      email: row.email,
      phone: row.phone,
      link: row.link,
      razorpayPaymentId: payload.razorpayPaymentId
    }, config);

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

      updateCampaignStatus_(row.rowNumber, 'Running', campaignResult.campaignId || '');
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
  const base = 'https://googleads.googleapis.com/v16/customers/' + customerId;

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
    'Order ID', 'Razorpay Order ID', 'Razorpay Payment ID', 'Razorpay Signature',
    'Created At', 'Platform', 'Service', 'Quantity', 'Duration', 'Amount',
    'Email', 'Phone', 'Link', 'Payment Status', 'Verification Status',
    'Campaign Status', 'Campaign ID', 'Notes'
  ]];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers[0].length).getValues()[0];
  if (headers[0].some(function (h, i) { return current[i] !== h; })) {
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  }
}

function upsertOrderRow_(data) {
  const sheet = getOrdersSheet_();
  const existing = findOrderRow_(data.orderId);
  const row = [
    data.orderId, data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature,
    data.timestamp, data.platform, data.service, data.quantity, data.duration, data.amount,
    data.email, data.phone, data.link, data.paymentStatus, data.verificationStatus,
    data.campaignStatus, data.campaignId || '', data.notes || ''
  ];
  if (existing) {
    sheet.getRange(existing.rowNumber, 1, 1, row.length).setValues([row]);
    return existing.rowNumber;
  }
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateOrderVerification_(rowNumber, values) {
  const sheet = getOrdersSheet_();
  sheet.getRange(rowNumber, 3).setValue(values.razorpayPaymentId || '');
  sheet.getRange(rowNumber, 4).setValue(values.razorpaySignature || '');
  sheet.getRange(rowNumber, 14).setValue(values.paymentStatus || '');
  sheet.getRange(rowNumber, 15).setValue(values.verificationStatus || '');
}

function updateCampaignStatus_(rowNumber, status, campaignId) {
  const sheet = getOrdersSheet_();
  sheet.getRange(rowNumber, 16).setValue(status);
  sheet.getRange(rowNumber, 17).setValue(campaignId || '');
}

function findOrderRow_(publicOrderId) {
  const sheet = getOrdersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] !== publicOrderId) continue;
    return {
      rowNumber: i + 2,
      orderId: values[i][0],
      razorpayOrderId: values[i][1],
      razorpayPaymentId: values[i][2],
      razorpaySignature: values[i][3],
      platform: values[i][5],
      service: values[i][6],
      quantity: values[i][7],
      duration: values[i][8],
      amount: values[i][9],
      email: values[i][10],
      phone: values[i][11],
      link: values[i][12],
      paymentStatus: values[i][13],
      verificationStatus: values[i][14],
      campaignStatus: values[i][15],
      campaignId: values[i][16],
      notes: values[i][17]
    };
  }
  return null;
}

// ─────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────

function sendConfirmationEmail_(data, config) {
  if (!data.email) return;
  const subject = 'Order Confirmed — ' + data.orderId;
  const amount = '₹' + Number(data.amount || 0).toLocaleString('en-IN');
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">',
    '<div style="background:linear-gradient(135deg,#f97316,#ec4899);padding:24px 28px;border-radius:14px 14px 0 0;color:#fff;">',
    '<h1 style="margin:0;font-size:26px;">' + escapeHtml_(config.businessName) + '</h1>',
    '<p style="margin:8px 0 0;opacity:0.9;">Payment successfully received!</p>',
    '</div>',
    '<div style="border:1px solid #ffe8d6;border-top:none;padding:24px 28px;border-radius:0 0 14px 14px;background:#fff;">',
    '<p style="color:#7a4f2d;">Aapka order receive ho gaya. Campaign tatkal shuru ho raha hai.</p>',
    '<table style="width:100%;border-collapse:collapse;">',
    buildEmailRow_('Order ID', data.orderId),
    buildEmailRow_('Platform', data.platform),
    buildEmailRow_('Service', (data.qty || '') + ' ' + (data.unit || '')),
    buildEmailRow_('Duration', data.duration || ''),
    buildEmailRow_('Amount', amount),
    buildEmailRow_('Payment ID', data.razorpayPaymentId || ''),
    '</table>',
    '<p style="color:#a8784a;font-size:13px;margin-top:16px;">Koi sawaal ho to WhatsApp karo: +91 7054411333</p>',
    '</div></div>'
  ].join('');
  GmailApp.sendEmail(data.email, subject, 'Order confirmed: ' + data.orderId, { htmlBody: html });
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
