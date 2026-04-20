# ⚡ BoostKaro — Complete Feature List
*Last updated: April 2026*

---

## 🌐 Website (Customer Facing)

### Home Page (`index.html`)
- Platform selection: YouTube, Instagram, Facebook
- Service type: Shorts, Long Video, Reels
- 4 plan tiers: ₹199 / ₹399 / ₹799 / ₹1499
- Video link input with platform-specific hint + "link lo" button
- YouTube video embed preview
- Link confirmation checkbox
- Order summary before payment
- Razorpay payment: GPay / PhonePe / BHIM → UPI ID → Card
- Loading spinner while Razorpay opens
- "100% Genuine Views" badge on hero banner
- Genuine views disclaimer near pay button
- Refund policy note + T&C link before payment
- Mobile-friendly footer with "Track Order" button
- Footer: Customer Care WhatsApp (9236569072)

### Success Page (`success.html`)
- Prominent 5-digit Track Number display
- Order timeline: Payment ✅ → Campaign 🚀 → Report 📊
- Full order details (plan, amount, platform, payment ID)
- "Status Check Karo" link → status.html
- PDF receipt download (print)
- Loading overlay after payment confirm

### Order Status Page (`status.html`)
- 5-digit track number input
- Auto-load if URL has `?track=XXXXX`
- 3-step visual timeline with color-coded dots
- Campaign timing: "5 min ke andar"
- Shows views before / after / gained (when Completed)
- Error state for campaign issues

### Legal Pages
- **Terms & Conditions** (`terms.html`) — campaign rejection + refund policy mentioned
- **Refund Policy** (`refund.html`) — campaign fail = refund minus Razorpay 2.5% fee
- **Privacy Policy** (`privacy.html`)

---

## 🔧 Admin Dashboard (`admin.html`)

- Password login: `boostkaro2026`
- Stats header: Total / Pending / Live / Revenue
- 4 tabs: ⏳ Pending / 🚀 In Progress / ✅ Completed / 📋 Sab
- Per order columns: Track #, Order ID, Customer name + phone, Platform badge, Video link, Plan + budget, Status
- **Status dropdown** — change karo, auto-save hota hai
- **Completed** → popup: post-views daalo → saves to sheet + Jankari sync
- **Mail button** — sirf email wale orders pe dikhta hai
- **Track # editing** — click karo, inline edit, Enter se save
- Refresh button

---

## ⚙️ Google Apps Script Backend (`google-apps-script.js`)

### Payment & Orders
- Razorpay order creation
- Payment signature verification (HMAC SHA256)
- Pre-campaign views fetch (YouTube Data API)
- Razorpay payment details fetch (method / bank / UPI VPA)
- 5-digit tracking number generation per order

### Campaign Automation
- Auto campaign launch on payment verify
- **Meta Ads** — Facebook Reels, Instagram Reels (VIDEO_VIEWS objective)
- **Google Ads** — YouTube Shorts & Long Video (In-Stream ads)
- Status update from dashboard → sheet + Jankari sync

### Email Notifications
- Order Confirmation email (on payment verify)
- Campaign Live email (on status → Launched)
- Final Report email (on status → Completed) with views before/after

### Google Sheets
- **Orders tab** — 36 columns, full tracking (payment, campaign, notifications)
- **Jankari tab** — clean human-readable summary, color-coded campaign status

### Script Properties Required
| Property | Value |
|----------|-------|
| SHEET_ID | Google Sheet ID |
| RAZORPAY_KEY_ID | rzp_live_... |
| RAZORPAY_KEY_SECRET | — |
| META_ACCESS_TOKEN | Long-lived system user token |
| META_AD_ACCOUNT_ID | act_XXXXXXXXX |
| META_PAGE_ID | Facebook Page ID |
| GOOGLE_ADS_DEVELOPER_TOKEN | — |
| GOOGLE_ADS_CUSTOMER_ID | Without dashes |
| GOOGLE_ADS_CLIENT_ID | — |
| GOOGLE_ADS_CLIENT_SECRET | — |
| GOOGLE_ADS_REFRESH_TOKEN | — |
| YOUTUBE_API_KEY | For pre-campaign views |

---

## 🔗 URLs & Keys

| Item | Value |
|------|-------|
| Website | https://boostkaro.dataimpact.in |
| Admin | https://boostkaro.dataimpact.in/admin.html |
| Status Page | https://boostkaro.dataimpact.in/status.html |
| GitHub Repo | https://github.com/alokkmohan/GrowYourSocialMedia |
| GAS URL | https://script.google.com/macros/s/AKfycbxeB6DMx4aEQzBwHrTVLavowHYLarTIXoOLJxI9aVr5cnXyj3W0qWlRRk7QJJtQ4p8K/exec |
| Razorpay (Test) | rzp_test_SfhusOo0f9Pt37 |
| Razorpay (Live) | rzp_live_SfEnPdfoYwU0WJ |
| WhatsApp Business | +91 9236569072 |
| Email | alokkmohan@zohomail.in |

---

## 🔜 Pending / Not Yet Active

- [ ] Meta credentials setup (Facebook Page + Ad Account) — ~April 25, 2026
- [ ] Google Ads Basic Access approval — applied April 19, waiting for email
- [ ] YouTube API key → set in GAS Script Properties
- [ ] Switch `RAZORPAY_KEY` to live key (`rzp_live_SfEnPdfoYwU0WJ`) before launch
- [ ] End-to-end test: order → payment → campaign → status → complete flow

---

## 📋 How to Deploy GAS Update

1. Copy code from `google-apps-script.js`
2. Paste in GAS editor → `Ctrl+S`
3. **Deploy → Manage Deployments → Edit (pencil) → Version: New version → Deploy**
4. Same URL — no need to update frontend files
