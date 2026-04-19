import { useEffect, useState } from 'react';
import api from '../../api';
import Badge from '../shared/Badge';
import RiskBar from '../shared/RiskBar';
import SectionCard from '../shared/SectionCard';
import Loader from '../shared/Loader';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    api.get('/admin/users')
      .then((r) => setUsers(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader message="Loading all users..." />;

  const filtered = users.filter((u) => {
    const matchSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.aadhaar_number?.includes(search) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === 'all' || u.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#0d3a66' }}>All Users</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0' }}>
          {filtered.length} of {users.length} users
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <input
          placeholder="Search name, Aadhaar, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 7, border: '1.5px solid #93c5fd',
            fontSize: 14, minWidth: 260, outline: 'none', background: '#f0f8ff',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'low', 'medium', 'high'].map((r) => (
            <button key={r} onClick={() => setRiskFilter(r)} style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: '1.5px solid',
              borderColor: riskFilter === r ? '#0d6efd' : '#e2e8f0',
              background: riskFilter === r ? '#0d6efd' : '#fff',
              color: riskFilter === r ? '#fff' : '#64748b',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>{r === 'all' ? 'All Risk' : r}</button>
          ))}
        </div>
      </div>

      <SectionCard title="User Records">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#e8f4ff', color: '#0d3a66' }}>
                {['Name', 'Aadhaar', 'Email', 'Occupation', 'Income', 'BPL', 'Apps', 'Risk Level', 'Fraud Probability'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #3b82f6', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>No users found.</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0d3a66' }}>{u.full_name || '-'}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 13 }}>{u.aadhaar_number}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b' }}>{u.email || '-'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b' }}>{u.occupation || '-'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    {u.income ? `₹${Number(u.income).toLocaleString()}` : '-'}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      background: u.is_bpl ? '#e6f9ee' : '#f1f5f9',
                      color: u.is_bpl ? '#1a7f2e' : '#94a3b8',
                      borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                    }}>{u.is_bpl ? 'Yes' : 'No'}</span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ background: '#e8f4ff', color: '#0d6efd', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
                      {u.applications}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px' }}><Badge value={u.risk_level} /></td>
                  <td style={{ padding: '9px 12px', minWidth: 160 }}>
                    <RiskBar value={u.fraud_probability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
