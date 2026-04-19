import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import Loader from '../shared/Loader';
import Badge from '../shared/Badge';
import StatCard from '../shared/StatCard';
import SectionCard from '../shared/SectionCard';
import RiskBar from '../shared/RiskBar';
import Btn from '../shared/Btn';

const riskColor = { low: '#27ae60', medium: '#f59e0b', high: '#e74c3c' };

export default function UserProfile({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/users/${user.user_id}/profile`)
      .then(r => setProfile(r.data))
      .finally(() => setLoading(false));
  }, [user.user_id]);

  if (loading) return <Loader message="Loading your profile..." />;
  if (!profile) return <div style={{ color: '#e74c3c', padding: '2rem' }}>Failed to load profile.</div>;

  const rc = riskColor[profile.risk?.risk_level] || '#64748b';
  const approvedCount = profile.applications_summary?.approved || 0;
  const totalApps = profile.total_applications || 0;

  return (
    <div>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0d3a66 0%, #1565c0 100%)',
        borderRadius: 14, padding: '1.8rem 2rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1.8rem', color: '#fff',
        boxShadow: '0 6px 24px rgba(13,58,102,0.28)',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
          border: '3px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 800, flexShrink: 0, color: '#fff',
        }}>
          {profile.full_name?.charAt(0) || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.5 }}>{profile.full_name}</div>
          <div style={{ opacity: 0.82, fontSize: 14, marginTop: 4 }}>
            {profile.occupation || 'Citizen'} &nbsp;•&nbsp;
            {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '–'}, {profile.age || '–'} yrs
            &nbsp;•&nbsp; {profile.is_bpl ? 'BPL Beneficiary' : 'APL Citizen'}
          </div>
          {profile.cluster_label && (
            <div style={{
              marginTop: 8, fontSize: 11, fontWeight: 700,
              background: 'rgba(255,255,255,0.15)', display: 'inline-block',
              borderRadius: 20, padding: '3px 12px', letterSpacing: 0.5,
            }}>
              ML CLUSTER: {profile.cluster_label.toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            background: rc, borderRadius: 8, padding: '6px 18px',
            fontWeight: 800, fontSize: 13, letterSpacing: 1, marginBottom: 6,
          }}>
            {(profile.risk?.risk_level || 'LOW').toUpperCase()} RISK
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Fraud Score: {((profile.risk?.fraud_probability || 0) * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Aadhaar: XXXX-XXXX-{profile.aadhaar_number?.slice(-4) || '????'}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard label="Total Benefits Received" value={`₹${(profile.total_benefit_received || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} accent="#27ae60" />
        <StatCard label="Schemes Applied" value={totalApps} accent="#0d6efd" />
        <StatCard label="Schemes Approved" value={approvedCount} accent="#27ae60" />
        <StatCard label="Fraud Flags" value={profile.fraud_flags?.length || 0} accent={profile.fraud_flags?.length > 0 ? '#e74c3c' : '#27ae60'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.2rem' }}>
        {/* Personal Info */}
        <SectionCard title="Personal Information">
          {[
            ['Full Name', profile.full_name],
            ['Date of Birth', profile.date_of_birth],
            ['Gender', profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '–'],
            ['Phone', profile.phone || '–'],
            ['Email', profile.email || '–'],
            ['Occupation', profile.occupation || '–'],
            ['Annual Income', profile.income ? `₹${Number(profile.income).toLocaleString('en-IN')}` : '–'],
            ['Category', profile.is_bpl ? 'Below Poverty Line (BPL)' : 'Above Poverty Line (APL)'],
            ['Member Since', profile.created_at ? profile.created_at.split(' ')[0] : '–'],
          ].map(([label, val]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid #f0f6ff', fontSize: 14,
            }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>{label}</span>
              <span style={{ color: '#0d3a66', fontWeight: 600, textAlign: 'right', maxWidth: '58%' }}>{val || '–'}</span>
            </div>
          ))}
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Risk profile */}
          <SectionCard title="ML Risk Profile">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Fraud Probability</div>
              <RiskBar value={profile.risk?.fraud_probability || 0} />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                {((profile.risk?.fraud_probability || 0) * 100).toFixed(1)}% fraud likelihood
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Anomaly Score (IsolationForest)</div>
              <RiskBar value={Math.min(1, Math.abs(profile.risk?.anomaly_score || 0) * 2)} />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Score: {(profile.risk?.anomaly_score || 0).toFixed(4)} (0 = normal, -1 = anomaly)
              </div>
            </div>
            {profile.cluster_label && (
              <div style={{ background: '#e8f4ff', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>ML Cluster Assignment</div>
                <div style={{ fontWeight: 700, color: '#0d3a66', fontSize: 13 }}>{profile.cluster_label}</div>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <Btn variant="primary" size="sm" onClick={() => navigate('/ml-insights')}>
                View Full BERT Analysis →
              </Btn>
            </div>
          </SectionCard>

          {/* Application summary */}
          <SectionCard title="Scheme Application Summary">
            {Object.entries(profile.applications_summary || {}).length === 0
              ? <div style={{ color: '#94a3b8', fontSize: 14 }}>No applications yet.</div>
              : Object.entries(profile.applications_summary).map(([status, count]) => (
                <div key={status} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #f0f6ff',
                }}>
                  <Badge value={status} />
                  <span style={{ fontWeight: 800, color: '#0d3a66', fontSize: 18 }}>{count}</span>
                </div>
              ))
            }
            <div style={{ marginTop: 10 }}>
              <Btn variant="outline" size="sm" onClick={() => navigate('/benefit-history')}>
                View Benefit History →
              </Btn>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Identity Documents */}
      <SectionCard title="Identity & Document Records">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            ['Aadhaar Number', 'XXXX-XXXX-' + (profile.aadhaar_number?.slice(-4) || '????'), true],
            ['Voter ID', profile.identity?.voter_id || '–', false],
            ['PAN Number', profile.identity?.pan_number || '–', false],
            ['Ration Card', profile.identity?.ration_card || '–', false],
            ['Aadhaar Verified', profile.identity?.aadhaar_verified ? 'Verified' : 'Not Verified', profile.identity?.aadhaar_verified],
          ].map(([label, val, highlight]) => (
            <div key={label} style={{
              background: highlight ? '#e6f9ee' : '#f8fafc',
              border: `1px solid ${highlight ? '#a7f3d0' : '#e2e8f0'}`,
              borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontWeight: 700, color: highlight ? '#1a7f2e' : '#0d3a66', fontSize: 14 }}>{val}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Fraud Flags */}
      {profile.fraud_flags?.length > 0 && (
        <div style={{ marginTop: '1.2rem' }}>
          <SectionCard title={<><i className="pi pi-exclamation-triangle" style={{ marginRight: 6, color: '#e74c3c' }} />Fraud Flags ({profile.fraud_flags.length})</>}>
            {profile.fraud_flags.map((f, i) => (
              <div key={i} style={{
                background: '#fff5f5', border: '1px solid #fca5a5',
                borderLeft: '4px solid #e74c3c',
                borderRadius: 8, padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#c0392b', textTransform: 'capitalize' }}>
                    {f.flag_type?.replace(/_/g, ' ')}
                  </span>
                  <Badge value={f.severity} />
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{f.description}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{f.created_at?.split(' ')[0]}</div>
              </div>
            ))}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
