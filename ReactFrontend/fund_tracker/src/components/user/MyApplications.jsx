import { useEffect, useState } from 'react';
import api from '../../api';
import Badge from '../shared/Badge';
import SectionCard from '../shared/SectionCard';
import Loader from '../shared/Loader';

export default function MyApplications({ user }) {
  const [applications, setApplications] = useState([]);
  const [schemes, setSchemes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [apps, sc] = await Promise.all([
          api.get(`/users/${user.user_id}/applications`),
          api.get('/schemes/detailed'),
        ]);
        setApplications(apps.data);
        const map = {};
        sc.data.forEach((s) => { map[s.id] = s; });
        setSchemes(map);
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (loading) return <Loader message="Loading applications..." />;

  const statusGroups = {
    approved: applications.filter((a) => a.status === 'approved'),
    under_review: applications.filter((a) => a.status === 'under_review'),
    submitted: applications.filter((a) => a.status === 'submitted'),
    rejected: applications.filter((a) => a.status === 'rejected'),
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#0d3a66' }}>My Applications</h2>
        <p style={{ color: '#64748b', margin: '4px 0 0' }}>All scheme applications you have submitted</p>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {Object.entries(statusGroups).map(([status, list]) => (
          <div key={status} style={{
            flex: 1, minWidth: 120, background: '#fff', border: '1.5px solid #dceffe',
            borderRadius: 8, padding: '12px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0d6efd' }}>{list.length}</div>
            <Badge value={status} />
          </div>
        ))}
      </div>

      <SectionCard title="All Applications">
        {applications.length === 0 ? (
          <div style={{ color: '#94a3b8', padding: '1rem 0' }}>
            No applications yet. Go to Browse Schemes to apply.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#e8f4ff', color: '#0d3a66' }}>
                {['#', 'Scheme', 'Category', 'Benefit Type', 'Status', 'Submitted', 'Reviewed'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #3b82f6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((a, i) => {
                const sc = schemes[a.scheme_id];
                return (
                  <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{a.id}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0d3a66' }}>{sc?.name || `Scheme #${a.scheme_id}`}</td>
                    <td style={{ padding: '9px 12px' }}>{sc?.category || '-'}</td>
                    <td style={{ padding: '9px 12px' }}>{sc ? <Badge value={sc.benefit_type} /> : '-'}</td>
                    <td style={{ padding: '9px 12px' }}><Badge value={a.status} /></td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '-'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
