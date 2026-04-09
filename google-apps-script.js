// =============================================
// BoostKaro — Google Apps Script
// =============================================

const SHEET_ID        = 'APNI_SHEET_ID_YAHAN_DAALO';
const SHEET_NAME      = 'Orders';
const BUSINESS_NAME   = 'BoostKaro';
const SITE_URL        = 'https://alokkmohan.github.io/GrowYourSocialMedia/';

// ⚠️ YouTube Data API Key (free mein milti hai Google Cloud Console se)
// https://console.cloud.google.com → Enable "YouTube Data API v3" → Create API Key
const YOUTUBE_API_KEY = 'APNI_YOUTUBE_API_KEY_YAHAN_DAALO';

// =============================================
// MAIN — POST webhook receive karo
// =============================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // YouTube ke liye views before capture karo
    if (data.platform === 'youtube') {
      data.viewsBefore = getYouTubeViews(data.link);
    } else {
      // Instagram/Facebook — admin manually bharega
      data.viewsBefore = 'Manual (check before starting)';
    }

    recordOrder(data);
    sendConfirmationEmail(data);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================
// YOUTUBE VIEW COUNT FETCH KARO
// =============================================
function getYouTubeViews(url) {
  try {
    const videoId = extractYouTubeId(url);
    if (!videoId) return 'Could not extract video ID';

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=statistics&key=${YOUTUBE_API_KEY}`;
    const response = UrlFetchApp.fetch(apiUrl);
    const json = JSON.parse(response.getContentText());

    if (json.items && json.items.length > 0) {
      return parseInt(json.items[0].statistics.viewCount);
    }
    return 'Video not found / Private';

  } catch (err) {
    return 'Fetch error: ' + err.message;
  }
}

// YouTube URL se Video ID extract karo
// Handles: watch?v=, /shorts/, youtu.be/
function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtube\.com\/shorts\/([^?&\s]+)/,
    /youtu\.be\/([^?&\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// =============================================
// GOOGLE SHEET MEIN ORDER RECORD KARO
// =============================================
function recordOrder(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'Order ID', 'Timestamp', 'Platform', 'Objective', 'Qty', 'Unit',
      'Duration', 'Amount (₹)', 'Razorpay Payment ID',
      'Email', 'Phone', 'Link',
      'Views Before', 'Views After', 'Views Gained',
      'Campaign Status', 'Notes'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#7c3aed').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    data.orderId              || '',
    new Date(data.timestamp)  || new Date(),
    data.platform             || '',
    data.objective            || '',
    data.qty                  || '',
    data.unit                 || '',
    data.duration             || '',
    data.amount               || '',
    data.razorpayPaymentId    || '',
    data.email                || '',
    data.phone                || '',
    data.link                 || '',
    data.viewsBefore          || '',  // Auto (YouTube) ya Manual (IG/FB)
    '',                               // Views After  — campaign end par bharega
    '',                               // Views Gained — auto calculate hoga
    'Not Started',                    // Campaign Status
    ''                                // Notes
  ]);
}

// =============================================
// CAMPAIGN END — Views After update karo
// Admin Google Sheet se Order ID copy karke
// yahan paste kare aur ye function chalaye
// =============================================
function updateViewsAfter(orderId) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== orderId) continue;

    const platform    = data[i][2];
    const link        = data[i][11];
    const viewsBefore = data[i][12];
    let   viewsAfter  = '';

    if (platform === 'youtube') {
      viewsAfter = getYouTubeViews(link);
    } else {
      // Instagram/Facebook — admin manually enter karega
      // Yahan se directly sheet update karo
      Logger.log('Instagram/Facebook: Please manually enter Views After in the sheet.');
      return;
    }

    const viewsGained = (typeof viewsBefore === 'number' && typeof viewsAfter === 'number')
      ? viewsAfter - viewsBefore
      : 'N/A';

    const rowNum = i + 1;
    sheet.getRange(rowNum, 14).setValue(viewsAfter);   // Views After
    sheet.getRange(rowNum, 15).setValue(viewsGained);  // Views Gained
    sheet.getRange(rowNum, 16).setValue('Completed');  // Campaign Status

    // Completion email bhejo
    sendCompletionEmail(data[i], viewsBefore, viewsAfter, viewsGained);

    Logger.log(`Updated Order ${orderId}: Before=${viewsBefore}, After=${viewsAfter}, Gained=${viewsGained}`);
    return;
  }

  Logger.log('Order not found: ' + orderId);
}

// =============================================
// CONFIRMATION EMAIL (Order ke baad)
// =============================================
function sendConfirmationEmail(data) {
  if (!data.email) return;

  const platformNames = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  const platform = platformNames[data.platform] || data.platform;
  const amount   = '₹' + Number(data.amount).toLocaleString('en-IN');

  const viewsBeforeRow = (data.platform === 'youtube' && typeof data.viewsBefore === 'number')
    ? `<tr style="background:#fff; border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 14px; color:#6b7280;">Views Before Campaign</td>
        <td style="padding:10px 14px; color:#111827; font-weight:600;">${data.viewsBefore.toLocaleString('en-IN')}</td>
       </tr>`
    : '';

  const subject  = `✅ Order Confirmed — ${data.orderId}`;
  const htmlBody = `
    <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto;">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5); padding:28px 32px; border-radius:12px 12px 0 0; text-align:center;">
        <h1 style="color:#fff; margin:0; font-size:1.6rem;">⚡ BoostKaro</h1>
        <p style="color:rgba(255,255,255,0.85); margin:6px 0 0;">Order Confirm Ho Gaya!</p>
      </div>
      <div style="background:#f9fafb; border:1px solid #e2e8f0; padding:28px 32px;">
        <p style="color:#374151;">Namaste! 🙏 Aapka order receive ho gaya. Details neeche hain:</p>
        <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:0.9rem;">
          <tr style="background:#fff; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280; width:45%;">Order ID</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${data.orderId}</td>
          </tr>
          <tr style="background:#f9fafb; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Platform</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${platform}</td>
          </tr>
          <tr style="background:#fff; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Service</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${data.qty} ${data.unit}</td>
          </tr>
          <tr style="background:#f9fafb; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Duration</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${data.duration}</td>
          </tr>
          ${viewsBeforeRow}
          <tr style="background:#fff; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Amount Paid</td>
            <td style="padding:10px 14px; color:#059669; font-weight:700;">${amount}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 14px; color:#6b7280;">Payment ID</td>
            <td style="padding:10px 14px; color:#111827; font-size:0.82rem;">${data.razorpayPaymentId}</td>
          </tr>
        </table>
        <div style="background:#ede9fe; border-left:4px solid #7c3aed; padding:14px 18px; border-radius:0 8px 8px 0; margin:20px 0;">
          <p style="margin:0; color:#5b21b6; font-weight:600;">⏱ Campaign 24 ghante ke andar shuru hoga</p>
          <p style="margin:6px 0 0; color:#7c3aed; font-size:0.88rem;">Start hone par aapko email notification milega.</p>
        </div>
        <p style="color:#6b7280; font-size:0.88rem;">Sawaal ho to: <a href="mailto:alokkmohan@zohomail.in" style="color:#7c3aed;">alokkmohan@zohomail.in</a></p>
      </div>
      <div style="background:#f1f5f9; padding:14px 32px; border-radius:0 0 12px 12px; text-align:center;">
        <p style="color:#94a3b8; font-size:0.8rem; margin:0;">© 2026 ${BUSINESS_NAME}</p>
      </div>
    </div>`;

  GmailApp.sendEmail(data.email, subject, '', { htmlBody });
}

// =============================================
// COMPLETION EMAIL (Campaign end par)
// =============================================
function sendCompletionEmail(orderRow, viewsBefore, viewsAfter, viewsGained) {
  const email    = orderRow[9];
  const orderId  = orderRow[0];
  const platform = orderRow[2];
  const qty      = orderRow[4];
  const unit     = orderRow[5];

  if (!email) return;

  const platformNames = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  const platformName  = platformNames[platform] || platform;

  const gainedStr = typeof viewsGained === 'number'
    ? `+${viewsGained.toLocaleString('en-IN')} ${unit}`
    : viewsGained;

  const subject  = `🎉 Campaign Complete — ${orderId}`;
  const htmlBody = `
    <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto;">
      <div style="background:linear-gradient(135deg,#059669,#047857); padding:28px 32px; border-radius:12px 12px 0 0; text-align:center;">
        <h1 style="color:#fff; margin:0;">🎉 Campaign Complete!</h1>
        <p style="color:rgba(255,255,255,0.85); margin:6px 0 0;">Aapki promotion successfully complete ho gayi</p>
      </div>
      <div style="background:#f9fafb; border:1px solid #e2e8f0; padding:28px 32px;">
        <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:0.9rem;">
          <tr style="background:#fff; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280; width:45%;">Order ID</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${orderId}</td>
          </tr>
          <tr style="background:#f9fafb; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Platform</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${platformName}</td>
          </tr>
          <tr style="background:#fff; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Views Before</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${typeof viewsBefore === 'number' ? viewsBefore.toLocaleString('en-IN') : viewsBefore}</td>
          </tr>
          <tr style="background:#f9fafb; border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 14px; color:#6b7280;">Views After</td>
            <td style="padding:10px 14px; color:#111827; font-weight:600;">${typeof viewsAfter === 'number' ? viewsAfter.toLocaleString('en-IN') : viewsAfter}</td>
          </tr>
          <tr style="background:#fff;">
            <td style="padding:10px 14px; color:#6b7280;">Views Gained</td>
            <td style="padding:10px 14px; color:#059669; font-weight:700; font-size:1.1rem;">${gainedStr}</td>
          </tr>
        </table>
        <p style="color:#374151;">Dobara promotion ke liye: <a href="${SITE_URL}" style="color:#7c3aed;">BoostKaro</a></p>
        <p style="color:#6b7280; font-size:0.88rem;">📧 <a href="mailto:alokkmohan@zohomail.in" style="color:#7c3aed;">alokkmohan@zohomail.in</a></p>
      </div>
      <div style="background:#f1f5f9; padding:14px 32px; border-radius:0 0 12px 12px; text-align:center;">
        <p style="color:#94a3b8; font-size:0.8rem; margin:0;">© 2026 ${BUSINESS_NAME}</p>
      </div>
    </div>`;

  GmailApp.sendEmail(email, subject, '', { htmlBody });
}
