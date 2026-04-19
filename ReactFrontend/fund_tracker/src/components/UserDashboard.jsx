import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import api from '../api';
import StatCard from './shared/StatCard';
import SectionCard from './shared/SectionCard';
import Badge from './shared/Badge';
import RiskBar from './shared/RiskBar';
import Loader from './shared/Loader';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import logo from '../assets/logo.png';

/* ─── Floating particle background (purely decorative) ─── */
function FloatingOrbs() {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const orbs = ref.current.querySelectorAll('.orb');
    orbs.forEach((orb, i) => {
      gsap.to(orb, {
        y: -20 - i * 6, x: 10 + i * 4, duration: 3 + i * 0.6,
        repeat: -1, yoyo: true, ease: 'sine.inOut', delay: i * 0.3,
      });
    });
  }, []);
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="orb" style={{
          position: 'absolute',
          width: 60 + i * 30, height: 60 + i * 30, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(59,130,246,${0.08 + i * 0.02}) 0%, transparent 70%)`,
          top: `${10 + i * 14}%`, left: `${5 + i * 15}%`,
        }} />
      ))}
    </div>
  );
}

/* ─── Quick-access action tile ─── */
function QuickAction({ icon, label, desc, color, onClick, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.5)', delay });
  }, [delay]);
  return (
    <div ref={ref} onClick={onClick} style={{
      flex: 1, minWidth: 160, cursor: 'pointer',
      background: '#fff', borderRadius: 16, padding: '1.4rem 1.2rem',
      border: `1px solid ${color}25`, boxShadow: `0 2px 12px ${color}12`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 12px 32px ${color}28`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 2px 12px ${color}12`; }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: `linear-gradient(135deg, ${color}20, ${color}10)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`pi ${icon}`} style={{ fontSize: 22, color }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{label}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

/* ─── Verification Status Badge ─── */
function VerifBadge({ status }) {
  const map = {
    approved: { bg: '#d1fae5', color: '#059669', icon: 'pi-verified', text: 'Verified' },
    pending: { bg: '#fef3c7', color: '#d97706', icon: 'pi-clock', text: 'Pending' },
    rejected: { bg: '#fee2e2', color: '#dc2626', icon: 'pi-times-circle', text: 'Rejected' },
    expired: { bg: '#f1f5f9', color: '#64748b', icon: 'pi-history', text: 'Expired' },
    not_submitted: { bg: '#f1f5f9', color: '#94a3b8', icon: 'pi-minus-circle', text: 'Not Verified' },
  };
  const c = map[status] || map.not_submitted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.color, padding: '4px 12px',
      borderRadius: 999, fontSize: 12, fontWeight: 700,
    }}>
      <i className={`pi ${c.icon}`} style={{ fontSize: 12 }} />
      {c.text}
    </span>
  );
}

/* ─── Circular progress ring (SVG) ─── */
function ProgressRing({ pct, size = 80, color = '#3b82f6', label }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const ringRef = useRef(null);
  useEffect(() => {
    if (ringRef.current) {
      gsap.from(ringRef.current, { strokeDashoffset: circ, duration: 1.6, ease: 'power2.out', delay: 0.3 });
    }
  }, [circ]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
        <circle ref={ringRef} cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (circ * pct / 100)} />
      </svg>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: -size / 2 - 10, position: 'relative' }}>{pct}%</div>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: size / 2 - 22 }}>{label}</div>}
    </div>
  );
}

export default function UserDashboard({ user }) {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [riskScore, setRiskScore] = useState(null);
  const [profile, setProfile] = useState(null);
  const [verifStatus, setVerifStatus] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const gridRef = useRef(null);
  const actionsRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [apps, notes, risk, prof, verif, sch] = await Promise.all([
          api.get(`/users/${user.user_id}/applications`),
          api.get(`/notifications/${user.user_id}`),
          api.get(`/risk_scores/${user.user_id}`).catch(() => ({ data: null })),
          api.get(`/users/${user.user_id}/profile`).catch(() => ({ data: null })),
          api.get(`/verify/status/${user.user_id}`).catch(() => ({ data: null })),
          api.get('/schemes').catch(() => ({ data: [] })),
        ]);
        setApplications(apps.data);
        setNotifications(notes.data);
        setRiskScore(risk.data);
        setProfile(prof.data);
        setVerifStatus(verif.data);
        setSchemes(sch.data);
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  /* ─── GSAP master timeline ─── */
  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Hero banner entrance
      if (heroRef.current) {
        tl.fromTo(heroRef.current, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 });
        const heroItems = heroRef.current.querySelectorAll('.hero-item');
        if (heroItems.length) {
          tl.fromTo(heroItems, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.12 }, '-=0.3');
        }
      }

      // Stats cards cascade
      if (statsRef.current?.children?.length) {
        tl.fromTo(statsRef.current.children,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(1.4)' },
        '-=0.2');
      }

      // Grid sections slide in
      if (gridRef.current?.children?.length) {
        tl.fromTo(gridRef.current.children,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
        '-=0.15');
      }

      // Table section
      if (tableRef.current) {
        tl.fromTo(tableRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.1');
      }
    });
    return () => ctx.revert();
  }, [loading]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  if (loading) return <Loader message="Loading your dashboard..." />;

  const approved = applications.filter((a) => a.status === 'approved').length;
  const pending  = applications.filter((a) => ['submitted', 'under_review'].includes(a.status)).length;
  const rejected = applications.filter((a) => a.status === 'rejected').length;
  const unread   = notifications.filter((n) => !n.is_read).length;
  const trustScore = riskScore ? Math.round((1 - (riskScore.fraud_probability || 0)) * 100) : 100;
  const verifiedOk = verifStatus?.status === 'approved';
  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{ width: '100%', position: 'relative' }}>

      {/* ════════ HERO BANNER ════════ */}
      <div ref={heroRef} style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0f4c81 80%, #155e8d 100%)',
        color: '#fff', borderRadius: 20, padding: '2rem 2.5rem',
        marginBottom: '1.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 8px 40px rgba(15,23,42,0.35)',
        position: 'relative', overflow: 'hidden', minHeight: 140,
      }}>
        <FloatingOrbs />

        {/* Left: Welcome text */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <div className="hero-item" style={{ fontSize: 13, color: 'rgba(148,197,253,0.7)', fontWeight: 600, marginBottom: 6 }}>
            {greeting},
          </div>
          <div className="hero-item" style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>
            {user.full_name}
          </div>
          <div className="hero-item" style={{ fontSize: 13, color: 'rgba(148,197,253,0.8)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Citizen Portal — DigiVerify Platform</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(148,197,253,0.4)' }} />
            <span>{todayStr}</span>
          </div>
          <div className="hero-item" style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <VerifBadge status={verifStatus?.status || 'not_submitted'} />
            {riskScore && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: riskScore.risk_level === 'low' ? 'rgba(16,185,129,0.15)' :
                  riskScore.risk_level === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: riskScore.risk_level === 'low' ? '#34d399' :
                  riskScore.risk_level === 'medium' ? '#fbbf24' : '#f87171',
                padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              }}>
                <i className="pi pi-shield" style={{ fontSize: 11 }} />
                Risk: {(riskScore.risk_level || 'N/A').toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Center: Logo */}
        <div className="hero-item" style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.12, pointerEvents: 'none',
        }}>
          <img src={logo} alt="" style={{ height: 120, objectFit: 'contain' }} />
        </div>

        {/* Right: User card */}
        <div className="hero-item" style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(255,255,255,0.07)', borderRadius: 16,
          padding: '16px 20px', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)', minWidth: 150,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 22,
            margin: '0 auto 8px', boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
          }}>
            {user.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ color: 'rgba(148,197,253,0.6)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase' }}>User ID</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#60a5fa' }}>#{user.user_id}</div>
          {profile?.income && (
            <div style={{ fontSize: 11, color: 'rgba(148,197,253,0.5)', marginTop: 4 }}>
              Income: ₹{Number(profile.income).toLocaleString('en-IN')}
            </div>
          )}
        </div>
      </div>

      {/* ════════ STATS ROW ════════ */}
      <div ref={statsRef} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        <StatCard label="Total Applications" value={applications.length} accent="#3b82f6" icon="pi-file" subtitle={`${approved} approved`} />
        <StatCard label="Approved" value={approved} accent="#10b981" icon="pi-check-circle" />
        <StatCard label="Pending" value={pending} accent="#f59e0b" icon="pi-clock" />
        <StatCard label="Rejected" value={rejected} accent="#ef4444" icon="pi-times-circle" />
        <StatCard label="Unread Alerts" value={unread} accent="#8b5cf6" icon="pi-bell" />
        <StatCard label="Trust Score" value={`${trustScore}%`} accent={trustScore >= 70 ? '#10b981' : trustScore >= 40 ? '#f59e0b' : '#ef4444'} icon="pi-verified" />
      </div>

      {/* ════════ QUICK ACTIONS ════════ */}
      <div ref={actionsRef} style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem',
      }}>
        <QuickAction icon="pi-th-large" label="Browse Schemes" desc="Explore government welfare schemes" color="#3b82f6" onClick={() => navigate('/schemes')} delay={0.1} />
        <QuickAction icon="pi-shield" label="Verify Identity" desc="Complete Aadhaar & biometric verification" color="#10b981" onClick={() => navigate('/verify')} delay={0.2} />
        <QuickAction icon="pi-chart-line" label="ML Insights" desc="View AI-driven risk analysis" color="#8b5cf6" onClick={() => navigate('/ml-insights')} delay={0.3} />
        <QuickAction icon="pi-link" label="Blockchain" desc="Track immutable verification records" color="#0ea5e9" onClick={() => navigate('/blockchain')} delay={0.4} />
        <QuickAction icon="pi-clock" label="Activity" desc="View your complete timeline" color="#f59e0b" onClick={() => navigate('/timeline')} delay={0.5} />
      </div>

      {/* ════════ MAIN GRID ════════ */}
      <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* ── Risk & Trust Profile ── */}
        <SectionCard title="Risk & Trust Profile" icon="pi-shield" accent="#ef4444">
          {riskScore ? (
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <RiskBar label="Fraud Probability" value={riskScore.fraud_probability} />
                <RiskBar label="Anomaly Score" value={Math.abs(riskScore.anomaly_score)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Risk Level:</span>
                  <Badge value={riskScore.risk_level} />
                </div>
                <button onClick={() => navigate('/verify')} style={{
                  marginTop: 16, width: '100%', padding: '10px 0',
                  background: verifiedOk
                    ? 'linear-gradient(135deg, #059669, #10b981)'
                    : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
                  {verifiedOk ? <><i className="pi pi-check" style={{ marginRight: 4 }} /> Identity Verified</> : <><i className="pi pi-lock" style={{ marginRight: 4 }} /> Verify My Identity &rarr;</>}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ProgressRing pct={trustScore} size={90} color={trustScore >= 70 ? '#10b981' : trustScore >= 40 ? '#f59e0b' : '#ef4444'} label="Trust" />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8' }}>
              <i className="pi pi-shield" style={{ fontSize: 36, marginBottom: 8, display: 'block', color: '#cbd5e1' }} />
              No risk data available yet.
            </div>
          )}
        </SectionCard>

        {/* ── Verification Status ── */}
        <SectionCard title="Verification Status" icon="pi-verified" accent="#10b981">
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            {/* Big status icon */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 14px',
              background: verifiedOk ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' :
                verifStatus?.status === 'pending' ? 'linear-gradient(135deg, #fef3c7, #fde68a)' :
                'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: verifiedOk ? '0 4px 20px rgba(16,185,129,0.3)' : '0 2px 10px rgba(0,0,0,0.05)',
            }}>
              <i className={`pi ${verifiedOk ? 'pi-verified' : verifStatus?.status === 'pending' ? 'pi-clock' : 'pi-id-card'}`}
                style={{ fontSize: 32, color: verifiedOk ? '#059669' : verifStatus?.status === 'pending' ? '#d97706' : '#94a3b8' }} />
            </div>
            <VerifBadge status={verifStatus?.status || 'not_submitted'} />
            {verifiedOk && verifStatus?.expires_at && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                <i className="pi pi-calendar" style={{ fontSize: 11, marginRight: 4 }} />
                Expires: {new Date(verifStatus.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
            {verifStatus?.block_hash && (
              <div style={{
                marginTop: 10, padding: '8px 12px', background: '#f0fdf4',
                borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 11,
                color: '#166534', fontFamily: 'monospace', wordBreak: 'break-all',
              }}>
                <i className="pi pi-link" style={{ fontSize: 10, marginRight: 4 }} />
                {verifStatus.block_hash.substring(0, 24)}...
              </div>
            )}
            {!verifiedOk && (
              <button onClick={() => navigate('/verify')} style={{
                marginTop: 16, padding: '10px 28px',
                background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              }}>
                Start Verification →
              </button>
            )}
          </div>
        </SectionCard>

        {/* ── Notifications ── */}
        <SectionCard title="Recent Notifications" icon="pi-bell" accent="#f59e0b"
          action={notifications.length > 5 && (
            <button onClick={() => navigate('/notifications')} style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b',
            }}>View All</button>
          )}>
          {notifications.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 14, padding: '1.5rem 0', textAlign: 'center' }}>
              <i className="pi pi-inbox" style={{ fontSize: 36, display: 'block', marginBottom: 8, color: '#cbd5e1' }} />
              No notifications yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.slice(0, 4).map((n) => (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: n.is_read ? '#f8fafc' : 'linear-gradient(90deg, #fff7e6, #fffbeb)',
                  border: `1px solid ${n.is_read ? '#e8f0fe' : '#fcd34d'}`,
                  borderRadius: 10, gap: 12,
                  borderLeft: `3px solid ${n.is_read ? '#e2e8f0' : '#f59e0b'}`,
                  transition: 'background 0.2s',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#1e293b', fontWeight: n.is_read ? 400 : 700, marginBottom: 4, lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Badge value={n.type} />
                      {n.created_at && <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(n.created_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                  </div>
                  {!n.is_read && (
                    <button onClick={() => markRead(n.id)} style={{
                      background: '#3b82f6', color: '#fff',
                      border: 'none', borderRadius: 6, padding: '4px 10px',
                      cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                    }}><i className="pi pi-check" style={{ marginRight: 4 }} /> Read</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Available Schemes Preview ── */}
        <SectionCard title="Available Schemes" icon="pi-th-large" accent="#8b5cf6"
          action={
            <button onClick={() => navigate('/schemes')} style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b',
            }}>Browse All</button>
          }>
          {schemes.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '1.5rem 0' }}>
              <i className="pi pi-th-large" style={{ fontSize: 36, display: 'block', marginBottom: 8, color: '#cbd5e1' }} />
              No schemes available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schemes.slice(0, 4).map((s, idx) => {
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
                const c = colors[idx % colors.length];
                const applied = applications.some(a => a.scheme_id === s.id);
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: '#f8fafc', borderRadius: 10, border: '1px solid #e8f0fe',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f6ff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <i className="pi pi-bookmark" style={{ fontSize: 16, color: c }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.benefit_type || 'Benefit'}</div>
                    </div>
                    {applied ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>Applied</span>
                    ) : (
                      <button onClick={() => navigate('/schemes')} style={{
                        background: `${c}15`, color: c, border: 'none', borderRadius: 6,
                        padding: '4px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      }}>Apply</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Profile Summary ── */}
        {profile && (
          <SectionCard title="My Profile" icon="pi-user" accent="#0ea5e9"
            action={
              <button onClick={() => navigate('/profile')} style={{
                background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b',
              }}>Full Profile</button>
            }>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: 'pi-id-card', label: 'Aadhaar', value: profile.aadhaar_number?.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') },
                { icon: 'pi-envelope', label: 'Email', value: profile.email },
                { icon: 'pi-phone', label: 'Phone', value: profile.phone || 'N/A' },
                { icon: 'pi-briefcase', label: 'Occupation', value: profile.occupation || 'N/A' },
                { icon: 'pi-calendar', label: 'Age', value: profile.age ? `${profile.age} years` : 'N/A' },
                { icon: 'pi-wallet', label: 'Category', value: profile.is_bpl ? 'BPL' : 'APL' },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: '#f8fafc', borderRadius: 8, border: '1px solid #e8f0fe',
                }}>
                  <i className={`pi ${item.icon}`} style={{ fontSize: 14, color: '#0ea5e9', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Application Status Breakdown ── */}
        <SectionCard title="Application Breakdown" icon="pi-chart-bar" accent="#3b82f6">
          {applications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8' }}>
              <i className="pi pi-file-plus" style={{ fontSize: 36, display: 'block', marginBottom: 8, color: '#cbd5e1' }} />
              No applications yet
            </div>
          ) : (
            <div>
              {/* Visual bar breakdown */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 14, marginBottom: 16 }}>
                {approved > 0 && <div style={{ flex: approved, background: '#10b981', transition: 'flex 0.5s' }} title={`Approved: ${approved}`} />}
                {pending > 0 && <div style={{ flex: pending, background: '#f59e0b', transition: 'flex 0.5s' }} title={`Pending: ${pending}`} />}
                {rejected > 0 && <div style={{ flex: rejected, background: '#ef4444', transition: 'flex 0.5s' }} title={`Rejected: ${rejected}`} />}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Approved', count: approved, color: '#10b981', icon: 'pi-check-circle' },
                  { label: 'Pending', count: pending, color: '#f59e0b', icon: 'pi-clock' },
                  { label: 'Rejected', count: rejected, color: '#ef4444', icon: 'pi-times-circle' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                    <i className={`pi ${s.icon}`} style={{ fontSize: 12, color: s.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{s.label}: {s.count}</span>
                  </div>
                ))}
              </div>

              {/* Recent application list */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {applications.slice(0, 3).map(a => {
                  const scheme = schemes.find(s => s.id === a.scheme_id);
                  return (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e8f0fe',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{scheme?.name || `Scheme #${a.scheme_id}`}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN') : ''}</div>
                      </div>
                      <Badge value={a.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ════════ APPLICATIONS TABLE ════════ */}
      <div ref={tableRef}>
        <SectionCard title="All Applications" icon="pi-file" accent="#3b82f6"
          action={applications.length > 0 && (
            <button onClick={() => navigate('/my-applications')} style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b',
            }}>View All</button>
          )}>
          {applications.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '2rem 0' }}>
              <i className="pi pi-file-plus" style={{ fontSize: 44, display: 'block', marginBottom: 12, color: '#cbd5e1' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No applications yet</div>
              <div style={{ fontSize: 12 }}>Browse schemes to find and apply for government welfare programs.</div>
              <button onClick={() => navigate('/schemes')} style={{
                marginTop: 14, padding: '10px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Browse Schemes →</button>
            </div>
          ) : (
            <DataTable value={applications.slice(0, 10)} stripedRows tableStyle={{ minWidth: '100%' }}
              style={{ fontSize: 13 }} emptyMessage="No applications found."
              rowHover>
              <Column field="scheme_id" header="Scheme" body={(row) => {
                const s = schemes.find(sc => sc.id === row.scheme_id);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#3b82f615', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="pi pi-bookmark" style={{ fontSize: 13, color: '#3b82f6' }} />
                    </div>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{s?.name || `Scheme #${row.scheme_id}`}</span>
                  </div>
                );
              }} />
              <Column field="status" header="Status" body={(row) => <Badge value={row.status} />} />
              <Column field="submitted_at" header="Submitted" body={(row) => (
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </span>
              )} />
              <Column field="reviewed_at" header="Reviewed" body={(row) => (
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {row.reviewed_at ? new Date(row.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </span>
              )} />
            </DataTable>
          )}
        </SectionCard>
      </div>

      {/* ════════ FOOTER INFO BAR ════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        padding: '16px', marginTop: 8, marginBottom: 8,
        background: '#f8fafc', borderRadius: 12, border: '1px solid #e8f0fe',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={logo} alt="" style={{ height: 22 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>DigiVerify</span>
        </div>
        <span style={{ width: 1, height: 16, background: '#e2e8f0' }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Blockchain-Secured Verification</span>
        <span style={{ width: 1, height: 16, background: '#e2e8f0' }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>AI-Powered Risk Analysis</span>
        <span style={{ width: 1, height: 16, background: '#e2e8f0' }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>Government Welfare Platform</span>
      </div>
    </div>
  );
}

