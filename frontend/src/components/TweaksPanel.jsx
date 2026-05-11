import { C } from '../constants.js';

export function TweaksPanel({ config, setConfig, visible }) {
  if (!visible) return null;
  const set = (k, v) => {
    const next = { ...config, [k]: v };
    setConfig(next);
  };
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, width: 320,
      background: C.surface, border: `1px solid ${C.borderStrong}`,
      borderRadius: 10, boxShadow: '0 12px 40px rgba(16,24,40,0.16)',
      zIndex: 200, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: C.accent, fontWeight: 700, letterSpacing: '0.1em' }}>⚙ TWEAKS</span>
        <span style={{ fontSize: 12, color: C.textMuted }}>策略參數</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Action · 顯示範圍</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[['doing', '只看有在做'], ['all', '+ 觀察中']].map(([k, l]) => (
              <button key={k} onClick={() => set('actionFollow', k)} style={{
                padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${(config.actionFollow||'all') === k ? C.text : C.border}`,
                background: (config.actionFollow||'all') === k ? C.text : 'transparent',
                color: (config.actionFollow||'all') === k ? '#fff' : C.textMuted,
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: C.textSubtle, marginTop: 4, lineHeight: 1.4 }}>
            「只是提到」一律隱藏（它們不是可跟標的）
          </div>
        </div>
        <div style={{ height: 1, background: C.border, margin: '4px -16px 16px' }} />
        <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10 }}>
          Analysis · 回測參數
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>跟單範圍</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[['doing', '有在做'], ['doing_watching', '+觀察'], ['all', '全部']].map(([k, l]) => (
              <button key={k} onClick={() => set('followOnly', k)} style={{
                padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${config.followOnly === k ? C.text : C.border}`,
                background: config.followOnly === k ? C.text : 'transparent',
                color: config.followOnly === k ? '#fff' : C.textMuted,
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>每集投入資金</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[5000, 10000, 50000, 100000].map(v => (
              <button key={v} onClick={() => set('capitalPerEpisode', v)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${config.capitalPerEpisode === v ? C.text : C.border}`,
                background: config.capitalPerEpisode === v ? C.text : 'transparent',
                color: config.capitalPerEpisode === v ? '#fff' : C.textMuted,
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer',
              }}>{v >= 1000 ? (v/1000) + 'K' : v}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>延遲進場（壓力測試）</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {[0, 1, 3, 7, 14].map(v => (
              <button key={v} onClick={() => set('entryDelay', v)} style={{
                padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${(config.entryDelay||0) === v ? C.text : C.border}`,
                background: (config.entryDelay||0) === v ? C.text : 'transparent',
                color: (config.entryDelay||0) === v ? '#fff' : C.textMuted,
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer',
              }}>{v === 0 ? '即時' : `+${v}d`}</button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: C.textSubtle, marginTop: 6, lineHeight: 1.4 }}>
            模擬聽完節目後隔幾天才進場；測試策略對進場時機的敏感度。
          </div>
        </div>
      </div>
    </div>
  );
}
