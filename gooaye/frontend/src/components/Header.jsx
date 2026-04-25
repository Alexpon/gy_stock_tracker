import { C } from '../constants.js';

export function Header({ market, setMarket, period, setPeriod, route }) {
  const routeLabel = {
    action: '決策 · Action',
    analysis: '歷史回測 · Analysis',
    episodes: '集數管理 · Episodes',
  }[route];
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`, background: C.surface,
      padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 24,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
        {routeLabel}
      </div>
      <div style={{ flex: 1 }} />
      {route !== 'episodes' && (
        <div style={{ display: 'inline-flex', background: C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${C.border}` }}>
          {['us', 'tw'].map(m => (
            <button key={m} onClick={() => setMarket(m)} style={{
              border: 'none', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
              background: market === m ? C.surface : 'transparent',
              color: market === m ? C.text : C.textMuted,
              boxShadow: market === m ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
            }}>{m === 'us' ? '美股 US' : '台股 TW'}</button>
          ))}
        </div>
      )}
      {route === 'analysis' && (
        <div style={{ display: 'inline-flex', background: C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${C.border}` }}>
          {[['w1', '1W'], ['w2', '2W'], ['m1', '1M'], ['q1', '1Q']].map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
              background: period === k ? C.surface : 'transparent',
              color: period === k ? C.text : C.textMuted,
              boxShadow: period === k ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
              fontFamily: 'var(--font-mono)',
            }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSubtle, fontFamily: 'var(--font-mono)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.up }} />
        LIVE · 更新於 {(() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
      </div>
    </div>
  );
}
