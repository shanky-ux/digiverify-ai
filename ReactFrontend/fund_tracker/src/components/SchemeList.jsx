import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export default function SchemeList({ user }) {
  const [schemes, setSchemes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const res = await axios.get(`${API_BASE_URL}/schemes`);
      setSchemes(res.data);
    };
    fetch();
  }, []);

  const apply = async (schemeId) => {
    try {
      await axios.post(`${API_BASE_URL}/users/${user.user_id}/apply`, { scheme_id: schemeId });
      setError('Application submitted successfully');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to apply');
    }
  };

  const getRiskReason = async (schemeId) => {
    const res = await axios.get(`${API_BASE_URL}/schemes/${schemeId}/risk_reason`);
    alert('Risk reasoning:\n' + res.data.reason);
  };

  return (
    <div>
      <h2>Available Schemes</h2>
      <div className="p-grid">
        {schemes.map((s) => (
          <div key={s.id} className="p-col-12 p-md-6 p-lg-4">
            <div className="card scheme-card p-3 mb-3">
              <h3>{s.name}</h3>
              <p>{s.eligibility_criteria}</p>
              <p><strong>Type:</strong> {s.benefit_type}</p>
              <button className="p-button p-button-success mr-2" onClick={() => apply(s.id)}>Apply</button>
              <button className="p-button p-button-warning" onClick={() => getRiskReason(s.id)}>Risk Reason</button>
            </div>
          </div>
        ))}
      </div>
      {error && <div className="info-message mt-2">{error}</div>}
    </div>
  );
}
