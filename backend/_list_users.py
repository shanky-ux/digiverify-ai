import pymysql

conn = pymysql.connect(host='localhost', port=3306, user='root', password='root',
                       database='welfare_system', cursorclass=pymysql.cursors.DictCursor)
cur = conn.cursor()
cur.execute('SELECT id, full_name, aadhaar_number, email FROM users ORDER BY id')
rows = cur.fetchall()

print(f"{'ID':<5}{'Name':<25}{'Aadhaar':<15}{'Email'}")
print('-' * 75)
for r in rows:
    print(f"{r['id']:<5}{r['full_name']:<25}{r['aadhaar_number']:<15}{r['email']}")

print(f"\nTotal: {len(rows)} users")
conn.close()
