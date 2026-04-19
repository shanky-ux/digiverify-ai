import pymysql
conn = pymysql.connect(host='localhost', port=3306, user='root', password='root',
                       database='welfare_system', cursorclass=pymysql.cursors.DictCursor)
cur = conn.cursor()
cur.execute("SELECT id, full_name, aadhaar_number FROM users WHERE aadhaar_number LIKE '%9014'")
user = cur.fetchone()
print('USER:', user)
if user:
    uid = user['id']
    cur.execute('SELECT * FROM risk_scores WHERE user_id=%s', (uid,))
    print('RISK:', cur.fetchone())
    cur.execute('SELECT id, status, verified_at, expires_at FROM beneficiary_verifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 1', (uid,))
    print('VERIF:', cur.fetchone())
conn.close()
