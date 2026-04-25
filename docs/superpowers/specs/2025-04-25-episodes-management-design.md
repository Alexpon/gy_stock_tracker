# Episodes Management + Frontend Modernization Design

## Overview

Add an "Episodes" management page to the Gooaye dashboard that displays all podcast episodes, their processing status, and allows manual triggering of the data pipeline. Simultaneously modernize the frontend from CDN-based React + in-browser Babel to Vite + React with proper ES modules.

## Motivation

- Currently no UI to see which episodes have been processed or to manually trigger processing
- The pipeline runs on a daily schedule with no visibility into status
- Frontend uses Babel standalone for in-browser JSX compilation (~1MB overhead, no HMR, no module system)

## Scope

1. **Backend**: New FastAPI server with API endpoints (replaces batch-only `run.py`)
2. **Frontend modernization**: Migrate to Vite + React with ES module imports
3. **New feature**: Episodes management page (table-based, scan, one-click processing)
4. **Navigation**: Add third sidebar item "Episodes"

## Architecture

### Project Structure

```
gooaye/
├── backend/
│   ├── server.py          # FastAPI (API + serve frontend build)
│   ├── pipeline.py        # existing orchestration
│   ├── rss.py, transcribe.py, extract.py, prices.py, ...
│   ├── db.py, config.py, ticker_map.py
│   └── generate.py        # kept but no longer called; may be removed later
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx        # entry point
│       ├── App.jsx         # router + layout + data fetching
│       ├── constants.js    # colors (V1_C), fmt utils
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── Sidebar.jsx
│       │   ├── DetailPanel.jsx
│       │   └── shared/     # Spark, Pill, Delta, StatCard
│       └── pages/
│           ├── ActionPage.jsx
│           ├── AnalysisPage.jsx
│           └── EpisodesPage.jsx   # new
├── data/
│   └── gooaye.db
└── run.py                  # updated to start FastAPI server
```

### Data Flow (Before vs After)

**Before:** `generate.py` → `data.js` (global `window.GOOAYE_DATA`) → frontend reads global

**After:** Frontend `fetch('/api/...')` → FastAPI queries SQLite → returns JSON

### Dev vs Production

- **Dev**: Vite dev server (port 5173) + FastAPI (port 5001), Vite proxies `/api` to FastAPI
- **Production**: `vite build` → FastAPI serves `frontend/dist/` static files + API endpoints

## API Design

### GET /api/episodes

List all episodes with processing status.

```json
{
  "episodes": [
    {
      "ep": 658,
      "title": "美國關稅搖擺不定...",
      "date": "2025-04-24",
      "duration": "48:32",
      "has_transcript": false,
      "picks_count": 0,
      "has_prices": false,
      "status": "pending"
    }
  ]
}
```

Status derivation logic:
- `has_transcript`: `episodes.transcript` field is non-null
- `picks_count`: count of `picks` rows for that episode
- `has_prices`: all picks for that episode have non-null `entry` price
- `status`:
  - `"completed"` — has_transcript AND picks_count > 0 AND has_prices
  - `"partial"` — at least one of the above is true but not all
  - `"pending"` — none of the above

### POST /api/scan

Scan RSS feed for new episodes and download MP3s.

```json
{
  "new_episodes": [{"ep": 659, "title": "..."}],
  "total_new": 1
}
```

### POST /api/process/{ep}

Run full pipeline for a specific episode (skips completed steps).

```json
{
  "success": true,
  "steps": {
    "stt": "done",
    "extract": "done",
    "prices": "done"
  }
}
```

On failure:
```json
{
  "success": false,
  "steps": {
    "stt": "done",
    "extract": "failed",
    "prices": "skipped"
  },
  "error": "Azure OpenAI API returned 429"
}
```

Step values: `"done"` | `"skipped"` (already complete) | `"failed"`

### GET /api/data

Replaces `data.js`. Returns the same structure as `window.GOOAYE_DATA`.

```json
{
  "episodes": [...],
  "picks": [...],
  "stats": { "us": {...}, "tw": {...} }
}
```

## Frontend: Episodes Page

### Layout (table-based, matching existing design language)

```
┌─────────────────────────────────────────────────────┐
│  集數管理 · Episodes              [掃描新集數] btn  │
├─────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┐                 │
│  │ 總集數   │ 已完成   │ 待處理   │  ← StatCard    │
│  │   12     │    8     │    4     │     style       │
│  └──────────┴──────────┴──────────┘                 │
├─────────────────────────────────────────────────────┤
│  集數  │ 標題           │ 日期  │ STT│ 股票│ 績效│操作│
│  EP658 │ 美國關稅...    │ 04/24 │  ✗ │  — │  — │[處理]│
│  EP657 │ 台股大跌...    │ 04/21 │  ✓ │  ✓ │  ✗ │[處理]│
│  EP656 │ NVIDIA 展望... │ 04/17 │  ✓ │  ✓ │  ✓ │ 完成 │
└─────────────────────────────────────────────────────┘
```

### Interactions

- **Scan button**: Click → loading spinner → POST `/api/scan` → show result toast ("找到 N 個新集數" or "沒有找到新集數") → reload table
- **Process button**: Click → button becomes spinner → POST `/api/process/{ep}` → on success, reload that row's status → on failure, show error message, button restores
- **Concurrent processing**: Disabled. While one episode is processing, other process buttons are disabled to avoid SQLite lock issues.
- **Sort**: Episodes sorted newest first (EP658 at top)

### Status Icons

- ✓ (green, `V1_C.up` / `#067647`) — step completed
- ✗ (orange, `V1_C.warn` / `#b54708`) — step pending/failed
- — (muted, `V1_C.textSubtle` / `#98a2b3`) — step not applicable yet (preceding step incomplete)

## Frontend: Modernization

### Vite Setup

- React + JSX (no TypeScript)
- Dev proxy: `/api` → `http://localhost:5001`
- No CSS framework — keep all existing inline styles

### File Migration

| Source | Destination | Notes |
|--------|------------|-------|
| `v1-dense.jsx` (820 lines) | Split into multiple files | See breakdown below |
| `v1-action.jsx` (459 lines) | `pages/ActionPage.jsx` | Add imports/exports |
| `v1-analytics.jsx` (349 lines) | `pages/AnalysisPage.jsx` | Keep sub-components inline |
| `data.js` | Removed | Replaced by `/api/data` |

### v1-dense.jsx Breakdown

| Component(s) | Destination |
|--------------|-------------|
| `V1_C`, `V1_fmt`, `V1_fmtPrice` | `constants.js` |
| `V1_Spark`, `V1_Pill`, `V1_Delta`, `V1_StatCard` | `components/shared/` |
| `V1_Header` | `components/Header.jsx` |
| `V1_Sidebar` | `components/Sidebar.jsx` |
| `V1_DetailPanel` | `components/DetailPanel.jsx` |
| `V1_App` (root) | `App.jsx` |

### Naming

- Drop `V1_` prefix from all component names (module isolation makes it unnecessary)
- PascalCase for components, file names match component names

### What Does NOT Change

- All inline styles — preserved exactly as-is
- Business logic and data processing
- Visual design — pixel-identical output
- Color scheme, fonts, spacing

## Navigation Changes

### Sidebar

```
NAVIGATION
├── Action    決策      最新 4 集 · 該跟哪幾檔
├── Analysis  分析      歷史回測 · 命中率
└── Episodes  集數管理  掃描 · 處理 · 狀態        ← new
```

### Header

- `route === 'episodes'` → display "集數管理 · Episodes"
- No market toggle or period selector on Episodes page (not market-specific)

### Data Loading

- App startup: `fetch('/api/data')` replaces reading `window.GOOAYE_DATA`
- Episodes page: `fetch('/api/episodes')` on mount
- Action/Analysis pages: logic unchanged, only data source changes

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API server unreachable | Page shows "無法連線到 API server" message |
| STT/OpenAI API failure | Process returns `success: false`, button restores, error shown |
| Scan finds no new episodes | Toast: "沒有找到新集數" |
| Pipeline step already done | Automatically skipped, status shows "skipped" |

## Out of Scope

- Per-step trigger buttons (only full pipeline trigger)
- Real-time progress streaming (simple spinner only)
- Concurrent multi-episode processing
- TypeScript migration
- CSS framework / styled-components migration
- URL-based routing (keep localStorage-based state routing)
