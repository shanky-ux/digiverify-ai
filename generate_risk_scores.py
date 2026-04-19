"""
Generate risk scores from trained models
"""
import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

# Load data
beneficiaries = pd.read_csv('data/enhanced_beneficiaries.csv')
print(f"Loaded {len(beneficiaries)} beneficiaries")

# Prepare features (same as in training)
features = beneficiaries.copy()

features['age_risk'] = (features['age'] >= 80).astype(int)
features['very_old'] = (features['age'] >= 100).astype(int)
features['age_group'] = pd.cut(features['age'], bins=[0, 30, 60, 80, 100, 150], labels=[0, 1, 2, 3, 4]).astype(int)

features['high_frequency'] = (features['transaction_frequency'] >= 11).astype(int)
features['inactivity_days'] = features['last_transaction_days'].apply(lambda x: min(x, 365))
features['transaction_per_day'] = features['transaction_frequency'] / (features['inactivity_days'] + 1)

features['aadhaar_not_verified'] = (features['aadhaar_verified'] == 0).astype(int)
features['bank_not_verified'] = (features['bank_verified'] == 0).astype(int)
features['unverified_count'] = features['aadhaar_not_verified'] + features['bank_not_verified']

features['death_record_flag'] = features['death_record_match'].astype(int)
features['location_mismatch_flag'] = features['location_mismatch'].astype(int)
features['high_reuse'] = (features['bank_account_reuse_count'] > 2).astype(int)
features['duplicate_flag'] = (features['duplicate_accounts'] > 0).astype(int)

features['name_match_risk'] = 1 - features['name_match_score']
features['poor_name_match'] = (features['name_match_score'] < 0.8).astype(int)

features['combined_risk'] = (
    features['death_record_flag'] * 3 +
    features['location_mismatch_flag'] * 2 +
    features['aadhaar_not_verified'] * 1.5 +
    features['very_old'] * 2 +
    features['high_reuse'] * 1.5 +
    features['poor_name_match'] * 1
)

features['life_cert_missing'] = features['last_life_certificate_date'].isna().astype(int)

# Get feature columns
feature_columns = [col for col in features.columns if col not in 
                   ['beneficiary_id', 'name', 'state', 'scheme_type', 'registration_date', 
                    'last_life_certificate_date', 'is_fraud']]

print(f"Using {len(feature_columns)} features")

# Scale and prepare
scaler = StandardScaler()
X = features[feature_columns].values
X_scaled = scaler.fit_transform(X)

# Load ensemble model
try:
    ensemble_model = joblib.load('ml_models/ensemble_ensemble.joblib')
    print("Loaded ensemble model")
except Exception as e:
    print(f"Warning: Could not load ensemble model: {e}")
    ensemble_model = None

# Load individual models for ensemble voting
models = {}
model_files = ['logistic_regression_model.joblib', 'random_forest_model.joblib', 
               'xgboost_model.joblib', 'lightgbm_model.joblib', 'gradient_boosting_model.joblib']

for mf in model_files:
    try:
        models[mf.replace('_model.joblib', '')] = joblib.load(f'ml_models/{mf}')
    except:
        pass

print(f"Loaded {len(models)} individual models")

# Generate predictions using ensemble of models
if len(models) >= 3:
    print("Generating ensemble predictions...")
    predictions = np.zeros((len(X_scaled), len(models)))
    
    for idx, (name, model) in enumerate(models.items()):
        try:
            proba = model.predict_proba(X_scaled)[:, 1]
            predictions[:, idx] = proba
        except Exception as e:
            print(f"Warning predicting with {name}: {e}")
    
    # Average ensemble
    ensemble_predictions = predictions.mean(axis=1)
else:
    print("Using simple fraud probability calculation...")
    ensemble_predictions = (
        features['death_record_flag'] * 0.35 +
        features['location_mismatch_flag'] * 0.25 +
        features['aadhaar_not_verified'] * 0.15 +
        features['very_old'] * 0.20 +
        features['high_reuse'] * 0.10 +
        features['combined_risk'] / 10 * 0.05
    ).clip(0, 1)

# Create risk scores dataframe
risk_scores = pd.DataFrame({
    'beneficiary_id': beneficiaries['beneficiary_id'],
    'fraud_probability': ensemble_predictions,
})

risk_scores['risk_level'] = pd.cut(
    risk_scores['fraud_probability'],
    bins=[0, 0.3, 0.6, 0.8, 1.0],
    labels=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
)

risk_scores['death_record_match'] = beneficiaries['death_record_match']
risk_scores['aadhaar_verified'] = beneficiaries['aadhaar_verified']
risk_scores['location_mismatch'] = beneficiaries['location_mismatch']
risk_scores['age'] = beneficiaries['age']

# Add risk factors
def explain_risk(row):
    factors = []
    if row['death_record_match'] == 1:
        factors.append("⚠️ Death record found")
    if row['aadhaar_verified'] == 0:
        factors.append("⚠️ Aadhaar not verified")
    if row['location_mismatch'] == 1:
        factors.append("⚠️ Location mismatch")
    if row['age'] >= 100:
        factors.append(f"⚠️ Centenarian ({row['age']} yrs)")
    if row['fraud_probability'] > 0.8:
        factors.append("🚨 High fraud probability")
    
    return " | ".join(factors) if factors else "✓ No major risk factors"

risk_scores['risk_factors'] = risk_scores.apply(explain_risk, axis=1)

# Save
risk_scores.to_csv('data/risk_scores.csv', index=False)
print(f"\n✅ Risk scores saved!")
print(f"   CRITICAL: {(risk_scores['risk_level'] == 'CRITICAL').sum()}")
print(f"   HIGH: {(risk_scores['risk_level'] == 'HIGH').sum()}")
print(f"   MEDIUM: {(risk_scores['risk_level'] == 'MEDIUM').sum()}")
print(f"   LOW: {(risk_scores['risk_level'] == 'LOW').sum()}")
