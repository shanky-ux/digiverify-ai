import { useRef, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import logo from '../../assets/logo.png';

/* ── Indian Flag colors ── */
const SAFFRON = '#FF9933';
const WHITE = '#FFFFFF';
const GREEN = '#138808';
const NAVY = '#000080';

/* ── Ashoka Chakra SVG (24 spokes) ── */
function AshokaSVG({ size = 28, style = {} }) {
  const spokes = [];
  for (let i = 0; i < 24; i++) {
    const angle = (i * 15) * Math.PI / 180;
    const x2 = 50 + 40 * Math.cos(angle);
    const y2 = 50 + 40 * Math.sin(angle);
    spokes.push(<line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke={NAVY} strokeWidth="2.2" />);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <circle cx="50" cy="50" r="45" fill="none" stroke={NAVY} strokeWidth="4" />
      <circle cx="50" cy="50" r="8" fill={NAVY} />
      {spokes}
    </svg>
  );
}

/* ── Simplified India Map outline SVG ── */
function IndiaMapSVG({ size = 36, opacity = 0.08 }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" style={{ opacity, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
      <path d="M45 5 L55 3 L65 8 L72 5 L78 10 L80 18 L85 22 L82 30 L88 35 L90 42 L85 50 L88 58 L82 65 L78 72 L80 80 L72 85 L68 92 L60 95 L55 105 L50 115 L48 108 L42 100 L38 92 L30 88 L25 80 L20 72 L18 62 L15 55 L12 48 L15 40 L18 32 L22 25 L28 20 L32 15 L38 10 Z"
        fill="white" stroke="none" />
    </svg>
  );
}

const NAV_USER = [
  { path: '/dashboard', label: 'Dashboard', icon: 'pi-home' },
  { path: '/schemes', label: 'Schemes', icon: 'pi-th-large' },
  { path: '/my-applications', label: 'Applications', icon: 'pi-file' },
  { path: '/benefit-history', label: 'Benefits', icon: 'pi-wallet' },
  { path: '/timeline', label: 'Timeline', icon: 'pi-clock' },
  { path: '/ml-insights', label: 'ML Insights', icon: 'pi-chart-line' },
  { path: '/verify', label: 'Verify ID', icon: 'pi-shield' },
  { path: '/blockchain', label: 'Chain', icon: 'pi-link' },
  { path: '/profile', label: 'Profile', icon: 'pi-user' },
];
const NAV_ADMIN = [
  { path: '/admin', label: 'Overview', icon: 'pi-chart-bar' },
  { path: '/admin/schemes', label: 'Schemes', icon: 'pi-th-large' },
  { path: '/admin/users', label: 'Users', icon: 'pi-users' },
  { path: '/admin/verifications', label: 'Verifications', icon: 'pi-shield' },
  { path: '/blockchain', label: 'Blockchain', icon: 'pi-link' },
];

export default function Navbar({ user, onLogout }) {
  const loc = useLocation();
  const links = user?.is_admin ? NAV_ADMIN : NAV_USER;
  const navRef = useRef(null);
  const chakraRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!navRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(navRef.current, { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
      if (chakraRef.current) {
        gsap.to(chakraRef.current, { rotation: 360, duration: 20, repeat: -1, ease: 'none' });
      }
    }, navRef);
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      ctx.revert();
    };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  return (
    <header ref={navRef} style={{
      position: 'sticky', top: 0, zIndex: 100,
      backdropFilter: 'blur(20px)',
      boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.45)' : '0 2px 16px rgba(0,0,0,0.25)',
      transition: 'box-shadow 0.3s ease',
    }}>
      {/* ── Indian Tricolor Stripe (thicker) ── */}
      <div style={{ display: 'flex', height: 5 }}>
        <div style={{ flex: 1, background: SAFFRON }} />
        <div style={{ flex: 1, background: WHITE }} />
        <div style={{ flex: 1, background: GREEN }} />
      </div>

      {/* ═══ TOP ROW: Logo + Brand + User ═══ */}
      <div style={{
        background: scrolled
          ? 'rgba(15,23,42,0.98)'
          : 'linear-gradient(135deg, #0c1929 0%, #0f172a 50%, #0c1929 100%)',
        transition: 'background 0.3s ease',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Faint India map watermark */}
        <IndiaMapSVG size={52} opacity={0.06} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 2rem', maxWidth: 1440, margin: '0 auto',
          position: 'relative', zIndex: 1,
        }}>
          {/* Logo + Chakra + Brand */}
          <Link to={user?.is_admin ? '/admin' : '/dashboard'} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            textDecoration: 'none', flexShrink: 0,
          }}>
            {/* Logo with tricolor ring */}
            <div style={{
              width: 58, height: 58, borderRadius: 14,
              background: 'rgba(255,255,255,0.06)',
              border: `2px solid transparent`,
              backgroundImage: `linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.06)), linear-gradient(180deg, ${SAFFRON}, ${WHITE}, ${GREEN})`,
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
              boxShadow: `0 2px 12px rgba(255,153,51,0.15), 0 2px 12px rgba(19,136,8,0.15)`,
            }}>
              <img src={logo} alt="DigiVerify" style={{
                height: 44, width: 44, objectFit: 'contain',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
              }} />
            </div>

            {/* Spinning Ashoka Chakra */}
            <div ref={chakraRef} style={{ flexShrink: 0 }}>
              <AshokaSVG size={32} style={{ opacity: 0.7, filter: 'drop-shadow(0 0 3px rgba(0,0,128,0.3))' }} />
            </div>

            {/* Brand name: Dig(saffron) iVe(white) rify(green) */}
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 900, fontSize: 26, letterSpacing: '0.5px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <span style={{ color: SAFFRON, textShadow: `0 0 12px rgba(255,153,51,0.4)` }}>Dig</span>
                <span style={{ color: WHITE }}>iVer</span>
                <span style={{ color: GREEN, textShadow: `0 0 12px rgba(19,136,8,0.4)` }}>ify</span>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: '2.5px', textTransform: 'uppercase',
                background: `linear-gradient(90deg, ${SAFFRON}, ${WHITE}, ${GREEN})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Government Scheme Verification
              </div>
            </div>

            {user?.is_admin && (
              <span style={{
                background: `linear-gradient(135deg, ${SAFFRON}, #e67300)`,
                color: '#fff', borderRadius: 999,
                fontSize: 9, fontWeight: 800, padding: '3px 10px', marginLeft: 4,
                boxShadow: `0 2px 8px rgba(255,153,51,0.35)`,
                letterSpacing: '1.5px',
              }}>ADMIN</span>
            )}
          </Link>

          {/* Right: User + Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {/* Notification bell */}
            {!user?.is_admin && (
              <Link to="/notifications" style={{
                width: 38, height: 38, borderRadius: 10,
                background: loc.pathname === '/notifications' ? `rgba(255,153,51,0.25)` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${loc.pathname === '/notifications' ? 'rgba(255,153,51,0.3)' : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: loc.pathname === '/notifications' ? SAFFRON : 'rgba(200,200,200,0.7)',
                textDecoration: 'none', transition: 'all 0.15s ease',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,153,51,0.15)'; e.currentTarget.style.color = SAFFRON; }}
                onMouseLeave={(e) => { if (loc.pathname !== '/notifications') { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(200,200,200,0.7)'; } }}>
                <i className="pi pi-bell" style={{ fontSize: 16 }} />
              </Link>
            )}

            {/* Divider */}
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />

            {/* User avatar + name */}
            <Link to={user?.is_admin ? '/admin' : '/profile'} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              textDecoration: 'none', padding: '5px 10px 5px 5px',
              borderRadius: 12, transition: 'background 0.15s ease',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `linear-gradient(135deg, ${SAFFRON}, ${GREEN})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 16,
                boxShadow: `0 2px 10px rgba(255,153,51,0.3)`,
              }}>
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{user?.full_name}</div>
                <div style={{ color: 'rgba(200,200,200,0.5)', fontSize: 10 }}>ID #{user?.user_id}</div>
              </div>
            </Link>

            {/* Logout */}
            <button onClick={onLogout} title="Logout" style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#fca5a5'; }}>
              <i className="pi pi-sign-out" style={{ fontSize: 15 }} />
            </button>

            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="nav-hamburger" style={{
              display: 'none', width: 38, height: 38, borderRadius: 10,
              background: mobileOpen ? 'rgba(255,153,51,0.25)' : 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`pi ${mobileOpen ? 'pi-times' : 'pi-bars'}`} style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM ROW: Navigation Links with tricolor accent ═══ */}
      <div style={{
        background: scrolled
          ? 'rgba(20,35,60,0.98)'
          : 'linear-gradient(90deg, #0f2137 0%, #142b47 50%, #0f2137 100%)',
        borderTop: `1px solid rgba(255,153,51,0.1)`,
        transition: 'background 0.3s ease',
        position: 'relative',
      }}>
        <nav className="nav-links-row" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 2, padding: '0 2rem', maxWidth: 1440, margin: '0 auto',
          height: 44,
        }}>
          {links.map((l) => {
            const active = loc.pathname === l.path;
            return (
              <Link key={l.path} to={l.path} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                color: active ? '#fff' : 'rgba(200,215,240,0.72)',
                textDecoration: 'none',
                padding: '7px 16px',
                borderRadius: 8,
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                background: active ? `rgba(255,153,51,0.2)` : 'transparent',
                position: 'relative',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,153,51,0.1)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(200,215,240,0.72)';
                  }
                }}>
                <i className={`pi ${l.icon}`} style={{ fontSize: 14 }} />
                <span>{l.label}</span>
                {active && <span style={{
                  position: 'absolute', bottom: 0, left: '10%', right: '10%',
                  height: 3, borderRadius: 2,
                  background: `linear-gradient(90deg, ${SAFFRON}, ${WHITE}, ${GREEN})`,
                  boxShadow: `0 0 8px rgba(255,153,51,0.4)`,
                }} />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom tricolor glow line ── */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, ${SAFFRON} 0%, ${SAFFRON} 30%, transparent 30%, transparent 35%, ${WHITE} 35%, ${WHITE} 65%, transparent 65%, transparent 70%, ${GREEN} 70%, ${GREEN} 100%)`,
        opacity: 0.6,
      }} />

      {/* ── Mobile Dropdown ── */}
      {mobileOpen && (
        <div style={{
          background: 'linear-gradient(180deg, #0c1929 0%, #142b47 100%)',
          borderTop: `1px solid rgba(255,153,51,0.15)`,
          padding: '8px 12px 12px',
        }}>
          {links.map((l) => {
            const active = loc.pathname === l.path;
            return (
              <Link key={l.path} to={l.path} onClick={() => setMobileOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                color: active ? '#fff' : 'rgba(200,215,240,0.8)',
                textDecoration: 'none',
                padding: '11px 16px',
                borderRadius: 10,
                fontWeight: active ? 700 : 500,
                fontSize: 14,
                background: active ? 'rgba(255,153,51,0.2)' : 'transparent',
                transition: 'background 0.15s',
                borderLeft: active ? `3px solid ${SAFFRON}` : '3px solid transparent',
              }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,153,51,0.08)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <i className={`pi ${l.icon}`} style={{ fontSize: 16, width: 22, textAlign: 'center' }} />
                {l.label}
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .nav-hamburger { display: flex !important; }
          .nav-links-row { display: none !important; }
        }
        @keyframes chakra-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </header>
  );
}
