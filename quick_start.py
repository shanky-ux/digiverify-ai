"""
AI14 - Quick Start Script
=========================
Run this script to quickly set up and demo the fraud detection system.

Usage:
    python quick_start.py
"""

import os
import sys
import subprocess
import time

def print_banner():
    print("=" * 60)
    print("  AI14 - DECEASED BENEFICIARY FRAUD DETECTION SYSTEM")
    print("=" * 60)
    print()

def check_dependencies():
    """Check if required packages are installed."""
    print("[1/5] Checking dependencies...")

    required = ['pandas', 'numpy', 'sklearn', 'fastapi', 'uvicorn', 'streamlit']
    missing = []

    for pkg in required:
        try:
            __import__(pkg.replace('-', '_'))
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"  ⚠️  Missing packages: {', '.join(missing)}")
        print("  Installing missing packages...")
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing)
        print("  ✓ Dependencies installed")
    else:
        print("  ✓ All dependencies installed")

    print()

def generate_data():
    """Generate demo data."""
    print("[2/5] Generating demo data...")

    from data.generate_demo_data import save_demo_data
    save_demo_data('data')
    print()

def train_model():
    """Train the ML model."""
    print("[3/5] Training fraud detection model...")

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from ml_models.deceased_beneficiary_detector import DeceasedBeneficiaryDetector, generate_synthetic_data
    import pandas as pd

    # Try to load existing data
    try:
        df = pd.read_csv("data/beneficiaries.csv")
        print(f"  ✓ Loaded {len(df)} beneficiary records")
    except:
        df = generate_synthetic_data(5000)
        df.to_csv("data/beneficiary_dataset_5000.csv", index=False)
        print("  ✓ Generated synthetic training data")

    # Train model
    detector = DeceasedBeneficiaryDetector()
    detector.fit(df)
    detector.save_model("ml_models/fraud_detector.joblib")
    print()

def show_menu():
    """Show interactive menu."""
    print("=" * 60)
    print("  SETUP COMPLETE! Choose an option:")
    print("=" * 60)
    print()
    print("  1. Start Backend API Server")
    print("  2. Start Frontend Dashboard")
    print("  3. Run Quick Demo (CLI)")
    print("  4. Exit")
    print()

    choice = input("Enter choice (1-4): ").strip()

    if choice == '1':
        print("\nStarting Backend API Server...")
        print("API will be available at: http://localhost:8000")
        print("Press Ctrl+C to stop\n")
        os.system("python backend/app.py")

    elif choice == '2':
        print("\nStarting Frontend Dashboard...")
        print("Dashboard will be available at: http://localhost:8501")
        print("Make sure the API server is running first!")
        print("Press Ctrl+C to stop\n")
        os.system("streamlit run frontend/dashboard.py")

    elif choice == '3':
        run_quick_demo()

    elif choice == '4':
        print("\nGoodbye!")
        sys.exit(0)

def run_quick_demo():
    """Run a quick CLI demo."""
    print("\n" + "=" * 60)
    print("  QUICK DEMO")
    print("=" * 60)
    print()

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from ml_models.deceased_beneficiary_detector import DeceasedBeneficiaryDetector
    import pandas as pd
    import joblib

    # Load model
    try:
        detector = DeceasedBeneficiaryDetector()
        detector.load_model("ml_models/fraud_detector.joblib")
        print("✓ Model loaded")
    except:
        print("⚠ Model not found. Please run full setup first.")
        return

    # Load data
    try:
        df = pd.read_csv("data/beneficiaries.csv")
        print(f"✓ Loaded {len(df)} beneficiaries")
    except:
        print("⚠ Data not found. Please run full setup first.")
        return

    print()

    # Show statistics
    print("=== BENEFICIARY STATISTICS ===")
    print(f"Total Beneficiaries: {len(df)}")
    print(f"Fraud Cases (Ground Truth): {(df['fraud_label']==1).sum()}")
    print(f"Death Records Matched: {df['death_record_match'].sum()}")
    print(f"Total Monthly Amount: ₹{df['monthly_amount'].sum():,}")
    print()

    # Run predictions
    print("=== RUNNING AI DETECTION ===")
    predictions, probabilities = detector.predict(df)

    # Show sample predictions
    sample = df.sample(5, random_state=42).copy()
    sample['fraud_probability'] = [probabilities[df.index.get_loc(i)] for i in sample.index]
    sample['predicted_fraud'] = predictions[[df.index.get_loc(i) for i in sample.index]]

    print("\nSample Predictions:")
    print(sample[['beneficiary_id', 'fraud_label', 'fraud_probability', 'predicted_fraud']].to_string())
    print()

    # Calculate impact
    detected_deceased = df[df['death_record_match'] == 1]
    potential_savings = detected_deceased['monthly_amount'].sum()

    print("=== FRAUD PREVENTION IMPACT ===")
    print(f"Deceased Beneficiaries Detected: {len(detected_deceased)}")
    print(f"Monthly Fraud Prevented: ₹{potential_savings:,}")
    print(f"Annual Projection: ₹{potential_savings * 12:,}")
    print()

    print("✓ Demo complete!")
    print()
    input("Press Enter to return to menu...")

if __name__ == "__main__":
    print_banner()
    check_dependencies()
    generate_data()
    train_model()
    show_menu()
