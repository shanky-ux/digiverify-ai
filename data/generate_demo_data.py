"""
AI14 - Demo Data Generator
==========================
Generates realistic synthetic data for the fraud detection system.
Creates:
- Beneficiary database
- Death records (simulated government database)
- Transaction logs
- Life certificate records
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import random


def generate_beneficiaries(n=5000, fraud_rate=0.15):
    """
    Generate synthetic beneficiary data.

    Parameters:
    - n: Number of beneficiaries
    - fraud_rate: Percentage of deceased beneficiaries (fraud cases)
    """
    np.random.seed(42)
    random.seed(42)

    beneficiaries = []

    # Indian name components for realistic names
    first_names = [
        'Ramesh', 'Suresh', 'Mahesh', 'Rajesh', 'Mukesh', 'Arun', 'Varun',
        'Deepak', 'Sanjay', 'Vijay', 'Asha', 'Usha', 'Sunita', 'Rekha',
        'Meena', 'Kavita', 'Priya', 'Neha', 'Anita', 'Geeta', 'Ravi',
        'Kumar', 'Singh', 'Sharma', 'Patel', 'Reddy', 'Nair', 'Iyer'
    ]

    last_names = [
        'Kumar', 'Singh', 'Sharma', 'Patel', 'Reddy', 'Nair', 'Iyer',
        'Gupta', 'Agarwal', 'Jain', 'Verma', 'Malhotra', 'Kapoor',
        'Rao', 'Menon', 'Pillai', 'Das', 'Roy', 'Chatterjee'
    ]

    states = [
        'Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat',
        'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Kerala', 'Punjab'
    ]

    for i in range(n):
        ben_id = f'B{i+1:05d}'

        # Generate age distribution (more elderly for social security)
        if random.random() < 0.3:
            age = np.random.randint(60, 80)
        elif random.random() < 0.5:
            age = np.random.randint(80, 100)
        else:
            age = np.random.randint(45, 60)

        # Determine if this is a fraud case
        is_fraud = random.random() < fraud_rate

        # Base values
        monthly_amount = np.random.randint(1500, 6000)
        last_transaction_days = np.random.exponential(30)
        transaction_frequency = np.random.poisson(3) + 1
        aadhaar_verified = 1 if random.random() < 0.85 else 0
        bank_reuse = np.random.poisson(1) + 1
        location_mismatch = 1 if random.random() < 0.08 else 0
        death_record = 0

        # Fraud case characteristics
        if is_fraud:
            death_record = 1 if random.random() < 0.7 else 0
            location_mismatch = 1 if random.random() < 0.4 else 0
            aadhaar_verified = 1 if random.random() < 0.5 else 0
            bank_reuse = np.random.randint(2, 6)
            last_transaction_days = np.random.exponential(100) + 50
            fraud_label = 1
        else:
            fraud_label = 0
            # Some elderly non-fraud cases
            if age >= 95:
                fraud_label = 1 if random.random() < 0.3 else 0

        beneficiaries.append({
            'beneficiary_id': ben_id,
            'name': f"{random.choice(first_names)} {random.choice(last_names)}",
            'age': int(age),
            'state': random.choice(states),
            'last_transaction_days': min(int(last_transaction_days), 365),
            'monthly_amount': int(monthly_amount),
            'transaction_frequency': min(int(transaction_frequency), 10),
            'aadhaar_verified': aadhaar_verified,
            'bank_account_reuse_count': int(bank_reuse),
            'death_record_match': death_record,
            'location_mismatch': location_mismatch,
            'fraud_label': fraud_label
        })

    return pd.DataFrame(beneficiaries)


def generate_death_records(beneficiaries_df):
    """
    Generate simulated death registration records.
    In production, this would come from government databases.
    """
    deceased = beneficiaries_df[beneficiaries_df['death_record_match'] == 1]

    death_records = []
    for _, row in deceased.iterrows():
        death_date = datetime.now() - timedelta(days=random.randint(30, 730))
        birth_year = datetime.now().year - row['age']

        death_records.append({
            'death_reg_number': f'DR{random.randint(100000, 999999)}',
            'name': row['name'],
            'date_of_birth': f'{birth_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}',
            'date_of_death': death_date.strftime('%Y-%m-%d'),
            'state': row['state'],
            'district': f'District_{random.randint(1, 50)}',
            'cause_of_death': random.choice([
                'Natural', 'Cardiac Arrest', 'Age-related',
                'Illness', 'Accident'
            ]),
            'registration_date': (death_date + timedelta(days=random.randint(1, 30))).strftime('%Y-%m-%d'),
            'registrar_office': f'Registrar Office - {row["state"]}'
        })

    return pd.DataFrame(death_records)


def generate_transaction_logs(beneficiaries_df, months=12):
    """
    Generate transaction history for beneficiaries.
    """
    transactions = []

    for _, row in beneficiaries_df.iterrows():
        # Determine number of transactions based on frequency
        num_transactions = row['transaction_frequency'] * months

        for j in range(num_transactions):
            tx_date = datetime.now() - timedelta(days=random.randint(1, 365))

            # Fraud cases often have irregular patterns
            if row['fraud_label'] == 1:
                amount_variance = np.random.normal(row['monthly_amount'], row['monthly_amount'] * 0.3)
            else:
                amount_variance = np.random.normal(row['monthly_amount'], row['monthly_amount'] * 0.1)

            transactions.append({
                'transaction_id': f'TXN{random.randint(1000000, 9999999)}',
                'beneficiary_id': row['beneficiary_id'],
                'transaction_date': tx_date.strftime('%Y-%m-%d'),
                'amount': max(100, int(amount_variance)),
                'status': random.choice(['SUCCESS', 'SUCCESS', 'SUCCESS', 'FAILED', 'PENDING']),
                'payment_mode': random.choice(['Direct Transfer', 'Bank Transfer', 'Post Office']),
                'location': row['state'] if row['location_mismatch'] == 0 else random.choice(['Delhi', 'Mumbai', 'Bangalore'])
            })

    return pd.DataFrame(transactions)


def generate_life_certificates(beneficiaries_df):
    """
    Generate life certificate submission records.
    """
    certificates = []

    # Only active beneficiaries submit certificates
    active = beneficiaries_df[beneficiaries_df['fraud_label'] == 0]
    sample = active.sample(frac=0.6, random_state=42)  # 60% compliance

    for _, row in sample.iterrows():
        cert_date = datetime.now() - timedelta(days=random.randint(1, 365))

        certificates.append({
            'certificate_id': f'LC{random.randint(100000, 999999)}',
            'beneficiary_id': row['beneficiary_id'],
            'submission_date': cert_date.strftime('%Y-%m-%d'),
            'certificate_type': random.choice(['Biometric', 'OTP', 'Physical']),
            'verification_status': 'VERIFIED',
            'valid_until': (cert_date + timedelta(days=365)).strftime('%Y-%m-%d'),
            'submission_location': random.choice(['Online', 'Pension Office', 'Bank Branch'])
        })

    return pd.DataFrame(certificates)


def save_demo_data(output_dir='data'):
    """Generate and save all demo datasets."""
    print("="*60)
    print("AI14 - Generating Demo Data")
    print("="*60)

    # Generate beneficiaries
    print("\n[1/4] Generating beneficiary database...")
    beneficiaries = generate_beneficiaries(5000)
    beneficiaries.to_csv(f'{output_dir}/beneficiaries.csv', index=False)
    print(f"  [OK] Created {len(beneficiaries)} beneficiary records")
    print(f"  [OK] Fraud cases: {beneficiaries['fraud_label'].sum()} ({beneficiaries['fraud_label'].mean()*100:.1f}%)")

    # Generate death records
    print("\n[2/4] Generating death registration records...")
    death_records = generate_death_records(beneficiaries)
    death_records.to_csv(f'{output_dir}/death_records.csv', index=False)
    print(f"  [OK] Created {len(death_records)} death records")

    # Generate transactions
    print("\n[3/4] Generating transaction logs...")
    transactions = generate_transaction_logs(beneficiaries)
    transactions.to_csv(f'{output_dir}/transactions.csv', index=False)
    print(f"  [OK] Created {len(transactions)} transaction records")

    # Generate life certificates
    print("\n[4/4] Generating life certificate records...")
    certificates = generate_life_certificates(beneficiaries)
    certificates.to_csv(f'{output_dir}/life_certificates.csv', index=False)
    print(f"  [OK] Created {len(certificates)} life certificate records")

    # Summary
    print("\n" + "="*60)
    print("DATA GENERATION COMPLETE")
    print("="*60)
    print(f"\n    Files created in '{output_dir}/':")
    print(f"    - beneficiaries.csv ({len(beneficiaries)} records)")
    print(f"    - death_records.csv ({len(death_records)} records)")
    print(f"    - transactions.csv ({len(transactions)} records)")
    print(f"    - life_certificates.csv ({len(certificates)} records)")
    print(f"\n    Key Statistics:")
    print(f"    - Total monthly disbursement: Rs.{beneficiaries['monthly_amount'].sum():,}")
    print(f"    - Potential fraud amount: Rs.{beneficiaries[beneficiaries['fraud_label']==1]['monthly_amount'].sum():,}")
    print(f"    - Average beneficiary age: {beneficiaries['age'].mean():.1f} years\n")

    return {
        'beneficiaries': beneficiaries,
        'death_records': death_records,
        'transactions': transactions,
        'life_certificates': certificates
    }


if __name__ == "__main__":
    save_demo_data()
