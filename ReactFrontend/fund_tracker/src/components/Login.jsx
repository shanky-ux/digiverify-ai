import { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import api from '../api';
import logo from '../assets/logo.png';

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('user');
  const [aadhaar, setAadhaar] = useState('');
  const [email, setEmail] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loading, setLoading] = useState(false);
  const cardRef = useRef(null);
  const logoRef = useRef(null);
  const toast = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline();
    // animate position only — remove scale and opacity changes
    tl.from(logoRef.current, { y: -8, duration: 0.6, ease: 'back.out(1.7)' })
      .from(cardRef.current, { y: 50, duration: 0.7, ease: 'power3.out' }, '-=0.3');
  }, []);

  const loginUser = async () => {
    if (!aadhaar || !email) {
      toast.current.show({ severity: 'warn', summary: 'Missing Fields', detail: 'Please fill in all fields.', life: 3000 });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { aadhaar_number: aadhaar, email });
      onLogin({ ...res.data, is_admin: false });
    } catch {
      toast.current.show({ severity: 'error', summary: 'Login Failed', detail: 'Invalid Aadhaar or email. Please try again.', life: 3000 });
    } finally { setLoading(false); }
  };

  const loginAdmin = async () => {
    if (!adminUser || !adminPass) {
      toast.current.show({ severity: 'warn', summary: 'Missing Fields', detail: 'Please fill in all fields.', life: 3000 });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/admin_login', { username: adminUser, password: adminPass });
      onLogin({ ...res.data, is_admin: true });
    } catch {
      toast.current.show({ severity: 'error', summary: 'Login Failed', detail: 'Invalid admin credentials.', life: 3000 });
    } finally { setLoading(false); }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: 10,
    padding: '11px 14px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0a2744 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <Toast ref={toast} position="top-right" />

      {/* Animated background orbs */}
      {[
        { size: 400, top: '-10%', left: '-10%', color: '#3b82f6', delay: '0s' },
        { size: 300, top: '60%', right: '-5%', color: '#1d4ed8', delay: '2s' },
        { size: 200, top: '30%', left: '60%', color: '#0ea5e9', delay: '4s' },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: orb.size, height: orb.size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${orb.color}25, transparent 70%)`,
          top: orb.top, left: orb.left, right: orb.right,
          animation: `orbFloat 8s ease-in-out infinite alternate`,
          animationDelay: orb.delay,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 460, margin: '0 2rem' }}>
        {/* Logo */}
        <div ref={logoRef} style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src={logo} alt="DigiVerify" style={{ height: 72, margin: '0 auto 12px', display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(59,130,246,0.6))' }} />
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Digi Verify</h1>
          <p style={{ color: 'rgba(147,197,253,0.8)', fontSize: 13, marginTop: 4 }}>Government Scheme Verification System</p>
        </div>

        {/* Glass Card */}
        <div ref={cardRef} style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          padding: '2.5rem 2.5rem 2rem',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
          {/* Tab Switcher */}
          <div style={{
            display: 'flex', borderRadius: 12, overflow: 'hidden', marginBottom: '1.75rem',
            background: 'rgba(255,255,255,0.06)', padding: 4, gap: 4,
          }}>
            {[['user', 'pi-user', 'Citizen Login'], ['admin', 'pi-shield', 'Admin Login']].map(([key, icon, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 0', fontWeight: 700, fontSize: 13,
                border: 'none', cursor: 'pointer', borderRadius: 9,
                background: tab === key ? 'rgba(59,130,246,0.85)' : 'transparent',
                color: tab === key ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.2s ease',
                boxShadow: tab === key ? '0 4px 12px rgba(59,130,246,0.4)' : 'none',
              }}>
                <i className={`pi ${icon}`} style={{ fontSize: 13 }} />{label}
              </button>
            ))}
          </div>

          {tab === 'user' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: 'rgba(147,197,253,0.9)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: '0.5px' }}>
                  <i className="pi pi-id-card" style={{ marginRight: 6 }} />AADHAAR NUMBER
                </label>
                <InputText value={aadhaar} onChange={(e) => setAadhaar(e.target.value)}
                  placeholder="12-digit Aadhaar number" maxLength={12} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: 'rgba(147,197,253,0.9)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: '0.5px' }}>
                  <i className="pi pi-envelope" style={{ marginRight: 6 }} />EMAIL ADDRESS
                </label>
                <InputText value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com" type="email" style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && loginUser()} />
              </div>
              <Button label={loading ? 'Signing In...' : 'Sign In as Citizen'} icon="pi pi-sign-in"
                loading={loading} onClick={loginUser} style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  border: 'none', borderRadius: 10, padding: '13px',
                  fontWeight: 700, fontSize: 15, width: '100%',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                }} />
              <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, color: 'rgba(147,197,253,0.7)', fontSize: 12 }}>
                Test: Aadhaar <span style={{ color: '#93c5fd', fontWeight: 700 }}>123456789012</span> / Email <span style={{ color: '#93c5fd', fontWeight: 700 }}>ravi@mail.com</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ color: 'rgba(147,197,253,0.9)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: '0.5px' }}>
                  <i className="pi pi-user" style={{ marginRight: 6 }} />USERNAME
                </label>
                <InputText value={adminUser} onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="admin" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: 'rgba(147,197,253,0.9)', fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, letterSpacing: '0.5px' }}>
                  <i className="pi pi-lock" style={{ marginRight: 6 }} />PASSWORD
                </label>
                <InputText value={adminPass} onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="admin password" type="password" style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && loginAdmin()} />
              </div>
              <Button label={loading ? 'Signing In...' : 'Sign In as Admin'} icon="pi pi-shield"
                loading={loading} onClick={loginAdmin} style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none', borderRadius: 10, padding: '13px',
                  fontWeight: 700, fontSize: 15, width: '100%',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                }} />
              <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, color: 'rgba(147,197,253,0.7)', fontSize: 12 }}>
                Credentials: <span style={{ color: '#93c5fd', fontWeight: 700 }}>admin</span> / <span style={{ color: '#93c5fd', fontWeight: 700 }}>admin123</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes orbFloat {
          from { transform: translateY(0px) scale(1); }
          to { transform: translateY(-40px) scale(1.08); }
        }
        .p-inputtext { font-family: inherit !important; }
        .p-inputtext::placeholder { color: rgba(255,255,255,0.35) !important; }
      `}</style>
    </div>
  );
}
