import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

export default function StatCard({ label, value, accent = '#3b82f6', icon, subtitle, trend }) {
  const cardRef = useRef(null);
  const valueRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(cardRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.1 });
    if (typeof value === 'number' && valueRef.current) {
      const obj = { val: 0 };
      gsap.to(obj, {
        val: value, duration: 1.4, ease: 'power2.out',
        onUpdate: () => { if (valueRef.current) valueRef.current.textContent = Math.round(obj.val); }
      });
    }
  }, [value]);

  return (
    <div ref={cardRef} style={{ flex: 1, minWidth: 180 }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '1.5rem 1.75rem',
        borderTop: `4px solid ${accent}`,
        boxShadow: `0 4px 24px ${accent}18`,
        border: `1px solid ${accent}20`,
        position: 'relative', overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${accent}30`; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 24px ${accent}18`; }}>

        {/* Background accent circle */}
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 80, height: 80,
          borderRadius: '50%', background: `${accent}12`,
        }} />

        {icon && (
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${accent}18`, marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className={`pi ${icon}`} style={{ fontSize: 20, color: accent }} />
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
          {label}
        </div>
        <div ref={valueRef} style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
          {typeof value === 'number' ? 0 : value}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{subtitle}</div>
        )}
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12 }}>
            <i className={`pi ${trend >= 0 ? 'pi-arrow-up' : 'pi-arrow-down'}`}
              style={{ color: trend >= 0 ? '#10b981' : '#ef4444', fontSize: 11 }} />
            <span style={{ color: trend >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {Math.abs(trend)}% from last month
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
