// =============================================
// BoostKaro - Main JS
// =============================================

const RAZORPAY_KEY = 'rzp_live_SfEnPdfoYwU0WJ';
const PAYMENT_API_URL = 'https://script.google.com/macros/s/AKfycbyjjIdDR4pHFp2fN4p60EkF9fE5w2chqCC294BsgvrJQnWNylUOc1j1Ak4I3VqBGQiA/exec';
const GAS_WEBHOOK_URL = '';

const order = { platform: '', objective: '', plan: null, link: '', phone: '', email: '' };
const ORDER_STORAGE_KEY = 'boostkaro_last_order';
let paymentInFlight = false;

const planData = {
  youtube: {
    shorts: [
      { qty: '700-1,200', unit: 'Shorts Views', dur: '2-3 days', price: 100 },
      { qty: '1,500-2,500', unit: 'Shorts Views', dur: '3-5 days', price: 200 },
      { qty: '4,000-7,000', unit: 'Shorts Views', dur: '5-7 days', price: 500 },
      { qty: '8,000-15,000', unit: 'Shorts Views', dur: '7-10 days', price: 999 },
    ],
    longvideo: [
      { qty: '300-500', unit: 'Video Views', dur: '2-3 days', price: 100 },
      { qty: '600-1,000', unit: 'Video Views', dur: '3-5 days', price: 200 },
      { qty: '1,500-3,000', unit: 'Video Views', dur: '5-7 days', price: 500 },
      { qty: '3,000-6,000', unit: 'Video Views', dur: '7-10 days', price: 999 },
    ],
  },
  instagram: {
    reels: [
      { qty: '800-1,500', unit: 'Reels Views', dur: '2-3 days', price: 100 },
      { qty: '1,800-3,000', unit: 'Reels Views', dur: '3-5 days', price: 200 },
      { qty: '5,000-9,000', unit: 'Reels Views', dur: '5-7 days', price: 500 },
      { qty: '10,000-18,000', unit: 'Reels Views', dur: '7-10 days', price: 999 },
    ],
  },
  facebook: {
    reels: [
      { qty: '1,000-1,800', unit: 'Reels Views', dur: '2-3 days', price: 100 },
      { qty: '2,200-3,500', unit: 'Reels Views', dur: '3-5 days', price: 200 },
      { qty: '6,000-10,000', unit: 'Reels Views', dur: '5-7 days', price: 500 },
      { qty: '12,000-20,000', unit: 'Reels Views', dur: '7-10 days', price: 999 },
    ],
    video: [
      { qty: '400-800', unit: 'Video Views', dur: '2-3 days', price: 100 },
      { qty: '900-1,600', unit: 'Video Views', dur: '3-5 days', price: 200 },
      { qty: '2,500-4,500', unit: 'Video Views', dur: '5-7 days', price: 500 },
      { qty: '5,000-9,000', unit: 'Video Views', dur: '7-10 days', price: 999 },
    ],
  },
};

const objectives = {
  youtube: [
    { key: 'shorts', icon: '⚡', label: 'Shorts / Reels', sub: 'Short video par views badhao' },
    { key: 'longvideo', icon: '▶', label: 'Long Video', sub: 'Long video par views badhao' },
  ],
  instagram: [
    { key: 'reels', icon: '⚡', label: 'Reels Views', sub: 'Instagram Reels par views badhao' },
  ],
  facebook: [
    { key: 'reels', icon: '⚡', label: 'Reels Views', sub: 'Facebook Reels par views badhao' },
    { key: 'video', icon: '▶', label: 'Video Views', sub: 'Normal video par views badhao' },
  ],
};

const linkLabels = {
  youtube: { shorts: 'YouTube Shorts URL', longvideo: 'YouTube Video URL' },
  instagram: { reels: 'Instagram Reel URL' },
  facebook: { reels: 'Facebook Reel URL', video: 'Facebook Video URL' },
};

const linkPlaceholders = {
  youtube: { shorts: 'https://www.youtube.com/shorts/...', longvideo: 'https://www.youtube.com/watch?v=...' },
  instagram: { reels: 'https://www.instagram.com/reel/...' },
  facebook: { reels: 'https://www.facebook.com/reel/...', video: 'https://www.facebook.com/video/...' },
};

function reveal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function selectPlatform(platform, cardEl) {
  order.platform = platform;
  order.objective = '';
  order.plan = null;
  order.link = '';

  document.querySelectorAll('.pcard').forEach((c) => c.classList.remove('active'));
  cardEl.classList.add('active');

  const container = document.getElementById('objCards');
  container.innerHTML = '';

  objectives[platform].forEach((obj) => {
    const card = document.createElement('div');
    card.className = 'obj-card';
    card.innerHTML = `
      <div class="obj-icon">${obj.icon}</div>
      <h4>${obj.label}</h4>
      <p>${obj.sub}</p>
    `;
    card.onclick = () => selectObjective(obj.key, card);
    container.appendChild(card);
  });

  const names = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  document.getElementById('objSubtitle').textContent = names[platform] + ' ke liye — views chahiye ya followers?';

  hideFrom('objectiveSection');
  reveal('objectiveSection');
}

function selectObjective(objective, cardEl) {
  order.objective = objective;
  order.plan = null;
  order.link = '';

  document.querySelectorAll('.obj-card').forEach((c) => c.classList.remove('active'));
  cardEl.classList.add('active');

  const plans = planData[order.platform][objective];
  const container = document.getElementById('planCards');
  container.innerHTML = '';

  plans.forEach((plan, i) => {
    const card = document.createElement('div');
    card.className = 'plan-card' + (i === 2 ? ' popular' : '');
    card.innerHTML = `
      <div class="plan-qty">${plan.qty}</div>
      <div class="plan-unit">${plan.unit}</div>
      <div class="plan-dur">⏱ ${plan.dur}</div>
      <div class="plan-price">₹${plan.price.toLocaleString('en-IN')}</div>
    `;
    card.onclick = () => selectPlan(plan, card);
    container.appendChild(card);
  });

  document.getElementById('planSubtitle').textContent = `Apna budget dekho aur plan chuno`;

  hideFrom('planSection');
  reveal('planSection');
}

function selectPlan(plan, cardEl) {
  order.plan = plan;
  order.link = '';

  document.querySelectorAll('.plan-card').forEach((c) => c.classList.remove('active'));
  cardEl.classList.add('active');

  const label = linkLabels[order.platform][order.objective];
  const placeholder = linkPlaceholders[order.platform][order.objective];
  const linkInput = document.getElementById('userLink');

  document.getElementById('linkLabel').textContent = '🔗 ' + label;
  linkInput.placeholder = placeholder;
  linkInput.value = '';
  document.getElementById('userEmail').value = '';
  setProceedEnabled(false);
  updateLinkPreview();

  hideFrom('detailsSection');
  reveal('detailsSection');
}

function proceedToPayment() {
  const link = document.getElementById('userLink').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const email = document.getElementById('userEmail').value.trim();

  if (!link) return showError('Please enter the URL.');
  if (!isValidUrl(link)) return showError('Please enter a valid URL (starting with https://).');
  if (!isExpectedLinkForSelection(link)) return showError('Please enter the correct reel/video link for the selected service.');
  if (!phone) return showError('Please enter your mobile number.');
  if (!/^\d{10}$/.test(phone)) return showError('Please enter a valid 10-digit mobile number.');
  if (email && !isValidEmail(email)) return showError('Please enter a valid email address.');

  order.link = link;
  order.phone = '+91' + phone;
  order.email = email;

  const p = order.plan;
  const platformNames = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  const summaryRows = [
    ['Platform', platformNames[order.platform]],
    ['Service', `${p.qty} ${p.unit}`],
    ['Duration', p.dur],
    ['Link', link],
    ['WhatsApp', `+91 ${phone}`],
    ['Email', email || 'Not provided'],
    ['Amount', `₹${p.price.toLocaleString('en-IN')}`],
  ];

  document.getElementById('orderSummary').innerHTML = `
    <h4>Order Summary</h4>
    ${summaryRows.map(([k, v]) => `<div class="sum-row"><span>${k}</span><span>${v}</span></div>`).join('')}
  `;

  const amtStr = '₹' + p.price.toLocaleString('en-IN');
  document.getElementById('displayAmount').textContent = amtStr;
  document.getElementById('payAmountBtn').textContent = amtStr;

  hideFrom('paySection');
  reveal('paySection');
}

async function initiatePayment() {
  if (paymentInFlight) return;
  if (!order.plan || !order.phone || !order.link) {
    showError('Please complete your order details before payment.');
    return;
  }

  paymentInFlight = true;
  const p = order.plan;
  const fallbackOrderId = 'BK' + Date.now();

  try {
    let backendOrder = null;
    if (PAYMENT_API_URL) {
      backendOrder = await createBackendOrder({
        platform: order.platform,
        objective: order.objective,
        link: order.link,
        phone: order.phone,
        email: order.email,
        qty: p.qty,
        unit: p.unit,
        duration: p.dur,
        amount: p.price,
      });
    }

    const publicOrderId = backendOrder?.publicOrderId || fallbackOrderId;
    const razorpayOrderId = backendOrder?.razorpayOrderId || undefined;
    const amountInPaise = Number(backendOrder?.amount || p.price * 100);
    const currency = backendOrder?.currency || 'INR';

    const options = {
      key: RAZORPAY_KEY,
      amount: amountInPaise,
      currency,
      name: 'BoostKaro',
      description: `${p.qty} ${p.unit}`,
      order_id: razorpayOrderId,
      prefill: { email: order.email || undefined, contact: order.phone },
      notes: {
        platform: order.platform,
        objective: order.objective,
        link: order.link,
        orderId: publicOrderId,
      },
      theme: { color: '#7c3aed' },
      handler: (response) => {
        paymentInFlight = false;
        onPaymentSuccess(response, publicOrderId, razorpayOrderId);
      },
      modal: {
        ondismiss: () => {
          paymentInFlight = false;
          window.location.href = 'cancel.html?orderId=' + encodeURIComponent(publicOrderId);
        },
      },
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (r) => {
      paymentInFlight = false;
      alert('Payment failed: ' + (r?.error?.description || 'Unknown error'));
    });
    rzp.open();
  } catch (error) {
    paymentInFlight = false;
    console.error(error);
    showError('Payment setup failed. Please try again in a moment.');
  }
}

async function onPaymentSuccess(response, orderId, expectedRazorpayOrderId) {
  const p = order.plan;
  const payload = {
    orderId,
    razorpayPaymentId: response.razorpay_payment_id,
    razorpayOrderId: response.razorpay_order_id || expectedRazorpayOrderId || '',
    razorpaySignature: response.razorpay_signature || '',
    platform: order.platform,
    objective: order.objective,
    link: order.link,
    phone: order.phone,
    email: order.email,
    qty: p.qty,
    unit: p.unit,
    duration: p.dur,
    amount: p.price,
    timestamp: new Date().toISOString(),
  };

  let status = 'received';

  try {
    if (PAYMENT_API_URL) {
      const verifyResponse = await postJson(PAYMENT_API_URL + '?action=verifyPayment', payload);
      status = verifyResponse && verifyResponse.success && verifyResponse.verified ? 'verified' : 'processing';
    } else if (GAS_WEBHOOK_URL) {
      await postJson(GAS_WEBHOOK_URL, payload);
      status = 'processing';
    }
  } catch (error) {
    console.error(error);
    status = 'processing';
  }

  persistOrderSummary({
    orderId,
    plan: `${p.qty} ${p.unit}`,
    amount: p.price,
    email: order.email,
    phone: order.phone,
    paymentId: payload.razorpayPaymentId,
    status,
  });

  const params = new URLSearchParams({
    orderId,
    plan: `${p.qty} ${p.unit}`,
    amount: p.price,
    email: order.email,
    paymentId: payload.razorpayPaymentId,
    status,
  });
  window.location.href = 'success.html?' + params.toString();
}

function updateLinkPreview() {
  const card = document.getElementById('linkPreviewCard');
  const title = document.getElementById('linkPreviewTitle');
  const badge = document.getElementById('linkPreviewBadge');
  const body = document.getElementById('linkPreviewBody');
  const confirmLabel = document.getElementById('linkConfirmLabel');
  const confirmCheck = document.getElementById('linkConfirmCheck');
  const rawLink = document.getElementById('userLink')?.value.trim() || '';

  if (!card || !title || !badge || !body) return;
  if (!rawLink || !isValidUrl(rawLink) || !order.platform || !order.objective) {
    card.style.display = 'none';
    body.innerHTML = '';
    if (confirmLabel) confirmLabel.style.display = 'none';
    if (confirmCheck) confirmCheck.checked = false;
    setProceedEnabled(false);
    return;
  }

  const meta = getPreviewMeta(rawLink);
  card.style.display = 'block';
  title.textContent = meta.title;
  badge.textContent = meta.badge;
  body.innerHTML = meta.html;

  if (confirmLabel) confirmLabel.style.display = 'flex';
  if (confirmCheck) confirmCheck.checked = false;
  setProceedEnabled(false);
}

function onLinkConfirmChange() {
  const confirmCheck = document.getElementById('linkConfirmCheck');
  setProceedEnabled(confirmCheck && confirmCheck.checked);
}

function setProceedEnabled(enabled) {
  const btn = document.querySelector('.btn-proceed');
  if (btn) btn.disabled = !enabled;
}

function getPreviewMeta(link) {
  if (order.platform === 'youtube') {
    const videoId = extractYouTubeId(link);
    if (videoId) {
      return {
        title: 'YouTube preview',
        badge: 'Preview ready',
        html: `<iframe class="embed-frame" src="https://www.youtube.com/embed/${videoId}" title="YouTube preview" allowfullscreen></iframe>`,
      };
    }
  }

  const url = new URL(link);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const itemName = getSelectedItemName();

  return {
    title: `${itemName} confirmation`,
    badge: 'Open to confirm',
    html: `
      <div class="link-preview-fallback">
        <p>Platform restrictions ki wajah se direct in-page preview har reel ke liye available nahi hota. Neeche link confirm kar lo.</p>
        <code>${escapeHtml(link)}</code>
        <a class="preview-link-btn" href="${escapeAttribute(link)}" target="_blank" rel="noopener noreferrer">Open this ${escapeHtml(itemName)} in new tab</a>
        <p style="margin-top:10px;">Detected path: <strong>${escapeHtml(path)}</strong></p>
      </div>
    `,
  };
}

function getSelectedItemName() {
  if (order.platform === 'instagram' && order.objective === 'reels') return 'reel';
  if (order.platform === 'facebook' && order.objective === 'reels') return 'reel';
  if (order.platform === 'youtube' && order.objective === 'shorts') return 'Short';
  return 'video';
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.split('/')[2] || '';
    }
    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v');
    }
  } catch (error) {
    return '';
  }
  return '';
}

function hideFrom(fromId) {
  const ids = ['objectiveSection', 'planSection', 'detailsSection', 'paySection'];
  const idx = ids.indexOf(fromId);
  ids.slice(idx).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
}

function isValidUrl(str) {
  try {
    return ['http:', 'https:'].includes(new URL(str).protocol);
  } catch (error) {
    return false;
  }
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isExpectedLinkForSelection(link) {
  try {
    const url = new URL(link);
    const path = url.pathname.toLowerCase();

    if (order.platform === 'instagram' && order.objective === 'reels') {
      return path.includes('/reel/');
    }
    if (order.platform === 'facebook' && order.objective === 'reels') {
      return path.includes('/reel/');
    }
    if (order.platform === 'facebook' && order.objective === 'video') {
      return path.includes('/video/');
    }
    if (order.platform === 'youtube' && order.objective === 'shorts') {
      return path.includes('/shorts/') || url.hostname.includes('youtu.be');
    }
    return true;
  } catch (error) {
    return false;
  }
}

function showError(msg) {
  alert(msg);
}

async function createBackendOrder(payload) {
  const response = await postJson(PAYMENT_API_URL + '?action=createOrder', payload);
  if (!response || !response.success || !response.razorpayOrderId) {
    throw new Error(response?.message || 'Unable to create order.');
  }
  return response;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { success: false, message: 'Invalid server response.', raw: text };
  }

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function persistOrderSummary(summary) {
  try {
    sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(summary));
  } catch (error) {
    console.error(error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
