import { C, fmt, fmtPrice } from '../constants.js';
import { Pill } from '../components/shared/Pill.jsx';
import { Spark } from '../components/shared/Spark.jsx';

function actionFmtPrice(n, market) {
  if (n == null) return '—';
  if (market === 'tw') return Math.round(n).toLocaleString();
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(2);
}

function entryTiming(pick) {
  const sparkline = pick.sparkline || [];
  const current = sparkline.length ? sparkline[sparkline.length - 1] : null;
  const entry = pick.entry;
  if (current == null || entry == null || entry === 0) {
    return { tier: 'unknown', label: '資料不足', detail: '尚無價格資料', color: '#98a2b3', change: null, current, entry };
  }
  const change = (current - entry) / entry * 100;

  let tier, label, detail, color;
  if (change < -2) {
    tier = 'great'; label = '低於當時價'; detail = '比節目當時更便宜'; color = '#067647';
  } else if (change < 2) {
    tier = 'good'; label = '接近當時價'; detail = '仍在合理區間'; color = '#067647';
  } else if (change < 10) {
    tier = 'ok'; label = '略高於當時價'; detail = '已上漲，但尚未過熱'; color = '#b54708';
  } else {
    tier = 'wait'; label = '已漲超過 10%'; detail = '建議等回檔'; color = '#b42318';
  }
  return { tier, label, detail, color, change, current, entry };
}

function daysAgo(dateStr) {
  const today = new Date();
  const d = new Date(dateStr);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function ActionCard({ pick }) {
  const market = pick.market;
  const timing = entryTiming(pick);
  const ccy = market === 'us' ? '$' : 'NT$';
  const sparkline = pick.sparkline || [];
  const currentPrice = sparkline.length ? sparkline[sparkline.length - 1] : null;
  const positive = timing.change != null ? timing.change >= 0 : true;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header: ticker + confidence + date */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{
                fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: C.text, letterSpacing: '-0.02em',
              }}>{pick.ticker}</span>
              <Pill kind={pick.confidence} />
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{pick.name}</div>
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
            <div style={{ fontSize: 11, color: C.textSubtle, letterSpacing: '0.04em' }}>
              EP {pick.ep} · {daysAgo(pick.mention_date)}天前
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{pick.mention_date}</div>
          </div>
        </div>
        <div style={{
          display: 'inline-block', fontSize: 10.5, padding: '2px 8px',
          background: C.surfaceAlt, color: C.textMuted, borderRadius: 3,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        }}>{pick.sector}</div>
      </div>

      {/* Price section: sparkline + current vs entry */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>
              現價
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.text, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {ccy}{actionFmtPrice(currentPrice, market)}
            </div>
            {timing.change != null && (
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: positive ? C.up : C.down, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {timing.change >= 0 ? '+' : ''}{timing.change.toFixed(1)}%
                <span style={{ color: C.textSubtle, marginLeft: 6 }}>vs 進場 {ccy}{actionFmtPrice(pick.entry, market)}</span>
              </div>
            )}
          </div>
          <Spark data={sparkline} width={120} height={48} positive={positive} />
        </div>

        {/* W1 return if available */}
        {pick.w1 != null && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[['1W', pick.w1], ['2W', pick.w2], ['1M', pick.m1]].map(([label, val]) => (
              <div key={label} style={{
                flex: 1, padding: '8px 10px', background: C.surfaceAlt, borderRadius: 4,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9.5, color: C.textSubtle, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                <div style={{
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  color: val != null ? (val >= 0 ? C.up : C.down) : C.textSubtle,
                  fontVariantNumeric: 'tabular-nums',
                }}>{fmt(val)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entry timing */}
      <div style={{
        padding: '14px 20px', background: C.surfaceAlt,
        borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: timing.color, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: timing.color, marginBottom: 2 }}>{timing.label}</div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{timing.detail}</div>
        </div>
      </div>

      {/* Quote */}
      {pick.quote && (
        <div style={{
          padding: '14px 20px 16px', borderTop: `1px solid ${C.border}`, background: C.surface,
        }}>
          <div style={{
            fontSize: 10, color: C.textSubtle, textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6,
          }}>股癌原話</div>
          <div style={{
            fontSize: 12.5, color: C.textMuted, lineHeight: 1.55,
            fontStyle: 'italic', letterSpacing: '0.01em',
          }}>「{pick.quote}」</div>
        </div>
      )}
    </div>
  );
}

export function ActionPage({ market, data }) {
  const { episodes, picks } = data;

  const latestEpisodes = [...episodes].sort((a, b) => b.ep - a.ep).slice(0, 4);
  if (latestEpisodes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
        尚無資料。請先到 Episodes 頁面掃描並處理集數。
      </div>
    );
  }

  const latestEpNums = new Set(latestEpisodes.map(e => e.ep));

  let candidates = picks.filter(p =>
    p.market === market &&
    latestEpNums.has(p.ep) &&
    p.confidence !== 'mention'
  );

  candidates.sort((a, b) => {
    if (b.ep !== a.ep) return b.ep - a.ep;
    if (a.confidence === 'doing' && b.confidence !== 'doing') return -1;
    if (b.confidence === 'doing' && a.confidence !== 'doing') return 1;
    return 0;
  });

  const timings = candidates.map(p => entryTiming(p));
  const greatCount = timings.filter(t => t.tier === 'great' || t.tier === 'good').length;

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11, color: C.accent, fontFamily: 'var(--font-mono)',
          fontWeight: 700, letterSpacing: '0.14em', marginBottom: 6,
        }}>
          ACTION · 最新 4 集 · {market === 'us' ? '美股' : '台股'}
        </div>
        <h1 style={{
          margin: 0, fontSize: 28, fontWeight: 700,
          color: C.text, letterSpacing: '-0.02em', lineHeight: 1.2,
        }}>
          今天該跟哪幾檔？
        </h1>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>
          EP {latestEpisodes[latestEpisodes.length - 1].ep} – EP {latestEpisodes[0].ep}
          · {latestEpisodes[latestEpisodes.length - 1].date} ~ {latestEpisodes[0].date}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        marginBottom: 28, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>可跟標的</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>{candidates.length}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>已隱藏「只是提到」</div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>時機良好</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.up, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {greatCount}<span style={{ fontSize: 16, color: C.textSubtle, fontWeight: 500 }}> / {candidates.length}</span>
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>現價低於或接近進場價</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>最新集數</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>EP {latestEpisodes[0].ep}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            {daysAgo(latestEpisodes[0].date)} 天前 · {latestEpisodes[0].date}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {candidates.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '60px 20px', textAlign: 'center',
          color: C.textMuted, fontSize: 14,
        }}>
          此市場最新 4 集沒有符合條件的可跟標的。
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20,
        }}>
          {candidates.map(pick => (
            <ActionCard key={`${pick.ep}-${pick.ticker}`} pick={pick} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        marginTop: 32, padding: '14px 18px',
        background: C.surfaceAlt, borderRadius: 6,
        fontSize: 11, color: C.textMuted, lineHeight: 1.6,
      }}>
        「進場時機」根據當前價 vs 節目當時價的差距判斷。
        <strong style={{ color: C.text }}> 本頁僅供參考，並非投資建議。</strong>
      </div>
    </div>
  );
}
