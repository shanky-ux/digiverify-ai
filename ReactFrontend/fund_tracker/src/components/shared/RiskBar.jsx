import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

export default function RiskBar({ value = 0, label }) {
  const pct = Math.min(Math.round(value * 100), 100);
  const color = pct < 30 ? '#10b981' : pct < 65 ? '#f59e0b' : '#ef4444';
  const bgColor = pct < 30 ? '#d1fae5' : pct < 65 ? '#fef3c7' : '#fee2e2';
  const barRef = useRef(null);

  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(barRef.current, { width: '0%' }, { width: `${pct}%`, duration: 1.2, ease: 'power2.out', delay: 0.2 });
    }
  }, [pct]);

  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color, background: bgColor, padding: '2px 8px', borderRadius: 999 }}>{pct}%</span>
        </div>
      )}
      <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden', position: 'relative' }}>
        <div ref={barRef} style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          boxShadow: `0 0 8px ${color}60`,
          transition: 'width 0.4s',
        }} />
      </div>
      {!label && (
        <div style={{ textAlign: 'right', marginTop: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}
