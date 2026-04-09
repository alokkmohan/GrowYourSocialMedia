# Social Media Ads Management Platform
## Project Documentation

---

## 📌 Project Overview

Ek automated platform jo users ko bina login ke Meta (Instagram/Facebook) aur YouTube ke liye paid promotion campaigns setup karne deta hai.

**Business Model:** Client payment karta hai → System automatically campaign trigger karta hai → Result email se jaata hai.

---

## 🎯 Core Concept

> "No login. No account. Sirf link do, payment karo, promotion shuru."

---

## 👤 User Flow (Step by Step)

```
1. Platform Select karo     →  Meta (Instagram/Facebook) ya YouTube
2. Objective Choose karo    →  Views ya Followers
3. Link Do                  →  Video URL ya Profile URL
4. Email Do                 →  Notifications ke liye
5. Plan Select karo         →  Budget + Duration
6. Payment Karo             →  Razorpay (UPI/Card/Net Banking)
7. Confirmation Email       →  Order ID + details
8. Campaign Auto-Start      →  System handle karega
9. Campaign End Email       →  Result + stats
```

---

## 📊 Google Sheet Structure

Sheet mein har order ka record:

| Column | Description |
|--------|-------------|
| Order ID | Unique ID (auto-generate) |
| Timestamp | Order time |
| Email | User ka email |
| Platform | Meta / YouTube |
| Objective | Views / Followers |
| Link | Video ya Profile URL |
| Plan | Plan name |
| Amount | ₹ mein |
| Payment Status | Pending / Paid / Failed / Refunded |
| Campaign Status | Not Started / Running / Completed |
| Start Date | Campaign start time |
| End Date | Campaign end time |
| Result | Views/Followers gained |
| Notes | Admin notes |

---

## 💰 Payment Flow

```
User → Razorpay Checkout
           ↓
    Payment Authorize
           ↓
   Google Apps Script
   (webhook receive)
           ↓
      Sheet mein
      entry karo
           ↓
    Confirmation
    email bhejo
```

### Refund Logic

```
Agar campaign start fail ho →
Razorpay Refund API call →
Same source pe wapas (5-7 days) →
Failure email to user
```

---

## 🛠️ Tech Stack

| Component | Tool | Cost |
|-----------|------|------|
| Frontend | HTML/CSS/JS | Free |
| Hosting | GitHub Pages | Free |
| Backend | Google Apps Script | Free |
| Database | Google Sheets | Free |
| Payment | Razorpay | 2% per txn |
| Email | Gmail SMTP / Apps Script | Free |
| Domain | Aapka existing domain | Already hai |

**Total Monthly Cost: ₹0 (sirf Razorpay commission)**

---

## 📁 File Structure

```
project/
│
├── index.html          # Main landing page
├── success.html        # Payment success page
├── cancel.html         # Payment cancel page
│
├── css/
│   └── style.css
│
├── js/
│   └── main.js         # Razorpay integration
│
└── README.md
```

---

## 📋 Plans Structure (Example)

### Views Plans

| Plan | Views | Duration | Price |
|------|-------|----------|-------|
| Starter | 1,000 | 3 days | ₹499 |
| Basic | 5,000 | 5 days | ₹999 |
| Standard | 15,000 | 7 days | ₹1,999 |
| Premium | 50,000 | 10 days | ₹3,999 |

### Followers Plans

| Plan | Followers | Duration | Price |
|------|-----------|----------|-------|
| Starter | 100 | 5 days | ₹699 |
| Basic | 500 | 7 days | ₹1,499 |
| Standard | 1,000 | 10 days | ₹2,499 |
| Premium | 5,000 | 15 days | ₹7,999 |

---

## 📧 Email Notifications

### 1. Order Confirmation Email
```
Subject: Order Confirmed - [Order ID]

Aapka order receive ho gaya hai.
Platform: Meta / YouTube
Objective: Views / Followers
Link: [user link]
Plan: [plan name]
Amount Paid: ₹[amount]
Expected Start: 24 hours mein
```

### 2. Campaign Start Email
```
Subject: Aapki Promotion Shuru Ho Gayi! 🚀

Order ID: [ID]
Campaign Start: [datetime]
Expected End: [datetime]
```

### 3. Campaign Complete Email
```
Subject: Promotion Complete ✅

Order ID: [ID]
Result: [X] views / [X] followers gained
Duration: [X] days
Thank you!
```

### 4. Refund Email
```
Subject: Refund Initiated

Order ID: [ID]
Amount: ₹[amount]
Reason: Campaign setup failed
Refund Time: 5-7 business days
Same source pe wapas aayega
```

---

## 🔧 Admin Dashboard (Google Sheet)

Aap manually Sheet dekhenge aur:

1. Naya order aaya → **Payment Status: Paid** dikhega
2. Meta Ads Manager / Google Ads mein manually campaign banao
3. Sheet mein **Campaign Status: Running** karo
4. Campaign end hone par **Campaign Status: Completed** karo
5. Result update karo
6. Apps Script se automatically completion email jaayegi

---

## 🚀 Development Phases

### Phase 1 — Foundation (Week 1-2)
- [ ] Google Sheet setup karo
- [ ] Google Apps Script webhook banao
- [ ] Razorpay account create karo
- [ ] Basic index.html banao

### Phase 2 — Integration (Week 3-4)
- [ ] Razorpay payment integrate karo
- [ ] Sheet auto-update karo payment pe
- [ ] Email notifications setup karo
- [ ] GitHub Pages pe deploy karo

### Phase 3 — Domain & Testing (Week 5)
- [ ] Custom domain connect karo
- [ ] End-to-end test karo
- [ ] Test order place karo
- [ ] Refund flow test karo

### Phase 4 — Launch (Week 6)
- [ ] Soft launch
- [ ] Khud 2-3 clients lo
- [ ] Feedback lo
- [ ] Improve karo

---

## ⚠️ Important Notes

1. **API Approvals** — Meta Marketing API aur Google Ads API ko approval lagta hai (2-4 weeks). Abhi manually campaigns chalao.

2. **GST** — ₹20 lakh turnover tak zaroori nahi. Baad mein lo.

3. **Refund Policy** — Clear refund policy website pe likho.

4. **Legal** — Terms & Conditions aur Privacy Policy zaroori hai Razorpay ke liye.

---

## 📈 Income Projection

| Month | Orders/Month | Avg Order | Revenue |
|-------|-------------|-----------|---------|
| 1-3 | 15-20 | ₹1,500 | ₹22-30k |
| 4-6 | 50 | ₹2,000 | ₹1 lakh |
| 7-12 | 150 | ₹2,500 | ₹3-4 lakh |
| Year 2 | 400+ | ₹3,000 | ₹10-12 lakh/month |

**2 saal target: ₹1 Crore — Achievable ✅**

---

## 🔜 Future Automation (Phase 2 - Later)

- Meta Marketing API integrate karo → campaigns auto-create
- Google Ads API → YouTube campaigns auto
- Reseller panel → agents apne clients manage karein
- Dashboard → real-time order tracking

---

*Document prepared: April 2026*
*Platform: Solo Ads Management System*
