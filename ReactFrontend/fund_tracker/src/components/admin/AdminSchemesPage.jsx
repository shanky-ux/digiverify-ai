import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import Badge from '../shared/Badge';
import RiskBar from '../shared/RiskBar';
import SectionCard from '../shared/SectionCard';
import Loader from '../shared/Loader';
import Btn from '../shared/Btn';
import CreateSchemeModal from './CreateSchemeModal';

export default function AdminSchemesPage() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const loadSchemes = () => {
    setLoading(true);
    api.get('/schemes/detailed')
      .then((r) => setSchemes(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSchemes(); }, []);

  if (loading) return <Loader message="Loading schemes..." />;

  return (
    <div>
      {showCreate && (
        <CreateSchemeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadSchemes(); }}
        />
      )}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0d3a66' }}>Scheme Management</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>Click a scheme to view enrolled users and their risk profiles</p>
        </div>
        <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Create Scheme</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
        {schemes.map((s) => (
          <div key={s.id} style={{
            background: '#fff', border: '1.5px solid #bde0ff', borderRadius: 10,
            padding: '1.2rem', boxShadow: '0 1px 6px rgba(13,110,253,0.07)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase' }}>{s.category}</span>
              <Badge value={s.benefit_type} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0d3a66', marginBottom: 6 }}>{s.name}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{s.eligibility_criteria}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {s.min_age && <span style={{ background: '#e8f4ff', color: '#0d6efd', borderRadius: 5, padding: '2px 8px', fontSize: 12 }}>Min age: {s.min_age}</span>}
              {s.max_income && <span style={{ background: '#e6f9ee', color: '#1a7f2e', borderRadius: 5, padding: '2px 8px', fontSize: 12 }}>Max income: {s.max_income.toLocaleString()}</span>}
            </div>
            <Btn variant="primary" size="sm" onClick={() => navigate(`/admin/schemes/${s.id}`)}>
              View Enrolled Users
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}
