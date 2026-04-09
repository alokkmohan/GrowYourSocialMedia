// =============================================
// BoostKaro — Google Apps Script
// Google Sheets mein order record karta hai
// aur confirmation email bhejta hai
// =============================================

// ⚠️ IMPORTANT: Apni Sheet ID yahan daalo
// Sheet URL mein se milegi:
// https://docs.google.com/spreadsheets/d/ [SHEET_ID] /edit
const SHEET_ID   = 'APNI_SHEET_ID_YAHAN_DAALO';
const SHEET_NAME = 'Orders'; // Sheet ka tab name

// Aapka naam (email signature ke liye)
const BUSINESS_NAME = 'BoostKaro';

// =============================================
// MAIN FUNCTION — POST request handle karta hai
// =============================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
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
// GOOGLE SHEET MEIN ROW ADD KARO
// =============================================
function recordOrder(data) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  // Agar sheet nahi mili to banao
  if (!sheet) {
    const newSheet = ss.insertSheet(SHEET_NAME);
    newSheet.appendRow([
      'Order ID', 'Timestamp', 'Platform', 'Objective',
      'Qty', 'Unit', 'Duration', 'Amount (₹)',
      'Razorpay Payment ID', 'Email', 'Phone', 'Link',
      'Campaign Status', 'Notes'
    ]);
    newSheet.getRange(1, 1, 1, 14).setFontWeight('bold');
    newSheet.setFrozenRows(1);
  }

  const activeSheet = ss.getSheetByName(SHEET_NAME);
  activeSheet.appendRow([
    data.orderId        || '',
    data.timestamp      || new Date().toISOString(),
    data.platform       || '',
    data.objective      || '',
    data.qty            || '',
    data.unit           || '',
    data.duration       || '',
    data.amount         || '',
    data.razorpayPaymentId || '',
    data.email          || '',
    data.phone          || '',
    data.link           || '',
    'Not Started',       // Campaign Status — admin manually update karega
    ''                   // Notes
  ]);
}

// =============================================
// CONFIRMATION EMAIL BHEJO
// =============================================
function sendConfirmationEmail(data) {
  if (!data.email) return;

  const platformNames = {
    youtube:   'YouTube',
    instagram: 'Instagram',
    facebook:  'Facebook'
  };

  const platform = platformNames[data.platform] || data.platform;
  const amount   = '₹' + Number(data.amount).toLocaleString('en-IN');

  const subject = `✅ Order Confirmed — ${data.orderId}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">

      <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 1.6rem;">⚡ BoostKaro</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 0.95rem;">Order Confirm Ho Gaya!</p>
      </div>

      <div style="background: #f9fafb; border: 1px solid #e2e8f0; padding: 28px 32px;">
        <p style="color: #374151; font-size: 1rem;">Namaste! 🙏</p>
        <p style="color: #374151;">Aapka order receive ho gaya hai. Neeche aapke order ki details hain:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9rem;">
          <tr style="background: #fff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #6b7280; width: 40%;">Order ID</td>
            <td style="padding: 10px 14px; color: #111827; font-weight: 600;">${data.orderId}</td>
          </tr>
          <tr style="background: #f9fafb; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #6b7280;">Platform</td>
            <td style="padding: 10px 14px; color: #111827; font-weight: 600;">${platform}</td>
          </tr>
          <tr style="background: #fff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #6b7280;">Service</td>
            <td style="padding: 10px 14px; color: #111827; font-weight: 600;">${data.qty} ${data.unit}</td>
          </tr>
          <tr style="background: #f9fafb; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #6b7280;">Duration</td>
            <td style="padding: 10px 14px; color: #111827; font-weight: 600;">${data.duration}</td>
          </tr>
          <tr style="background: #fff; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #6b7280;">Link</td>
            <td style="padding: 10px 14px; color: #111827; word-break: break-all;">${data.link}</td>
          </tr>
          <tr style="background: #f9fafb; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; color: #6b7280;">Amount Paid</td>
            <td style="padding: 10px 14px; color: #059669; font-weight: 700; font-size: 1rem;">${amount}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 14px; color: #6b7280;">Payment ID</td>
            <td style="padding: 10px 14px; color: #111827; font-size: 0.82rem;">${data.razorpayPaymentId}</td>
          </tr>
        </table>

        <div style="background: #ede9fe; border-left: 4px solid #7c3aed; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0;">
          <p style="margin: 0; color: #5b21b6; font-weight: 600;">⏱ Campaign 24 ghante ke andar shuru hoga</p>
          <p style="margin: 6px 0 0; color: #7c3aed; font-size: 0.88rem;">Start hone par aapko email notification milega.</p>
        </div>

        <p style="color: #6b7280; font-size: 0.88rem;">Koi bhi sawaal ho to humse contact karein:<br/>
          📧 <a href="mailto:alokkmohan@zohomail.in" style="color: #7c3aed;">alokkmohan@zohomail.in</a>
        </p>
      </div>

      <div style="background: #f1f5f9; padding: 16px 32px; border-radius: 0 0 12px 12px; text-align: center;">
        <p style="color: #94a3b8; font-size: 0.8rem; margin: 0;">© 2026 ${BUSINESS_NAME}. Social media promotion made simple.</p>
      </div>

    </div>
  `;

  GmailApp.sendEmail(data.email, subject, '', { htmlBody });
}

// =============================================
// CAMPAIGN COMPLETE EMAIL (Admin manually call karega)
// Google Sheet se Order ID copy karke yahan paste karo
// =============================================
function sendCompletionEmail(orderId, resultDescription) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();

  // Order ID se row dhundo
  let orderRow = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === orderId) {
      orderRow = data[i];
      break;
    }
  }

  if (!orderRow) {
    Logger.log('Order not found: ' + orderId);
    return;
  }

  const email    = orderRow[9];
  const platform = orderRow[2];
  const qty      = orderRow[4];
  const unit     = orderRow[5];

  const subject  = `🎉 Campaign Complete — ${orderId}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669, #047857); padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0;">🎉 Promotion Complete!</h1>
      </div>
      <div style="background: #f9fafb; border: 1px solid #e2e8f0; padding: 28px 32px;">
        <p style="color: #374151;">Aapki promotion successfully complete ho gayi!</p>
        <p style="color: #374151;"><strong>Order ID:</strong> ${orderId}</p>
        <p style="color: #374151;"><strong>Service:</strong> ${qty} ${unit} on ${platform}</p>
        <p style="color: #374151;"><strong>Result:</strong> ${resultDescription}</p>
        <p style="color: #374151;">Dobara promotion ke liye visit karein: <a href="https://alokkmohan.github.io/GrowYourSocialMedia/" style="color:#7c3aed;">BoostKaro</a></p>
        <p style="color: #6b7280; font-size: 0.88rem;">📧 <a href="mailto:alokkmohan@zohomail.in" style="color: #7c3aed;">alokkmohan@zohomail.in</a></p>
      </div>
    </div>
  `;

  GmailApp.sendEmail(email, subject, '', { htmlBody });
  Logger.log('Completion email sent to: ' + email);
}
