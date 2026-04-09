// =============================================
// BoostKaro — Main JS
// =============================================

const RAZORPAY_KEY    = 'rzp_test_XXXXXXXXXXXXXXXXXX'; // ← Apna key yahan
const GAS_WEBHOOK_URL = '';                             // ← Google Apps Script URL

// ---- STATE ----
const order = { platform: '', objective: '', plan: null, link: '', email: '' };

// ---- PLAN DATA ---- (platform → objective → plans)
const planData = {
  youtube: {
    views: [
      { qty: '100',   unit: 'Views',       dur: '1 day',   price: 99  },
      { qty: '200',   unit: 'Views',       dur: '2 days',  price: 179 },
      { qty: '500',   unit: 'Views',       dur: '3 days',  price: 399 },
      { qty: '1,000', unit: 'Views',       dur: '5 days',  price: 699 },
    ],
    subscribers: [
      { qty: '100',   unit: 'Subscribers', dur: '5 days',  price: 299  },
      { qty: '200',   unit: 'Subscribers', dur: '7 days',  price: 549  },
      { qty: '500',   unit: 'Subscribers', dur: '10 days', price: 1199 },
      { qty: '1,000', unit: 'Subscribers', dur: '15 days', price: 2199 },
    ],
  },
  instagram: {
    views: [
      { qty: '100',   unit: 'Reel Views', dur: '1 day',   price: 79  },
      { qty: '200',   unit: 'Reel Views', dur: '2 days',  price: 149 },
      { qty: '500',   unit: 'Reel Views', dur: '3 days',  price: 349 },
      { qty: '1,000', unit: 'Reel Views', dur: '5 days',  price: 599 },
    ],
    followers: [
      { qty: '100',   unit: 'Followers', dur: '3 days',  price: 199  },
      { qty: '200',   unit: 'Followers', dur: '5 days',  price: 379  },
      { qty: '500',   unit: 'Followers', dur: '7 days',  price: 849  },
      { qty: '1,000', unit: 'Followers', dur: '10 days', price: 1599 },
    ],
  },
  facebook: {
    views: [
      { qty: '100',   unit: 'Video Views', dur: '1 day',   price: 89  },
      { qty: '200',   unit: 'Video Views', dur: '2 days',  price: 169 },
      { qty: '500',   unit: 'Video Views', dur: '3 days',  price: 379 },
      { qty: '1,000', unit: 'Video Views', dur: '5 days',  price: 649 },
    ],
    followers: [
      { qty: '100',   unit: 'Page Likes', dur: '3 days',  price: 249  },
      { qty: '200',   unit: 'Page Likes', dur: '5 days',  price: 449  },
      { qty: '500',   unit: 'Page Likes', dur: '7 days',  price: 999  },
      { qty: '1,000', unit: 'Page Likes', dur: '10 days', price: 1849 },
    ],
  },
};

// Objectives per platform
const objectives = {
  youtube:   [
    { key: 'views',       icon: '👁️', label: 'Views',       sub: 'Video views badhao' },
    { key: 'subscribers', icon: '🔔', label: 'Subscribers',  sub: 'Channel subscribers badhao' },
  ],
  instagram: [
    { key: 'views',     icon: '▶️', label: 'Reel Views',   sub: 'Reels par views badhao' },
    { key: 'followers', icon: '👥', label: 'Followers',     sub: 'Profile followers badhao' },
  ],
  facebook:  [
    { key: 'views',     icon: '▶️', label: 'Video Views',   sub: 'Video views badhao' },
    { key: 'followers', icon: '👍', label: 'Page Likes',    sub: 'Page likes badhao' },
  ],
};

const linkLabels = {
  youtube:   { views: 'YouTube Video URL', subscribers: 'YouTube Channel URL' },
  instagram: { views: 'Instagram Reel URL', followers: 'Instagram Profile URL' },
  facebook:  { views: 'Facebook Video URL', followers: 'Facebook Page URL' },
};

const linkPlaceholders = {
  youtube:   { views: 'https://www.youtube.com/watch?v=...', subscribers: 'https://www.youtube.com/@channel' },
  instagram: { views: 'https://www.instagram.com/reel/...', followers: 'https://www.instagram.com/yourprofile' },
  facebook:  { views: 'https://www.facebook.com/video/...', followers: 'https://www.facebook.com/yourpage' },
};

// =============================================
// REVEAL HELPER
// =============================================
function reveal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// =============================================
// STEP 1 — Platform
// =============================================
function selectPlatform(platform, cardEl) {
  order.platform = platform;
  order.objective = '';
  order.plan = null;

  // Mark active card
  document.querySelectorAll('.pcard').forEach(c => c.classList.remove('active'));
  cardEl.classList.add('active');

  // Render objectives
  const container = document.getElementById('objCards');
  container.innerHTML = '';
  objectives[platform].forEach(obj => {
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

  // Update subtitle
  const names = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  document.getElementById('objSubtitle').textContent = names[platform] + ' ke liye objective choose karo';

  // Hide later sections
  hideFrom('objectiveSection');
  reveal('objectiveSection');
}

// =============================================
// STEP 2 — Objective
// =============================================
function selectObjective(objective, cardEl) {
  order.objective = objective;
  order.plan = null;

  document.querySelectorAll('.obj-card').forEach(c => c.classList.remove('active'));
  cardEl.classList.add('active');

  // Render plans
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

  const unitLabel = plans[0].unit;
  document.getElementById('planSubtitle').textContent = `Kitne ${unitLabel} chahiye?`;

  hideFrom('planSection');
  reveal('planSection');
}

// =============================================
// STEP 3 — Plan
// =============================================
function selectPlan(plan, cardEl) {
  order.plan = plan;

  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
  cardEl.classList.add('active');

  // Update link input label
  const lbl = linkLabels[order.platform][order.objective];
  const ph  = linkPlaceholders[order.platform][order.objective];
  document.getElementById('linkLabel').textContent = '🔗 ' + lbl;
  document.getElementById('userLink').placeholder = ph;
  document.getElementById('userLink').value = '';
  document.getElementById('userEmail').value = '';

  hideFrom('detailsSection');
  reveal('detailsSection');
}

// =============================================
// STEP 4 — Link + Email → Pay
// =============================================
function proceedToPayment() {
  const link  = document.getElementById('userLink').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const email = document.getElementById('userEmail').value.trim();

  if (!link)               return showError('Please enter the URL.');
  if (!isValidUrl(link))   return showError('Please enter a valid URL (starting with https://).');
  if (!phone)              return showError('Please enter your mobile number.');
  if (!/^\d{10}$/.test(phone)) return showError('Please enter a valid 10-digit mobile number.');
  if (!email)              return showError('Please enter your email address.');
  if (!isValidEmail(email))  return showError('Please enter a valid email address.');

  order.link  = link;
  order.phone = '+91' + phone;
  order.email = email;

  // Build summary
  const p = order.plan;
  const platformNames = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook' };
  const summaryHTML = `
    <h4>Order Summary</h4>
    <div class="sum-row"><span>Platform</span><span>${platformNames[order.platform]}</span></div>
    <div class="sum-row"><span>Service</span><span>${p.qty} ${p.unit}</span></div>
    <div class="sum-row"><span>Duration</span><span>${p.dur}</span></div>
    <div class="sum-row"><span>Link</span><span>${link}</span></div>
    <div class="sum-row"><span>WhatsApp</span><span>+91 ${phone}</span></div>
    <div class="sum-row"><span>Email</span><span>${email}</span></div>
    <div class="sum-row"><span>Amount</span><span style="color:#10b981;font-size:1.1rem">₹${p.price.toLocaleString('en-IN')}</span></div>
  `;
  document.getElementById('orderSummary').innerHTML = summaryHTML;

  const amtStr = '₹' + p.price.toLocaleString('en-IN');
  document.getElementById('displayAmount').textContent  = amtStr;
  document.getElementById('payAmountBtn').textContent   = amtStr;

  hideFrom('paySection');
  reveal('paySection');
}

// =============================================
// STEP 5 — Razorpay Payment
// =============================================
function initiatePayment() {
  const p = order.plan;
  const orderId = 'BK' + Date.now();

  const options = {
    key:      RAZORPAY_KEY,
    amount:   p.price * 100,
    currency: 'INR',
    name:     'BoostKaro',
    description: `${p.qty} ${p.unit}`,
    prefill:  { email: order.email, contact: order.phone },
    notes: {
      platform:  order.platform,
      objective: order.objective,
      link:      order.link,
      orderId,
    },
    theme: { color: '#7c3aed' },
    handler: (response) => onPaymentSuccess(response, orderId),
    modal:   { ondismiss: () => {} },
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', (r) => alert('Payment failed: ' + r.error.description));
  rzp.open();
}

function onPaymentSuccess(response, orderId) {
  const p = order.plan;
  const payload = {
    orderId, razorpayPaymentId: response.razorpay_payment_id,
    platform: order.platform, objective: order.objective,
    link: order.link, phone: order.phone, email: order.email,
    qty: p.qty, unit: p.unit, duration: p.dur, amount: p.price,
    timestamp: new Date().toISOString(),
  };

  if (GAS_WEBHOOK_URL) {
    fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(console.error);
  }

  const params = new URLSearchParams({
    orderId, plan: `${p.qty} ${p.unit}`, amount: p.price, email: order.email,
  });
  window.location.href = 'success.html?' + params.toString();
}

// =============================================
// HELPERS
// =============================================
function hideFrom(fromId) {
  const order = ['objectiveSection', 'planSection', 'detailsSection', 'paySection'];
  const idx = order.indexOf(fromId);
  order.slice(idx).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
}

function isValidUrl(str) {
  try { return ['http:', 'https:'].includes(new URL(str).protocol); }
  catch { return false; }
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function showError(msg) {
  alert(msg); // baad mein better toast banana
}
