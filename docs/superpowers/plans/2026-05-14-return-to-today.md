# Return-to-Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed-period returns (1W/2W/1M/1Q) with "return to today" across the entire Analysis page.

**Architecture:** Frontend-only change. A new `returnToday.js` utility computes current price, return %, and holding days from existing `sparkline` + `entry` data. All components in `AnalysisPage.jsx` switch from period-based values to return-to-today. Stats computation moves from backend to frontend. No DB/API changes.

**Tech Stack:** React (Vite), existing Playwright e2e tests

**Spec:** `docs/superpowers/specs/2026-05-14-return-to-today-design.md`

---

### Task 1: Create returnToday.js utility

**Files:**
- Create: `frontend/src/utils/returnToday.js`

- [ ] **Step 1: Create the utility file**

```js
// frontend/src/utils/returnToday.js

export function calcReturnToday(pick) {
  const spark = pick.sparkline;
  if (!spark || spark.length === 0 || !pick.entry) return null;
  const currentPrice = spark[spark.length - 1];
  const returnPct = (currentPrice - pick.entry) / pick.entry * 100;
  const mentionDate = new Date(pick.mention_date);
  const today = new Date();
  const holdingDays = Math.floor((today - mentionDate) / (1000 * 60 * 60 * 24));
  return { currentPrice, returnPct, holdingDays };
}

export function bestBenchReturn(pick) {
  return pick.bench_q1 ?? pick.bench_m1 ?? pick.bench_w2 ?? pick.bench_w1 ?? 0;
}

export function computeStats(picks, market) {
  const marketPicks = picks.filter(p => p.market === market);
  const total = marketPicks.length;
  const doing = marketPicks.filter(p => p.confidence === 'doing').length;
  const watching = marketPicks.filter(p => p.confidence === 'watching').length;
  const mention = marketPicks.filter(p => p.confidence === 'mention').length;

  const withReturn = marketPicks
    .map(p => ({ ...p, _rt: calcReturnToday(p) }))
    .filter(p => p._rt !== null);

  const hitRate = withReturn.length > 0
    ? withReturn.filter(p => p._rt.returnPct > 0).length / withReturn.length
    : 0;
  const avgReturn = withReturn.length > 0
    ? withReturn.reduce((sum, p) => sum + p._rt.returnPct, 0) / withReturn.length
    : 0;
  const avgBench = withReturn.length > 0
    ? withReturn.reduce((sum, p) => sum + bestBenchReturn(p), 0) / withReturn.length
    : 0;

  const benchKey = market === 'us' ? 'vs_spy' : 'vs_0050';

  let bestPick = { ticker: '-', returnPct: 0 };
  let worstPick = { ticker: '-', returnPct: 0 };
  if (withReturn.length > 0) {
    const best = withReturn.reduce((a, b) => a._rt.returnPct > b._rt.returnPct ? a : b);
    const worst = withReturn.reduce((a, b) => a._rt.returnPct < b._rt.returnPct ? a : b);
    bestPick = { ticker: best.ticker, returnPct: best._rt.returnPct };
    worstPick = { ticker: worst.ticker, returnPct: worst._rt.returnPct };
  }

  return {
    total_picks: total, doing, watching, mention,
    hit_rate: Math.round(hitRate * 100) / 100,
    avg_return: Math.round(avgReturn * 10) / 10,
    [benchKey]: Math.round((avgReturn - avgBench) * 10) / 10,
    best_pick: bestPick,
    worst_pick: worstPick,
  };
}
```

- [ ] **Step 2: Verify file was created**

Run: `ls frontend/src/utils/returnToday.js`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/returnToday.js
git commit -m "feat: add returnToday utility for analysis page simplification"
```

---

### Task 2: Strip period plumbing from App, Header, constants

**Files:**
- Modify: `frontend/src/constants.js` (line 20 — remove `PERIOD_DAYS`)
- Modify: `frontend/src/App.jsx` (lines 31, 54-55, 62-63 — remove period state and prop passing)
- Modify: `frontend/src/components/Header.jsx` (lines 3, 19-31 — remove period switcher and props)

- [ ] **Step 1: Remove PERIOD_DAYS from constants.js**

In `frontend/src/constants.js`, delete line 20:

```js
// DELETE this line:
export const PERIOD_DAYS = { w1: 5, w2: 10, m1: 21, q1: 63 };
```

- [ ] **Step 2: Remove period state and props from App.jsx**

In `frontend/src/App.jsx`:

1. Remove the import of `PERIOD_DAYS` from line 2 (if it exists — check first; currently not imported here).
2. Remove `period` state (line 31): delete `const [period, setPeriod] = useState('w1');`
3. Remove period/setPeriod from Header props (line 54-55): change to `<Header market={market} setMarket={setMarket} route={route} />`
4. Remove period prop from AnalysisPage (line 62-63): remove `period={period}` from the JSX

The AnalysisPage line should become:
```jsx
<AnalysisPage data={data} market={market}
  config={DEFAULT_CONFIG} selected={selected} setSelected={setSelected}
  activeEp={activeEp} setActiveEp={setActiveEp} />
```

- [ ] **Step 3: Remove period switcher from Header.jsx**

In `frontend/src/components/Header.jsx`:

1. Remove `period` and `setPeriod` from the function signature (line 3):
```jsx
export function Header({ market, setMarket, route }) {
```

2. Delete the entire period switcher block (lines 19-31 — the `{route === 'analysis' && setPeriod && (` block).

- [ ] **Step 4: Verify build compiles**

Run: `cd /Users/yushao/claude_workspace/gooaye/frontend && npx vite build 2>&1 | tail -5`

Expected: Build will fail because AnalysisPage.jsx still references `period` prop. That's OK — we'll fix it in the next task. Just confirm the Header and App changes are syntactically valid by checking for compilation errors in those specific files.

Alternatively, just confirm the files look correct by reading them.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/constants.js frontend/src/App.jsx frontend/src/components/Header.jsx
git commit -m "refactor: remove period state and switcher from App and Header"
```

---

### Task 3: Rewrite StatsBar + PicksTable in AnalysisPage

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.jsx` (lines 1-264)

- [ ] **Step 1: Update imports and remove old helpers**

At the top of `AnalysisPage.jsx`, replace the imports and analytics helpers (lines 1-31):

```jsx
import { useState } from 'react';
import { C, fmt, fmtPrice } from '../constants.js';
import { Spark } from '../components/shared/Spark.jsx';
import { Pill } from '../components/shared/Pill.jsx';
import { Delta } from '../components/shared/Delta.jsx';
import { StatCard } from '../components/shared/StatCard.jsx';
import { calcReturnToday, bestBenchReturn, computeStats } from '../utils/returnToday.js';

// ─── Analytics helpers ────────────────────────────────────

function filterByConfidence(pool, followOnly) {
  if (followOnly === 'all') return pool;
  if (followOnly === 'doing_watching') return pool.filter(p => p.confidence === 'doing' || p.confidence === 'watching');
  return pool.filter(p => p.confidence === followOnly);
}
```

This removes `computeDelayed`, `benchForPeriod`, and `PERIOD_DAYS` import. Keeps `filterByConfidence` (still used by CumulativeChart and ConfidenceBreakdown).

- [ ] **Step 2: Rewrite StatsBar**

Replace the entire `StatsBar` function (lines 33-67) with:

```jsx
// ─── StatsBar ─────────────────────────────────────────────

function StatsBar({ stats, market }) {
  const benchName = market === 'us' ? 'SPY' : '0050';
  const benchKey = market === 'us' ? 'vs_spy' : 'vs_0050';
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      display: 'flex', marginBottom: 20, overflow: 'hidden',
    }}>
      <StatCard label="總計提及個股" value={stats.total_picks}
        sub={`有在做 ${stats.doing} · 觀察 ${stats.watching} · 提到 ${stats.mention}`} />
      <StatCard label="命中率 (至今)" value={`${(stats.hit_rate * 100).toFixed(0)}%`} />
      <StatCard label="平均報酬 (至今)" value={fmt(stats.avg_return)}
        subKind={stats.avg_return >= 0 ? 'up' : 'down'} />
      <StatCard label={`VS ${benchName} (至今)`} value={fmt(stats[benchKey])}
        sub={stats[benchKey] >= 0 ? '超越大盤' : '落後大盤'}
        subKind={stats[benchKey] >= 0 ? 'up' : 'down'} />
      <StatCard label="表現最佳" value={stats.best_pick.ticker}
        sub={fmt(stats.best_pick.returnPct)} subKind="up" />
      <StatCard label="表現最差" value={stats.worst_pick.ticker}
        sub={fmt(stats.worst_pick.returnPct)} subKind="down" />
    </div>
  );
}
```

Key changes: removes `period` prop, removes sub-row with other periods, uses `stats.avg_return` / `stats.hit_rate` / `stats.best_pick.returnPct` instead of period-indexed values.

- [ ] **Step 3: Rewrite PicksTable**

Replace the entire `PicksTable` function (lines 160-264) with:

```jsx
// ─── PicksTable ───────────────────────────────────────────

function PicksTable({ picks, episodes, market, onSelect, selected }) {
  const [sortKey, setSortKey] = useState('ep');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('all');

  const filtered = picks.filter(p => p.market === market).filter(p => filter === 'all' ? true : p.confidence === filter);
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortKey === 'return') {
      const ra = calcReturnToday(a); const rb = calcReturnToday(b);
      av = ra ? ra.returnPct : -Infinity; bv = rb ? rb.returnPct : -Infinity;
    } else if (sortKey === 'ep') { av = a.ep; bv = b.ep; }
    else if (sortKey === 'confidence') {
      const rank = { doing: 0, watching: 1, mention: 2 };
      av = rank[a.confidence]; bv = rank[b.confidence];
    } else if (sortKey === 'bench') {
      const ra = calcReturnToday(a); const rb = calcReturnToday(b);
      av = (ra ? ra.returnPct : 0) - bestBenchReturn(a);
      bv = (rb ? rb.returnPct : 0) - bestBenchReturn(b);
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
              <Th align="center">現價</Th>
              <Th k="return" align="right" width="140">至今報酬</Th>
              <Th align="center" width="200">Trend</Th><Th k="bench" align="right">vs Bench</Th>
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
              const rt = calcReturnToday(p);
              const val = rt ? rt.returnPct : null;
              const positive = val !== null && val >= 0;
              const diff = (val ?? 0) - bestBenchReturn(p);
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
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {rt ? fmtPrice(rt.currentPrice) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: C.accentBg }}>
                    {rt ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: positive ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>{fmt(rt.returnPct)}</div>
                        <div style={{ fontSize: 10, color: C.textSubtle, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{rt.holdingDays} 天</div>
                      </>
                    ) : <span style={{ color: C.textSubtle }}>—</span>}
                  </td>
                  <td style={{ padding: '4px 12px', textAlign: 'center' }}><Spark data={p.sparkline} width={180} height={28} positive={positive} /></td>
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
```

Key changes: removes `period` prop, 4 return columns → 1 "至今報酬" column + "現價" column, Trend width 100→180, sorting uses `calcReturnToday`.

- [ ] **Step 4: Verify the changes read back correctly**

Read `AnalysisPage.jsx` to confirm the StatsBar and PicksTable changes look correct.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AnalysisPage.jsx
git commit -m "refactor: rewrite StatsBar and PicksTable for return-to-today"
```

---

### Task 4: Rewrite LatestEpisode + StrategyTable

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.jsx` (LatestEpisode ~line 114, StrategyTable ~line 266)

- [ ] **Step 1: Rewrite LatestEpisode**

Replace the entire `LatestEpisode` function with:

```jsx
// ─── LatestEpisode ────────────────────────────────────────

function LatestEpisode({ ep, picks, market, onSelect }) {
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
            const rt = calcReturnToday(p);
            const val = rt ? rt.returnPct : 0;
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
                  {rt ? (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: positive ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>{fmt(val)}</div>
                      <div style={{ fontSize: 10, color: C.textSubtle, fontFamily: 'var(--font-mono)' }}>{rt.holdingDays} 天</div>
                    </>
                  ) : <span style={{ color: C.textSubtle, fontSize: 13 }}>—</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

Key changes: removes `period` prop, uses `calcReturnToday(p)` instead of `p[period]`, shows holding days instead of period label.

- [ ] **Step 2: Rewrite StrategyTable**

Replace the entire `StrategyTable` function with:

```jsx
// ─── StrategyTable ────────────────────────────────────────

function StrategyTable({ episodes, picks, market, config }) {
  const rows = episodes.map(ep => {
    const all = picks.filter(p => p.ep === ep.ep && p.market === market);
    const filtered = config.followOnly === 'all'
      ? all
      : all.filter(p => p.confidence === config.followOnly ||
                        (config.followOnly === 'doing_watching' && (p.confidence === 'doing' || p.confidence === 'watching')));
    if (filtered.length === 0) return null;

    const withRt = filtered.map(p => ({ ...p, _rt: calcReturnToday(p) })).filter(p => p._rt !== null);
    if (withRt.length === 0) return null;

    const avg = withRt.reduce((a, p) => a + p._rt.returnPct, 0) / withRt.length;
    const bench = withRt.reduce((a, p) => a + bestBenchReturn(p), 0) / withRt.length;
    const holdingDays = withRt[0]._rt.holdingDays;
    return { ep, picks: withRt, avg, bench, alpha: avg - bench, holdingDays };
  }).filter(Boolean);

  const totalCapital = rows.length * config.capitalPerEpisode;
  const totalPnl = rows.reduce((a, r) => a + config.capitalPerEpisode * r.avg / 100, 0);
  const benchPnl = rows.reduce((a, r) => a + config.capitalPerEpisode * r.bench / 100, 0);
  const totalReturn = totalCapital === 0 ? 0 : totalPnl / totalCapital * 100;
  const benchReturn = totalCapital === 0 ? 0 : benchPnl / totalCapital * 100;
  const hits = rows.filter(r => r.avg > 0).length;
  const beats = rows.filter(r => r.alpha > 0).length;

  const benchName = market === 'us' ? 'SPY' : '0050';
  const ccy = market === 'us' ? '$' : 'NT$';

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(180deg, #fbfcfd, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>FOLLOW STRATEGY · 跟單回測</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em', marginBottom: 4 }}>
              每集節目下個交易日開盤買入 · 持有至今
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              策略：只跟 <b>{config.followOnly === 'doing' ? '「有在做」' : config.followOnly === 'doing_watching' ? '「有在做 / 觀察中」' : '全部提及'}</b> 個股、每集等權重投入 {ccy}{config.capitalPerEpisode.toLocaleString()}、持有至今。
            </div>
          </div>
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

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ background: C.surfaceAlt }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>集數 / 日期</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>當集跟單標的</th>
              <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 80 }}>持有天數</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, background: C.accentBg, width: 120 }}>至今報酬</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10.5, color: C.textMuted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, width: 140 }}>
                損益·α
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pnl = config.capitalPerEpisode * r.avg / 100;
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
                        const v = p._rt.returnPct;
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
                  <td style={{ padding: '14px 12px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'var(--font-mono)', color: C.textMuted }}>
                    {r.holdingDays} 天
                  </td>
                  <td style={{ padding: '14px 12px', textAlign: 'right', verticalAlign: 'top', background: C.accentBg }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.avg >= 0 ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(r.avg)}
                    </div>
                  </td>
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
              <td style={{ padding: '14px 12px' }} />
              <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 11, opacity: 0.75 }}>
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

      <div style={{ padding: '10px 20px', background: C.surfaceAlt, fontSize: 10.5, color: C.textSubtle, lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
        * 進場假設為節目發布後首個交易日開盤價等權重買入；未計入手續費、稅、滑價。合成示意資料，不構成投資建議。
      </div>
    </div>
  );
}
```

Key changes: removes `period` prop, 4 period columns → 1 "至今報酬" + 1 "持有天數" column, uses `calcReturnToday` per pick, strategy description says "持有至今".

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AnalysisPage.jsx
git commit -m "refactor: rewrite LatestEpisode and StrategyTable for return-to-today"
```

---

### Task 5: Rewrite CumulativeChart + ConfidenceBreakdown

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.jsx` (CumulativeChart ~line 451, ConfidenceBreakdown ~line 619)

- [ ] **Step 1: Rewrite CumulativeChart**

Replace the entire `CumulativeChart` function with:

```jsx
// ─── CumulativeChart (SVG P&L) ────────────────────────────

function CumulativeChart({ episodes, picks, market, config }) {
  const sorted = [...episodes].sort((a, b) => a.ep - b.ep);
  const ccy = market === 'us' ? '$' : 'NT$';
  const cap = config.capitalPerEpisode;

  let cumStrat = 0, cumBench = 0;
  const points = sorted.map(ep => {
    const pool = picks.filter(p => p.ep === ep.ep && p.market === market);
    const filt = filterByConfidence(pool, config.followOnly);
    const withRt = filt.map(p => ({ ...p, _rt: calcReturnToday(p) })).filter(p => p._rt !== null);
    if (withRt.length === 0) {
      return { ep: ep.ep, date: ep.date, cumStrat, cumBench, epPnl: 0, epBench: 0, hasData: false };
    }
    const avg = withRt.reduce((a, p) => a + p._rt.returnPct, 0) / withRt.length;
    const bench = withRt.reduce((a, p) => a + bestBenchReturn(p), 0) / withRt.length;
    const epPnl = cap * avg / 100;
    const epBench = cap * bench / 100;
    cumStrat += epPnl;
    cumBench += epBench;
    return { ep: ep.ep, date: ep.date, cumStrat, cumBench, epPnl, epBench, hasData: true, avg, bench };
  });

  const valid = points.filter(p => p.hasData);
  if (valid.length === 0) return null;

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
  const stratArea = `${padL},${zeroY} ${stratLine} ${xScale(valid.length - 1)},${zeroY}`;
  const yTicks = [yLo, yLo + (yHi - yLo) * 0.25, yLo + (yHi - yLo) * 0.5, yLo + (yHi - yLo) * 0.75, yHi];

  const finalStrat = valid[valid.length - 1].cumStrat;
  const finalBench = valid[valid.length - 1].cumBench;
  const totalCap = valid.length * cap;
  const stratPct = finalStrat / totalCap * 100;
  const benchPct = finalBench / totalCap * 100;

  let peak = 0, maxDD = 0;
  valid.forEach(p => {
    if (p.cumStrat > peak) peak = p.cumStrat;
    const dd = p.cumStrat - peak;
    if (dd < maxDD) maxDD = dd;
  });

  const benchName = market === 'us' ? 'SPY' : '0050';

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>CUMULATIVE P&L · 累積損益曲線</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            每集投入 {ccy}{cap.toLocaleString()} · 持有至今
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
          <polygon points={stratArea} fill={finalStrat >= 0 ? C.up : C.down} fillOpacity="0.08" />
          <polyline points={benchLine} fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeDasharray="4 3" />
          <polyline points={stratLine} fill="none" stroke={finalStrat >= 0 ? C.up : C.down} strokeWidth="2" />
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
```

Key changes: removes `period` prop, uses `calcReturnToday` + `bestBenchReturn` instead of `computeDelayed` + `benchForPeriod`, label says "持有至今", removed `config.entryDelay` from display label (entry delay is about entry timing not holding period — the config still works internally).

- [ ] **Step 2: Rewrite ConfidenceBreakdown**

Replace the entire `ConfidenceBreakdown` function with:

```jsx
// ─── ConfidenceBreakdown ──────────────────────────────────

function ConfidenceBreakdown({ episodes, picks, market, config }) {
  const tiers = [
    { key: 'doing', label: '有在做', desc: '實際有持股 / 加倉的個股', color: C.accent, bg: C.accentBg },
    { key: 'watching', label: '觀察中', desc: '放在雷達上、未進場的個股', color: C.warn, bg: C.warnBg },
    { key: 'mention', label: '只是提到', desc: '順便講一下、沒有立場的個股', color: C.textMuted, bg: C.surfaceAlt },
  ];
  const ccy = market === 'us' ? '$' : 'NT$';
  const cap = config.capitalPerEpisode;

  const rows = tiers.map(t => {
    const picksInTier = picks.filter(p => p.market === market && p.confidence === t.key);
    if (picksInTier.length === 0) return { ...t, count: 0 };

    const epMap = new Map();
    picksInTier.forEach(p => {
      if (!epMap.has(p.ep)) epMap.set(p.ep, []);
      epMap.get(p.ep).push(p);
    });
    const epRows = [...epMap.entries()].map(([ep, list]) => {
      const withRt = list.map(p => ({ ...p, _rt: calcReturnToday(p) })).filter(p => p._rt !== null);
      if (withRt.length === 0) return null;
      const avg = withRt.reduce((a, p) => a + p._rt.returnPct, 0) / withRt.length;
      const bench = withRt.reduce((a, p) => a + bestBenchReturn(p), 0) / withRt.length;
      return { ep, avg, bench };
    }).filter(Boolean);

    if (epRows.length === 0) return { ...t, count: picksInTier.length, epCount: 0, avgRet: 0, avgBench: 0, alpha: 0, hits: 0, beats: 0, cumPnl: 0, totalCap: 0 };

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

  const maxAbs = Math.max(...rows.map(r => Math.abs(r.avgRet || 0)), 1);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10.5, color: C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
          CONFIDENCE TIERS · 信心度拆分
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>哪一層的跟單效果最好？</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
          不管右下角 Tweaks 的「跟單範圍」設定，這裡固定比較三個層級的獨立績效（至今報酬）。
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

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.avgRet >= 0 ? C.up : C.down, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {fmt(r.avgRet)}
                </span>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'var(--font-mono)' }}>平均每集</span>
              </div>

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
        * 每集投入 {ccy}{cap.toLocaleString()} · 持有至今
      </div>
    </div>
  );
}
```

Key changes: removes `period` prop, uses `calcReturnToday` + `bestBenchReturn`, footer says "持有至今".

- [ ] **Step 3: Update AnalysisPage wrapper**

Replace the exported `AnalysisPage` function (the last function in the file) with:

```jsx
// ─── AnalysisPage (exported wrapper) ──────────────────────

export function AnalysisPage({ data, market, config, selected, setSelected, activeEp, setActiveEp }) {
  const allPicks = data.picks || [];
  const episodes = data.episodes || [];
  const stats = computeStats(allPicks, market);
  const activeEpObj = episodes.find(e => e.ep === activeEp);

  return (
    <div style={{ padding: '20px 28px 60px', maxWidth: 1760, margin: '0 auto' }}>
      <StatsBar stats={stats} market={market} />
      <EpList episodes={episodes} picks={allPicks} market={market} onPickEp={setActiveEp} activeEp={activeEp} />
      {activeEpObj && (
        <LatestEpisode ep={activeEpObj} picks={allPicks} market={market} onSelect={setSelected} />
      )}
      <PicksTable picks={allPicks} episodes={episodes} market={market} onSelect={setSelected} selected={selected} />
      <div style={{ marginTop: 20 }}>
        <StrategyTable episodes={episodes} picks={allPicks} market={market} config={config} />
      </div>
      <CumulativeChart episodes={episodes} picks={allPicks} market={market} config={config} />
      <ConfidenceBreakdown episodes={episodes} picks={allPicks} market={market} config={config} />
    </div>
  );
}
```

Key changes: removes `period` prop from signature and all child component calls, uses `computeStats(allPicks, market)` instead of `data.stats[market]`.

- [ ] **Step 4: Build and verify**

Run: `cd /Users/yushao/claude_workspace/gooaye/frontend && npx vite build 2>&1 | tail -10`

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AnalysisPage.jsx
git commit -m "refactor: rewrite CumulativeChart, ConfidenceBreakdown, and AnalysisPage wrapper for return-to-today"
```

---

### Task 6: Update e2e and journey tests

**Files:**
- Modify: `tests/e2e/test_analysis_page.py`
- Modify: `tests/e2e/test_navigation.py`
- Modify: `tests/journeys/test_j1_analysis.py`

The existing tests check for period-specific values (1W/2W/1M/1Q columns, specific period return values, period selector buttons). These all need updating.

- [ ] **Step 1: Update test_navigation.py**

Replace `test_period_selector_on_analysis` (lines 58-62) with a test that verifies the period selector is **gone**:

```python
def test_period_selector_removed_from_analysis(self):
    self.page.get_by_role("button", name=re.compile("Analysis")).click()
    self.page.wait_for_timeout(300)
    for period in ["1W", "2W", "1M", "1Q"]:
        assert self.page.get_by_role("button", name=period).count() == 0
```

- [ ] **Step 2: Update test_analysis_page.py**

Replace the entire file with:

```python
"""E2E tests for the Analysis page — verifies stats, picks table, and strategy table."""
import re

import pytest


def _go_analysis(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    return home


class TestAnalysisUS:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_analysis(home)
        self.page.get_by_role("button", name="美股 US").click()
        self.page.wait_for_timeout(300)

    def test_header(self):
        assert self.page.locator("text=歷史回測 · Analysis").is_visible()

    def test_stats_total_picks(self):
        assert self.page.locator("text=總計提及個股").is_visible()
        card = self.page.locator("div", has_text=re.compile("^總計提及個股$")).locator("..")
        assert card.locator("div", has_text=re.compile("^6$")).is_visible()

    def test_stats_sub_counts(self):
        assert self.page.locator("text=觀察 1 · 提到 5").is_visible()

    def test_stats_labels_show_return_to_today(self):
        assert self.page.locator("text=命中率 (至今)").is_visible()
        assert self.page.locator("text=平均報酬 (至今)").is_visible()

    def test_no_period_sub_rows(self):
        assert self.page.locator("text=2W -4.00%").count() == 0
        assert self.page.locator("text=1M -13.40%").count() == 0

    def test_timeline_episodes(self):
        assert self.page.locator("text=EP 654").first.is_visible()
        assert self.page.locator("text=EP 630").first.is_visible()

    def test_timeline_pick_counts(self):
        assert self.page.locator("text=4 檔").first.is_visible()
        assert self.page.locator("text=2 檔").first.is_visible()

    def test_table_has_all_us_tickers(self):
        table = self.page.locator("table").first
        for ticker in ["NVDA", "META", "AMZN", "AAPL", "ASTS", "PSTG"]:
            assert table.locator(f"td:text-is('{ticker}')").first.is_visible()

    def test_table_has_current_price_column(self):
        table = self.page.locator("table").first
        assert table.locator("th", has_text="現價").is_visible()

    def test_table_has_return_to_today_column(self):
        table = self.page.locator("table").first
        assert table.locator("th", has_text="至今報酬").is_visible()

    def test_table_no_period_columns(self):
        table = self.page.locator("table").first
        for period in ["1W", "2W", "1M", "1Q"]:
            assert table.locator(f"th:text-is('{period}')").count() == 0

    def test_table_entry_prices(self):
        table = self.page.locator("table").first
        assert table.locator("text=199.98").is_visible()
        assert table.locator("text=681.36").is_visible()
        assert table.locator("text=249.19").is_visible()
        assert table.locator("text=270.33").is_visible()
        assert table.locator("text=112.55").is_visible()
        assert table.locator("text=69.89").is_visible()

    def test_table_shows_holding_days(self):
        table = self.page.locator("table").first
        assert table.locator("text=/\\d+ 天/").first.is_visible()

    def test_confidence_labels(self):
        table = self.page.locator("table").first
        assert table.locator("text=觀察中").is_visible()
        assert table.locator("text=只是提到").first.is_visible()


class TestAnalysisTW:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_analysis(home)
        self.page.get_by_role("button", name="台股 TW").click()
        self.page.wait_for_timeout(300)

    def test_stats_total_picks(self):
        card = self.page.locator("div", has_text=re.compile("^總計提及個股$")).locator("..")
        assert card.locator("div", has_text=re.compile("^9$")).is_visible()

    def test_stats_sub_counts(self):
        assert self.page.locator("text=有在做 3 · 觀察 1 · 提到 5").is_visible()

    def test_stats_labels_show_return_to_today(self):
        assert self.page.locator("text=命中率 (至今)").is_visible()
        assert self.page.locator("text=平均報酬 (至今)").is_visible()

    def test_timeline_pick_counts(self):
        assert self.page.locator("text=5 檔").first.is_visible()
        assert self.page.locator("text=4 檔").first.is_visible()

    def test_table_has_all_tw_tickers(self):
        table = self.page.locator("table").first
        for ticker in ["2330", "0050", "2317", "2327", "6415", "2454", "2337"]:
            assert table.locator(f"td:text-is('{ticker}')").first.is_visible()

    def test_table_entry_prices(self):
        table = self.page.locator("table").first
        assert table.locator("text=2,030").is_visible()
        assert table.locator("text=84.55").is_visible()
        assert table.locator("text=206.00").is_visible()
        assert table.locator("text=320.00").is_visible()
        assert table.locator("text=361.00").is_visible()

    def test_confidence_tiers_section(self):
        assert self.page.locator("text=CONFIDENCE TIERS").is_visible()
        assert self.page.locator("text=有在做").first.is_visible()
        assert self.page.locator("text=觀察中").first.is_visible()
        assert self.page.locator("text=只是提到").first.is_visible()

    def test_strategy_table_exists(self):
        assert self.page.locator("text=FOLLOW STRATEGY").is_visible()
        strategy_table = self.page.locator("table").nth(1)
        assert strategy_table.locator("text=EP 654").is_visible()
        assert strategy_table.locator("text=EP 630").is_visible()

    def test_strategy_table_shows_holding_days(self):
        strategy_table = self.page.locator("table").nth(1)
        assert strategy_table.locator("text=持有天數").is_visible()
        assert strategy_table.locator("text=/\\d+ 天/").first.is_visible()

    def test_strategy_description_says_hold_to_today(self):
        assert self.page.locator("text=持有至今").first.is_visible()

    def test_cumulative_chart_exists(self):
        assert self.page.locator("text=CUMULATIVE P&L").is_visible()
```

- [ ] **Step 3: Update test_j1_analysis.py**

Replace the entire file with:

```python
"""Journey 1: Analysis 歷史回測 — 完整 US→TW 資料驗證 (return-to-today version)

Scenario: 使用者打開 Analysis 頁面，從美股切到台股，逐一確認：
  1. 統計卡數字是否正確（總數、命中率至今、平均報酬至今）
  2. 時間軸集數與檔數
  3. 個股回測表格：ticker、名稱、信心度、entry、現價、至今報酬
  4. 跟單策略表格（持有至今版）
  5. 信心度拆分區塊
  6. 累積損益圖表區塊
"""
import re
from playwright.sync_api import expect


def test_analysis_full_journey(app):
    page = app

    # ── Step 1: Navigate to Analysis ──
    page.get_by_role("button", name=re.compile("Analysis")).click()
    page.wait_for_load_state("networkidle")
    expect(page.locator("text=歷史回測 · Analysis")).to_be_visible()

    # ── Step 2: Verify no period selector ──
    for period in ["1W", "2W", "1M", "1Q"]:
        assert page.get_by_role("button", name=period).count() == 0

    # ── Step 3: US market view ──
    page.get_by_role("button", name="美股 US").click()
    page.wait_for_timeout(500)

    # 3a. Stats bar — 6 US picks total
    expect(page.locator("div:has(> div:text-is('總計提及個股'))").locator(
        "div", has_text=re.compile("^6$"))).to_be_visible()
    expect(page.locator("text=觀察 1 · 提到 5")).to_be_visible()

    # 3b. Stats labels use "至今" not period names
    expect(page.locator("text=命中率 (至今)")).to_be_visible()
    expect(page.locator("text=平均報酬 (至今)")).to_be_visible()

    # 3c. Timeline — EP654 has 4 US picks, EP630 has 2
    ep654_btn = page.locator("button", has_text="EP 654")
    expect(ep654_btn.locator("text=4 檔")).to_be_visible()
    ep630_btn = page.locator("button", has_text="EP 630")
    expect(ep630_btn.locator("text=2 檔")).to_be_visible()

    # 3d. Picks table — all 6 US tickers present
    table = page.locator("table").first
    for ticker in ["NVDA", "META", "AMZN", "AAPL", "ASTS", "PSTG"]:
        expect(table.locator(f"td:text-is('{ticker}')").first).to_be_visible()

    # 3e. Table has 現價 and 至今報酬 columns, no period columns
    expect(table.locator("th", has_text="現價")).to_be_visible()
    expect(table.locator("th", has_text="至今報酬")).to_be_visible()
    for period in ["1W", "2W", "1M", "1Q"]:
        assert table.locator(f"th:text-is('{period}')").count() == 0

    # 3f. Table shows holding days
    expect(table.locator("text=/\\d+ 天/").first).to_be_visible()

    # 3g. Entry prices
    expect(table.locator("text=199.98")).to_be_visible()   # NVDA
    expect(table.locator("text=681.36")).to_be_visible()   # META
    expect(table.locator("text=249.19")).to_be_visible()   # AMZN
    expect(table.locator("text=270.33")).to_be_visible()   # AAPL
    expect(table.locator("text=112.55")).to_be_visible()   # ASTS
    expect(table.locator("text=69.89")).to_be_visible()    # PSTG

    # 3h. Confidence labels
    expect(table.locator("text=觀察中")).to_be_visible()
    expect(table.locator("text=只是提到").first).to_be_visible()

    # ── Step 4: Switch to TW market ──
    page.get_by_role("button", name="台股 TW").click()
    page.wait_for_timeout(500)

    # 4a. Stats bar — 9 TW picks total
    expect(page.locator("div:has(> div:text-is('總計提及個股'))").locator(
        "div", has_text=re.compile("^9$"))).to_be_visible()
    expect(page.locator("text=有在做 3 · 觀察 1 · 提到 5")).to_be_visible()

    # 4b. All 9 TW tickers in table
    table = page.locator("table").first
    for ticker in ["2330", "0050", "2317", "2327", "6415", "2454", "2337"]:
        expect(table.locator(f"td:text-is('{ticker}')").first).to_be_visible()

    # 4c. TW entry prices
    expect(table.locator("text=2,030")).to_be_visible()    # 2330
    expect(table.locator("text=84.55")).to_be_visible()    # 0050
    expect(table.locator("text=206.00")).to_be_visible()   # 2317
    expect(table.locator("text=320.00")).to_be_visible()   # 2327
    expect(table.locator("text=361.00")).to_be_visible()   # 6415

    # ── Step 5: Strategy table ──
    expect(page.locator("text=FOLLOW STRATEGY")).to_be_visible()
    expect(page.locator("text=持有至今").first).to_be_visible()
    strategy_table = page.locator("table").nth(1)
    expect(strategy_table.locator("text=EP 654")).to_be_visible()
    expect(strategy_table.locator("text=EP 630")).to_be_visible()
    expect(strategy_table.locator("text=持有天數")).to_be_visible()

    # ── Step 6: Confidence tiers ──
    expect(page.locator("text=CONFIDENCE TIERS")).to_be_visible()
    expect(page.locator("text=有在做").first).to_be_visible()
    expect(page.locator("text=觀察中").first).to_be_visible()
    expect(page.locator("text=只是提到").first).to_be_visible()

    # ── Step 7: Cumulative P&L chart ──
    expect(page.locator("text=CUMULATIVE P&L")).to_be_visible()
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/test_analysis_page.py tests/e2e/test_navigation.py tests/journeys/test_j1_analysis.py
git commit -m "test: update e2e and journey tests for return-to-today changes"
```

---

### Task 7: Build, start dev server, and verify in browser

**Files:** None (verification only)

- [ ] **Step 1: Build frontend**

Run: `cd /Users/yushao/claude_workspace/gooaye/frontend && npx vite build 2>&1 | tail -10`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server**

Start the backend API server and frontend dev server:

```bash
# Terminal 1: backend
cd /Users/yushao/claude_workspace/gooaye && uvicorn backend.server:app --port 8000 &

# Terminal 2: frontend (proxies API to backend)
cd /Users/yushao/claude_workspace/gooaye/frontend && npx vite --port 5173 &
```

Wait for both to be ready. Frontend at `http://localhost:5173`.

- [ ] **Step 3: Open Analysis page in browser (US market)**

Using Playwright MCP tools:
1. Navigate to the app URL (likely `http://localhost:5173` or `http://localhost:8000`)
2. Click "Analysis" in sidebar
3. Click "美股 US"
4. Take a screenshot
5. Verify:
   - No 1W/2W/1M/1Q period buttons in header
   - StatsBar shows "命中率 (至今)" and "平均報酬 (至今)"
   - PicksTable has "現價" and "至今報酬" columns
   - PicksTable shows holding days (e.g., "13 天")
   - No period columns (1W/2W/1M/1Q) in the table
   - Sparkline trend is wider than before

- [ ] **Step 4: Verify Analysis page (TW market)**

1. Click "台股 TW"
2. Take a screenshot
3. Verify same structural changes as US

- [ ] **Step 5: Scroll down and verify remaining sections**

1. Scroll to StrategyTable
2. Verify: header says "持有至今", table has "持有天數" column, no period columns
3. Scroll to CumulativeChart
4. Verify: title says "持有至今"
5. Scroll to ConfidenceBreakdown
6. Verify: renders correctly with return-to-today values

- [ ] **Step 6: Verify Action and Episodes pages unaffected**

1. Click "Action" in sidebar — verify page loads normally
2. Click "Episodes" in sidebar — verify page loads normally

- [ ] **Step 7: Run e2e tests**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/e2e/ tests/journeys/test_j1_analysis.py -v 2>&1 | tail -30`

Expected: All tests pass.

- [ ] **Step 8: Commit final state (if any fixes were needed)**

Only if browser verification revealed issues that needed fixing.
