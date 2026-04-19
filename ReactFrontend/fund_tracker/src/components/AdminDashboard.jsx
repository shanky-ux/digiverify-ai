import { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import api from '../api';
import StatCard from './shared/StatCard';
import SectionCard from './shared/SectionCard';
import Badge from './shared/Badge';
import RiskBar from './shared/RiskBar';
import Loader from './shared/Loader';
import Btn from './shared/Btn';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toast } from 'primereact/toast';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const toast = useRef(null);

  useEffect(() => {
    api.get('/admin/overview')
      .then((r) => setOverview(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && heroRef.current) {
      const ctx = gsap.context(() => {
        gsap.from(heroRef.current, { y: -30, opacity: 0, duration: 0.6, ease: 'power3.out' });
        gsap.from(statsRef.current?.children || [], {
          y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out', delay: 0.2
        });
      }, heroRef);
      return () => ctx.revert();
    }
  }, [loading]);

  const recomputeRisk = async () => {
    setRecomputing(true);
    try {
      const res = await api.post('/admin/recompute_risk');
      toast.current.show({ severity: 'success', summary: 'Risk Recomputed', detail: `ML risk scores updated for ${res.data.updated} users.`, life: 4000 });
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'Failed to recompute risk scores.', life: 4000 });
    } finally { setRecomputing(false); }
  };

  if (loading) return <Loader message="Loading admin overview..." />;
  if (!overview) return (
    <div style={{ color: '#ef4444', padding: '2rem', textAlign: 'center' }}>
      <i className="pi pi-exclamation-triangle" style={{ fontSize: 40, display: 'block', marginBottom: 10 }} />
      Failed to load admin data.
    </div>
  );

  const highRisk = overview.schemes.filter((s) => s.avg_fraud_probability > 0.5).length;
  const highRiskSchemes = overview.schemes.filter((s) => s.avg_fraud_probability > 0.5);

  return (
    <div style={{ width: '100%' }}>
      <Toast ref={toast} />

      {/* Admin Hero Banner */}
      <div ref={heroRef} style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1a3a2a 50%, #0f3a1a 100%)',
        color: '#fff', borderRadius: 20, padding: '2rem 2.5rem',
        marginBottom: '1.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 32px rgba(15,23,42,0.3)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: 100, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(16,185,129,0.12)',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: 10, padding: '4px 14px', fontWeight: 800, fontSize: 12, letterSpacing: '1px' }}>ADMIN PANEL</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>System Overview</div>
          <div style={{ fontSize: 14, color: 'rgba(167,243,208,0.8)' }}>Monitor scheme performance, manage users, and analyze fraud risk</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <Btn onClick={recomputeRisk} disabled={recomputing} variant="warning" icon="pi pi-sync">
            {recomputing ? 'Running ML...' : 'Recompute Risk'}
          </Btn>
          <div style={{
            background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 18px', textAlign: 'right',
          }}>
            <div style={{ color: 'rgba(167,243,208,0.7)', fontSize: 11 }}>TODAY</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#6ee7b7' }}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div ref={statsRef} style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        <StatCard label="Total Users" value={overview.total_users} accent="#3b82f6" icon="pi-users" />
        <StatCard label="Total Applications" value={overview.total_applications} accent="#10b981" icon="pi-file" />
        <StatCard label="Active Schemes" value={overview.schemes.length} accent="#f59e0b" icon="pi-th-large" />
        <StatCard label="High Risk Schemes" value={highRisk} accent="#ef4444" icon="pi-exclamation-triangle" />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Schemes Performance Table */}
        <SectionCard title="Schemes Performance Overview" icon="pi-chart-bar" accent="#3b82f6">
          <DataTable value={overview.schemes} stripedRows tableStyle={{ minWidth: '100%' }}
            style={{ fontSize: 14 }} emptyMessage="No schemes found.">
            <Column field="scheme_name" header="Scheme Name" body={(row) => (
              <span style={{ fontWeight: 700, color: '#1e3a5f' }}>{row.scheme_name}</span>
            )} />
            <Column field="applications" header="Applications" body={(row) => (
              <span style={{
                background: 'linear-gradient(135deg, #e8f4ff, #dbeafe)',
                color: '#1d4ed8', borderRadius: 8, padding: '3px 12px', fontWeight: 700, fontSize: 13
              }}>{row.applications}</span>
            )} />
            <Column field="avg_fraud_probability" header="Fraud Risk" body={(row) => (
              <div style={{ minWidth: 160 }}><RiskBar value={row.avg_fraud_probability || 0} /></div>
            )} />
          </DataTable>
        </SectionCard>

        {/* High Risk Schemes */}
        <SectionCard title="High Risk Alerts" icon="pi-exclamation-triangle" accent="#ef4444">
          {highRiskSchemes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#10b981' }}>
              <i className="pi pi-check-circle" style={{ fontSize: 40, display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 14 }}>All schemes are safe!</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>No high-risk schemes detected.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {highRiskSchemes.map((s) => (
                <div key={s.scheme_id} style={{
                  background: 'linear-gradient(90deg, #fff1f0, #fef2f2)',
                  border: '1px solid #fecaca', borderLeft: '4px solid #ef4444',
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 13 }}>{s.scheme_name}</div>
                  <div style={{ marginTop: 6 }}><RiskBar value={s.avg_fraud_probability} /></div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
