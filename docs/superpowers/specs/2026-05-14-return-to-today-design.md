# Analysis Page: Replace Fixed Periods with Return-to-Today

**Date:** 2026-05-14
**Status:** Draft

## Problem

The analysis page displays returns across four fixed periods (1W/2W/1M/1Q = 5/10/21/63 trading days). For recently published episodes, most period columns show "—" because not enough trading days have passed. This makes the page feel empty and confusing. Users primarily care about "how much has this pick made since it was mentioned?"

## Decision Summary

| Question | Decision |
|----------|----------|
| Scope | Full removal of fixed period concept across all components |
| StrategyTable | Keep, change to return-to-today with holding days per episode |
| PicksTable layout | Wider version: add "Current Price" column + larger Trend sparkline |
| Data source | Frontend computes from existing sparkline + entry fields (no DB/API changes) |
| Stats computation | Move from backend to frontend for consistency |

## Core Calculation

All "return to today" values are derived on the frontend from existing data:

```js
function calcReturnToday(pick) {
  const spark = pick.sparkline;
  if (!spark || spark.length === 0 || !pick.entry) return null;
  const currentPrice = spark[spark.length - 1];
  const returnPct = (currentPrice - pick.entry) / pick.entry * 100;
  const mentionDate = new Date(pick.mention_date);
  const today = new Date();
  const holdingDays = Math.floor((today - mentionDate) / (1000 * 60 * 60 * 24));
  return { currentPrice, returnPct, holdingDays };
}
```

Data freshness depends on the daily backfill schedule (already configured in `server.py`'s `_daily_backfill`). The sparkline's last point is the most recent close from the last backfill run.

## Component Changes

### 1. Header (Header.jsx)

**Remove** the 1W/2W/1M/1Q period switcher entirely. The `period` and `setPeriod` props are no longer needed.

**Before:** `[1W] [2W] [1M] [1Q]  [美股 US] [台股 TW]`
**After:** `[美股 US] [台股 TW]`

### 2. App.jsx

Remove `period` state and all `period`/`setPeriod` prop passing. Remove `PERIOD_DAYS` import if unused.

### 3. constants.js

Remove `PERIOD_DAYS` export. Keep `fmt`, `fmtPrice`, `C` unchanged.

### 4. StatsBar

**Move stats computation from backend (`generate.py:compute_stats`) to frontend.**

New stats shape (computed in `AnalysisPage` or a helper):

```js
{
  total_picks, doing, watching, mention,
  hit_rate,       // % of picks with return_today > 0
  avg_return,     // average return_today across all picks
  vs_bench,       // avg_return - avg_bench_return
  best_pick,      // { ticker, return: max return_today }
  worst_pick,     // { ticker, return: min return_today }
}
```

**StatsBar cards:**
- 總計提及個股 — unchanged
- 命中率 — label changes from "命中率 (1W)" → "命中率 (至今)"，remove sub row showing other periods
- 平均報酬 — label changes from "平均報酬 (1W)" → "平均報酬 (至今)"，remove sub row
- VS SPY/0050 — label changes from "(1Q)" → "(至今)"
- 表現最佳/最差 — use return_today instead of q1

### 5. PicksTable

**Column changes:**

| Before | After |
|--------|-------|
| Ticker | Ticker |
| Name | Name |
| Signal | Signal |
| EP / Date | EP / Date |
| Entry | Entry |
| 1W | *(removed)* |
| 2W | *(removed)* |
| 1M | *(removed)* |
| 1Q | *(removed)* |
| — | **現價** (new) |
| — | **至今報酬** (new, with holding days subtitle) |
| Trend | Trend (wider: 180px from 100px) |
| vs Bench | vs Bench |

**至今報酬 column rendering:**
- Main: `+12.3%` (large, bold, green/red)
- Sub: `13 天` (small, muted)

**現價 column:** Display `sparkline[last]` formatted with `fmtPrice`.

**Sorting:** `sortKey === 'return'` uses `calcReturnToday(pick).returnPct` instead of `pick[period]`. Bench diff also uses return-to-today values.

**Bench calculation for "vs Bench":** Use the same sparkline approach — we still have `bench_w1..bench_q1` in the data. For "vs bench to today," we need a bench return to today. Options:
- Use the longest available bench period as approximation
- Compute from bench sparkline if available

Since we don't have bench sparklines, use `bench_q1` if available, else `bench_m1`, else `bench_w2`, else `bench_w1` — the longest available period as the best approximation of bench return to today. This is slightly imprecise but acceptable since the bench return over the same period is highly correlated.

### 6. LatestEpisode

Card display changes from showing `period` value to showing `calcReturnToday` value. Remove the period label badge (currently shows "W1" / "M1" etc). Replace with holding days.

### 7. StrategyTable

**Header description:**
- Before: "每集節目下個交易日開盤買入 · 持有 1週"
- After: "每集節目下個交易日開盤買入 · 持有至今"

**Summary boxes:** Same structure, values use return-to-today averages.

**Per-episode rows:**
- Remove 1W/2W/1M/1Q columns
- Add single "至今報酬" column
- Add "持有天數" column
- Per-pick badges show return-to-today values
- 損益·α column uses return-to-today

**Period label references** (e.g., `periodLabel` variable) replaced with "至今".

### 8. CumulativeChart

Each episode's contribution changes from `computeDelayed(pick, period, delay)` to `calcReturnToday(pick).returnPct`. The chart conceptually becomes "cumulative P&L if you bought every episode's picks and still hold all of them."

Labels:
- Before: "每集投入 $10,000 · 持有 1週 · 即時進場"
- After: "每集投入 $10,000 · 持有至今"

Remove delay-related logic (`config.entryDelay` references in this chart can stay since it's about entry timing, not exit).

### 9. ConfidenceBreakdown

Same structural change as StrategyTable — use return-to-today for all per-tier calculations. The bar chart, stats grid, and cumulative PnL within each tier all switch to return-to-today.

### 10. Backend (generate.py)

**Simplify** `compute_stats` — the frontend will compute its own stats from return-to-today, so the backend stats become secondary. Two options:
- Keep `compute_stats` as-is (still uses fixed periods) — harmless, frontend just ignores `data.stats`
- Remove the `stats` field from the API response

Recommendation: **keep `compute_stats` unchanged** for now. The frontend ignores `data.stats` and computes its own. This avoids breaking anything and minimizes backend changes.

The `format_picks` function stays unchanged — it still sends `w1/w2/m1/q1` and `sparkline` data. The frontend simply ignores the period fields and uses sparkline instead.

## What Does NOT Change

- **DB schema** — `w1, w2, m1, q1, bench_w1..bench_q1` columns stay (historical data preserved)
- **prices.py** — still fetches prices, computes sparklines, and backfills period returns
- **API endpoints** — `/api/data`, `/api/episodes`, `/api/process/{ep}` unchanged structurally
- **EpisodesPage** — not affected
- **ActionPage** — not affected (already uses sparkline directly, never references `period`)
- **Sidebar** — no period-related config; unchanged

## Migration Notes

- No DB migration needed
- Frontend-only deployment
- Backend change is optional (removing stats computation)
- Old period data stays in DB and API response, just unused by frontend

## Testing

- Verify all picks show a return value (no "—" unless entry price is null)
- Verify holding days are correct (today - mention_date)
- Verify current price matches sparkline's last point
- Verify StatsBar hit_rate and avg_return are computed correctly from return-to-today
- Verify StrategyTable cumulative P&L sums correctly
- Verify CumulativeChart renders with return-to-today values
- Verify ConfidenceBreakdown tiers compute independently
- Verify sorting in PicksTable works on return-to-today values
- Verify bench diff uses best available bench period
- Edge case: pick with no sparkline data (entry null) shows "—"
- Edge case: pick from today (0 holding days) shows correct values
