import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    const fetchAdmin = async () => {
      const res = await axios.get(`${API_BASE_URL}/admin/overview`);
      setOverview(res.data);
    };
    fetchAdmin();
  }, []);

  if (!overview) return <div>Loading admin data...</div>;

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <div className="card p-3 mb-3">
        <p><strong>Total Users:</strong> {overview.total_users}</p>
        <p><strong>Total Applications:</strong> {overview.total_applications}</p>
      </div>
      <div className="card p-3">
        <h3>Schemes Overview</h3>
        <table className="p-datatable p-component">
          <thead>
            <tr><th>Scheme</th><th>Applications</th><th>Avg Fraud Probability</th></tr>
          </thead>
          <tbody>
            {overview.schemes.map((s) => (
              <tr key={s.scheme_id}>
                <td>{s.scheme_name}</td>
                <td>{s.applications}</td>
                <td>{s.avg_fraud_probability?.toFixed(2) ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
