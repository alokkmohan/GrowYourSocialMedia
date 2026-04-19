// BoostKaro - Google Apps Script backend
//
// Deploy this file as a Web App and store secrets in Script Properties:
// SHEET_ID
// RAZORPAY_KEY_ID
// RAZORPAY_KEY_SECRET
// BUSINESS_NAME (optional)
// SITE_URL (optional)

const DEFAULT_SHEET_NAME = 'Orders';

function doGet() {
  return jsonResponse_({
    success: true,
    service: 'boostkaro-payments',
    date: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';
    const payload = parseJsonBody_(e);

    if (action === 'createOrder') {
      return jsonResponse_(createOrder_(payload));
    }

    if (action === 'verifyPayment') {
      return jsonResponse_(verifyPayment_(payload));
    }

    return jsonResponse_({
      success: false,
      message: 'Unknown action.'
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error.message
    });
  }
}

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
      email: payload.email || '',
      phone: payload.phone || ''
    }
  });

  const rowData = {
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
    notes: payload.unit || ''
  };

  upsertOrderRow_(rowData);

  return {
    success: true,
    publicOrderId: publicOrderId,
    razorpayOrderId: razorpayOrder.id,
    amount: amountInPaise,
    currency: razorpayOrder.currency || 'INR'
  };
}

function verifyPayment_(payload) {
  const config = getConfig_();
  validateVerificationPayload_(payload);

  const row = findOrderRow_(payload.orderId);
  if (!row) {
    throw new Error('Order not found for verification.');
  }

  const savedOrderId = row.razorpayOrderId;
  if (!savedOrderId) {
    throw new Error('Missing Razorpay order ID on server.');
  }

  const providedOrderId = payload.razorpayOrderId || '';
  if (providedOrderId && providedOrderId !== savedOrderId) {
    throw new Error('Razorpay order ID mismatch.');
  }

  const verified = verifySignature_(
    savedOrderId,
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
  }

  return {
    success: true,
    verified: verified,
    orderId: payload.orderId
  };
}

function createRazorpayOrder_(config, payload) {
  const response = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(config.razorpayKeyId + ':' + config.razorpayKeySecret)
    },
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
  const signedPayload = razorpayOrderId + '|' + paymentId;
  const raw = Utilities.computeHmacSha256Signature(signedPayload, secret);
  const generatedSignature = raw.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');

  return generatedSignature === signature;
}

function upsertOrderRow_(data) {
  const sheet = getOrdersSheet_();
  const existing = findOrderRow_(data.orderId);

  if (existing) {
    sheet.getRange(existing.rowNumber, 1, 1, 16).setValues([[
      data.orderId,
      data.razorpayOrderId,
      data.razorpayPaymentId,
      data.razorpaySignature,
      data.timestamp,
      data.platform,
      data.service,
      data.quantity,
      data.duration,
      data.amount,
      data.email,
      data.phone,
      data.link,
      data.paymentStatus,
      data.verificationStatus,
      data.campaignStatus
    ]]);
    sheet.getRange(existing.rowNumber, 17).setValue(data.notes || '');
    return existing.rowNumber;
  }

  sheet.appendRow([
    data.orderId,
    data.razorpayOrderId,
    data.razorpayPaymentId,
    data.razorpaySignature,
    data.timestamp,
    data.platform,
    data.service,
    data.quantity,
    data.duration,
    data.amount,
    data.email,
    data.phone,
    data.link,
    data.paymentStatus,
    data.verificationStatus,
    data.campaignStatus,
    data.notes || ''
  ]);

  return sheet.getLastRow();
}

function updateOrderVerification_(rowNumber, values) {
  const sheet = getOrdersSheet_();
  sheet.getRange(rowNumber, 3).setValue(values.razorpayPaymentId || '');
  sheet.getRange(rowNumber, 4).setValue(values.razorpaySignature || '');
  sheet.getRange(rowNumber, 14).setValue(values.paymentStatus || '');
  sheet.getRange(rowNumber, 15).setValue(values.verificationStatus || '');
}

function findOrderRow_(publicOrderId) {
  const sheet = getOrdersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
  for (let i = 0; i < values.length; i++) {
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
      email: values[i][10],
      phone: values[i][11],
      link: values[i][12],
      paymentStatus: values[i][13],
      verificationStatus: values[i][14],
      campaignStatus: values[i][15],
      notes: values[i][16]
    };
  }

  return null;
}

function getOrdersSheet_() {
  const config = getConfig_();
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  let sheet = spreadsheet.getSheetByName(DEFAULT_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(DEFAULT_SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const headers = [[
    'Order ID',
    'Razorpay Order ID',
    'Razorpay Payment ID',
    'Razorpay Signature',
    'Created At',
    'Platform',
    'Service',
    'Quantity',
    'Duration',
    'Amount',
    'Email',
    'Phone',
    'Link',
    'Payment Status',
    'Verification Status',
    'Campaign Status',
    'Notes'
  ]];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers[0].length).getValues()[0];
  const mismatch = headers[0].some(function (header, index) {
    return currentHeaders[index] !== header;
  });

  if (mismatch) {
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  }
}

function sendConfirmationEmail_(data, config) {
  if (!data.email) return;

  const subject = 'Order Confirmed - ' + data.orderId;
  const amount = 'Rs ' + Number(data.amount || 0).toLocaleString('en-IN');
  const htmlBody = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">',
    '<div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px 28px;border-radius:14px 14px 0 0;color:#fff;">',
    '<h1 style="margin:0;font-size:28px;">' + escapeHtml_(config.businessName) + '</h1>',
    '<p style="margin:8px 0 0;opacity:0.9;">Your payment has been verified successfully.</p>',
    '</div>',
    '<div style="border:1px solid #e2e8f0;border-top:none;padding:24px 28px;border-radius:0 0 14px 14px;background:#fff;">',
    '<p style="margin-top:0;color:#334155;">We have received your order and will start processing it within 24 hours.</p>',
    '<table style="width:100%;border-collapse:collapse;">',
    buildEmailRow_('Order ID', data.orderId),
    buildEmailRow_('Platform', data.platform),
    buildEmailRow_('Service', (data.qty || '') + ' ' + (data.unit || '')),
    buildEmailRow_('Duration', data.duration || ''),
    buildEmailRow_('Amount', amount),
    buildEmailRow_('Payment ID', data.razorpayPaymentId || ''),
    '</table>',
    '<p style="color:#64748b;font-size:14px;margin-bottom:0;">Website: <a href="' + escapeHtml_(config.siteUrl) + '">' + escapeHtml_(config.siteUrl) + '</a></p>',
    '</div>',
    '</div>'
  ].join('');

  GmailApp.sendEmail(data.email, subject, 'Order confirmed: ' + data.orderId, {
    htmlBody: htmlBody
  });
}

function buildEmailRow_(label, value) {
  return [
    '<tr>',
    '<td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;width:40%;">' + escapeHtml_(label) + '</td>',
    '<td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;">' + escapeHtml_(String(value || '-')) + '</td>',
    '</tr>'
  ].join('');
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
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

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    sheetId: props.getProperty('SHEET_ID') || '',
    razorpayKeyId: props.getProperty('RAZORPAY_KEY_ID') || '',
    razorpayKeySecret: props.getProperty('RAZORPAY_KEY_SECRET') || '',
    businessName: props.getProperty('BUSINESS_NAME') || 'BoostKaro',
    siteUrl: props.getProperty('SITE_URL') || 'https://boostkaro.dataimpact.in/'
  };

  if (!config.sheetId) throw new Error('SHEET_ID is missing in Script Properties.');
  if (!config.razorpayKeyId) throw new Error('RAZORPAY_KEY_ID is missing in Script Properties.');
  if (!config.razorpayKeySecret) throw new Error('RAZORPAY_KEY_SECRET is missing in Script Properties.');

  return config;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
