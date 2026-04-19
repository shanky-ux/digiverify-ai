"""
AI14 - Deceased Beneficiary Fraud Detection System
===================================================
This module contains the ML model for detecting potential fraud cases
where social security funds are being transferred to deceased beneficiaries.

Features:
- Death record matching
- Aadhaar verification integration
- Transaction anomaly detection
- Risk scoring model
- Life certificate prediction
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')


class DeceasedBeneficiaryDetector:
    """
    ML-based detector for identifying deceased beneficiary fraud.

    Uses multiple signals:
    - Age anomalies (beneficiaries > 100 years)
    - Transaction patterns (unusual frequency after supposed death)
    - Death record matching
    - Aadhaar verification status
    - Location mismatches
    - Bank account reuse patterns
    """

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = None
        self.is_fitted = False

    def create_features(self, df):
        """Create advanced features for fraud detection."""
        features = df.copy()

        # Age-based risk features
        features['age_risk'] = (features['age'] >= 80).astype(int)
        features['very_old'] = (features['age'] >= 100).astype(int)

        # Transaction behavior features
        features['high_frequency'] = (features['transaction_frequency'] >= 5).astype(int)
        features['transaction_per_day'] = features['transaction_frequency'] / (features['last_transaction_days'] + 1)

        # Death record indicator
        features['death_record_flag'] = features['death_record_match'].astype(int)

        # Aadhaar verification
        features['aadhaar_not_verified'] = (features['aadhaar_verified'] == 0).astype(int)

        # Location mismatch
        features['location_mismatch_flag'] = features['location_mismatch'].astype(int)

        # Bank account reuse (potential family member using same account)
        features['high_reuse'] = (features['bank_account_reuse_count'] > 2).astype(int)

        # Combined risk score
        features['combined_risk'] = (
            features['death_record_flag'] * 3 +
            features['location_mismatch_flag'] * 2 +
            features['aadhaar_not_verified'] +
            features['very_old'] * 2 +
            features['high_reuse']
        )

        return features

    def fit(self, df, feature_columns=None):
        """Train the fraud detection model."""
        print("Training Deceased Beneficiary Fraud Detection Model...")

        # Create features
        features_df = self.create_features(df)

        # Prepare features and target
        if feature_columns is None:
            feature_columns = [
                'age', 'last_transaction_days', 'monthly_amount',
                'transaction_frequency', 'aadhaar_verified',
                'bank_account_reuse_count', 'death_record_match',
                'location_mismatch', 'age_risk', 'very_old',
                'high_frequency', 'transaction_per_day',
                'death_record_flag', 'aadhaar_not_verified',
                'location_mismatch_flag', 'high_reuse', 'combined_risk'
            ]

        self.feature_columns = feature_columns

        X = features_df[feature_columns].values
        y = features_df['fraud_label'].values

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )

        # Train model with class weight balancing
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )

        self.model.fit(X_train, y_train)

        # Evaluate
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)[:, 1]

        print("\n" + "="*50)
        print("MODEL EVALUATION")
        print("="*50)
        print(f"\nClassification Report:\n{classification_report(y_test, y_pred)}")
        print(f"\nConfusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
        print(f"\nROC-AUC Score: {roc_auc_score(y_test, y_proba):.4f}")

        # Feature importance
        importance_df = pd.DataFrame({
            'feature': feature_columns,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        print(f"\nTop 10 Feature Importances:\n{importance_df.head(10)}")

        self.is_fitted = True
        print("\nModel training completed successfully!")

        return self

    def predict(self, df):
        """Predict fraud probability for beneficiaries."""
        if not self.is_fitted:
            raise ValueError("Model must be fitted before prediction")

        features_df = self.create_features(df)
        X = features_df[self.feature_columns].values
        X_scaled = self.scaler.transform(X)

        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)[:, 1]

        return predictions, probabilities

    def calculate_risk_score(self, df):
        """
        Calculate detailed risk score for each beneficiary.
        Returns a dataframe with risk breakdown.
        """
        features_df = self.create_features(df)
        X = features_df[self.feature_columns].values
        X_scaled = self.scaler.transform(X)

        probabilities = self.model.predict_proba(X_scaled)[:, 1]

        risk_df = pd.DataFrame({
            'beneficiary_id': df['beneficiary_id'],
            'fraud_probability': probabilities,
            'risk_level': pd.cut(probabilities,
                               bins=[0, 0.3, 0.6, 0.8, 1.0],
                               labels=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
            'death_record_match': df['death_record_match'],
            'aadhaar_verified': df['aadhaar_verified'],
            'location_mismatch': df['location_mismatch'],
            'age': df['age'],
            'last_transaction_days': df['last_transaction_days']
        })

        # Add risk factors explanation
        risk_df['risk_factors'] = risk_df.apply(self._explain_risk, axis=1)

        return risk_df

    def _explain_risk(self, row):
        """Generate human-readable risk explanation."""
        factors = []
        if row['death_record_match'] == 1:
            factors.append("Death record found")
        if row['aadhaar_verified'] == 0:
            factors.append("Aadhaar not verified")
        if row['location_mismatch'] == 1:
            factors.append("Location mismatch detected")
        if row['age'] >= 100:
            factors.append(f"Very high age ({row['age']} years)")
        if row['last_transaction_days'] > 100:
            factors.append("No recent transactions")
        if row['fraud_probability'] > 0.8:
            factors.append("High fraud probability")

        return "; ".join(factors) if factors else "No significant risk factors"

    def save_model(self, path):
        """Save the trained model."""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns
        }, path)
        print(f"Model saved to {path}")

    def load_model(self, path):
        """Load a trained model."""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_columns = data['feature_columns']
        self.is_fitted = True
        print(f"Model loaded from {path}")
        return self


def generate_synthetic_data(n_samples=5000, fraud_rate=0.15):
    """
    Generate synthetic beneficiary data for training.

    Simulates:
    - Normal beneficiaries receiving social security
    - Deceased beneficiaries with continued payments (fraud)
    - Various risk indicators
    """
    np.random.seed(42)

    data = {
        'beneficiary_id': [f'B{i:05d}' for i in range(1, n_samples + 1)],
        'age': np.random.normal(65, 15, n_samples).clip(18, 120).astype(int),
        'last_transaction_days': np.random.exponential(30, n_samples).clip(0, 365).astype(int),
        'monthly_amount': np.random.normal(3000, 1000, n_samples).clip(500, 10000).astype(int),
        'transaction_frequency': np.random.poisson(3, n_samples).clip(1, 10),
        'aadhaar_verified': np.random.choice([0, 1], n_samples, p=[0.1, 0.9]),
        'bank_account_reuse_count': np.random.poisson(1, n_samples).clip(1, 5),
        'death_record_match': np.zeros(n_samples, dtype=int),
        'location_mismatch': np.random.choice([0, 1], n_samples, p=[0.95, 0.05]),
        'fraud_label': np.zeros(n_samples, dtype=int)
    }

    df = pd.DataFrame(data)

    # Create fraud cases (deceased beneficiaries)
    n_fraud = int(n_samples * fraud_rate)
    fraud_indices = np.random.choice(n_samples, n_fraud, replace=False)

    # Fraud characteristics
    df.loc[fraud_indices, 'death_record_match'] = np.random.choice([0, 1], n_fraud, p=[0.3, 0.7])
    df.loc[fraud_indices, 'location_mismatch'] = np.random.choice([0, 1], n_fraud, p=[0.6, 0.4])
    df.loc[fraud_indices, 'aadhaar_verified'] = np.random.choice([0, 1], n_fraud, p=[0.4, 0.6])
    df.loc[fraud_indices, 'bank_account_reuse_count'] = np.random.randint(2, 6, n_fraud)
    df.loc[fraud_indices, 'last_transaction_days'] = np.random.exponential(100, n_fraud).clip(30, 365).astype(int)
    df.loc[fraud_indices, 'fraud_label'] = 1

    # Some elderly beneficiaries without proper verification (suspicious)
    elderly_indices = df[df['age'] >= 95].index
    df.loc[elderly_indices, 'fraud_label'] = np.random.choice([0, 1], len(elderly_indices), p=[0.5, 0.5])

    return df


if __name__ == "__main__":
    print("="*60)
    print("AI14 - DECEASED BENEFICIARY FRAUD DETECTION SYSTEM")
    print("="*60)
    print("\nInitializing training pipeline...\n")

    # Load or generate data
    try:
        df = pd.read_csv("AIModels/Anomaly_Detection_Models/model1/beneficiary_dataset_5000.csv")
        print(f"Loaded existing dataset: {len(df)} records")
    except FileNotFoundError:
        print("Generating synthetic training data...")
        df = generate_synthetic_data(5000)
        df.to_csv("data/beneficiary_dataset_5000.csv", index=False)

    # Train model
    detector = DeceasedBeneficiaryDetector()
    detector.fit(df)

    # Save model
    detector.save_model("ml_models/fraud_detector.joblib")

    # Generate risk report for sample
    print("\n" + "="*60)
    print("SAMPLE RISK ASSESSMENT")
    print("="*60)
    risk_report = detector.calculate_risk_score(df.sample(10, random_state=42))
    print(risk_report.to_string())

    print("\n\nModel training and evaluation complete!")
    print("Ready for integration with backend API.")
