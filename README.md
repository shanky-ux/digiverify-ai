<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=220&section=header&text=DigiVerify%20AI&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Stop%20Social%20Security%20Funds%20to%20Deceased%20Beneficiaries&descSize=18&descAlignY=58&descColor=ccccff"/>
</p>

<p align="center">
  <b>🏆 Hackathon Winner · Government Technology Track</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/Scikit--Learn-ML-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white"/>
  <img src="https://img.shields.io/badge/Streamlit-Analytics-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white"/>
  <img src="https://img.shields.io/badge/Accuracy-94.5%25-brightgreen?style=for-the-badge"/>
</p>

---

## 📌 Overview

**DigiVerify AI** is a full-stack AI-powered fraud detection platform that prevents crores in government welfare leakage by automatically identifying and stopping social security payments to deceased beneficiaries.

India disburses **₹3.47 lakh crore** annually across schemes like PM-KISAN, NSAP, and MGNREGS. A conservative 1–2% leakage from deceased beneficiaries means **₹3,470–6,940 crore lost every year** — not from corruption, but from disconnected systems that don't talk to each other.

DigiVerify AI solves this by integrating death registries, Aadhaar verification, and a trained ML anomaly detection model into a single real-time platform.

> *"Even saving 1% of welfare fraud means crores of rupees that can feed millions of children."*

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Data_Sources["📦 Data Sources"]
        DR[Death Registry - CRS]
        UID[UIDAI Aadhaar API]
        BANK[Bank Records - NPCI]
        WDB[Welfare Beneficiary DB]
    end

    subgraph Ingestion["⚙️ Ingestion Layer"]
        ETL[ETL Pipeline - Pandas + SQLite]
        CACHE[Redis Hot Cache]
    end

    subgraph ML_Engine["🤖 ML Engine"]
        FE[Feature Engineering - 9 Signals]
        GBC[Gradient Boosting Classifier]
        RS[Risk Scorer - 0.0 to 1.0]
        AE[Alert Engine - Threshold 0.7]
    end

    subgraph Backend["⚡ FastAPI Backend - Port 5000"]
        V1[/verify/beneficiary]
        V2[/verify/bulk]
        DC[/death-record/check]
        AV[/aadhaar/verify]
        LC[/life-certificate/submit]
        DS[/dashboard/summary]
    end

    subgraph Frontends["🖥️ Dual Frontend"]
        REACT[React Dashboard - Vite + Tailwind - 5173]
        STREAM[Streamlit Analytics - 8501]
    end

    subgraph Actions["🚨 Automated Actions"]
        STOP[Stop Payment]
        FLAG[Flag Beneficiary]
        AUDIT[Immutable Audit Log]
        NOTIFY[Officer Notification]
    end

    Data_Sources --> ETL
    ETL --> CACHE
    CACHE --> FE
    FE --> GBC
    GBC --> RS
    RS --> AE
    AE --> Backend
    Backend --> Frontends
    Backend --> Actions
```

---

## 🔄 End-to-End Verification Flow

```mermaid
flowchart TD
    A[Officer Triggers Bulk Verification] --> B[React Dashboard]
    B --> C[Validate and Format Beneficiary IDs]
    C --> D[POST /api/verify/bulk]
    D --> E[FastAPI Backend]
    E --> F[Cross-Reference Death Registry]
    E --> G[Check Aadhaar Liveness Status]
    E --> H[Fetch 6-Month Transaction History]
    F --> I[Build 9-Signal Feature Vector]
    G --> I
    H --> I
    I --> J[Run GBC Model Inference]
    J --> K{Risk Score}
    K -->|score >= 0.7| L[🔴 HIGH RISK - Stop Payment]
    K -->|score 0.4 to 0.7| M[🟡 MEDIUM RISK - Manual Review]
    K -->|score < 0.4| N[✅ VERIFIED - Continue Payment]
    L --> O[Write Audit Log Entry]
    M --> O
    N --> O
    O --> P[Update Dashboard in Real Time]
```

---

## ☁️ Cloud Deployment Architecture

```mermaid
flowchart LR
    Officer --> CDN
    CDN --> Frontend

    Frontend --> APIGateway
    APIGateway --> Backend
    Backend --> MLEngine
    Backend --> Database
    Backend --> Cache
    MLEngine --> Backend
    Backend --> APIGateway
    APIGateway --> Frontend
    Frontend --> Officer

    subgraph Frontend_Layer["Frontend Layer"]
        Frontend[React + Tailwind Dashboard]
    end

    subgraph Backend_Layer["Backend Layer"]
        Backend[FastAPI Server]
        MLEngine[GBC Inference Engine]
        Database[(SQLite / PostgreSQL)]
        Cache[(Redis Cache)]
    end

    subgraph Cloud_Layer["Cloud Layer"]
        CDN[Content Delivery Network]
        APIGateway[API Gateway + Auth]
    end
```

---

## 🔁 Request Lifecycle

```mermaid
sequenceDiagram
    participant O as Officer
    participant F as React Frontend
    participant A as FastAPI Backend
    participant M as ML Engine
    participant D as Death Registry
    participant P as Payment System

    O->>F: Trigger bulk verification
    F->>A: POST /api/verify/bulk
    A->>D: Cross-reference name + DOB + district
    D-->>A: Match results
    A->>M: Forward 9-signal feature vector
    M-->>A: risk_score: 0.87, confidence: 0.94

    alt risk_score >= 0.7
        A->>P: SUSPEND payments for beneficiary
        P-->>A: Hold confirmed
        A-->>F: Flag as HIGH_RISK 🔴
    else risk_score 0.4 to 0.7
        A-->>F: Flag as MEDIUM_RISK 🟡
    else risk_score < 0.4
        A-->>F: Mark VERIFIED ✅
    end

    F-->>O: Dashboard updated with full audit trail
```

---

## 🤖 Machine Learning Model

DigiVerify AI uses a **Gradient Boosting Classifier** trained on 5,000 synthetic beneficiary records with realistic fraud injection patterns.

### ML Feature Pipeline

```mermaid
flowchart LR
    subgraph Input["Raw Input"]
        A[Beneficiary Record]
        B[Transaction History]
        C[Death Registry Match]
        D[Aadhaar Status]
    end

    subgraph Features["9-Signal Feature Vector"]
        F1[death_record_match · 0.41]
        F2[aadhaar_not_verified · 0.18]
        F3[location_mismatch_score · 0.14]
        F4[age_anomaly · 0.09]
        F5[life_cert_overdue_days · 0.07]
        F6[withdrawal_post_inactivity · 0.05]
        F7[txn_frequency_zscore · 0.03]
        F8[bank_acct_reuse · 0.02]
        F9[district_mismatch · 0.01]
    end

    subgraph Model["GBC Model"]
        SC[StandardScaler]
        GBC[GradientBoostingClassifier]
        OUT[risk_score + action]
    end

    Input --> Features
    Features --> SC
    SC --> GBC
    GBC --> OUT
```

### Model Performance

| Metric | Value |
|--------|-------|
| Accuracy | **94.5%** |
| AUC-ROC | **0.967** |
| Precision | 81.0% |
| Recall | 75.4% |
| F1-Score | 78.1% |
| False Positive Rate | 2.3% |

---

## 📂 Project Structure

```
digiverify-ai/
│
├── AIModels/
│   └── Anomaly_Detection_Models/
│       └── model1/
│           ├── train.ipynb                    ← EDA, training, evaluation
│           └── beneficiary_dataset_5000.csv   ← Synthetic training corpus
│
├── backend/
│   └── app.py                                 ← FastAPI routes + handlers
│
├── ReactFrontend/
│   └── fund_tracker/
│       └── src/
│           ├── components/                    ← Dashboard, FlaggedCases, Reports
│           └── api/                           ← Axios client wrappers
│
├── frontend/
│   └── dashboard.py                           ← Streamlit analytics view
│
├── ml_models/
│   ├── deceased_beneficiary_detector.py       ← GBC model + feature engineering
│   └── fraud_detector.joblib                  ← Serialized trained model
│
├── data/
│   ├── generate_demo_data.py                  ← Faker-based data generator
│   ├── beneficiaries.csv
│   ├── death_records.csv
│   ├── transactions.csv
│   └── life_certificates.csv
│
├── generate_risk_scores.py
├── quick_start.py
└── requirements.txt
```

---

## 🔧 API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/verify/beneficiary` | POST | Verify single beneficiary |
| `/api/verify/bulk` | POST | Bulk verify up to 10,000 records |
| `/api/death-record/check` | POST | Cross-reference death registry |
| `/api/aadhaar/verify` | POST | Trigger OTP / biometric liveness check |
| `/api/life-certificate/submit` | POST | Submit and validate life certificate |

### Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/summary` | GET | Aggregate monitoring stats |
| `/api/dashboard/flagged-cases` | GET | Paginated high-risk case list |
| `/api/reports/fraud-prevention` | GET | Impact report with projections |
| `/api/simulate/stop-payments` | POST | Demo: simulate payment hold |

---

## ⚙️ Installation & Setup

```bash
# Clone the repository
git clone https://github.com/shanky-ux/digiverify-ai.git
cd digiverify-ai

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux / Mac
.venv\Scripts\activate           # Windows

# Install Python dependencies
pip install -r requirements.txt

# Generate synthetic demo data
python data/generate_demo_data.py
```

### Run the Backend

```bash
cd backend
python app.py
# API running at   http://localhost:5000
# Swagger UI at    http://localhost:5000/docs
```

### Run the React Dashboard

```bash
cd ReactFrontend/fund_tracker
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### Run Streamlit Analytics (Optional)

```bash
streamlit run frontend/dashboard.py
# Analytics at http://localhost:8501
```

### One-Command Start

```bash
python quick_start.py
```

---

## 🌐 Environment Variables

Create a `.env` file in the root directory:

```
VITE_API_BASE_URL=http://localhost:5000
```

Access inside React:

```js
const baseURL = import.meta.env.VITE_API_BASE_URL;
```

---

## 📈 Impact Metrics

| Metric | Value |
|--------|-------|
| Beneficiaries Analyzed | 5,000 |
| Deceased Detected | ~748 (14.96%) |
| High-Risk Cases | ~320 |
| Monthly Fraud Prevented | ₹2.3+ Crores |
| Annual Projection | ₹28+ Crores |
| Processing Speed | <200ms per beneficiary |
| Bulk Throughput | 10,000 records / 45 seconds |

---

## ✨ Key Features

- AI-powered deceased beneficiary detection with 94.5% accuracy
- Real-time cross-referencing with Civil Registration System death records
- Aadhaar OTP / biometric liveness verification
- Automated payment suspension for high-risk cases
- Dual frontend — React dashboard for officers, Streamlit for analytics
- Immutable audit trail for every verification and action
- Bulk processing — 10,000 records in under a minute
- Modular, backend-ready ML API architecture

---

## 🚀 Future Enhancements

- Real National Death Registry and UIDAI API integration
- PostgreSQL migration for production scale
- Async bulk processing with Celery and Redis
- LSTM-based time-series anomaly detection
- Fraud ring detection via network graph analysis
- React Native mobile app for field officers
- Blockchain-backed immutable audit trail
- Smart contract for auto-payment suspension

---

## 🔐 Security Notes

- No real PII stored — all demo data is Faker-generated and fully synthetic
- Aadhaar integration is mocked; production uses the official UIDAI sandbox API
- Death registry uses simulated CRS data; production integrates with eNagar Seva
- Every action — verification, flag, or payment hold — is logged to an immutable audit record

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| ML | Scikit-learn — Gradient Boosting Classifier |
| Backend | FastAPI + Uvicorn |
| Data Processing | Pandas, NumPy |
| Database | SQLite → PostgreSQL (production) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Analytics | Streamlit |
| Model Serialization | Joblib |
| Synthetic Data | Faker |

---

## 👨‍💻 Author

**Ravi Shankar**
B.Tech Computer Science (AIML)
Full Stack Developer | AI Enthusiast

GitHub: https://github.com/shanky-ux

---

## 📜 License

This project is licensed under the MIT License — built for educational and hackathon purposes.

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:24243e,50:302b63,100:0f0c29&height=120&section=footer"/>
</p>
