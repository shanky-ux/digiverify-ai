export default function SectionCard({ title, children, action, icon, accent = '#3b82f6' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2eaf4',
      borderRadius: 16,
      marginBottom: '1.5rem',
      boxShadow: '0 2px 16px rgba(59,130,246,0.08)',
      overflow: 'hidden',
    }}>
      {title && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #e8f0fe',
          background: 'linear-gradient(90deg, #f8faff 0%, #f0f6ff 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon && (
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`pi ${icon}`} style={{ color: accent, fontSize: 15 }} />
              </div>
            )}
            <h3 style={{ margin: 0, color: '#1e3a5f', fontSize: 15, fontWeight: 700 }}>{title}</h3>
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: '1.5rem' }}>
        {children}
      </div>
    </div>
  );
}
