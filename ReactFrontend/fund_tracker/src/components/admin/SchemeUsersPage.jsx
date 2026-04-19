import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import Badge from '../shared/Badge';
import RiskBar from '../shared/RiskBar';
import SectionCard from '../shared/SectionCard';
import Loader from '../shared/Loader';
import Btn from '../shared/Btn';

const STATUS_OPTIONS = ['submitted', 'under_review', 'approved', 'rejected'];

function UserRiskPanel({ u }) {
  return (
    <div style={{
      background: '#f0f8ff', border: '1px solid #bde0ff', borderRadius: 8,
      padding: '12px 16px', marginTop: 4,
    }}>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <RiskBar label="Fraud Probability" value={u.fraud_probability} />
          <RiskBar label="Anomaly Score" value={u.anomaly_score} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Risk Level</div>
          <Badge value={u.risk_level} />
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Fraud Flags</div>
          <span style={{
            background: u.fraud_flags > 0 ? '#fff1f0' : '#e6f9ee',
            color: u.fraud_flags > 0 ? '#c0392b' : '#1a7f2e',
            borderRadius: 5, padding: '2px 8px', fontSize: 13, fontWeight: 700,
          }}>{u.fraud_flags}</span>
        </div>
      </div>
    </div>
  );
}

export default function SchemeUsersPage() {
  const { schemeId } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [u, sc] = await Promise.all([
          api.get(`/admin/schemes/${schemeId}/users`),
          api.get('/schemes/detailed'),
        ]);
        setUsers(u.data);
        const found = sc.data.find((s) => s.id === parseInt(schemeId));
        setScheme(found);
      } finally { setLoading(false); }
    };
    load();
  }, [schemeId]);

  const updateStatus = async (appId, status) => {
    setUpdating(appId);
    try {
      await api.put(`/admin/applications/${appId}/status`, { status });
      setUsers((prev) => prev.map((u) => u.application_id === appId ? { ...u, status } : u));
      setStatusMsg(`Application #${appId} updated to "${status}"`);
      setTimeout(() => setStatusMsg(''), 3000);
    } finally { setUpdating(null); }
  };

  if (loading) return <Loader message="Loading enrolled users..." />;

  const riskCounts = {
    low: users.filter((u) => u.risk_level === 'low').length,
    medium: users.filter((u) => u.risk_level === 'medium').length,
    high: users.filter((u) => u.risk_level === 'high').length,
  };

  return (
    <div>
      <Btn variant="ghost" onClick={() => navigate('/admin/schemes')} style={{ marginBottom: 12 }}>
        &larr; Back to Schemes
      </Btn>

      <div style={{
        background: 'linear-gradient(90deg, #0d3a66, #0d6efd)',
        color: '#fff', borderRadius: 12, padding: '1.2rem 1.8rem', marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{scheme?.name || `Scheme #${schemeId}`}</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
          {scheme?.category} — {scheme?.eligibility_criteria}
        </div>
      </div>

      {/* Risk Summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 100, background: '#e6f9ee', border: '1.5px solid #27ae60', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a7f2e' }}>{riskCounts.low}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Low Risk</div>
        </div>
        <div style={{ flex: 1, minWidth: 100, background: '#fff7e6', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#b45309' }}>{riskCounts.medium}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Medium Risk</div>
        </div>
        <div style={{ flex: 1, minWidth: 100, background: '#fff1f0', border: '1.5px solid #e74c3c', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#c0392b' }}>{riskCounts.high}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>High Risk</div>
        </div>
        <div style={{ flex: 1, minWidth: 100, background: '#e8f4ff', border: '1.5px solid #3b82f6', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0d6efd' }}>{users.length}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Total Enrolled</div>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: '#e6f9ee', color: '#1a7f2e', border: '1px solid #6ee7b7', borderRadius: 7, padding: '8px 14px', marginBottom: 14, fontSize: 13 }}>
          {statusMsg}
        </div>
      )}

      <SectionCard title="Enrolled Users">
        {users.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '1rem 0' }}>No users enrolled in this scheme yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map((u) => (
              <div key={u.application_id} style={{
                border: `1.5px solid ${u.risk_level === 'high' ? '#fca5a5' : u.risk_level === 'medium' ? '#fde68a' : '#bde0ff'}`,
                borderRadius: 10, overflow: 'hidden',
              }}>
                {/* Row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '12px 16px', background: '#fff', cursor: 'pointer',
                }} onClick={() => setExpanded(expanded === u.application_id ? null : u.application_id)}>
                  {/* Risk dot */}
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: u.risk_level === 'high' ? '#e74c3c' : u.risk_level === 'medium' ? '#f59e0b' : '#27ae60',
                  }} />
                  <div style={{ flex: 2, minWidth: 130 }}>
                    <div style={{ fontWeight: 600, color: '#0d3a66' }}>{u.full_name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{u.aadhaar_number}</div>
                  </div>
                  <div style={{ flex: 2, fontSize: 13, color: '#64748b', minWidth: 130 }}>{u.email}</div>
                  <div><Badge value={u.status} /></div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <select
                      value={u.status}
                      onChange={(e) => { e.stopPropagation(); updateStatus(u.application_id, e.target.value); }}
                      disabled={updating === u.application_id}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '4px 8px', borderRadius: 5, border: '1.5px solid #93c5fd',
                        fontSize: 13, background: '#f0f8ff', cursor: 'pointer',
                      }}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', minWidth: 60 }}>
                    {expanded === u.application_id ? 'Hide' : 'Details'}
                  </div>
                </div>

                {/* Expanded risk panel */}
                {expanded === u.application_id && (
                  <div style={{ padding: '0 16px 14px', background: '#fafcff' }}>
                    <UserRiskPanel u={u} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
