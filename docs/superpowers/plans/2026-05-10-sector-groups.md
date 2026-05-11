# Sector Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract stock sector group opinions (bullish/neutral/bearish) from podcast transcripts and display them as cards on the Action page.

**Architecture:** New `sectors` DB table stores per-episode group sentiments. LLM extraction prompt is extended to return both `picks` and `sectors`. Frontend renders sector cards between the summary bar and the stock table, with expand/collapse for details and history.

**Tech Stack:** SQLite, Python (FastAPI, Azure OpenAI), React (inline styles, no component library)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/db.py` | Modify | Add sectors table DDL + insert/query functions |
| `backend/extract.py` | Modify | Extend prompt, parse sectors from LLM response |
| `backend/generate.py` | Modify | Add `format_sectors` + include in `write_data_js` |
| `backend/server.py` | Modify | Include sectors in `/api/data` response |
| `frontend/src/components/shared/SentimentPill.jsx` | Create | Reusable pill for bullish/neutral/bearish |
| `frontend/src/pages/ActionPage.jsx` | Modify | Add SectorCards section between summary bar and table |

---

### Task 1: Database — Add sectors table and functions

**Files:**
- Modify: `backend/db.py`

- [ ] **Step 1: Add sectors table to `init_db()`**

In `backend/db.py`, add the following DDL inside `init_db()` after the `picks` table creation:

```python
        CREATE TABLE IF NOT EXISTS sectors (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ep            INTEGER NOT NULL REFERENCES episodes(ep),
            name          TEXT NOT NULL,
            sentiment     TEXT NOT NULL,
            quote         TEXT,
            tickers       TEXT,
            segment_start REAL,
            segment_end   REAL,
            created_at    TEXT DEFAULT (datetime('now')),
            UNIQUE(ep, name)
        );
```

- [ ] **Step 2: Add `insert_sector` function**

Add after `insert_pick`:

```python
def insert_sector(ep, name, sentiment, quote=None, tickers=None,
                  segment_start=None, segment_end=None):
    conn = _connect()
    tickers_json = json.dumps(tickers, ensure_ascii=False) if tickers else None
    conn.execute("""
        INSERT INTO sectors (ep, name, sentiment, quote, tickers, segment_start, segment_end)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ep, name) DO UPDATE SET
            sentiment=excluded.sentiment, quote=excluded.quote,
            tickers=excluded.tickers,
            segment_start=excluded.segment_start, segment_end=excluded.segment_end
    """, (ep, name, sentiment, quote, tickers_json, segment_start, segment_end))
    conn.commit()
    conn.close()
```

Add `import json` at the top of db.py (it's not currently imported).

- [ ] **Step 3: Add `get_sectors_for_episodes` function**

Add after `get_picks_for_episodes`:

```python
def get_sectors_for_episodes(ep_list):
    if not ep_list:
        return []
    conn = _connect()
    placeholders = ",".join("?" * len(ep_list))
    rows = conn.execute(
        f"SELECT * FROM sectors WHERE ep IN ({placeholders}) ORDER BY ep DESC, id",
        ep_list,
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
```

- [ ] **Step 4: Verify the DB schema initializes correctly**

Run:
```bash
cd /Users/yushao/claude_workspace/gooaye && python -c "from backend import db; db.init_db(); print('OK')"
```

Expected: `OK` (no errors)

- [ ] **Step 5: Commit**

```bash
git add backend/db.py
git commit -m "feat(db): add sectors table for sector group opinions"
```

---

### Task 2: Extraction — Extend LLM prompt and parse sectors

**Files:**
- Modify: `backend/extract.py`

- [ ] **Step 1: Extend `SYSTEM_PROMPT` with sector extraction instructions**

Replace the final line of `SYSTEM_PROMPT` (the line `若無任何個股提及，回傳 JSON：{"picks": []}"""`) with:

```python
同時抽取股癌提到的「股票族群」整體觀點。族群是指他對某一類股票的整體看法（非單一個股）。
只有他明確表達對某族群的態度時才抽取，不是所有產業關鍵字都算。

對每個族群，回傳：
1. name：族群名稱（用股癌原始用詞，如「散熱」「AI」「航運」「金融」「機器人」）
2. sentiment：
   - "bullish"：看好（「族群還有空間」「會輪到」「持續加碼這塊」）
   - "neutral"：中立（「先觀望」「不確定」「還沒到時候」）
   - "bearish"：看壞（「要小心」「我不碰」「過熱」「要修正」）
3. quote：最能代表他對該族群態度的原話（1-2 句，保留原文）
4. tickers：該族群中他有提到的具體個股 ticker（必須同時出現在 picks 中）
5. segment_indices：quote 對應的 segment 索引

請以 JSON 格式回傳：{"picks": [...], "sectors": [...]}
若無任何個股提及，回傳 JSON：{"picks": [], "sectors": []}"""
```

- [ ] **Step 2: Add sector processing logic in `run()` function**

After the existing picks processing loop (after `logger.info("EP%d: extracted %d valid picks ...")`), add sector extraction:

```python
    # --- Sector groups ---
    raw_sectors = result.get("sectors", [])
    valid_sentiments = {"bullish", "neutral", "bearish"}
    extracted_tickers = {p["ticker"] for p in picks}
    sectors = []

    for sec in raw_sectors:
        name = sec.get("name", "").strip()
        sentiment = sec.get("sentiment", "").strip().lower()
        if not name or sentiment not in valid_sentiments:
            logger.warning("EP%d: skipping invalid sector '%s' (%s)", ep, name, sentiment)
            continue

        sec_tickers = [t for t in sec.get("tickers", []) if t in extracted_tickers]

        seg_start, seg_end = _map_segment_timestamps(
            sec.get("segment_indices", []), segments
        )

        db.insert_sector(
            ep=ep,
            name=name,
            sentiment=sentiment,
            quote=sec.get("quote"),
            tickers=sec_tickers if sec_tickers else None,
            segment_start=seg_start,
            segment_end=seg_end,
        )
        sectors.append(sec)

    logger.info("EP%d: extracted %d sector groups", ep, len(sectors))
```

- [ ] **Step 3: Update `run()` return value**

Change the final return from:
```python
    return picks
```
to:
```python
    return picks, sectors
```

- [ ] **Step 4: Update the `__main__` block to handle new return**

Replace:
```python
    picks = run(ep_num)
    for p in picks:
        print(f"  {p['ticker']} ({p['confidence']}): {p.get('quote', '')[:40]}...")
```

with:
```python
    picks, sectors = run(ep_num)
    for p in picks:
        print(f"  {p['ticker']} ({p['confidence']}): {p.get('quote', '')[:40]}...")
    for s in sectors:
        print(f"  [{s['sentiment']}] {s['name']}: {s.get('quote', '')[:40]}...")
```

- [ ] **Step 5: Update `server.py` process endpoint to handle tuple return**

In `backend/server.py`, the `process_episode` function calls `extract.run(ep)` inside a lambda. Since the return value isn't used downstream in that function, no change is needed — the lambda discards the return value. Verify this is the case by reading line 151:

```python
pipeline.append(("extract", lambda: extract.run(ep)))
```

The return is discarded, so no change needed here.

- [ ] **Step 6: Commit**

```bash
git add backend/extract.py
git commit -m "feat(extract): extend LLM prompt to extract sector group opinions"
```

---

### Task 3: Data Layer — Serve sectors via API and data.js

**Files:**
- Modify: `backend/generate.py`
- Modify: `backend/server.py`

- [ ] **Step 1: Add `format_sectors` in `generate.py`**

Add after `format_picks`:

```python
def format_sectors(sectors, ep_dates):
    result = []
    for s in sectors:
        tickers = s["tickers"]
        if isinstance(tickers, str):
            try:
                tickers = json.loads(tickers)
            except (json.JSONDecodeError, TypeError):
                tickers = []

        result.append({
            "ep": s["ep"],
            "name": s["name"],
            "sentiment": s["sentiment"],
            "quote": s.get("quote"),
            "tickers": tickers or [],
            "mention_date": ep_dates.get(s["ep"], ""),
        })
    return result
```

- [ ] **Step 2: Update `write_data_js` to include sectors**

In `write_data_js`, after `picks = db.get_picks_for_episodes(ep_list)`, add:

```python
    sectors = db.get_sectors_for_episodes(ep_list)
```

Then in the `data` dict, add the `sectors` key:

```python
    data = {
        "episodes": format_episodes(episodes),
        "picks": format_picks(picks, ep_dates),
        "sectors": format_sectors(sectors, ep_dates),
        "stats": {
            "us": compute_stats(us_picks, "us"),
            "tw": compute_stats(tw_picks, "tw"),
        },
    }
```

Update the log line:
```python
    logger.info("Wrote data.js with %d episodes, %d picks, %d sectors", len(episodes), len(picks), len(sectors))
```

- [ ] **Step 3: Update `/api/data` endpoint in `server.py`**

In the `get_data()` function, after `picks = db.get_picks_for_episodes(ep_list)`, add:

```python
    sectors = db.get_sectors_for_episodes(ep_list)
```

Update the import line at the top:
```python
from backend.generate import format_episodes, format_picks, format_sectors, compute_stats
```

Add `sectors` to the return dict:

```python
    return {
        "episodes": formatted_eps,
        "picks": formatted_picks,
        "sectors": format_sectors(sectors, ep_dates),
        "stats": {
            "us": compute_stats(us_picks, "us"),
            "tw": compute_stats(tw_picks, "tw"),
        },
    }
```

- [ ] **Step 4: Verify API returns sectors field**

Run:
```bash
cd /Users/yushao/claude_workspace/gooaye && python -c "
from backend import db
db.init_db()
from backend.generate import write_data_js
write_data_js()
print('OK')
"
```

Expected: `OK`, and `data.js` now contains a `"sectors"` key (even if empty array).

- [ ] **Step 5: Commit**

```bash
git add backend/generate.py backend/server.py
git commit -m "feat(api): serve sector groups in /api/data and data.js"
```

---

### Task 4: Frontend — SentimentPill component

**Files:**
- Create: `frontend/src/components/shared/SentimentPill.jsx`

- [ ] **Step 1: Create `SentimentPill.jsx`**

```jsx
import { C } from '../../constants.js';

const STYLES = {
  bullish: { bg: C.upBg, color: C.up, label: '看好' },
  neutral: { bg: C.warnBg, color: C.warn, label: '中立' },
  bearish: { bg: C.downBg, color: C.down, label: '看壞' },
};

export function SentimentPill({ sentiment }) {
  const s = STYLES[sentiment] || STYLES.neutral;
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/shared/SentimentPill.jsx
git commit -m "feat(ui): add SentimentPill component for sector sentiment display"
```

---

### Task 5: Frontend — Sector cards on ActionPage

**Files:**
- Modify: `frontend/src/pages/ActionPage.jsx`

- [ ] **Step 1: Add import for SentimentPill**

At the top of `ActionPage.jsx`, add:

```jsx
import { SentimentPill } from '../components/shared/SentimentPill.jsx';
```

- [ ] **Step 2: Add `mergeSectors` helper function**

Add after the existing `mergePicks` function (after line 94):

```jsx
// ─── 族群合併邏輯 ─────────────────────────────────────

const SENT_RANK = { bullish: 3, neutral: 2, bearish: 1 };

function mergeSectors(sectors) {
  const map = new Map();
  for (const s of sectors) {
    if (!map.has(s.name)) {
      map.set(s.name, { name: s.name, entries: [s], latest: s });
    } else {
      const g = map.get(s.name);
      g.entries.push(s);
      if (s.ep > g.latest.ep) g.latest = s;
    }
  }
  return [...map.values()]
    .map(g => ({
      ...g,
      sentiment: g.latest.sentiment,
      quote: g.latest.quote,
      tickers: g.latest.tickers || [],
      mentionCount: g.entries.length,
    }))
    .sort((a, b) => (SENT_RANK[b.sentiment] || 0) - (SENT_RANK[a.sentiment] || 0));
}
```

- [ ] **Step 3: Add `SectorCard` component**

Add after `mergeSectors`:

```jsx
function SectorCard({ group, allPicks }) {
  const [open, setOpen] = useState(false);
  const truncatedQuote = group.quote
    ? group.quote.length > 30 ? group.quote.slice(0, 30) + '…' : group.quote
    : null;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        minWidth: 180,
        flex: '1 1 180px',
        maxWidth: 280,
      }}
      onClick={() => setOpen(!open)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{group.name}</span>
        <SentimentPill sentiment={group.sentiment} />
      </div>
      <div style={{ fontSize: 10, color: C.textSubtle, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
        EP {group.latest.ep}
        {group.mentionCount > 1 && ` · 共 ${group.mentionCount} 集提及`}
      </div>
      {truncatedQuote && (
        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.4 }}>
          「{truncatedQuote}」
        </div>
      )}
      {group.tickers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {group.tickers.slice(0, 4).map(t => (
            <span key={t} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '1px 6px', borderRadius: 3,
              background: C.surfaceAlt, color: C.textMuted,
            }}>{t}</span>
          ))}
          {group.tickers.length > 4 && (
            <span style={{ fontSize: 10, color: C.textSubtle }}>+{group.tickers.length - 4}</span>
          )}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {group.quote && group.quote.length > 30 && (
            <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10 }}>
              「{group.quote}」
            </div>
          )}
          {group.entries.length > 1 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: C.textSubtle, fontWeight: 700, marginBottom: 6 }}>歷史觀點</div>
              {group.entries.sort((a, b) => b.ep - a.ep).map(s => (
                <div key={s.ep} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: C.text, minWidth: 50 }}>
                    EP {s.ep}
                  </span>
                  <SentimentPill sentiment={s.sentiment} />
                  {s.quote && (
                    <span style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>
                      「{s.quote.length > 20 ? s.quote.slice(0, 20) + '…' : s.quote}」
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Integrate sector cards into ActionPage render**

In the `ActionPage` component function, after `const greatCount = ...` (line 297), add sector data processing:

```jsx
  // sector groups
  const allSectors = (data.sectors || []).filter(s => {
    if (!s.tickers || s.tickers.length === 0) return true;
    const tickerMarkets = s.tickers
      .map(t => picks.find(p => p.ticker === t))
      .filter(Boolean)
      .map(p => p.market);
    return tickerMarkets.length === 0 || tickerMarkets.includes(market);
  }).filter(s => latestEpNums.has(s.ep));
  const sectorGroups = mergeSectors(allSectors);
```

Then in the JSX, between the `{/* Summary bar */}` closing `</div>` (after line 382) and `{/* 可跟標的表格 */}`, add:

```jsx
      {/* 族群觀點卡片 */}
      {sectorGroups.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, color: C.textSubtle, fontFamily: 'var(--font-mono)',
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            族群觀點 · 最新 4 集
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {sectorGroups.map(g => (
              <SectorCard key={g.name} group={g} allPicks={allCandidates} />
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify the page renders without errors**

Run the dev server:
```bash
cd /Users/yushao/claude_workspace/gooaye/frontend && npm run dev
```

Open `http://localhost:5173` in browser. Navigate to Action page. Even with no sectors data yet, the page should render without errors (sector section simply won't appear).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ActionPage.jsx
git commit -m "feat(action): add sector group cards between summary bar and stock table"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Re-extract an episode to populate sectors**

Pick an already-transcribed episode and re-extract it:

```bash
cd /Users/yushao/claude_workspace/gooaye
python -c "
from backend import db
db.init_db()
# Clear existing picks for re-extraction
conn = db._connect()
conn.execute('DELETE FROM picks WHERE ep = (SELECT MAX(ep) FROM episodes WHERE transcript IS NOT NULL)')
conn.execute('DELETE FROM sectors WHERE ep = (SELECT MAX(ep) FROM episodes WHERE transcript IS NOT NULL)')
conn.commit()
ep = conn.execute('SELECT MAX(ep) FROM episodes WHERE transcript IS NOT NULL').fetchone()[0]
conn.close()
print(f'Re-extracting EP{ep}')
from backend import extract
picks, sectors = extract.run(ep)
print(f'Picks: {len(picks)}, Sectors: {len(sectors)}')
for s in sectors:
    print(f'  [{s[\"sentiment\"]}] {s[\"name\"]}')
"
```

Expected: Some sectors extracted with bullish/neutral/bearish sentiments.

- [ ] **Step 2: Regenerate data.js and verify sectors field**

```bash
cd /Users/yushao/claude_workspace/gooaye && python -c "
from backend import db
db.init_db()
from backend.generate import write_data_js
write_data_js()
" && grep -c '"sectors"' data.js
```

Expected: `1` (the sectors key appears in data.js)

- [ ] **Step 3: Verify in browser**

Open the Action page in the browser. Sector cards should now appear between the summary bar and the stock table, showing group names, sentiment pills, quotes, and related tickers.

- [ ] **Step 4: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "feat: sector groups end-to-end working"
```
