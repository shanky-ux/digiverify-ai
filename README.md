# DigiVerify AI

**Stop Social Security Funds to Deceased Beneficiaries** · AI14 Hackathon Winner 🏆

An AI-powered welfare fraud detection platform that cross-references death registries, runs ML anomaly detection, and stops payments to deceased beneficiaries — all in real time.

> "Even saving 1% of welfare fraud means crores of rupees that can feed millions of children."

---

## The Problem

India disburses **₹3.47 lakh crore** annually across schemes like PM-KISAN, NSAP, and MGNREGS. A conservative 1–2% leakage from deceased beneficiaries means **₹3,470–6,940 crore lost every year** — not from corruption, but from disconnected systems.

| Root Cause | Impact |
|---|---|
| No real-time death registry integration | Payments continue months after death |
| Manual, paper-based life certificates | Easy to forge, slow to process |
| No anomaly detection on transactions | Post-death ATM withdrawals go unnoticed |
| Reactive audits only | Fraud caught after disbursement — recovery nearly impossible |

---

## System Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │               DATA SOURCES                   │
                        │                                              │
                        │  ┌──────────┐  ┌────────┐  ┌───────────┐   │
                        │  │  Death   │  │ UIDAI  │  │   Bank    │   │
                        │  │ Registry │  │Aadhaar │  │  Records  │   │
                        │  │  (CRS)   │  │  API   │  │  (NPCI)   │   │
                        │  └────┬─────┘  └───┬────┘  └─────┬─────┘   │
                        └───────┼────────────┼─────────────┼──────────┘
                                │            │             │
                                ▼            ▼             ▼
                        ┌──────────────────────────────────────────────┐
                        │            ETL + INGESTION LAYER             │
                        │     Pandas pipeline → SQLite → Redis cache   │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │               ML ENGINE                      │
                        │                                              │
                        │   Feature Engineering  →  GBC Model          │
                        │       (9 signals)          (94.5% acc)       │
                        │                             │                │
                        │          ┌──────────────────┼──────────────┐ │
                        │          ▼                  ▼              ▼ │
                        │      HIGH RISK          MEDIUM RISK     CLEAR │
                        │      score ≥ 0.7       score 0.4–0.7  score < 0.4 │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │             FastAPI BACKEND (:5000)          │
                        │                                              │
                        │  /verify/beneficiary  /verify/bulk           │
                        │  /death-record/check  /aadhaar/verify        │
                        │  /life-certificate    /dashboard/*           │
                        └───────────────┬──────────────────┬───────────┘
                                        │                  │
                              ┌─────────▼──────┐  ┌───────▼──────────┐
                              │ React Dashboard│  │Streamlit Analytics│
                              │     :5173      │  │      :8501        │
                              └────────────────┘  └──────────────────┘
```

---

## Request Lifecycle

```
  Officer                  FastAPI               ML Engine          Payment System
     │                        │                      │                    │
     │── POST /verify/bulk ──▶│                      │                    │
     │                        │── Death Registry ──▶ │                    │
     │                        │◀─ Match results ──── │                    │
     │                        │── Aadhaar check ───▶ │                    │
     │                        │◀─ Verification ────── │                    │
     │                        │── Feature vector ───▶ │                    │
     │                        │◀─ risk_score: 0.87 ── │                    │
     │                        │                      │                    │
     │                        │  [score ≥ 0.7]       │                    │
     │                        │────── SUSPEND payment ─────────────────▶ │
     │                        │◀───── Hold confirmed ────────────────────  │
     │◀── HIGH_RISK flagged ──│                      │                    │
     │                        │  [score 0.4–0.7]     │                    │
     │◀── MEDIUM_RISK queued ─│                      │                    │
     │                        │  [score < 0.4]       │                    │
     │◀── VERIFIED ───────────│                      │                    │
     │                        │                      │                    │
     │  [Audit log entry created for every action]   │                    │
```

---

## ML Model

**Algorithm:** Gradient Boosting Classifier · **Accuracy:** 94.5% · **AUC-ROC:** 0.967

### Feature Pipeline

```
Raw Beneficiary Record
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                   FEATURE ENGINEERING                     │
│                                                           │
│  1. death_record_match         Binary    weight: 0.41     │
│  2. aadhaar_not_verified       Binary    weight: 0.18     │
│  3. location_mismatch_score    Float     weight: 0.14     │
│  4. age_anomaly (>100)         Binary    weight: 0.09     │
│  5. life_cert_overdue_days     Integer   weight: 0.07     │
│  6. withdrawal_post_inactivity Binary    weight: 0.05     │
│  7. txn_frequency_zscore       Float     weight: 0.03     │
│  8. bank_acct_reuse            Integer   weight: 0.02     │
│  9. district_mismatch          Binary    weight: 0.01     │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
            StandardScaler → GradientBoostingClassifier
              n_estimators=200, learning_rate=0.05
                   max_depth=4, subsample=0.8
                            │
                            ▼
               risk_score (0.0 → 1.0)  +  action
```

### Confusion Matrix (Test Set, n=1000)

```
                     Predicted
                  ALIVE    DECEASED
  Actual  ALIVE │ 847 TN │  23 FP │   Precision : 81.0%
         DECEASED│  32 FN │  98 TP │   Recall    : 75.4%
                                       F1-Score   : 78.1%
                                       Accuracy   : 94.5%
                                       AUC-ROC    : 0.967
```

---

## Database Schema

```
┌────────────────────────┐         ┌──────────────────────┐
│     BENEFICIARIES      │         │       SCHEMES        │
├────────────────────────┤         ├──────────────────────┤
│ beneficiary_id    PK   │──────── │ scheme_id        PK  │
│ full_name              │  FK     │ scheme_name          │
│ aadhaar_number         │         │ ministry             │
│ date_of_birth          │         │ monthly_amount       │
│ district, state        │         │ eligibility_criteria │
│ bank_account           │         └──────────────────────┘
│ scheme_id         FK   │
│ risk_score             │
│ status                 │         ┌──────────────────────┐
│ last_verified          │         │    DEATH_RECORDS     │
└────────────┬───────────┘         ├──────────────────────┤
             │                     │ record_id        PK  │
    ┌────────┼─────────┐           │ full_name            │
    │        │         │     ──── │ date_of_death        │
    ▼        ▼         ▼    match  │ district             │
┌────────┐ ┌───────┐ ┌────────┐   │ registration_no      │
│TRANSAC-│ │ LIFE  │ │ AUDIT  │   │ source               │
│TIONS   │ │ CERTS │ │  LOG   │   └──────────────────────┘
├────────┤ ├───────┤ ├────────┤
│txn_id  │ │cert_id│ │log_id  │
│amount  │ │method │ │action  │
│channel │ │expiry │ │risk_at │
│flagged │ │valid  │ │ts      │
└────────┘ └───────┘ └────────┘
```

---

## API Reference

**Base URL:** `http://localhost:5000/api` · **Docs:** `http://localhost:5000/docs`

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | System health check |
| `/verify/beneficiary` | POST | Verify single beneficiary against all sources |
| `/verify/bulk` | POST | Bulk verify up to 10,000 records (async) |
| `/death-record/check` | POST | Cross-reference Civil Registration System |
| `/aadhaar/verify` | POST | Trigger OTP/biometric liveness check |
| `/life-certificate/submit` | POST | Accept and validate life certificate |
| `/dashboard/summary` | GET | Aggregate stats for the monitoring view |
| `/dashboard/flagged-cases` | GET | Paginated high-risk case list |
| `/reports/fraud-prevention` | GET | Impact report with projections |
| `/simulate/stop-payments` | POST | Demo: simulate payment hold workflow |

### Sample: Verify Beneficiary

```bash
curl -X POST http://localhost:5000/api/verify/beneficiary \
  -H "Content-Type: application/json" \
  -d '{"beneficiary_id": "BEN-2024-10234", "scheme_id": "PM-KISAN"}'
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

### Sample: Dashboard Summary

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
│
├── AIModels/
│   └── Anomaly_Detection_Models/model1/
│       ├── train.ipynb                   ← EDA, training, evaluation
│       └── beneficiary_dataset_5000.csv  ← Synthetic training corpus
│
├── backend/
│   └── app.py                            ← FastAPI routes + handlers
│
├── ReactFrontend/fund_tracker/
│   └── src/
│       ├── components/                   ← Dashboard, FlaggedCases, Reports
│       └── api/                          ← Axios client wrappers
│
├── frontend/
│   └── dashboard.py                      ← Streamlit analytics view
│
├── ml_models/
│   ├── deceased_beneficiary_detector.py  ← GBC class + feature engineering
│   └── fraud_detector.joblib             ← Serialized trained model
│
├── data/
│   ├── generate_demo_data.py             ← Faker-based synthetic generator
│   ├── beneficiaries.csv
│   ├── death_records.csv
│   ├── transactions.csv
│   └── life_certificates.csv
│
├── generate_risk_scores.py               ← Batch scoring utility
├── quick_start.py                        ← One-command setup
└── requirements.txt
```

---

## Quick Start

**Prerequisites:** Python 3.9+ · Node.js 18+

```bash
# 1. Clone and install
git clone https://github.com/shanky-ux/digiverify-ai.git
cd digiverify-ai
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Generate demo data
python data/generate_demo_data.py

# 3. Start the backend (Terminal 1)
cd backend && python app.py
# → API at http://localhost:5000
# → Swagger UI at http://localhost:5000/docs

# 4. Start the React dashboard (Terminal 2)
cd ReactFrontend/fund_tracker && npm install && npm run dev
# → Dashboard at http://localhost:5173

# 5. Optional: Streamlit analytics (Terminal 3)
streamlit run frontend/dashboard.py
# → Analytics at http://localhost:8501

# OR: one command to start everything
python quick_start.py
```

---

## Impact

| Metric | Value |
|---|---|
| Beneficiaries analyzed | 5,000 |
| Deceased detected | ~748 (14.96%) |
| High-risk cases | ~320 |
| Monthly fraud prevented | ₹2.3+ Crores |
| Annual projection | ₹28+ Crores |
| Processing speed | <200ms per beneficiary |
| Bulk throughput | 10,000 records / 45 seconds |
| Model accuracy | 94.5% |
| AUC-ROC | 0.967 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML | Scikit-learn — Gradient Boosting Classifier |
| Backend | FastAPI + Uvicorn |
| Data Processing | Pandas, NumPy |
| Database | SQLite → PostgreSQL (production) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Analytics | Streamlit |
| Model Serialization | Joblib |
| Synthetic Data | Faker |

---

## Security Notes

- No real PII stored — all demo data is Faker-generated synthetic records
- Aadhaar integration is mocked; production uses the UIDAI sandbox API
- Death registry uses simulated CRS data; production integrates with eNagar Seva
- Every verification and payment action writes to an immutable audit log

---

## Roadmap

- [ ] PostgreSQL migration for production scale
- [ ] Async bulk processing with Celery + Redis
- [ ] Live UIDAI and National Death Registry API integration
- [ ] LSTM time-series anomaly detection
- [ ] Fraud ring detection via network graph analysis
- [ ] React Native mobile app for field officers
- [ ] Blockchain-backed immutable audit trail

---

## License

MIT — Built for educational and hackathon purposes.
