import { C, fmt, fmtPrice } from '../constants.js';
import { Spark } from './shared/Spark.jsx';
import { Pill } from './shared/Pill.jsx';
import { Delta } from './shared/Delta.jsx';

export function DetailPanel({ pick, episodes, onClose }) {
  if (!pick) return null;
  const ep = episodes.find(e => e.ep === pick.ep);
  const benchApprox = { w1: pick.bench_w1 || 0, w2: pick.bench_w2 || 0, m1: pick.bench_m1 || 0, q1: pick.bench_q1 || 0 };
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: C.surface,
      borderLeft: `1px solid ${C.border}`, boxShadow: '-8px 0 32px rgba(16,24,40,0.08)',
      overflowY: 'auto', zIndex: 50, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, background: C.surface, zIndex: 2,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{pick.ticker}</span>
            <Pill kind={pick.confidence} />
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: C.surfaceAlt, color: C.textMuted, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pick.market.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{pick.name}</div>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, color: C.textMuted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: C.surfaceAlt, borderRadius: 6, padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>進場價 · {pick.mention_date}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {pick.market === 'tw' ? 'NT$' : '$'}{fmtPrice(pick.entry)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>當前</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: pick.q1 >= 0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>
                {pick.market === 'tw' ? 'NT$' : '$'}{fmtPrice(pick.sparkline[pick.sparkline.length-1])}
              </div>
            </div>
          </div>
          <Spark data={pick.sparkline} width={412} height={72} positive={pick.q1 >= 0} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>回測報酬</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[['1週', 'w1'], ['2週', 'w2'], ['1個月', 'm1'], ['1季', 'q1']].map(([label, k]) => {
              const v = pick[k]; const d = v - benchApprox[k];
              return (
                <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, color: C.textSubtle, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: v>=0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</div>
                  <div style={{ fontSize: 10, color: d>=0 ? C.up : C.down, fontFamily: 'var(--font-mono)', marginTop: 2 }}>vs 大盤 {fmt(d)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: C.warnBg, border: `1px solid #fedf89`, borderRadius: 6, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#fff', color: C.warn, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>EP {pick.ep}</span>
            <span style={{ fontSize: 11, color: C.warn, fontWeight: 600 }}>節目原話</span>
            <div style={{ flex: 1 }} />
            <button style={{ border: 'none', background: 'transparent', color: C.warn, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>▶ 播放片段</button>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#6a4103', fontStyle: 'italic' }}>「{pick.quote}」</div>
          {ep && <div style={{ fontSize: 11, color: C.warn, marginTop: 8, opacity: 0.8 }}>出自 《{ep.title}》 · {ep.date}</div>}
        </div>

        <div style={{ fontSize: 10.5, color: C.textSubtle, lineHeight: 1.5 }}>
          進場價採當集節目發布後首個交易日開盤價；與大盤比較的基準為 {pick.market === 'us' ? 'SPDR S&P 500 ETF (SPY)' : '元大台灣 50 (0050)'}。
        </div>
      </div>
    </div>
  );
}
