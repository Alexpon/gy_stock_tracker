// V1 Dense: 資料密度派
const V1_C = {
  bg: '#f7f8fa', surface: '#ffffff', surfaceAlt: '#f1f3f7',
  border: '#e4e7ec', borderStrong: '#d0d5dd',
  text: '#0b1220', textMuted: '#475467', textSubtle: '#98a2b3',
  up: '#067647', upBg: '#ecfdf3', down: '#b42318', downBg: '#fef3f2',
  accent: '#3e4ccf', accentBg: '#eef0ff', warn: '#b54708', warnBg: '#fffaeb',
};

function V1_fmt(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(dp) + '%';
}
function V1_fmtPrice(n) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(2);
}

function V1_Spark({ data, width = 120, height = 32, positive }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, height - ((v - min) / range) * height]).map(p => p.join(',')).join(' ');
  const last = data[data.length - 1];
  const lastY = height - ((last - min) / range) * height;
  const color = positive ? V1_C.up : V1_C.down;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} stroke={color} strokeWidth="1.25" fill="none" />
      <circle cx={width - 1} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

function V1_Pill({ kind }) {
  const s = {
    doing: { bg: V1_C.accentBg, color: V1_C.accent, label: '有在做' },
    watching: { bg: V1_C.warnBg, color: V1_C.warn, label: '觀察中' },
    mention: { bg: V1_C.surfaceAlt, color: V1_C.textMuted, label: '只是提到' },
  }[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 3,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      background: s.bg, color: s.color, fontFamily: 'var(--font-sans)',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

function V1_Delta({ value, strong }) {
  if (value === null || value === undefined) return <span style={{ color: V1_C.textSubtle }}>—</span>;
  const positive = value >= 0;
  return (
    <span style={{
      color: positive ? V1_C.up : V1_C.down, fontWeight: strong ? 600 : 500,
      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
    }}>{V1_fmt(value)}</span>
  );
}

function V1_Header({ market, setMarket, period, setPeriod, route }) {
  return (
    <div style={{
      borderBottom: `1px solid ${V1_C.border}`, background: V1_C.surface,
      padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 24,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: V1_C.text, letterSpacing: '-0.005em' }}>
        {route === 'action' ? '決策 · Action' : '歷史回測 · Analysis'}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'inline-flex', background: V1_C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${V1_C.border}` }}>
        {['us', 'tw'].map(m => (
          <button key={m} onClick={() => setMarket(m)} style={{
            border: 'none', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
            background: market === m ? V1_C.surface : 'transparent',
            color: market === m ? V1_C.text : V1_C.textMuted,
            boxShadow: market === m ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
          }}>{m === 'us' ? '美股 US' : '台股 TW'}</button>
        ))}
      </div>
      {route === 'analysis' && (
        <div style={{ display: 'inline-flex', background: V1_C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${V1_C.border}` }}>
          {[['w1', '1W'], ['w2', '2W'], ['m1', '1M'], ['q1', '1Q']].map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
              background: period === k ? V1_C.surface : 'transparent',
              color: period === k ? V1_C.text : V1_C.textMuted,
              boxShadow: period === k ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
              fontFamily: 'var(--font-mono)',
            }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: V1_C.textSubtle, fontFamily: 'var(--font-mono)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: V1_C.up }} />
        LIVE · 更新於 {(() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
      </div>
    </div>
  );
}

function V1_Sidebar({ route, setRoute }) {
  const items = [
    { k: 'action', label: 'Action', sub: '決策', desc: '最新 4 集 · 該跟哪幾檔' },
    { k: 'analysis', label: 'Analysis', sub: '分析', desc: '歷史回測 · 命中率' },
  ];
  return (
    <div style={{
      width: 220, background: V1_C.surface, borderRight: `1px solid ${V1_C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ padding: '20px 18px 18px', borderBottom: `1px solid ${V1_C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: V1_C.text, color: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>G</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: V1_C.text, letterSpacing: '-0.01em' }}>Gooaye</div>
            <div style={{ fontSize: 10.5, color: V1_C.textSubtle, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>MONITOR</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 10px' }}>
        <div style={{
          fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase',
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
              background: active ? V1_C.text : 'transparent',
              color: active ? '#fff' : V1_C.text,
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
        padding: '14px 18px', borderTop: `1px solid ${V1_C.border}`,
        fontSize: 10.5, color: V1_C.textSubtle, lineHeight: 1.5,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 4 }}>
          v1 · {new Date().toISOString().slice(0, 10)}
        </div>
        <div>合成資料原型 · 非投資建議</div>
      </div>
    </div>
  );
}

function V1_StatCard({ label, value, sub, subKind, mono = true }) {
  return (
    <div style={{ padding: '14px 16px', borderRight: `1px solid ${V1_C.border}`, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 600, color: V1_C.text,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, marginTop: 4,
          color: subKind === 'up' ? V1_C.up : subKind === 'down' ? V1_C.down : V1_C.textMuted,
          fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        }}>{sub}</div>
      )}
    </div>
  );
}

function V1_StatsBar({ stats, market, period }) {
  const benchName = market === 'us' ? 'SPY' : '0050';
  const benchKey = market === 'us' ? 'vs_spy_q1' : 'vs_0050_q1';
  const pLabel = { w1: '1W', w2: '2W', m1: '1M', q1: '1Q' }[period];
  const hitRate = stats[`hit_rate_${period}`] ?? stats.hit_rate_q1;
  const avgRet = stats[`avg_${period}`] ?? stats.avg_q1;
  // sub rows — 除了主期間外的其他三個
  const otherPeriods = ['w1','w2','m1','q1'].filter(p => p !== period);
  const periodLabel = { w1: '1W', w2: '2W', m1: '1M', q1: '1Q' };
  const hitSub = otherPeriods.map(p => `${periodLabel[p]} ${((stats[`hit_rate_${p}`]||0)*100).toFixed(0)}%`).join(' · ');
  const avgSub = otherPeriods.map(p => `${periodLabel[p]} ${V1_fmt(stats[`avg_${p}`]||0)}`).join(' · ');
  return (
    <div style={{
      background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8,
      display: 'flex', marginBottom: 20, overflow: 'hidden',
    }}>
      <V1_StatCard label="總計提及個股" value={stats.total_picks}
        sub={`有在做 ${stats.doing} · 觀察 ${stats.watching} · 提到 ${stats.mention}`} />
      <V1_StatCard label={`命中率 (${pLabel})`} value={`${(hitRate * 100).toFixed(0)}%`}
        sub={hitSub} />
      <V1_StatCard label={`平均報酬 (${pLabel})`} value={V1_fmt(avgRet)}
        sub={avgSub}
        subKind={avgRet >= 0 ? 'up' : 'down'} />
      <V1_StatCard label={`VS ${benchName} (1Q)`} value={V1_fmt(stats[benchKey])}
        sub={stats[benchKey] >= 0 ? '超越大盤' : '落後大盤'}
        subKind={stats[benchKey] >= 0 ? 'up' : 'down'} />
      <V1_StatCard label="表現最佳" value={stats.best_pick.ticker}
        sub={V1_fmt(stats.best_pick.q1)} subKind="up" />
      <V1_StatCard label="表現最差" value={stats.worst_pick.ticker}
        sub={V1_fmt(stats.worst_pick.q1)} subKind="down" />
    </div>
  );
}

function V1_LatestEpisode({ ep, picks, period, market, onSelect }) {
  const filtered = picks.filter(p => p.ep === ep.ep && p.market === market);
  if (filtered.length === 0) return null;
  return (
    <div style={{ background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${V1_C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 10.5, color: V1_C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>LATEST EPISODE</div>
        <div style={{ fontSize: 12, color: V1_C.textSubtle, fontFamily: 'var(--font-mono)' }}>EP {ep.ep} · {ep.date} · {ep.duration}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: V1_C.textSubtle }}>提及 {filtered.length} 檔 / 此市場</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: V1_C.text, marginBottom: 12, letterSpacing: '-0.01em' }}>「{ep.title}」</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.map(p => {
            const val = p[period];
            const positive = val >= 0;
            return (
              <button key={p.ticker} onClick={() => onSelect(p)} style={{
                background: V1_C.surfaceAlt, border: `1px solid ${V1_C.border}`, borderRadius: 6,
                padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-sans)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: V1_C.text, fontFamily: 'var(--font-mono)' }}>{p.ticker}</span>
                    <V1_Pill kind={p.confidence} />
                  </div>
                  <div style={{ fontSize: 11, color: V1_C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                </div>
                <V1_Spark data={p.sparkline} width={64} height={24} positive={positive} />
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: positive ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>{V1_fmt(val)}</div>
                  <div style={{ fontSize: 10, color: V1_C.textSubtle, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{period.toUpperCase()}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function V1_PicksTable({ picks, episodes, period, market, onSelect, selected }) {
  const [sortKey, setSortKey] = React.useState('return');
  const [sortDir, setSortDir] = React.useState('desc');
  const [filter, setFilter] = React.useState('all');

  const filtered = picks.filter(p => p.market === market).filter(p => filter === 'all' ? true : p.confidence === filter);
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortKey === 'return') { av = a[period]; bv = b[period]; }
    else if (sortKey === 'ep') { av = a.ep; bv = b.ep; }
    else if (sortKey === 'confidence') {
      const rank = { doing: 0, watching: 1, mention: 2 };
      av = rank[a.confidence]; bv = rank[b.confidence];
    } else if (sortKey === 'bench') {
      const mul = period === 'q1' ? 1 : period === 'm1' ? 0.35 : period === 'w2' ? 0.15 : 0.08;
      av = a[period] - a.bench_q1 * mul; bv = b[period] - b.bench_q1 * mul;
    }
    return sortDir === 'desc' ? bv - av : av - bv;
  });
  const setSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const Th = ({ k, children, align = 'left', width }) => (
    <th style={{
      textAlign: align, padding: '10px 12px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}`,
      cursor: k ? 'pointer' : 'default', userSelect: 'none', width, whiteSpace: 'nowrap',
    }} onClick={() => k && setSort(k)}>
      {children}
      {k && sortKey === k && <span style={{ marginLeft: 4, color: V1_C.accent }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  );
  return (
    <div style={{ background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${V1_C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: V1_C.text }}>所有個股回測</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[['all', '全部'], ['doing', '有在做'], ['watching', '觀察'], ['mention', '提到']].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '4px 10px', borderRadius: 4,
              border: `1px solid ${filter === k ? V1_C.text : V1_C.border}`,
              background: filter === k ? V1_C.text : 'transparent',
              color: filter === k ? '#fff' : V1_C.textMuted,
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ background: V1_C.surfaceAlt }}>
            <tr>
              <Th>Ticker</Th><Th>Name</Th><Th k="confidence">Signal</Th>
              <Th k="ep" align="center">EP / Date</Th><Th align="center">Entry</Th>
              <Th align="right" width="110">1W</Th><Th align="right" width="110">2W</Th>
              <Th align="right" width="110">1M</Th><Th align="right" width="110">1Q</Th>
              <Th align="center" width="140">Trend</Th><Th k="bench" align="right">vs Bench</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const isSel = selected && selected.ticker === p.ticker && selected.ep === p.ep;
              const val = p[period]; const positive = val >= 0;
              const mul = period === 'q1' ? 1 : period === 'm1' ? 0.35 : period === 'w2' ? 0.15 : 0.08;
              const diff = val - p.bench_q1 * mul;
              const bg = isSel ? V1_C.accentBg : (i % 2 === 0 ? V1_C.surface : '#fbfcfd');
              return (
                <tr key={`${p.ticker}-${p.ep}`} onClick={() => onSelect(p)}
                  style={{ background: bg, cursor: 'pointer', borderBottom: `1px solid ${V1_C.border}` }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: V1_C.text }}>{p.ticker}</td>
                  <td style={{ padding: '10px 12px', color: V1_C.textMuted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={{ padding: '10px 12px' }}><V1_Pill kind={p.confidence} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: V1_C.textMuted, fontSize: 11.5 }}>
                    EP{p.ep} <span style={{ color: V1_C.textSubtle }}>· {p.mention_date.slice(5)}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{V1_fmtPrice(p.entry)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='w1' ? V1_C.accentBg : 'transparent' }}><V1_Delta value={p.w1} strong={period==='w1'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='w2' ? V1_C.accentBg : 'transparent' }}><V1_Delta value={p.w2} strong={period==='w2'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='m1' ? V1_C.accentBg : 'transparent' }}><V1_Delta value={p.m1} strong={period==='m1'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='q1' ? V1_C.accentBg : 'transparent' }}><V1_Delta value={p.q1} strong={period==='q1'} /></td>
                  <td style={{ padding: '4px 12px', textAlign: 'center' }}><V1_Spark data={p.sparkline} width={100} height={26} positive={positive} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}><V1_Delta value={diff} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function V1_DetailPanel({ pick, episodes, onClose }) {
  if (!pick) return null;
  const ep = episodes.find(e => e.ep === pick.ep);
  const benchApprox = { w1: pick.bench_q1*0.08, w2: pick.bench_q1*0.15, m1: pick.bench_q1*0.35, q1: pick.bench_q1 };
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: V1_C.surface,
      borderLeft: `1px solid ${V1_C.border}`, boxShadow: '-8px 0 32px rgba(16,24,40,0.08)',
      overflowY: 'auto', zIndex: 50, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        padding: '18px 24px', borderBottom: `1px solid ${V1_C.border}`,
        position: 'sticky', top: 0, background: V1_C.surface, zIndex: 2,
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: V1_C.text, fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>{pick.ticker}</span>
            <V1_Pill kind={pick.confidence} />
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: V1_C.surfaceAlt, color: V1_C.textMuted, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pick.market.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 13, color: V1_C.textMuted }}>{pick.name}</div>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, color: V1_C.textMuted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: V1_C.surfaceAlt, borderRadius: 6, padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>進場價 · {pick.mention_date}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: V1_C.text, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {pick.market === 'tw' ? 'NT$' : '$'}{V1_fmtPrice(pick.entry)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>當前</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: pick.q1 >= 0 ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>
                {pick.market === 'tw' ? 'NT$' : '$'}{V1_fmtPrice(pick.sparkline[pick.sparkline.length-1])}
              </div>
            </div>
          </div>
          <V1_Spark data={pick.sparkline} width={412} height={72} positive={pick.q1 >= 0} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>回測報酬</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[['1週', 'w1'], ['2週', 'w2'], ['1個月', 'm1'], ['1季', 'q1']].map(([label, k]) => {
              const v = pick[k]; const d = v - benchApprox[k];
              return (
                <div key={k} style={{ border: `1px solid ${V1_C.border}`, borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, color: V1_C.textSubtle, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: v>=0 ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>{V1_fmt(v)}</div>
                  <div style={{ fontSize: 10, color: d>=0 ? V1_C.up : V1_C.down, fontFamily: 'var(--font-mono)', marginTop: 2 }}>vs 大盤 {V1_fmt(d)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: V1_C.warnBg, border: `1px solid #fedf89`, borderRadius: 6, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#fff', color: V1_C.warn, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>EP {pick.ep}</span>
            <span style={{ fontSize: 11, color: V1_C.warn, fontWeight: 600 }}>節目原話</span>
            <div style={{ flex: 1 }} />
            <button style={{ border: 'none', background: 'transparent', color: V1_C.warn, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>▶ 播放片段</button>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#6a4103', fontStyle: 'italic' }}>「{pick.quote}」</div>
          {ep && <div style={{ fontSize: 11, color: V1_C.warn, marginTop: 8, opacity: 0.8 }}>出自 《{ep.title}》 · {ep.date}</div>}
        </div>

        <div style={{ fontSize: 10.5, color: V1_C.textSubtle, lineHeight: 1.5 }}>
          進場價採當集節目發布後首個交易日開盤價；與大盤比較的基準為 {pick.market === 'us' ? 'SPDR S&P 500 ETF (SPY)' : '元大台灣 50 (0050)'}。
        </div>
      </div>
    </div>
  );
}

function V1_EpList({ episodes, picks, market, onPickEp, activeEp }) {
  const otherMarket = market === 'us' ? 'tw' : 'us';
  const otherMarketLabel = market === 'us' ? '台股' : '美股';
  return (
    <div style={{ background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8, padding: '14px 18px 10px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: V1_C.text, marginBottom: 10 }}>最近 10 集時間軸</div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
        {episodes.map(e => {
          const count = picks.filter(p => p.ep === e.ep && p.market === market).length;
          const otherCount = picks.filter(p => p.ep === e.ep && p.market === otherMarket).length;
          const active = activeEp === e.ep;
          const empty = count === 0;
          return (
            <button key={e.ep} onClick={() => !empty && onPickEp(e.ep)} disabled={empty}
              title={empty && otherCount > 0 ? `本集無${market === 'us' ? '美股' : '台股'}個股·切換到${otherMarketLabel}查看` : ''}
              style={{
                flex: '0 0 auto', minWidth: 110, padding: '10px 12px',
                border: `1px solid ${active ? V1_C.text : V1_C.border}`,
                background: active ? V1_C.text : (empty ? V1_C.surfaceAlt : V1_C.surface),
                color: active ? '#fff' : (empty ? V1_C.textSubtle : V1_C.text),
                borderRadius: 6, cursor: empty ? 'not-allowed' : 'pointer', textAlign: 'left',
                opacity: empty ? 0.6 : 1,
              }}>
              <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', opacity: 0.7, fontWeight: 600 }}>EP {e.ep}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{e.date.slice(5)}</div>
              {empty && otherCount > 0 ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, lineHeight: 1.3, opacity: 0.85 }}>僅{otherMarketLabel}</div>
                  <div style={{ fontSize: 10, lineHeight: 1.3, opacity: 0.75, fontFamily: 'var(--font-mono)' }}>{otherCount} 檔</div>
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  {count} <span style={{ fontSize: 10, opacity: 0.7 }}>檔</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 跟單策略回測 ─────────────────────────────────────────
// 策略：每集節目後，於下個交易日開盤等權重買入該集提及的個股
// （可選：只買「有在做」的個股）。持有 1W / 2W / 1M / 1Q 後計算報酬。

const V1_TWEAKS = /*EDITMODE-BEGIN*/{
  "followOnly": "doing",
  "capitalPerEpisode": 10000,
  "entryDelay": 0,
  "showBenchOverlay": true,
  "actionFollow": "all"
}/*EDITMODE-END*/;

function V1_StrategyTable({ episodes, picks, market, period, config }) {
  // 每集的策略報酬 = 該集符合條件個股的等權平均報酬
  const rows = episodes.map(ep => {
    const all = picks.filter(p => p.ep === ep.ep && p.market === market);
    const filtered = config.followOnly === 'all'
      ? all
      : all.filter(p => p.confidence === config.followOnly ||
                        (config.followOnly === 'doing_watching' && (p.confidence === 'doing' || p.confidence === 'watching')));
    if (filtered.length === 0) return null;
    const avg = filtered.reduce((a, p) => a + p[period], 0) / filtered.length;
    const bench = filtered.reduce((a, p) => {
      const mul = period === 'q1' ? 1 : period === 'm1' ? 0.35 : period === 'w2' ? 0.15 : 0.08;
      return a + p.bench_q1 * mul;
    }, 0) / filtered.length;
    return { ep, picks: filtered, avg, bench, alpha: avg - bench };
  }).filter(Boolean);

  // 累積報酬：把每集當作一筆獨立資金，算總和
  const totalCapital = rows.length * config.capitalPerEpisode;
  const totalPnl = rows.reduce((a, r) => a + config.capitalPerEpisode * r.avg / 100, 0);
  const benchPnl = rows.reduce((a, r) => a + config.capitalPerEpisode * r.bench / 100, 0);
  const totalReturn = totalCapital === 0 ? 0 : totalPnl / totalCapital * 100;
  const benchReturn = totalCapital === 0 ? 0 : benchPnl / totalCapital * 100;
  const hits = rows.filter(r => r.avg > 0).length;
  const beats = rows.filter(r => r.alpha > 0).length;

  const periodLabel = { w1: '1週', w2: '2週', m1: '1個月', q1: '1季' }[period];
  const benchName = market === 'us' ? 'SPY' : '0050';
  const ccy = market === 'us' ? '$' : 'NT$';

  return (
    <div style={{ background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* 策略標題 */}
      <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${V1_C.border}`, background: 'linear-gradient(180deg, #fbfcfd, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, color: V1_C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>FOLLOW STRATEGY · 跟單回測</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: V1_C.text, letterSpacing: '-0.01em', marginBottom: 4 }}>
              每集節目下個交易日開盤買入 · 持有 {periodLabel}
            </div>
            <div style={{ fontSize: 12, color: V1_C.textMuted, lineHeight: 1.5 }}>
              策略：只跟 <b>{config.followOnly === 'doing' ? '「有在做」' : config.followOnly === 'doing_watching' ? '「有在做 / 觀察中」' : '全部提及'}</b> 個股、每集等權重投入 {ccy}{config.capitalPerEpisode.toLocaleString()}、持有 {periodLabel} 後賣出。
            </div>
          </div>
          {/* 大數字結果 */}
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${V1_C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '10px 18px', borderRight: `1px solid ${V1_C.border}`, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>跟單平均報酬</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: totalReturn >= 0 ? V1_C.up : V1_C.down, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                {V1_fmt(totalReturn)}
              </div>
              <div style={{ fontSize: 10.5, color: V1_C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {totalPnl >= 0 ? '+' : ''}{ccy}{Math.round(totalPnl).toLocaleString()} / {ccy}{totalCapital.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '10px 18px', borderRight: `1px solid ${V1_C.border}`, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>買大盤 ({benchName})</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: benchReturn >= 0 ? V1_C.up : V1_C.down, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                {V1_fmt(benchReturn)}
              </div>
              <div style={{ fontSize: 10.5, color: V1_C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {benchPnl >= 0 ? '+' : ''}{ccy}{Math.round(benchPnl).toLocaleString()} 對照組
              </div>
            </div>
            <div style={{ padding: '10px 18px', minWidth: 130, background: (totalReturn - benchReturn) >= 0 ? V1_C.upBg : V1_C.downBg }}>
              <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>超額報酬 α</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: (totalReturn - benchReturn) >= 0 ? V1_C.up : V1_C.down, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                {V1_fmt(totalReturn - benchReturn)}
              </div>
              <div style={{ fontSize: 10.5, color: V1_C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {beats}/{rows.length} 集跑贏大盤
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 每集 breakdown */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ background: V1_C.surfaceAlt }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}` }}>集數 / 日期</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}` }}>當集跟單標的</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}`, width: 110, background: period==='w1' ? V1_C.accentBg : 'transparent' }}>1W</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}`, width: 110, background: period==='w2' ? V1_C.accentBg : 'transparent' }}>2W</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}`, width: 110, background: period==='m1' ? V1_C.accentBg : 'transparent' }}>1M</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}`, width: 110, background: period==='q1' ? V1_C.accentBg : 'transparent' }}>1Q</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10.5, color: V1_C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${V1_C.border}`, width: 140 }}>
                {periodLabel} 損益·α
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pnl = config.capitalPerEpisode * r.avg / 100;
              const bpnl = config.capitalPerEpisode * r.bench / 100;
              // per-period averages
              const per = (k) => r.picks.reduce((a, p) => a + p[k], 0) / r.picks.length;
              return (
                <tr key={r.ep.ep} style={{ borderBottom: `1px solid ${V1_C.border}`, background: i % 2 === 0 ? V1_C.surface : '#fbfcfd' }}>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V1_C.text, fontFamily: 'var(--font-mono)' }}>EP {r.ep.ep}</div>
                    <div style={{ fontSize: 11, color: V1_C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{r.ep.date}</div>
                    <div style={{ fontSize: 10.5, color: V1_C.textSubtle, marginTop: 4, maxWidth: 220, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.ep.title}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.picks.map(p => {
                        const v = p[period];
                        return (
                          <span key={p.ticker} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 3, fontSize: 11,
                            background: v >= 0 ? V1_C.upBg : V1_C.downBg,
                            color: v >= 0 ? V1_C.up : V1_C.down,
                            fontFamily: 'var(--font-mono)', fontWeight: 600,
                          }}>
                            {p.ticker} <span style={{ fontSize: 10, opacity: 0.85 }}>{V1_fmt(v)}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: V1_C.textSubtle, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                      {r.picks.length} 檔等權重 · {ccy}{(config.capitalPerEpisode / r.picks.length).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 檔
                    </div>
                  </td>
                  {['w1','w2','m1','q1'].map(k => {
                    const v = per(k);
                    const isActive = period === k;
                    return (
                      <td key={k} style={{ padding: '14px 12px', textAlign: 'right', verticalAlign: 'top', background: isActive ? V1_C.accentBg : 'transparent' }}>
                        <div style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, fontFamily: 'var(--font-mono)', color: v >= 0 ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>
                          {V1_fmt(v)}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: pnl >= 0 ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>
                      {pnl >= 0 ? '+' : ''}{ccy}{Math.round(pnl).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10.5, color: r.alpha >= 0 ? V1_C.up : V1_C.down, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      α {V1_fmt(r.alpha)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: V1_C.text, color: '#fff' }}>
              <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 12.5 }}>
                合計 · {rows.length} 集
              </td>
              <td style={{ padding: '14px 12px', fontSize: 11.5, opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                跟單命中 {hits}/{rows.length} 集 · 打敗大盤 {beats}/{rows.length} 集
              </td>
              <td colSpan={4} style={{ padding: '14px 12px', textAlign: 'right', fontSize: 11, opacity: 0.75 }}>
                總投入 {ccy}{totalCapital.toLocaleString()}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: totalPnl >= 0 ? '#86efac' : '#fca5a5', fontVariantNumeric: 'tabular-nums' }}>
                  {totalPnl >= 0 ? '+' : ''}{ccy}{Math.round(totalPnl).toLocaleString()}
                </div>
                <div style={{ fontSize: 10.5, opacity: 0.8, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  α {V1_fmt(totalReturn - benchReturn)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 免責 */}
      <div style={{ padding: '10px 20px', background: V1_C.surfaceAlt, fontSize: 10.5, color: V1_C.textSubtle, lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
        * 進場假設為節目發布後首個交易日開盤價等權重買入；未計入手續費、稅、滑價。合成示意資料，不構成投資建議。
      </div>
    </div>
  );
}

function V1_TweaksPanel({ config, setConfig, visible }) {
  if (!visible) return null;
  const set = (k, v) => {
    const next = { ...config, [k]: v };
    setConfig(next);
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*'); } catch(e) {}
  };
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, width: 320,
      background: V1_C.surface, border: `1px solid ${V1_C.borderStrong}`,
      borderRadius: 10, boxShadow: '0 12px 40px rgba(16,24,40,0.16)',
      zIndex: 200, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${V1_C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: V1_C.accent, fontWeight: 700, letterSpacing: '0.1em' }}>⚙ TWEAKS</span>
        <span style={{ fontSize: 12, color: V1_C.textMuted }}>策略參數</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: V1_C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Action · 顯示範圍</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[['doing', '只看有在做'], ['all', '+ 觀察中']].map(([k, l]) => (
              <button key={k} onClick={() => set('actionFollow', k)} style={{
                padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${(config.actionFollow||'all') === k ? V1_C.text : V1_C.border}`,
                background: (config.actionFollow||'all') === k ? V1_C.text : 'transparent',
                color: (config.actionFollow||'all') === k ? '#fff' : V1_C.textMuted,
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: V1_C.textSubtle, marginTop: 4, lineHeight: 1.4 }}>
            「只是提到」一律隱藏（它們不是可跟標的）
          </div>
        </div>
        <div style={{ height: 1, background: V1_C.border, margin: '4px -16px 16px' }} />
        <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 10 }}>
          Analysis · 回測參數
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: V1_C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>跟單範圍</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[['doing', '有在做'], ['doing_watching', '+觀察'], ['all', '全部']].map(([k, l]) => (
              <button key={k} onClick={() => set('followOnly', k)} style={{
                padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${config.followOnly === k ? V1_C.text : V1_C.border}`,
                background: config.followOnly === k ? V1_C.text : 'transparent',
                color: config.followOnly === k ? '#fff' : V1_C.textMuted,
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: V1_C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>每集投入資金</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[5000, 10000, 50000, 100000].map(v => (
              <button key={v} onClick={() => set('capitalPerEpisode', v)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${config.capitalPerEpisode === v ? V1_C.text : V1_C.border}`,
                background: config.capitalPerEpisode === v ? V1_C.text : 'transparent',
                color: config.capitalPerEpisode === v ? '#fff' : V1_C.textMuted,
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer',
              }}>{v >= 1000 ? (v/1000) + 'K' : v}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: V1_C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>延遲進場（壓力測試）</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {[0, 1, 3, 7, 14].map(v => (
              <button key={v} onClick={() => set('entryDelay', v)} style={{
                padding: '6px 4px', borderRadius: 4,
                border: `1px solid ${(config.entryDelay||0) === v ? V1_C.text : V1_C.border}`,
                background: (config.entryDelay||0) === v ? V1_C.text : 'transparent',
                color: (config.entryDelay||0) === v ? '#fff' : V1_C.textMuted,
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer',
              }}>{v === 0 ? '即時' : `+${v}d`}</button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: V1_C.textSubtle, marginTop: 6, lineHeight: 1.4 }}>
            模擬聽完節目後隔幾天才進場；測試策略對進場時機的敏感度。
          </div>
        </div>
      </div>
    </div>
  );
}

function V1_App() {
  const [market, setMarket] = React.useState('us');
  const [period, setPeriod] = React.useState('m1');
  const [selected, setSelected] = React.useState(null);
  const [activeEp, setActiveEp] = React.useState(window.GOOAYE_DATA.episodes[0].ep);
  const [tweaksVisible, setTweaksVisible] = React.useState(false);
  const [config, setConfig] = React.useState(V1_TWEAKS);
  const [route, setRoute] = React.useState(() => {
    try { return localStorage.getItem('v1_route') || 'action'; } catch { return 'action'; }
  });
  const { episodes, picks, stats } = window.GOOAYE_DATA;
  const activeEpObj = episodes.find(e => e.ep === activeEp);

  React.useEffect(() => {
    try { localStorage.setItem('v1_route', route); } catch {}
  }, [route]);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweaksVisible(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch(err) {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: V1_C.bg, color: V1_C.text, display: 'flex' }}>
      <V1_Sidebar route={route} setRoute={setRoute} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <V1_Header market={market} setMarket={setMarket} period={period} setPeriod={setPeriod} route={route} />
        {route === 'action' ? (
          <V1A_ActionPage market={market} config={config} />
        ) : (
          <div style={{ padding: '20px 28px 60px', maxWidth: 1760, margin: '0 auto' }}>
            <V1_StatsBar stats={stats[market]} market={market} period={period} />
            <V1_EpList episodes={episodes} picks={picks} market={market} onPickEp={setActiveEp} activeEp={activeEp} />
            <V1_LatestEpisode ep={activeEpObj} picks={picks} period={period} market={market} onSelect={setSelected} />
            <div style={{ marginTop: 20 }}>
              <V1_StrategyTable episodes={episodes} picks={picks} market={market} period={period} config={config} />
            </div>
            <V1_CumulativeChart episodes={episodes} picks={picks} market={market} period={period} config={config} />
            <V1_ConfidenceBreakdown episodes={episodes} picks={picks} market={market} period={period} config={config} />
          </div>
        )}
      </div>
      <V1_DetailPanel pick={selected} episodes={episodes} onClose={() => setSelected(null)} />
      <V1_TweaksPanel config={config} setConfig={setConfig} visible={tweaksVisible} />
    </div>
  );
}

Object.assign(window, { V1_App });
