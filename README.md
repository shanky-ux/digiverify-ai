# DigiVerify AI — Stop Social Security Funds to Deceased Beneficiaries

> An AI-powered fraud detection platform that prevents crores in welfare leakage by identifying and stopping payments to deceased beneficiaries in real-time.

---

## Problem Statement

India disburses thousands of crores annually across social security schemes including PM-KISAN, NSAP, MGNREGS, and state pension programs. Even a conservative 1–2% leakage due to payments reaching deceased beneficiaries represents thousands of crores lost every year.

**Why does fraud persist today?**

- **Siloed systems** — Death registry and welfare databases have no real-time cross-reference
- **Manual life certificate process** — Paper-based verification is slow and prone to forgery
- **No ML anomaly detection** — Suspicious transaction patterns (e.g. ATM withdrawals post-death) go undetected
- **Reactive-only audits** — Fraud is caught post-disbursement, making fund recovery nearly impossible

---

## Solution Overview

DigiVerify AI is a full-stack system that:

1. **Cross-references the Death Registry** — Matches beneficiaries against Civil Registration System records using exact and fuzzy name matching
2. **Runs AI Anomaly Detection** — A Gradient Boosting Classifier scores every beneficiary on 9 risk signals even when no death record exists
3. **Verifies via Aadhaar** — Biometric/OTP liveness check through the UIDAI API (mocked for demo)
4. **Manages Life Certificates** — Tracks submission history and flags overdue certificates
5. **Provides a Real-Time Dashboard** — Officers can review flagged cases, trigger payment holds, and export reports

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA SOURCES                               │
│  Death Registry (CRS)  │  UIDAI Aadhaar  │  Bank Records  │  Welfare DB │
└────────────┬────────────┴────────┬────────┴───────┬────────┴────────┘
             │                    │                 │
             ▼                    ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ETL + INGESTION LAYER                         │
│              Pandas pipeline → SQLite → Redis hot cache             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          ML ENGINE                                  │
│   Feature Engineering (9 signals) → GBC Model → Risk Score 0–1.0   │
│   Threshold: HIGH (>0.7) │ MEDIUM (0.4–0.7) │ CLEAR (<0.4)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FastAPI BACKEND                               │
│   /verify  │  /death-record/check  │  /aadhaar/verify  │  /dashboard│
└──────────────┬──────────────────────────────┬───────────────────────┘
               │                              │
       ┌───────▼───────┐             ┌────────▼────────┐
       │ React Dashboard│             │Streamlit Analytics│
       │   :5173        │             │   :8501           │
       └────────────────┘             └───────────────────┘
```

### Request Flow

```
Officer triggers bulk verify
        │
        ▼
POST /api/verify/bulk {beneficiary_ids[]}
        │
        ├──▶ Cross-reference Death Registry (exact + fuzzy match)
        ├──▶ Check Aadhaar OTP/biometric status
        ├──▶ Pull last 6 months transaction history
        │
        ▼
Feature vector (9 signals) fed to GBC model
        │
        ├── risk_score ≥ 0.7  →  STOP_PAYMENT + flag HIGH_RISK
        ├── risk_score 0.4–0.7 →  Queue for MANUAL_REVIEW
        └── risk_score < 0.4  →  Mark VERIFIED
        │
        ▼
Audit log entry created → Dashboard updated → Officer notified
```

---

## ML Model Deep Dive

**Algorithm:** Gradient Boosting Classifier (scikit-learn)  
**Training data:** 5,000 synthetic beneficiary records with realistic fraud injection  
**Overall Accuracy:** 94.5% | **AUC-ROC:** 0.967

### Feature Set

| Rank | Feature | Type | Weight | Description |
|------|---------|------|--------|-------------|
| 1 | `death_record_match` | Binary | 0.41 | Exact/fuzzy match in CRS death registry |
| 2 | `aadhaar_not_verified` | Binary | 0.18 | UIDAI OTP/biometric check failed |
| 3 | `location_mismatch_score` | Float | 0.14 | Transaction district ≠ registered district |
| 4 | `age_anomaly` | Binary | 0.09 | Age > 100 (statistical outlier) |
| 5 | `life_cert_overdue_days` | Integer | 0.07 | Days past certificate expiry |
| 6 | `withdrawal_post_inactivity` | Binary | 0.05 | ATM withdrawal after 6+ month gap |
| 7 | `txn_frequency_zscore` | Float | 0.03 | Std deviations from normal frequency |
| 8 | `bank_acct_reuse` | Integer | 0.02 | Number of beneficiaries sharing account |
| 9 | `district_mismatch` | Binary | 0.01 | Administrative district inconsistency |

### Confusion Matrix (Test Set, n=1000)

```
                    Predicted
                 ALIVE      DECEASED
Actual  ALIVE  │ 847 (TN) │  23 (FP) │
       DECEASED│  32 (FN) │  98 (TP) │

Precision : 81.0%
Recall    : 75.4%
F1-Score  : 78.1%
Accuracy  : 94.5%
AUC-ROC   : 0.967
```

### Core Model Code

```python
# ml_models/deceased_beneficiary_detector.py

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib

class DeceasedBeneficiaryDetector:
    def __init__(self):
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.8,
                random_state=42
            ))
        ])
        self.feature_names = [
            'death_record_match', 'aadhaar_not_verified',
            'location_mismatch_score', 'age_anomaly',
            'life_cert_overdue_days', 'withdrawal_post_inactivity',
            'txn_frequency_zscore', 'bank_acct_reuse', 'district_mismatch'
        ]

    def predict_risk(self, record: dict) -> dict:
        features = self._extract_features(record)
        risk_score = self.pipeline.predict_proba([features])[0][1]
        return {
            "risk_score": round(risk_score, 4),
            "classification": self._classify(risk_score),
            "action": self._recommend_action(risk_score)
        }

    def _classify(self, score: float) -> str:
        if score >= 0.7: return "HIGH_RISK"
        if score >= 0.4: return "MEDIUM_RISK"
        return "VERIFIED"

    def _recommend_action(self, score: float) -> str:
        if score >= 0.7: return "STOP_PAYMENT"
        if score >= 0.4: return "MANUAL_REVIEW"
        return "CONTINUE"
```

---

## Database Schema

```
BENEFICIARIES
  beneficiary_id  PK
  full_name
  aadhaar_number
  date_of_birth
  district, state
  bank_account
  scheme_id       FK → SCHEMES
  risk_score
  status          [VERIFIED | HIGH_RISK | MEDIUM_RISK | STOPPED]
  last_verified

SCHEMES
  scheme_id PK
  scheme_name
  ministry
  monthly_amount
  eligibility_criteria

DEATH_RECORDS
  record_id PK
  full_name
  date_of_death
  district
  registration_no
  source          [CRS | STATE_REGISTRY | HOSPITAL]

TRANSACTIONS
  txn_id PK
  beneficiary_id  FK
  amount
  txn_timestamp
  location
  channel         [ATM | BANK | UPI | AePS]
  flagged

LIFE_CERTIFICATES
  cert_id PK
  beneficiary_id  FK
  submission_date
  expiry_date
  method          [BIOMETRIC | OTP | IN_PERSON]
  is_valid

AUDIT_LOG
  log_id PK
  beneficiary_id  FK
  action
  triggered_by
  timestamp
  risk_score_at_action
```

---

## API Reference

**Base URL:** `http://localhost:5000/api`  
**Interactive Docs:** `http://localhost:5000/docs`

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check |
| `/verify/beneficiary` | POST | Verify single beneficiary |
| `/verify/bulk` | POST | Bulk verify up to 10,000 records |
| `/death-record/check` | POST | Cross-reference death registry |
| `/aadhaar/verify` | POST | Trigger OTP/biometric check |
| `/life-certificate/submit` | POST | Submit life certificate |
| `/dashboard/summary` | GET | Aggregate stats |
| `/dashboard/flagged-cases` | GET | Paginated high-risk list |
| `/reports/fraud-prevention` | GET | Impact report |
| `/simulate/stop-payments` | POST | Demo: simulate payment hold |

### Example: Verify Single Beneficiary

```bash
curl -X POST http://localhost:5000/api/verify/beneficiary \
  -H "Content-Type: application/json" \
  -d '{
    "beneficiary_id": "BEN-2024-10234",
    "aadhaar_number": "XXXX-XXXX-7823",
    "scheme_id": "PM-KISAN"
  }'
```

```json
{
  "beneficiary_id": "BEN-2024-10234",
  "status": "HIGH_RISK",
  "risk_score": 0.87,
  "flags": {
    "death_record_match": true,
    "aadhaar_not_verified": true,
    "location_mismatch": false
  },
  "recommended_action": "STOP_PAYMENT",
  "confidence": 0.94
}
```

### Example: Bulk Verification

```bash
curl -X POST http://localhost:5000/api/verify/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "beneficiary_ids": ["BEN-001", "BEN-002"],
    "scheme_id": "NSAP",
    "async": true
  }'
```

```json
{
  "job_id": "job-uuid-1234",
  "total": 5000,
  "status": "processing",
  "estimated_completion": "45s"
}
```

### Example: Dashboard Summary

```json
{
  "total_beneficiaries": 5000,
  "deceased_detected": 748,
  "high_risk_pending": 320,
  "monthly_fraud_prevented_cr": 2.3,
  "annual_projection_cr": 28,
  "model_accuracy": 0.945
}
```

---

## Project Structure

```
digiverify-ai/
├── AIModels/
│   └── Anomaly_Detection_Models/
│       └── model1/
│           ├── train.ipynb                    # EDA + training + evaluation
│           └── beneficiary_dataset_5000.csv   # Synthetic training corpus
│
├── backend/
│   └── app.py                                 # FastAPI app + all route handlers
│
├── ReactFrontend/
│   └── fund_tracker/
│       ├── src/
│       │   ├── components/                    # Dashboard, FlaggedCases, Reports
│       │   └── api/                           # Axios client wrappers
│       └── vite.config.js
│
├── frontend/
│   └── dashboard.py                           # Streamlit analytics view
│
├── ml_models/
│   ├── deceased_beneficiary_detector.py       # GBC model class + feature engineering
│   └── fraud_detector.joblib                  # Serialized trained model
│
├── data/
│   ├── generate_demo_data.py                  # Faker-based synthetic data generator
│   ├── beneficiaries.csv
│   ├── death_records.csv
│   ├── transactions.csv
│   └── life_certificates.csv
│
├── generate_risk_scores.py                    # Batch scoring utility
├── quick_start.py                             # One-command setup
└── requirements.txt
```

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+

### Setup

```bash
git clone https://github.com/shanky-ux/digiverify-ai.git
cd digiverify-ai

# Python environment
python -m venv .venv
source .venv/bin/activate        # Linux/Mac
.venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

### Generate Demo Data

```bash
python data/generate_demo_data.py
```

### Start the Backend

```bash
cd backend
python app.py
# API at http://localhost:5000
# Swagger UI at http://localhost:5000/docs
```

### Start the React Dashboard

```bash
cd ReactFrontend/fund_tracker
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### Start Streamlit Analytics (optional)

```bash
streamlit run frontend/dashboard.py
# Analytics at http://localhost:8501
```

### One-Command Start

```bash
python quick_start.py
```

---

## Impact Metrics

| Metric | Value |
|--------|-------|
| Beneficiaries Analyzed | 5,000 |
| Deceased Detected | ~748 (14.96%) |
| High-Risk Cases | ~320 |
| Monthly Fraud Prevented | ₹2.3+ Crores |
| Annual Projection | ₹28+ Crores |
| Avg. Processing Time | <200ms per beneficiary |
| Bulk Throughput | 10,000 records / 45 seconds |
| Model Accuracy | 94.5% |
| AUC-ROC | 0.967 |

---

## Security Notes

- No real PII is stored — all data is synthetic (Faker-generated)
- Aadhaar integration is mocked — production would use the UIDAI sandbox API
- Death registry uses simulated CRS data — production integrates with eNagar Seva
- Every verification and payment action is written to an immutable audit log

---

## Roadmap

- [ ] PostgreSQL migration for production scale
- [ ] Async bulk processing via Celery + Redis
- [ ] Real UIDAI and National Death Registry API integration
- [ ] LSTM-based time-series anomaly detection
- [ ] Network graph analysis for fraud ring detection
- [ ] React Native mobile app for field officers
- [ ] Blockchain-backed immutable audit trail

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML | Scikit-learn (Gradient Boosting) |
| Backend | FastAPI |
| Data Processing | Pandas, NumPy |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Analytics | Streamlit |
| Model Serialization | Joblib |
| Synthetic Data | Faker |

---

## License

MIT License — Built for educational and hackathon purposes.

---

*"Even saving 1% of welfare fraud means crores of rupees that can feed millions of children."*
