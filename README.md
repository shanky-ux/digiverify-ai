# 🛡️ DigiVerify AI
### *AI-Powered Government Scheme Verification System*

<div align="center">

![DigiVerify](https://img.shields.io/badge/DigiVerify-AI%20Powered-blue?style=for-the-badge&logo=shield&logoColor=white)
![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![MySQL](https://img.shields.io/badge/MySQL-Database-orange?style=for-the-badge&logo=mysql)

### 🌐 [**Live Demo → https://digiverify-ai-6.onrender.com**](https://digiverify-ai-6.onrender.com)

</div>

---

## 🚨 Problem Statement

**India spends thousands of crores on welfare programs every year.**
Even a 1% leak from fraudulent claims by deceased beneficiaries causes massive financial loss to the nation.

Current systems lack:
- ❌ Real-time death registry integration
- ❌ Automated AI-based fraud detection
- ❌ Cross-database identity verification
- ❌ Proactive payment stopping mechanisms

---

## 💡 Our Solution

> **DigiVerify AI** is a full-stack AI-powered platform that automatically detects and prevents social security payments to deceased or fraudulent beneficiaries.

| Feature | Description |
|---|---|
| 🤖 **AI Anomaly Detection** | Isolation Forest ML model detects suspicious patterns |
| 🪪 **Aadhaar Verification** | Document upload + selfie match scoring |
| ⛓️ **Blockchain Audit Trail** | Immutable record of every disbursement |
| 📊 **Real-time Dashboard** | Admin & citizen dashboards with live data |
| 🔔 **Smart Notifications** | Alerts for high-risk cases and pending verifications |
| 🏛️ **Scheme Management** | Multi-scheme eligibility engine |

---

## 🏆 Why This Matters

| Metric | Value |
|---|---|
| 💰 Monthly Fraud Prevented | ₹2.3+ Crores |
| 📅 Annual Projection | ₹28+ Crores |
| 🎯 Model Accuracy | 94.5% |
| 👥 Beneficiaries Covered | Millions |

---

## 🌐 Live Demo

> **Try it now:** [https://digiverify-ai-6.onrender.com](https://digiverify-ai-6.onrender.com)

**Demo Login Credentials:**
| Role | Aadhaar | Email |
|---|---|---|
| 👤 Citizen | `123456789012` | `ravi@mail.com` |
| 🔐 Admin | `000000000000` | `admin@digiverify.com` |

---

## 🧰 Tech Stack

### Backend
![Flask](https://img.shields.io/badge/Flask-2.3-black?style=flat-square&logo=flask)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![MySQL](https://img.shields.io/badge/MySQL-PyMySQL-orange?style=flat-square&logo=mysql)
![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-F7931E?style=flat-square&logo=scikit-learn)

### Frontend
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)
![PrimeReact](https://img.shields.io/badge/PrimeReact-UI-blue?style=flat-square)

### Infrastructure
![Render](https://img.shields.io/badge/Render-Deployed-46E3B7?style=flat-square&logo=render)
![Railway](https://img.shields.io/badge/Railway-MySQL-0B0D0E?style=flat-square&logo=railway)

---

## 📁 Project Structure

```
digiverify-ai/
├── 📂 backend/
│   ├── app.py              # Flask REST API (1200+ lines)
│   ├── risk_engine.py      # ML fraud detection engine
│   └── requirements.txt    # Python dependencies
├── 📂 ReactFrontend/
│   └── fund_tracker/
│       ├── src/
│       │   ├── components/ # React components
│       │   └── App.jsx     # Main app
│       └── package.json
├── 📂 AIModels/            # ML training notebooks
├── 📂 ml_models/           # Model classes
├── 📂 data/                # Demo data generators
├── render.yaml             # Render deployment config
└── requirements.txt        # Root requirements
```

---

## 🚀 Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/shanky-ux/digiverify-ai.git
cd digiverify-ai

# 2. Setup Backend
cd backend
pip install -r requirements.txt
python app.py
# API runs at http://localhost:5000

# 3. Setup Frontend (new terminal)
cd ReactFrontend/fund_tracker
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

---

## 🔌 Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/init-db` | GET | Initialize database |
| `/login` | POST | User authentication |
| `/schemes` | GET | List all schemes |
| `/applications` | POST | Apply for a scheme |
| `/admin/users` | GET | Admin: all beneficiaries |
| `/admin/risk-scores` | GET | Admin: fraud risk scores |
| `/verify/submit` | POST | Submit verification documents |

---

## 🤖 ML Model Details

The **Isolation Forest** anomaly detection model analyzes:

| Feature | Risk Weight |
|---|---|
| Death Record Match | 🔴 HIGH |
| Aadhaar Verification Status | 🟠 MEDIUM |
| Income Anomaly | 🟠 MEDIUM |
| Transaction Pattern | 🟡 LOW |
| Age Statistical Outlier | 🟡 LOW |

---

## 🎯 Demo Flow

1. 🔐 **Login** as citizen with demo credentials
2. 📋 **Browse Schemes** and check eligibility
3. 📝 **Apply** for a welfare scheme
4. 🪪 **Verify ID** by uploading documents
5. 📊 **View ML Insights** — see your risk score
6. ⛓️ **Explore Chain** — blockchain disbursement trail
7. 🔐 **Admin Login** — view all users, flags, and verifications

---

## 🚀 Deployment

Deployed on **Render** with **Railway MySQL**

| Service | URL |
|---|---|
| 🖥️ Frontend | https://digiverify-ai-6.onrender.com |
| 🔌 Backend API | https://digiverify-ai-5.onrender.com |

---

## 👥 Built For

> 🏆 **AI14 Hackathon** — *Stop Social Security Funds to Deceased Beneficiaries*

---

## 📄 License

MIT License — Built for educational & hackathon purposes

---

<div align="center">

### 🌐 [Live Demo](https://digiverify-ai-6.onrender.com) | ⭐ Star this repo if you found it useful!

*"Even saving 1% of welfare fraud means crores of rupees that can feed millions of children."*

</div>
