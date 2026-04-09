// =============================================
// BoostKaro — Main JS
// =============================================

// ---- CONFIG (replace with your keys) ----
const RAZORPAY_KEY = 'rzp_test_XXXXXXXXXXXXXXXXXX'; // ← Apna Razorpay test key yahan
const GAS_WEBHOOK_URL = ''; // ← Google Apps Script URL (baad mein)

// ---- STATE ----
const order = {
  platform: '',
  objective: '',
  link: '',
  email: '',
  plan: null,
};

// ---- PLAN DATA ----
const plans = {
  views: [
    { name: 'Starter',  quantity: '1,000',  unit: 'Views',     duration: '3 days',  price: 499  },
    { name: 'Basic',    quantity: '5,000',  unit: 'Views',     duration: '5 days',  price: 999  },
    { name: 'Standard', quantity: '15,000', unit: 'Views',     duration: '7 days',  price: 1999 },
    { name: 'Premium',  quantity: '50,000', unit: 'Views',     duration: '10 days', price: 3999 },
  ],
  followers: [
    { name: 'Starter',  quantity: '100',   unit: 'Followers', duration: '5 days',  price: 699  },
    { name: 'Basic',    quantity: '500',   unit: 'Followers', duration: '7 days',  price: 1499 },
    { name: 'Standard', quantity: '1,000', unit: 'Followers', duration: '10 days', price: 2499 },
    { name: 'Premium',  quantity: '5,000', unit: 'Followers', duration: '15 days', price: 7999 },
  ],
};

// =============================================
// STEP NAVIGATION
// =============================================

const progressMap = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.add('hidden'));
  document.getElementById('step' + n).classList.remove('hidden');
  document.getElementById('progressFill').style.width = progressMap[n] + '%';
  document.getElementById('progressLabel').textContent = `Step ${n} of 5`;
  document.getElementById('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goBack(currentStep) {
  showStep(currentStep - 1);
}

// =============================================
// STEP 1 — Platform
// =============================================

function selectPlatform(value) {
  order.platform = value;
  document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.platform-btn[data-value="${value}"]`).classList.add('active');
  setTimeout(() => showStep(2), 200);
}

// =============================================
// STEP 2 — Objective
// =============================================

function selectObjective(value) {
  order.objective = value;
  document.querySelectorAll('.obj-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.obj-btn[data-value="${value}"]`).classList.add('active');

  // Update link label based on objective
  const label = document.getElementById('linkLabel');
  label.textContent = value === 'views'
    ? 'Video URL (jis video pe views chahiye)'
    : 'Profile URL (jis profile pe followers chahiye)';

  setTimeout(() => showStep(3), 200);
}

// =============================================
// STEP 3 — Link & Email → Plans
// =============================================

function goToPlans() {
  const link  = document.getElementById('userLink').value.trim();
  const email = document.getElementById('userEmail').value.trim();

  if (!link) return alert('Please enter your video/profile URL.');
  if (!isValidUrl(link)) return alert('Please enter a valid URL (starting with https://).');
  if (!email) return alert('Please enter your email address.');
  if (!isValidEmail(email)) return alert('Please enter a valid email address.');

  order.link  = link;
  order.email = email;

  renderPlans();
  showStep(4);
}

function isValidUrl(str) {
  try { return ['http:', 'https:'].includes(new URL(str).protocol); }
  catch { return false; }
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

// =============================================
// STEP 4 — Plans
// =============================================

function renderPlans() {
  const grid = document.getElementById('plansGrid');
  grid.innerHTML = '';

  const badges = ['', '', '🔥 Most Popular', ''];
  plans[order.objective].forEach((plan, i) => {
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
      ${badges[i] ? `<div class="plan-badge">${badges[i]}</div>` : ''}
      <div class="plan-name">${plan.name}</div>
      <div class="plan-quantity">${plan.quantity}</div>
      <div class="plan-unit">${plan.unit}</div>
      <div class="plan-duration">⏱ ${plan.duration}</div>
      <div class="plan-price">₹${plan.price.toLocaleString('en-IN')}</div>
    `;
    card.onclick = () => selectPlan(i, card);
    grid.appendChild(card);
  });
}

// =============================================
// PRICING PREVIEW SECTION
// =============================================

function renderPricingPreview(objective) {
  const grid = document.getElementById('pricingGrid');
  grid.innerHTML = '';
  const badges = ['', '', '🔥 Popular', ''];
  plans[objective].forEach((plan, i) => {
    const card = document.createElement('div');
    card.className = 'price-card' + (i === 2 ? ' featured' : '');
    card.innerHTML = `
      ${badges[i] ? `<div class="price-badge">${badges[i]}</div>` : ''}
      <div class="p-name">${plan.name}</div>
      <div class="p-qty">${plan.quantity}</div>
      <div class="p-unit">${plan.unit}</div>
      <div class="p-dur">⏱ ${plan.duration}</div>
      <div class="p-price">₹${plan.price.toLocaleString('en-IN')}</div>
    `;
    grid.appendChild(card);
  });
}

function switchTab(objective, tabEl) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  renderPricingPreview(objective);
}

// Init pricing preview on load
document.addEventListener('DOMContentLoaded', () => renderPricingPreview('views'));

function selectPlan(index, cardEl) {
  order.plan = plans[order.objective][index];
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
  cardEl.classList.add('active');
  setTimeout(() => showConfirm(), 250);
}

// =============================================
// STEP 5 — Confirm
// =============================================

function showConfirm() {
  const p = order.plan;
  const platformLabel = order.platform === 'meta' ? 'Meta (Instagram/Facebook)' : 'YouTube';

  document.getElementById('summaryBox').innerHTML = `
    <div class="summary-row"><span>Platform</span><span>${platformLabel}</span></div>
    <div class="summary-row"><span>Objective</span><span>${capitalize(order.objective)}</span></div>
    <div class="summary-row"><span>Plan</span><span>${p.name} — ${p.quantity} ${p.unit}</span></div>
    <div class="summary-row"><span>Duration</span><span>${p.duration}</span></div>
    <div class="summary-row"><span>Link</span><span style="word-break:break-all;max-width:220px">${order.link}</span></div>
    <div class="summary-row"><span>Email</span><span>${order.email}</span></div>
    <div class="summary-row"><span>Amount</span><span style="color:#10b981;font-size:1.1rem">₹${p.price.toLocaleString('en-IN')}</span></div>
  `;

  document.getElementById('payAmount').textContent = p.price.toLocaleString('en-IN');
  showStep(5);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================
// RAZORPAY PAYMENT
// =============================================

function initiatePayment() {
  const p = order.plan;
  const orderId = 'BK' + Date.now();

  const options = {
    key: RAZORPAY_KEY,
    amount: p.price * 100, // paise mein
    currency: 'INR',
    name: 'BoostKaro',
    description: `${p.name} — ${p.quantity} ${p.unit}`,
    image: '', // logo URL (optional)
    order_id: '', // server-side order ID (optional for now)
    prefill: {
      email: order.email,
    },
    notes: {
      platform:  order.platform,
      objective: order.objective,
      link:      order.link,
      plan:      p.name,
      orderId:   orderId,
    },
    theme: { color: '#7c3aed' },
    handler: function(response) {
      onPaymentSuccess(response, orderId);
    },
    modal: {
      ondismiss: function() {
        console.log('Payment cancelled by user.');
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function(response) {
    alert('Payment failed: ' + response.error.description);
  });
  rzp.open();
}

// =============================================
// AFTER PAYMENT SUCCESS
// =============================================

function onPaymentSuccess(response, orderId) {
  const payload = {
    orderId:          orderId,
    razorpayPaymentId: response.razorpay_payment_id,
    platform:         order.platform,
    objective:        order.objective,
    link:             order.link,
    email:            order.email,
    plan:             order.plan.name,
    quantity:         order.plan.quantity,
    unit:             order.plan.unit,
    duration:         order.plan.duration,
    amount:           order.plan.price,
    timestamp:        new Date().toISOString(),
  };

  // Google Sheets mein entry karo (Google Apps Script webhook)
  if (GAS_WEBHOOK_URL) {
    fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => console.error('Webhook error:', err));
  }

  // Success page pe redirect
  const params = new URLSearchParams({
    orderId: orderId,
    plan:    order.plan.name,
    amount:  order.plan.price,
    email:   order.email,
  });
  window.location.href = 'success.html?' + params.toString();
}
