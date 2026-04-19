import pymysql
c = pymysql.connect(host='localhost', port=3306, user='root', password='root',
                    database='welfare_system', cursorclass=pymysql.cursors.DictCursor)
cur = c.cursor()
cur.execute('''SELECT u.id, u.full_name, u.aadhaar_number, u.gender, u.income, u.occupation, u.is_bpl,
               rs.fraud_probability, rs.anomaly_score, rs.risk_level
               FROM users u JOIN risk_scores rs ON rs.user_id=u.id
               WHERE rs.risk_level='high' ORDER BY rs.fraud_probability DESC''')
rows = cur.fetchall()
print(f"{'#':>3} {'ID':>4} {'Name':<22} {'Aadhaar':<14} {'Gender':<7} {'Income':>8} {'Fraud%':>7} {'BPL':>4} {'Occupation':<20}")
print("-" * 105)
for i, r in enumerate(rows, 1):
    print(f"{i:>3} {r['id']:>4} {r['full_name']:<22} {r['aadhaar_number']:<14} {r['gender']:<7} {float(r['income']):>8.0f} {float(r['fraud_probability'])*100:>6.1f}% {r['is_bpl']:>4} {r.get('occupation','N/A') or 'N/A':<20}")
print(f"\nTotal: {len(rows)} high-risk users")
c.close()
