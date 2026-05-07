import { useState } from 'react';
import { C, fmt, fmtPrice, PERIOD_DAYS } from '../constants.js';
import { Spark } from '../components/shared/Spark.jsx';
import { Pill } from '../components/shared/Pill.jsx';
import { Delta } from '../components/shared/Delta.jsx';
import { StatCard } from '../components/shared/StatCard.jsx';

// ─── Analytics helpers ────────────────────────────────────

function computeDelayed(pick, period, delayDays) {
  const spark = pick.sparkline;
  if (!spark || spark.length === 0) return pick[period] ?? 0;
  const entryIdx = Math.min(delayDays, spark.length - 1);
  const exitIdx = Math.min(entryIdx + PERIOD_DAYS[period], spark.length - 1);
  const entry = spark[entryIdx], exit = spark[exitIdx];
  if (!entry || entry === 0) return pick[period] ?? 0;
  return (exit - entry) / entry * 100;
}

function benchForPeriod(pick, period) {
  const key = `bench_${period}`;
  const val = pick[key];
  if (val !== null && val !== undefined) return val;
  return 0;
}

function filterByConfidence(pool, followOnly) {
  if (followOnly === 'all') return pool;
  if (followOnly === 'doing_watching') return pool.filter(p => p.confidence === 'doing' || p.confidence === 'watching');
  return pool.filter(p => p.confidence === followOnly);
}

// ─── StatsBar ─────────────────────────────────────────────

function StatsBar({ stats, market, period }) {
  const benchName = market === 'us' ? 'SPY' : '0050';
  const benchKey = market === 'us' ? 'vs_spy_q1' : 'vs_0050_q1';
  const pLabel = { w1: '1W', w2: '2W', m1: '1M', q1: '1Q' }[period];
  const hitRate = stats[`hit_rate_${period}`] ?? stats.hit_rate_q1;
  const avgRet = stats[`avg_${period}`] ?? stats.avg_q1;
  // sub rows — 除了主期間外的其他三個
  const otherPeriods = ['w1','w2','m1','q1'].filter(p => p !== period);
  const periodLabel = { w1: '1W', w2: '2W', m1: '1M', q1: '1Q' };
  const hitSub = otherPeriods.map(p => `${periodLabel[p]} ${((stats[`hit_rate_${p}`]||0)*100).toFixed(0)}%`).join(' · ');
  const avgSub = otherPeriods.map(p => `${periodLabel[p]} ${fmt(stats[`avg_${p}`]||0)}`).join(' · ');
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      display: 'flex', marginBottom: 20, overflow: 'hidden',
    }}>
      <StatCard label="總計提及個股" value={stats.total_picks}
        sub={`有在做 ${stats.doing} · 觀察 ${stats.watching} · 提到 ${stats.mention}`} />
      <StatCard label={`命中率 (${pLabel})`} value={`${(hitRate * 100).toFixed(0)}%`}
        sub={hitSub} />
      <StatCard label={`平均報酬 (${pLabel})`} value={fmt(avgRet)}
        sub={avgSub}
        subKind={avgRet >= 0 ? 'up' : 'down'} />
      <StatCard label={`VS ${benchName} (1Q)`} value={fmt(stats[benchKey])}
        sub={stats[benchKey] >= 0 ? '超越大盤' : '落後大盤'}
        subKind={stats[benchKey] >= 0 ? 'up' : 'down'} />
      <StatCard label="表現最佳" value={stats.best_pick.ticker}
        sub={fmt(stats.best_pick.q1)} subKind="up" />
      <StatCard label="表現最差" value={stats.worst_pick.ticker}
        sub={fmt(stats.worst_pick.q1)} subKind="down" />
    </div>
  );
}

// ─── EpList ───────────────────────────────────────────────

function EpList({ episodes, picks, market, onPickEp, activeEp }) {
  const otherMarket = market === 'us' ? 'tw' : 'us';
  const otherMarketLabel = market === 'us' ? '台股' : '美股';
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px 10px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>最近 10 集時間軸</div>
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
                border: `1px solid ${active ? C.text : C.border}`,
                background: active ? C.text : (empty ? C.surfaceAlt : C.surface),
                color: active ? '#fff' : (empty ? C.textSubtle : C.text),
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

// ─── LatestEpisode ────────────────────────────────────────

function LatestEpisode({ ep, picks, period, market, onSelect }) {
  const filtered = picks.filter(p => p.ep === ep.ep && p.market === market);
  if (filtered.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>LATEST EPISODE</div>
        <div style={{ fontSize: 12, color: C.textSubtle, fontFamily: 'var(--font-mono)' }}>EP {ep.ep} · {ep.date} · {ep.duration}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: C.textSubtle }}>提及 {filtered.length} 檔 / 此市場</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 12, letterSpacing: '-0.01em' }}>「{ep.title}」</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {filtered.map(p => {
            const val = p[period] ?? 0;
            const positive = val >= 0;
            return (
              <button key={p.ticker} onClick={() => onSelect(p)} style={{
                background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-sans)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'var(--font-mono)' }}>{p.ticker}</span>
                    <Pill kind={p.confidence} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                </div>
                <Spark data={p.sparkline} width={64} height={24} positive={positive} />
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: positive ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>{fmt(val)}</div>
                  <div style={{ fontSize: 10, color: C.textSubtle, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{period.toUpperCase()}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── PicksTable ───────────────────────────────────────────

function PicksTable({ picks, episodes, period, market, onSelect, selected }) {
  const [sortKey, setSortKey] = useState('ep');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('all');

  const filtered = picks.filter(p => p.market === market).filter(p => filter === 'all' ? true : p.confidence === filter);
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortKey === 'return') { av = a[period] ?? 0; bv = b[period] ?? 0; }
    else if (sortKey === 'ep') { av = a.ep; bv = b.ep; }
    else if (sortKey === 'confidence') {
      const rank = { doing: 0, watching: 1, mention: 2 };
      av = rank[a.confidence]; bv = rank[b.confidence];
    } else if (sortKey === 'bench') {
      av = (a[period] ?? 0) - (a[`bench_${period}`] || 0); bv = (b[period] ?? 0) - (b[`bench_${period}`] || 0);
    }
    return sortDir === 'desc' ? bv - av : av - bv;
  });
  const setSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };
  const Th = ({ k, children, align = 'left', width }) => (
    <th style={{
      textAlign: align, padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
      cursor: k ? 'pointer' : 'default', userSelect: 'none', width, whiteSpace: 'nowrap',
    }} onClick={() => k && setSort(k)}>
      {children}
      {k && sortKey === k && <span style={{ marginLeft: 4, color: C.accent }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  );
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>所有個股回測</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[['all', '全部'], ['doing', '有在做'], ['watching', '觀察'], ['mention', '提到']].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '4px 10px', borderRadius: 4,
              border: `1px solid ${filter === k ? C.text : C.border}`,
              background: filter === k ? C.text : 'transparent',
              color: filter === k ? '#fff' : C.textMuted,
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ background: C.surfaceAlt }}>
            <tr>
              <Th>Ticker</Th><Th>Name</Th><Th k="confidence">Signal</Th>
              <Th k="ep" align="center">EP / Date</Th><Th align="center">Entry</Th>
              <Th align="right" width="110">1W</Th><Th align="right" width="110">2W</Th>
              <Th align="right" width="110">1M</Th><Th align="right" width="110">1Q</Th>
              <Th align="center" width="140">Trend</Th><Th k="bench" align="right">vs Bench</Th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const epColors = ['#f0f4ff', '#fef3f0', '#f0faf4', '#fdf8ef', '#f3f0fe', '#eff8fb'];
              const epOrder = [...new Set(sorted.map(p => p.ep))];
              const epColorMap = Object.fromEntries(epOrder.map((ep, i) => [ep, epColors[i % epColors.length]]));
              const epBorderColors = ['#93b4f8', '#f0a090', '#6dc99a', '#e0b860', '#a893f0', '#70c0d8'];
              const epBorderMap = Object.fromEntries(epOrder.map((ep, i) => [ep, epBorderColors[i % epBorderColors.length]]));
              return sorted.map((p, i) => {
              const isSel = selected && selected.ticker === p.ticker && selected.ep === p.ep;
              const val = p[period] ?? 0; const positive = val >= 0;
              const diff = val - (p[`bench_${period}`] || 0);
              const bg = isSel ? C.accentBg : epColorMap[p.ep];
              const isFirstOfEp = i === 0 || sorted[i - 1].ep !== p.ep;
              return (
                <tr key={`${p.ticker}-${p.ep}`} onClick={() => onSelect(p)}
                  style={{ background: bg, cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
                    borderTop: isFirstOfEp && i > 0 ? `2px solid ${epBorderMap[p.ep]}` : undefined,
                  }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: C.text,
                    borderLeft: `3px solid ${epBorderMap[p.ep]}`,
                  }}>{p.ticker}</td>
                  <td style={{ padding: '10px 12px', color: C.textMuted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={{ padding: '10px 12px' }}><Pill kind={p.confidence} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: C.textMuted, fontSize: 11.5 }}>
                    EP{p.ep} <span style={{ color: C.textSubtle }}>· {p.mention_date.slice(5)}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p.entry)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='w1' ? C.accentBg : 'transparent' }}><Delta value={p.w1} strong={period==='w1'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='w2' ? C.accentBg : 'transparent' }}><Delta value={p.w2} strong={period==='w2'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='m1' ? C.accentBg : 'transparent' }}><Delta value={p.m1} strong={period==='m1'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='q1' ? C.accentBg : 'transparent' }}><Delta value={p.q1} strong={period==='q1'} /></td>
                  <td style={{ padding: '4px 12px', textAlign: 'center' }}><Spark data={p.sparkline} width={100} height={26} positive={positive} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}><Delta value={diff} /></td>
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── StrategyTable ────────────────────────────────────────

function StrategyTable({ episodes, picks, market, period, config }) {
  // 每集的策略報酬 = 該集符合條件個股的等權平均報酬
  const rows = episodes.map(ep => {
    const all = picks.filter(p => p.ep === ep.ep && p.market === market);
    const filtered = config.followOnly === 'all'
      ? all
      : all.filter(p => p.confidence === config.followOnly ||
                        (config.followOnly === 'doing_watching' && (p.confidence === 'doing' || p.confidence === 'watching')));
    if (filtered.length === 0) return null;
    const avg = filtered.reduce((a, p) => a + (p[period] ?? 0), 0) / filtered.length;
    const bench = filtered.reduce((a, p) => a + (p[`bench_${period}`] || 0), 0) / filtered.length;
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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* 策略標題 */}
      <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(180deg, #fbfcfd, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>FOLLOW STRATEGY · 跟單回測</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em', marginBottom: 4 }}>
              每集節目下個交易日開盤買入 · 持有 {periodLabel}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              策略：只跟 <b>{config.followOnly === 'doing' ? '「有在做」' : config.followOnly === 'doing_watching' ? '「有在做 / 觀察中」' : '全部提及'}</b> 個股、每集等權重投入 {ccy}{config.capitalPerEpisode.toLocaleString()}、持有 {periodLabel} 後賣出。
            </div>
          </div>
          {/* 大數字結果 */}
          <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '10px 18px', borderRight: `1px solid ${C.border}`, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>跟單平均報酬</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: totalReturn >= 0 ? C.up : C.down, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                {fmt(totalReturn)}
              </div>
              <div style={{ fontSize: 10.5, color: C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {totalPnl >= 0 ? '+' : ''}{ccy}{Math.round(totalPnl).toLocaleString()} / {ccy}{totalCapital.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '10px 18px', borderRight: `1px solid ${C.border}`, minWidth: 130 }}>
              <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>買大盤 ({benchName})</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: benchReturn >= 0 ? C.up : C.down, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                {fmt(benchReturn)}
              </div>
              <div style={{ fontSize: 10.5, color: C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {benchPnl >= 0 ? '+' : ''}{ccy}{Math.round(benchPnl).toLocaleString()} 對照組
              </div>
            </div>
            <div style={{ padding: '10px 18px', minWidth: 130, background: (totalReturn - benchReturn) >= 0 ? C.upBg : C.downBg }}>
              <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>超額報酬 α</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: (totalReturn - benchReturn) >= 0 ? C.up : C.down, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                {fmt(totalReturn - benchReturn)}
              </div>
              <div style={{ fontSize: 10.5, color: C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {beats}/{rows.length} 集跑贏大盤
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 每集 breakdown */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ background: C.surfaceAlt }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>集數 / 日期</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>當集跟單標的</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 110, background: period==='w1' ? C.accentBg : 'transparent' }}>1W</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 110, background: period==='w2' ? C.accentBg : 'transparent' }}>2W</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 110, background: period==='m1' ? C.accentBg : 'transparent' }}>1M</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 110, background: period==='q1' ? C.accentBg : 'transparent' }}>1Q</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 140 }}>
                {periodLabel} 損益·α
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pnl = config.capitalPerEpisode * r.avg / 100;
              const bpnl = config.capitalPerEpisode * r.bench / 100;
              // per-period averages
              const per = (k) => r.picks.reduce((a, p) => a + (p[k] ?? 0), 0) / r.picks.length;
              return (
                <tr key={r.ep.ep} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : '#fbfcfd' }}>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: 'var(--font-mono)' }}>EP {r.ep.ep}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{r.ep.date}</div>
                    <div style={{ fontSize: 10.5, color: C.textSubtle, marginTop: 4, maxWidth: 220, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.ep.title}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.picks.map(p => {
                        const v = p[period] ?? 0;
                        return (
                          <span key={p.ticker} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 3, fontSize: 11,
                            background: v >= 0 ? C.upBg : C.downBg,
                            color: v >= 0 ? C.up : C.down,
                            fontFamily: 'var(--font-mono)', fontWeight: 600,
                          }}>
                            {p.ticker} <span style={{ fontSize: 10, opacity: 0.85 }}>{fmt(v)}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: C.textSubtle, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                      {r.picks.length} 檔等權重 · {ccy}{(config.capitalPerEpisode / r.picks.length).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 檔
                    </div>
                  </td>
                  {['w1','w2','m1','q1'].map(k => {
                    const v = per(k);
                    const isActive = period === k;
                    return (
                      <td key={k} style={{ padding: '14px 12px', textAlign: 'right', verticalAlign: 'top', background: isActive ? C.accentBg : 'transparent' }}>
                        <div style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, fontFamily: 'var(--font-mono)', color: v >= 0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(v)}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: pnl >= 0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>
                      {pnl >= 0 ? '+' : ''}{ccy}{Math.round(pnl).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10.5, color: r.alpha >= 0 ? C.up : C.down, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      α {fmt(r.alpha)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: C.text, color: '#fff' }}>
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
                  α {fmt(totalReturn - benchReturn)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 免責 */}
      <div style={{ padding: '10px 20px', background: C.surfaceAlt, fontSize: 10.5, color: C.textSubtle, lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
        * 進場假設為節目發布後首個交易日開盤價等權重買入；未計入手續費、稅、滑價。合成示意資料，不構成投資建議。
      </div>
    </div>
  );
}

// ─── CumulativeChart (SVG P&L) ────────────────────────────

function CumulativeChart({ episodes, picks, market, period, config }) {
  // 以每集為時間點，畫累積 P&L ($ 或 NT$)
  const sorted = [...episodes].sort((a, b) => a.ep - b.ep); // 舊 → 新
  const ccy = market === 'us' ? '$' : 'NT$';
  const cap = config.capitalPerEpisode;
  const delay = config.entryDelay || 0;

  // 建三條線：跟單策略 / 大盤 / 差額
  let cumStrat = 0, cumBench = 0;
  const points = sorted.map(ep => {
    const pool = picks.filter(p => p.ep === ep.ep && p.market === market);
    const filt = filterByConfidence(pool, config.followOnly);
    if (filt.length === 0) {
      return { ep: ep.ep, date: ep.date, cumStrat, cumBench, epPnl: 0, epBench: 0, hasData: false };
    }
    const avg = filt.reduce((a, p) => a + computeDelayed(p, period, delay), 0) / filt.length;
    const bench = filt.reduce((a, p) => a + benchForPeriod(p, period), 0) / filt.length;
    const epPnl = cap * avg / 100;
    const epBench = cap * bench / 100;
    cumStrat += epPnl;
    cumBench += epBench;
    return { ep: ep.ep, date: ep.date, cumStrat, cumBench, epPnl, epBench, hasData: true, avg, bench };
  });

  const valid = points.filter(p => p.hasData);
  if (valid.length === 0) return null;

  // chart dims
  const W = 1100, H = 260, padL = 56, padR = 20, padT = 20, padB = 36;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allVals = valid.flatMap(p => [p.cumStrat, p.cumBench, 0]);
  const yMin = Math.min(...allVals), yMax = Math.max(...allVals);
  const yRange = (yMax - yMin) || 1;
  const yPad = yRange * 0.1;
  const yLo = yMin - yPad, yHi = yMax + yPad;
  const yScale = v => padT + innerH - ((v - yLo) / (yHi - yLo)) * innerH;
  const xScale = i => padL + (i / Math.max(valid.length - 1, 1)) * innerW;

  const stratLine = valid.map((p, i) => `${xScale(i)},${yScale(p.cumStrat)}`).join(' ');
  const benchLine = valid.map((p, i) => `${xScale(i)},${yScale(p.cumBench)}`).join(' ');
  const zeroY = yScale(0);

  // area under strat
  const stratArea = `${padL},${zeroY} ${stratLine} ${xScale(valid.length - 1)},${zeroY}`;

  // y ticks
  const yTicks = [yLo, yLo + (yHi - yLo) * 0.25, yLo + (yHi - yLo) * 0.5, yLo + (yHi - yLo) * 0.75, yHi];

  const finalStrat = valid[valid.length - 1].cumStrat;
  const finalBench = valid[valid.length - 1].cumBench;
  const totalCap = valid.length * cap;
  const stratPct = finalStrat / totalCap * 100;
  const benchPct = finalBench / totalCap * 100;

  // max drawdown on strat
  let peak = 0, maxDD = 0;
  valid.forEach(p => {
    if (p.cumStrat > peak) peak = p.cumStrat;
    const dd = p.cumStrat - peak;
    if (dd < maxDD) maxDD = dd;
  });

  const periodLabel = { w1: '1週', w2: '2週', m1: '1個月', q1: '1季' }[period];
  const benchName = market === 'us' ? 'SPY' : '0050';
  const delayLabel = delay === 0 ? '即時' : `延遲 ${delay} 天`;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>CUMULATIVE P&L · 累積損益曲線</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            每集投入 {ccy}{cap.toLocaleString()} · 持有 {periodLabel} · {delayLabel}進場
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
            時間軸由左（最舊集）至右（最新集）· 面積＝累積損益（實線＝跟單、虛線＝同金額買 {benchName}）
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, fontFamily: 'var(--font-mono)' }}>
          <div>
            <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>最終累積</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: finalStrat >= 0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>
              {finalStrat >= 0 ? '+' : ''}{ccy}{Math.round(finalStrat).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{fmt(stratPct)} / {ccy}{totalCap.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>vs 買 {benchName}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (finalStrat - finalBench) >= 0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>
              {(finalStrat - finalBench) >= 0 ? '+' : ''}{ccy}{Math.round(finalStrat - finalBench).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>α {fmt(stratPct - benchPct)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>最大回撤</div>
            {maxDD < -0.5 ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.down, fontVariantNumeric: 'tabular-nums' }}>
                  {ccy}{Math.round(maxDD).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>由高點最深跌幅</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>—</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>期內無回檔</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 8px 4px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: 320 }}>
          {/* y grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={yScale(t)} y2={yScale(t)}
                stroke={t === 0 ? C.borderStrong : C.border} strokeWidth={t === 0 ? 1.2 : 1}
                strokeDasharray={t === 0 ? '' : '2 3'} />
              <text x={padL - 8} y={yScale(t) + 3} textAnchor="end" fontSize="10"
                fontFamily="var(--font-mono)" fill={C.textSubtle}>
                {t >= 0 ? '+' : ''}{ccy}{Math.round(t).toLocaleString()}
              </text>
            </g>
          ))}

          {/* area */}
          <polygon points={stratArea} fill={finalStrat >= 0 ? C.up : C.down} fillOpacity="0.08" />

          {/* bench line (dashed) */}
          <polyline points={benchLine} fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeDasharray="4 3" />

          {/* strat line */}
          <polyline points={stratLine} fill="none" stroke={finalStrat >= 0 ? C.up : C.down} strokeWidth="2" />

          {/* dots + ep labels */}
          {valid.map((p, i) => (
            <g key={p.ep}>
              <circle cx={xScale(i)} cy={yScale(p.cumStrat)} r="3.5" fill={C.surface}
                stroke={finalStrat >= 0 ? C.up : C.down} strokeWidth="1.5" />
              <text x={xScale(i)} y={H - padB + 14} textAnchor="middle" fontSize="9.5"
                fontFamily="var(--font-mono)" fill={C.textSubtle}>
                EP{p.ep}
              </text>
              <text x={xScale(i)} y={H - padB + 25} textAnchor="middle" fontSize="9"
                fontFamily="var(--font-mono)" fill={C.textSubtle}>
                {p.date.slice(5)}
              </text>
            </g>
          ))}

          {/* legend */}
          <g transform={`translate(${padL + 8}, ${padT + 8})`}>
            <rect width="180" height="42" fill={C.surface} fillOpacity="0.95" stroke={C.border} rx="3" />
            <line x1="10" y1="14" x2="28" y2="14" stroke={finalStrat >= 0 ? C.up : C.down} strokeWidth="2" />
            <text x="34" y="17" fontSize="11" fontFamily="var(--font-sans)" fill={C.text} fontWeight="500">跟單策略</text>
            <line x1="10" y1="32" x2="28" y2="32" stroke={C.textMuted} strokeWidth="1.5" strokeDasharray="4 3" />
            <text x="34" y="35" fontSize="11" fontFamily="var(--font-sans)" fill={C.text} fontWeight="500">買 {benchName} 對照組</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─── ConfidenceBreakdown ──────────────────────────────────

function ConfidenceBreakdown({ episodes, picks, market, period, config }) {
  const tiers = [
    { key: 'doing', label: '有在做', desc: '實際有持股 / 加倉的個股', color: C.accent, bg: C.accentBg },
    { key: 'watching', label: '觀察中', desc: '放在雷達上、未進場的個股', color: C.warn, bg: C.warnBg },
    { key: 'mention', label: '只是提到', desc: '順便講一下、沒有立場的個股', color: C.textMuted, bg: C.surfaceAlt },
  ];
  const ccy = market === 'us' ? '$' : 'NT$';
  const cap = config.capitalPerEpisode;
  const delay = config.entryDelay || 0;

  const rows = tiers.map(t => {
    const picksInTier = picks.filter(p => p.market === market && p.confidence === t.key);
    if (picksInTier.length === 0) return { ...t, count: 0 };
    // 每集的平均（此信心度）
    const epMap = new Map();
    picksInTier.forEach(p => {
      if (!epMap.has(p.ep)) epMap.set(p.ep, []);
      epMap.get(p.ep).push(p);
    });
    const epRows = [...epMap.entries()].map(([ep, list]) => {
      const avg = list.reduce((a, p) => a + computeDelayed(p, period, delay), 0) / list.length;
      const bench = list.reduce((a, p) => a + benchForPeriod(p, period), 0) / list.length;
      return { ep, avg, bench };
    });
    const avgRet = epRows.reduce((a, r) => a + r.avg, 0) / epRows.length;
    const avgBench = epRows.reduce((a, r) => a + r.bench, 0) / epRows.length;
    const alpha = avgRet - avgBench;
    const hits = epRows.filter(r => r.avg > 0).length;
    const beats = epRows.filter(r => r.avg > r.bench).length;
    const cumPnl = epRows.reduce((a, r) => a + cap * r.avg / 100, 0);
    return {
      ...t, count: picksInTier.length, epCount: epRows.length,
      avgRet, avgBench, alpha, hits, beats, cumPnl,
      totalCap: epRows.length * cap,
    };
  });

  // max for bar scale
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.avgRet || 0)), 1);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
          CONFIDENCE TIERS · 信心度拆分
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>哪一層的跟單效果最好？</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
          不管右下角 Tweaks 的「跟單範圍」設定，這裡固定比較三個層級的獨立績效。
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {rows.map((r, i) => {
          if (r.count === 0) {
            return (
              <div key={r.key} style={{ padding: '20px 22px', borderRight: i < 2 ? `1px solid ${C.border}` : 'none', color: C.textSubtle, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{r.label}</span> · 本市場無此分類資料
              </div>
            );
          }
          const barPctRet = (r.avgRet / maxAbs) * 100;
          const barPctBench = (r.avgBench / maxAbs) * 100;
          return (
            <div key={r.key} style={{ padding: '18px 22px 22px', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.label}</span>
                <span style={{ fontSize: 11, color: C.textSubtle, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {r.count} 檔 · {r.epCount} 集
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14, lineHeight: 1.4 }}>{r.desc}</div>

              {/* big number */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.avgRet >= 0 ? C.up : C.down, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {fmt(r.avgRet)}
                </span>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'var(--font-mono)' }}>平均每集</span>
              </div>

              {/* strat vs bench bar */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)', marginBottom: 4, color: C.textMuted }}>
                  <span style={{ width: 56 }}>跟單</span>
                  <div style={{ flex: 1, height: 8, background: C.surfaceAlt, position: 'relative', borderRadius: 2 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: C.borderStrong }} />
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: barPctRet >= 0 ? '50%' : `${50 + barPctRet / 2}%`,
                      width: `${Math.abs(barPctRet) / 2}%`,
                      background: r.avgRet >= 0 ? C.up : C.down, borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ width: 52, textAlign: 'right', color: r.avgRet >= 0 ? C.up : C.down, fontWeight: 600 }}>{fmt(r.avgRet)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: C.textMuted }}>
                  <span style={{ width: 56 }}>大盤</span>
                  <div style={{ flex: 1, height: 8, background: C.surfaceAlt, position: 'relative', borderRadius: 2 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: C.borderStrong }} />
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: barPctBench >= 0 ? '50%' : `${50 + barPctBench / 2}%`,
                      width: `${Math.abs(barPctBench) / 2}%`,
                      background: C.textMuted, borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ width: 52, textAlign: 'right', color: C.textMuted }}>{fmt(r.avgBench)}</span>
                </div>
              </div>

              {/* stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>超額 α</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.alpha >= 0 ? C.up : C.down }}>
                    {fmt(r.alpha)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>命中 · 打敗</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.text }}>
                    {r.hits}/{r.epCount} · {r.beats}/{r.epCount}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>累積損益</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.cumPnl >= 0 ? C.up : C.down }}>
                    {r.cumPnl >= 0 ? '+' : ''}{ccy}{Math.round(r.cumPnl).toLocaleString()}
                    <span style={{ fontSize: 10.5, color: C.textSubtle, fontWeight: 500, marginLeft: 6 }}>
                      / {ccy}{r.totalCap.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 20px', background: C.surfaceAlt, fontSize: 10.5, color: C.textSubtle, fontFamily: 'var(--font-mono)' }}>
        * 每集投入 {ccy}{cap.toLocaleString()} · {delay === 0 ? '即時進場' : `延遲 ${delay} 天進場`} · 持有 {{ w1: '1週', w2: '2週', m1: '1個月', q1: '1季' }[period]}
      </div>
    </div>
  );
}

// ─── AnalysisPage (exported wrapper) ──────────────────────

export function AnalysisPage({ data, market, period, config, selected, setSelected, activeEp, setActiveEp }) {
  const stats = data.stats[market] || {};
  const allPicks = data.picks || [];
  const episodes = data.episodes || [];
  const activeEpObj = episodes.find(e => e.ep === activeEp);

  return (
    <div style={{ padding: '20px 28px 60px', maxWidth: 1760, margin: '0 auto' }}>
      <StatsBar stats={stats} market={market} period={period} />
      <EpList episodes={episodes} picks={allPicks} market={market} onPickEp={setActiveEp} activeEp={activeEp} />
      {activeEpObj && (
        <LatestEpisode ep={activeEpObj} picks={allPicks} period={period} market={market} onSelect={setSelected} />
      )}
      <PicksTable picks={allPicks} episodes={episodes} period={period} market={market} onSelect={setSelected} selected={selected} />
      <div style={{ marginTop: 20 }}>
        <StrategyTable episodes={episodes} picks={allPicks} market={market} period={period} config={config} />
      </div>
      <CumulativeChart episodes={episodes} picks={allPicks} market={market} period={period} config={config} />
      <ConfidenceBreakdown episodes={episodes} picks={allPicks} market={market} period={period} config={config} />
    </div>
  );
}
