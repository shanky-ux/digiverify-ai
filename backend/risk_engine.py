"""
DigiVerify Risk Scoring Engine
================================
Uses Isolation Forest (anomaly detection) + rule-based signals
to compute fraud_probability and anomaly_score for each user.

Called by the Flask backend's /seed and /admin/recompute_risk endpoints.
No training data file required — fits on the seeded population itself.
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


def _user_to_features(u):
    """
    Convert a dict of user attributes to a numeric feature vector.
    Mirrors the logic in comprehensive_model_suite.py create_features().
    """
    age = u.get('age', 35)
    income = u.get('income', 50000) or 50000
    tx_freq = u.get('transaction_frequency', 2)
    last_tx_days = u.get('last_transaction_days', 30)
    aadhaar_verified = int(u.get('aadhaar_verified', 1))
    death_record = int(u.get('death_record_match', 0))
    location_mismatch = int(u.get('location_mismatch', 0))
    bank_reuse = u.get('bank_account_reuse', 0)
    num_schemes = u.get('num_schemes', 1)
    is_bpl = int(u.get('is_bpl', 0))

    age_risk = int(age >= 80)
    very_old = int(age >= 100)
    tx_per_day = tx_freq / (last_tx_days + 1)
    high_freq = int(tx_freq >= 10)
    high_reuse = int(bank_reuse > 2)
    combined_risk = (death_record * 3 + location_mismatch * 2 +
                     (1 - aadhaar_verified) + very_old * 2 + high_reuse)

    return [
        age, income / 100000,
        tx_freq, last_tx_days,
        aadhaar_verified, death_record, location_mismatch,
        bank_reuse, num_schemes,
        age_risk, very_old, tx_per_day, high_freq, high_reuse,
        combined_risk, is_bpl,
    ]


def _rule_based_probability(u):
    """
    Rule-based fraud score (0–1) that mirrors the ML signal.
    Used as a supplement to IsolationForest's anomaly score.
    """
    score = 0.05
    if u.get('age', 35) >= 100:
        score += 0.35
    elif u.get('age', 35) >= 85:
        score += 0.15
    if u.get('death_record_match', 0):
        score += 0.40
    if not u.get('aadhaar_verified', 1):
        score += 0.15
    if u.get('location_mismatch', 0):
        score += 0.10
    if u.get('bank_account_reuse', 0) > 2:
        score += 0.10
    if u.get('transaction_frequency', 2) >= 15:
        score += 0.08
    if (u.get('income', 50000) or 50000) > 800000 and u.get('is_bpl', 0):
        score += 0.20
    if u.get('num_schemes', 1) >= 6:
        score += 0.05
    return min(score, 0.99)


def compute_risk_scores(user_data_list):
    """
    Given a list of user attribute dicts, return a list of dicts:
      { user_id, anomaly_score, fraud_probability, risk_level }

    user_data_list items must have:
      user_id, age, income, transaction_frequency, last_transaction_days,
      aadhaar_verified, death_record_match, location_mismatch,
      bank_account_reuse, num_schemes, is_bpl
    """
    if not user_data_list:
        return []

    features = [_user_to_features(u) for u in user_data_list]
    X = np.array(features, dtype=float)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # IsolationForest: contamination ~15% (realistic for welfare fraud)
    iso = IsolationForest(n_estimators=200, contamination=0.15, random_state=42)
    iso.fit(X_scaled)
    raw_scores = iso.decision_function(X_scaled)  # higher = more normal

    # Normalize to [0,1] anomaly score (higher = more anomalous)
    min_s, max_s = raw_scores.min(), raw_scores.max()
    if max_s == min_s:
        anomaly_scores = [0.1] * len(raw_scores)
    else:
        anomaly_scores = [float(1 - (s - min_s) / (max_s - min_s)) for s in raw_scores]

    results = []
    for i, u in enumerate(user_data_list):
        rule_prob = _rule_based_probability(u)
        anomaly = anomaly_scores[i]
        # Blend: 60% rule-based, 40% isolation-forest anomaly
        fraud_prob = round(0.6 * rule_prob + 0.4 * anomaly, 4)
        fraud_prob = min(fraud_prob, 0.99)

        if fraud_prob < 0.30:
            risk_level = 'low'
        elif fraud_prob < 0.60:
            risk_level = 'medium'
        else:
            risk_level = 'high'

        results.append({
            'user_id': u['user_id'],
            'anomaly_score': round(anomaly, 4),
            'fraud_probability': fraud_prob,
            'risk_level': risk_level,
        })
    return results
