import { useState, useRef, useEffect } from 'react';
import api from '../../api';

const BOT_AVATAR = null; // rendered as PrimeIcon below

function Markdown({ text }) {
  // Simple markdown: **bold**, bullet points, line breaks
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={i} />;
        const isBullet = /^[-•*]\s/.test(trimmed);
        const content = trimmed
          .replace(/^[-•*]\s/, '')
          .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
          .replace(/`(.+?)`/g, '<code style="background:#e8f4ff;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>');
        return (
          <div key={i} style={{
            paddingLeft: isBullet ? 16 : 0,
            position: 'relative',
            marginBottom: 2,
          }}>
            {isBullet && <span style={{ position: 'absolute', left: 4, color: '#3b82f6' }}>•</span>}
            <span dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      })}
    </div>
  );
}

const SUGGESTIONS = [
  'What schemes am I eligible for?',
  'Why is my risk score high?',
  'How do I verify my identity?',
  'What documents do I need?',
  'How long is verification valid?',
];

export default function AIAssistant({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${user?.full_name?.split(' ')[0] || 'there'}! I'm DigiVerify AI \u2014 your personal assistant.\n\nI can help you with:\n- **Scheme eligibility** & how to apply\n- **Risk score** explanations\n- **Verification steps** & status\n\nAsk me anything!` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await api.post('/chat', {
        message: msg,
        user_id: user?.user_id,
        history,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (e) {
      const errMsg = e.response?.data?.error || 'Failed to reach AI assistant. Make sure Ollama is running.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 60, height: 60, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="Ask DigiVerify AI"
      >
        <i className="pi pi-android" style={{ fontSize: 28, color: '#fff' }} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      width: 420, maxWidth: 'calc(100vw - 48px)',
      height: 560, maxHeight: 'calc(100vh - 100px)',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 8px 40px rgba(13,58,102,0.35), 0 0 0 1px rgba(59,130,246,0.2)',
      display: 'flex', flexDirection: 'column',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            <i className="pi pi-android" style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>DigiVerify AI</div>
            <div style={{ color: '#93c5fd', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Powered by Ollama · qwen2.5
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', color: '#93c5fd',
          width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><i className="pi pi-times" style={{ fontSize: 14 }} /></button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        background: 'linear-gradient(180deg, #f8fafc, #f0f6ff)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            gap: 8, alignItems: 'flex-end',
          }}>
            {m.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>
                <i className="pi pi-android" style={{ fontSize: 14, color: '#fff' }} />
              </div>
            )}
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.role === 'user'
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : '#fff',
              color: m.role === 'user' ? '#fff' : '#1e293b',
              fontSize: 13.5, lineHeight: 1.55,
              boxShadow: m.role === 'user'
                ? '0 2px 8px rgba(59,130,246,0.3)'
                : '0 1px 4px rgba(0,0,0,0.08)',
              border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
            }}>
              {m.role === 'user' ? m.content : <Markdown text={m.content} />}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              <i className="pi pi-android" style={{ fontSize: 14, color: '#fff' }} />
            </div>
            <div style={{
              background: '#fff', borderRadius: 14, padding: '12px 18px',
              border: '1px solid #e2e8f0', display: 'flex', gap: 4,
            }}>
              {[0, 1, 2].map((d) => (
                <div key={d} style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#93c5fd',
                  animation: `bounce 1.2s ease-in-out ${d * 0.15}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Suggestion chips — show only when no user messages yet */}
        {messages.length === 1 && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{
                background: '#e8f4ff', border: '1px solid #93c5fd', borderRadius: 99,
                padding: '6px 14px', fontSize: 12, color: '#1d4ed8', cursor: 'pointer',
                fontWeight: 600, transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#e8f4ff'; e.currentTarget.style.color = '#1d4ed8'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 14px', borderTop: '1px solid #e2e8f0',
        background: '#fff', display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about schemes, risk, or verification..."
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid #93c5fd', fontSize: 14, outline: 'none',
            background: loading ? '#f1f5f9' : '#fff',
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            width: 42, height: 42, borderRadius: 10,
            background: loading || !input.trim()
              ? '#e2e8f0'
              : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            border: 'none', cursor: loading || !input.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 18,
            transition: 'all 0.15s',
          }}
        >
          <i className="pi pi-send" style={{ fontSize: 16 }} />
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
