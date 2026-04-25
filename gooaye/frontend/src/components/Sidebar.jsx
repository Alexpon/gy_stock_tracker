import { C } from '../constants.js';

export function Sidebar({ route, setRoute }) {
  const items = [
    { k: 'action', label: 'Action', sub: '決策', desc: '最新 4 集 · 該跟哪幾檔' },
    { k: 'analysis', label: 'Analysis', sub: '分析', desc: '歷史回測 · 命中率' },
    { k: 'episodes', label: 'Episodes', sub: '集數管理', desc: '掃描 · 處理 · 狀態' },
  ];
  return (
    <div style={{
      width: 220, background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ padding: '20px 18px 18px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: C.text, color: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>G</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Gooaye</div>
            <div style={{ fontSize: 10.5, color: C.textSubtle, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>MONITOR</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 10px' }}>
        <div style={{
          fontSize: 10, color: C.textSubtle, textTransform: 'uppercase',
          letterSpacing: '0.12em', fontWeight: 600, padding: '4px 10px 8px',
        }}>
          NAVIGATION
        </div>
        {items.map(it => {
          const active = route === it.k;
          return (
            <button key={it.k} onClick={() => setRoute(it.k)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 12px', marginBottom: 4,
              border: 'none', borderRadius: 6, cursor: 'pointer',
              background: active ? C.text : 'transparent',
              color: active ? '#fff' : C.text,
              fontFamily: 'var(--font-sans)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}>{it.label}</span>
                <span style={{ fontSize: 11, opacity: active ? 0.65 : 0.55 }}>{it.sub}</span>
              </div>
              <div style={{ fontSize: 10.5, opacity: active ? 0.7 : 0.6, lineHeight: 1.4 }}>{it.desc}</div>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{
        padding: '14px 18px', borderTop: `1px solid ${C.border}`,
        fontSize: 10.5, color: C.textSubtle, lineHeight: 1.5,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 4 }}>
          v1 · {new Date().toISOString().slice(0, 10)}
        </div>
        <div>合成資料原型 · 非投資建議</div>
      </div>
    </div>
  );
}
