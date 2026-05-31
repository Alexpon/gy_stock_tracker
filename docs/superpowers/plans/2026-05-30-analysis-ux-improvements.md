# Analysis UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the orphaned DetailPanel, make Action the consistent landing page, clarify the hit-rate metric with its sample size, and add colorblind-friendly direction symbols to the Analysis return table.

**Architecture:** Pure frontend changes to a React + Vite SPA served by FastAPI. State (`selected`, `route`) already lives in `App.jsx`; we wire the existing-but-unmounted `DetailPanel` into that tree, remove route persistence, extend the frontend `computeStats` helper, and add symbols in two render sites. No backend or data-pipeline changes.

**Tech Stack:** React 18, Vite 6, plain inline-style components. Tests are pytest + Playwright e2e (Python) that run against a seeded FastAPI server serving `frontend/dist`.

---

## Test Environment & Conventions

- **Test runner:** `/opt/miniconda3/bin/python -m pytest` (this interpreter has `playwright`, `pytest-playwright`, `pytest-base-url`; the default `python3` does NOT).
- **Frontend must be rebuilt before every e2e run** — the test server serves the static bundle from `frontend/dist`, not the dev server. Always run `cd frontend && npm run build && cd ..` after editing any `.jsx`/`.js` and before running pytest.
- **Sandbox:** the e2e fixture starts `uvicorn` bound to `127.0.0.1` on a free port. If a sandboxed Bash call fails to bind the socket, re-run the pytest command with `dangerouslyDisableSandbox: true`.
- **Existing test conventions** (mirror these): tests live in `tests/e2e/`, use the session-scoped seeded `home` fixture from `tests/e2e/conftest.py` (it navigates to the app and clears `localStorage`), navigate via `home.get_by_role("button", name=re.compile("Analysis"))`, switch market via `home.get_by_role("button", name="美股 US")` / `"台股 TW"`, and locate cells via `table.locator("td:text-is('NVDA')")`.
- **Seed data facts used by these tests** (`tests/e2e/conftest.py::_seed_db`):
  - US picks with return data: NVDA `[199.98,202]` (+), META `[681,672]` (−), AMZN `[249,252]` (+), AAPL `[273,267.12]` (−), ASTS `[112,86]` (−), PSTG `[69.89,68]` (−). → 6 picks with returns, 2 positive.
  - TW pick `2330` (台積電), EP654, confidence `doing`, has `quote="台積電在接下來的蓋的狀態是給的非常好啦"`, entry `2030.0`, sparkline `[2030,2050]`.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `frontend/src/App.jsx` | Modify | Mount `DetailPanel` when `selected` is set; clear `selected` on route/market change; remove `route` localStorage persistence so the app always starts on Action. |
| `frontend/src/utils/returnToday.js` | Modify | `computeStats` also returns `hit_count` and `hit_total` (the positive-return numerator and the with-return denominator). |
| `frontend/src/pages/AnalysisPage.jsx` | Modify | `StatsBar` shows the hit-rate sample size; the 至今報酬 cell gets a ▲/▼ prefix. |
| `frontend/src/components/shared/Delta.jsx` | Modify | Prefix ▲/▼ to the rendered delta (used only by the vs Bench column). |
| `frontend/src/components/DetailPanel.jsx` | None (already correct) | Existing overlay panel — only needs mounting. |
| `tests/e2e/test_detail_panel.py` | Create | Verify clicking a pick row opens the panel and × closes it. |
| `tests/e2e/test_default_route.py` | Create | Verify the app lands on Action and does not persist the last route across reload. |
| `tests/e2e/test_hit_rate_sample.py` | Create | Verify the hit-rate card shows the positive-return sample size. |
| `tests/e2e/test_colorblind_arrows.py` | Create | Verify the return table contains ▲ and ▼ symbols. |

---

## Task 1: Mount the DetailPanel

`DetailPanel.jsx` is fully implemented but never rendered, so clicking a row in the Analysis table only highlights it. We render it in `App.jsx` when `selected` is set, and clear `selected` when the user changes route or market so a stale panel never lingers.

**Files:**
- Modify: `frontend/src/App.jsx`
- Test: `tests/e2e/test_detail_panel.py`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/test_detail_panel.py`:

```python
"""E2E tests for the DetailPanel — clicking a pick row opens the detail overlay."""
import re

import pytest


def _go_analysis_tw(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    home.get_by_role("button", name="台股 TW").click()
    home.wait_for_timeout(300)
    return home


class TestDetailPanel:
    @pytest.fixture(autouse=True)
    def setup(self, home):
        self.page = _go_analysis_tw(home)

    def test_panel_hidden_initially(self):
        assert self.page.locator("text=節目原話").count() == 0

    def test_click_row_opens_panel(self):
        self.page.locator("table").first.locator("td:text-is('2330')").first.click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=節目原話").is_visible()
        assert self.page.locator("text=回測報酬").is_visible()

    def test_close_button_closes_panel(self):
        self.page.locator("table").first.locator("td:text-is('2330')").first.click()
        self.page.wait_for_timeout(200)
        self.page.get_by_role("button", name="×").click()
        self.page.wait_for_timeout(200)
        assert self.page.locator("text=節目原話").count() == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_detail_panel.py -v
```
Expected: `test_panel_hidden_initially` PASSES; `test_click_row_opens_panel` and `test_close_button_closes_panel` FAIL (panel never mounts, so "節目原話" is never found).

- [ ] **Step 3: Mount DetailPanel in App.jsx**

In `frontend/src/App.jsx`, add the import after the other page imports (after line 7):

```jsx
import { EpisodesPage } from './pages/EpisodesPage.jsx';
import { DetailPanel } from './components/DetailPanel.jsx';
```

Add an effect that clears the selection when the route or market changes. Place it immediately after the existing route-persistence effect (which is removed in Task 2 — if Task 1 is done first, add this new effect right after line 47's effect; ordering among effects does not matter):

```jsx
  useEffect(() => { setSelected(null); }, [route, market]);
```

Render the panel inside the outer flex container, immediately before its closing `</div>` (i.e. after the `<div style={{ flex: 1, ... }}>…</div>` block that holds Header + routes, before line 68's `</div>`):

```jsx
      {selected && (
        <DetailPanel pick={selected} episodes={data.episodes} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_detail_panel.py -v
```
Expected: all three tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx tests/e2e/test_detail_panel.py
git commit -m "fix: mount DetailPanel so analysis row clicks open the detail overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Always land on Action

The default route is already `'action'`, but `App.jsx` persists the last route to `localStorage` and restores it on load, so a returning user re-enters on whatever page they left. The stated intent is that the landing page should always be the highest-frequency one (Action). We remove the persistence entirely.

**Trade-off:** removing persistence means the app no longer "remembers where you were." That is the desired behavior here — Action is the intended entry point every session. (If we later want both, we'd gate persistence behind an explicit pin; out of scope now.)

**Files:**
- Modify: `frontend/src/App.jsx`
- Test: `tests/e2e/test_default_route.py`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/test_default_route.py`:

```python
"""E2E: the app lands on Action and does not persist the last route across reloads."""
import re


def test_lands_on_action_by_default(home):
    assert home.locator("text=今天該跟哪幾檔").is_visible()


def test_does_not_persist_route_after_reload(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    assert home.locator("text=歷史回測 · Analysis").is_visible()

    home.reload()
    home.wait_for_load_state("networkidle")
    # Must return to Action, not restore Analysis.
    assert home.locator("text=今天該跟哪幾檔").is_visible()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_default_route.py -v
```
Expected: `test_lands_on_action_by_default` PASSES; `test_does_not_persist_route_after_reload` FAILS (current code restores Analysis from localStorage after reload).

- [ ] **Step 3: Remove route persistence in App.jsx**

In `frontend/src/App.jsx`, change the route state initializer (line 28) from:

```jsx
  const [route, setRoute] = useState(() => localStorage.getItem('gooaye_route') || 'action');
```

to:

```jsx
  const [route, setRoute] = useState('action');
```

Then delete the persistence effect (line 47):

```jsx
  useEffect(() => { localStorage.setItem('gooaye_route', route); }, [route]);
```

(`useEffect` is still imported and used elsewhere in the file, so leave the import alone.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_default_route.py -v
```
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx tests/e2e/test_default_route.py
git commit -m "fix: always land on Action page instead of restoring last route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Show hit-rate definition and sample size

The "命中率 (至今) 72%" card has no denominator and no stated definition, so the number is not trustworthy to an analyst. The metric is already "fraction of picks-with-return-data whose to-date return is positive." We surface the sample size (`正報酬 X/Y 檔`) as the card's sub-line, which both defines the metric (正報酬 = positive return) and shows N.

**Files:**
- Modify: `frontend/src/utils/returnToday.js`
- Modify: `frontend/src/pages/AnalysisPage.jsx`
- Test: `tests/e2e/test_hit_rate_sample.py`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/test_hit_rate_sample.py`:

```python
"""E2E: the hit-rate card shows the positive-return sample size."""
import re


def _go_analysis_us(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    home.get_by_role("button", name="美股 US").click()
    home.wait_for_timeout(300)
    return home


def test_hit_rate_shows_sample_size(home):
    page = _go_analysis_us(home)
    # US seed: 6 picks have return data, 2 are positive (NVDA, AMZN).
    assert page.locator("text=正報酬 2/6 檔").is_visible()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_hit_rate_sample.py -v
```
Expected: FAIL — the string "正報酬 2/6 檔" does not exist yet.

- [ ] **Step 3: Expose hit_count and hit_total in computeStats**

In `frontend/src/utils/returnToday.js`, inside `computeStats`, the `hitRate` line currently reads:

```js
  const hitRate = withReturn.length > 0
    ? withReturn.filter(p => p._rt.returnPct > 0).length / withReturn.length
    : 0;
```

Replace it with named counts:

```js
  const hitTotal = withReturn.length;
  const hitCount = withReturn.filter(p => p._rt.returnPct > 0).length;
  const hitRate = hitTotal > 0 ? hitCount / hitTotal : 0;
```

Then add the two fields to the returned object. The current `return` block ends with:

```js
    hit_rate: Math.round(hitRate * 100) / 100,
    avg_return: Math.round(avgReturn * 10) / 10,
```

Change to:

```js
    hit_rate: Math.round(hitRate * 100) / 100,
    hit_count: hitCount,
    hit_total: hitTotal,
    avg_return: Math.round(avgReturn * 10) / 10,
```

- [ ] **Step 4: Render the sample size in StatsBar**

In `frontend/src/pages/AnalysisPage.jsx`, the `StatsBar` hit-rate card currently reads:

```jsx
      <StatCard label="命中率 (至今)" value={`${(stats.hit_rate * 100).toFixed(0)}%`} />
```

Replace it with:

```jsx
      <StatCard label="命中率 (至今)" value={`${(stats.hit_rate * 100).toFixed(0)}%`}
        sub={`正報酬 ${stats.hit_count}/${stats.hit_total} 檔`} />
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_hit_rate_sample.py -v
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/returnToday.js frontend/src/pages/AnalysisPage.jsx tests/e2e/test_hit_rate_sample.py
git commit -m "feat: show hit-rate sample size (positive-return count) on stats card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Colorblind-friendly direction symbols

Returns rely on red/green alone. We add a ▲/▼ glyph as a redundant, non-color cue in the Analysis table's 至今報酬 column and the vs Bench column (the latter via the `Delta` component, which is used only there).

**Files:**
- Modify: `frontend/src/components/shared/Delta.jsx`
- Modify: `frontend/src/pages/AnalysisPage.jsx`
- Test: `tests/e2e/test_colorblind_arrows.py`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/test_colorblind_arrows.py`:

```python
"""E2E: Analysis return table includes ▲/▼ direction symbols (colorblind aid)."""
import re


def _go_analysis_us(home):
    home.get_by_role("button", name=re.compile("Analysis")).click()
    home.wait_for_load_state("networkidle")
    home.get_by_role("button", name="美股 US").click()
    home.wait_for_timeout(300)
    return home


def test_table_has_up_and_down_arrows(home):
    page = _go_analysis_us(home)
    table = page.locator("table").first
    # US seed has both positive (NVDA, AMZN) and negative (META, AAPL, ASTS, PSTG) returns.
    assert table.locator("text=▲").first.is_visible()
    assert table.locator("text=▼").first.is_visible()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_colorblind_arrows.py -v
```
Expected: FAIL — no ▲/▼ glyphs in the table yet.

- [ ] **Step 3: Add the arrow to the Delta component**

Replace the whole body of `frontend/src/components/shared/Delta.jsx` with:

```jsx
import { C, fmt } from '../../constants.js';

export function Delta({ value, strong }) {
  if (value === null || value === undefined) return <span style={{ color: C.textSubtle }}>—</span>;
  const positive = value >= 0;
  return (
    <span style={{
      color: positive ? C.up : C.down, fontWeight: strong ? 600 : 500,
      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
    }}>{positive ? '▲' : '▼'} {fmt(value)}</span>
  );
}
```

- [ ] **Step 4: Add the arrow to the 至今報酬 cell**

In `frontend/src/pages/AnalysisPage.jsx`, the 至今報酬 cell currently renders:

```jsx
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: positive ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>{fmt(rt.returnPct)}</div>
```

Replace the inner content with an arrow prefix:

```jsx
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: positive ? C.up : C.down, fontVariantNumeric: 'tabular-nums' }}>{positive ? '▲' : '▼'} {fmt(rt.returnPct)}</div>
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest tests/e2e/test_colorblind_arrows.py -v
```
Expected: PASS.

- [ ] **Step 6: Run the full Analysis e2e + journey suites to confirm no regressions**

```bash
/opt/miniconda3/bin/python -m pytest tests/e2e/test_analysis_page.py tests/journeys/test_j1_analysis.py -v
```
Expected: all PASS. (Existing assertions use substring `text=` or `text-is` on tickers/labels/column headers, none on exact return values, so the arrow prefix does not break them.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/shared/Delta.jsx frontend/src/pages/AnalysisPage.jsx tests/e2e/test_colorblind_arrows.py
git commit -m "feat: add colorblind-friendly direction arrows to analysis return table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Run the four new test files plus the full Analysis/navigation suites**

```bash
cd frontend && npm run build && cd .. && /opt/miniconda3/bin/python -m pytest \
  tests/e2e/test_detail_panel.py \
  tests/e2e/test_default_route.py \
  tests/e2e/test_hit_rate_sample.py \
  tests/e2e/test_colorblind_arrows.py \
  tests/e2e/test_analysis_page.py \
  tests/e2e/test_navigation.py \
  tests/journeys/test_j1_analysis.py \
  tests/journeys/test_j4_navigation.py -v
```
Expected: all PASS.

- [ ] **Manual browser check (Playwright MCP):** load the app, confirm it opens on Action; go to Analysis, click a row → DetailPanel opens with quote + 回測報酬; verify the hit-rate card shows `正報酬 X/Y 檔`; verify ▲/▼ appear in the return columns.
