# Episodes Management + Frontend Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Episodes management page with pipeline triggering, while migrating the frontend from CDN React + Babel standalone to Vite + React with ES modules.

**Architecture:** FastAPI backend serves 4 API endpoints (episodes list, RSS scan, pipeline process, data) and static frontend files. Frontend is a Vite + React app with modular components extracted from the existing monolithic JSX files. All existing visual design and inline styles are preserved exactly.

**Tech Stack:** Python 3 / FastAPI / uvicorn / SQLite (backend), Vite / React 18 / ES modules (frontend)

**Spec:** `docs/superpowers/specs/2025-04-25-episodes-management-design.md`

---

## File Structure

### Backend (new/modified)

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/server.py` | Create | FastAPI app with 4 API endpoints + static file serving |
| `tests/test_server.py` | Create | API endpoint tests |
| `run.py` | Modify | Update to start FastAPI server instead of schedule loop |
| `requirements.txt` | Modify | Add fastapi, uvicorn |

### Frontend (new)

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/package.json` | Create | Vite + React dependencies |
| `frontend/vite.config.js` | Create | Vite config with API proxy |
| `frontend/index.html` | Create | Vite entry point |
| `frontend/src/main.jsx` | Create | React root mount |
| `frontend/src/constants.js` | Create | V1_C colors, V1_fmt, V1_fmtPrice |
| `frontend/src/App.jsx` | Create | Root component: layout, routing, data fetching |
| `frontend/src/components/shared/Spark.jsx` | Create | Sparkline SVG component |
| `frontend/src/components/shared/Pill.jsx` | Create | Confidence badge component |
| `frontend/src/components/shared/Delta.jsx` | Create | Colored percentage display |
| `frontend/src/components/shared/StatCard.jsx` | Create | Stat display card |
| `frontend/src/components/Header.jsx` | Create | Top navbar |
| `frontend/src/components/Sidebar.jsx` | Create | Left navigation (3 items now) |
| `frontend/src/components/DetailPanel.jsx` | Create | Right slide-out detail panel |
| `frontend/src/components/TweaksPanel.jsx` | Create | Configuration panel |
| `frontend/src/pages/ActionPage.jsx` | Create | Action page + ActionCard |
| `frontend/src/pages/AnalysisPage.jsx` | Create | Analysis page with all sub-components |
| `frontend/src/pages/EpisodesPage.jsx` | Create | New episodes management page |

### Files to keep (unchanged)

All existing `backend/*.py` files remain unchanged. The new `server.py` imports and calls existing pipeline functions.

### Files retired after migration

| File | Status |
|------|--------|
| `index.html` | Replaced by `frontend/index.html` |
| `v1-dense.jsx` | Split into modules under `frontend/src/` |
| `v1-action.jsx` | Migrated to `frontend/src/pages/ActionPage.jsx` |
| `v1-analytics.jsx` | Migrated to `frontend/src/pages/AnalysisPage.jsx` |
| `data.js` | Replaced by `/api/data` endpoint |

---

## Task 1: FastAPI Server — `/api/episodes` endpoint

**Files:**
- Create: `backend/server.py`
- Create: `tests/test_server.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add FastAPI and uvicorn to requirements.txt**

Add to `requirements.txt`:
```
fastapi
uvicorn[standard]
```

- [ ] **Step 2: Write the failing test for GET /api/episodes**

Create `tests/test_server.py`:

```python
import json
import pytest
from fastapi.testclient import TestClient
from backend import db


@pytest.fixture
def client(tmp_db):
    from backend.server import app
    return TestClient(app)


@pytest.fixture
def seeded_db(tmp_db):
    db.insert_episode(654, "EP654 美股觀察", "2026-04-18", "2999")
    db.insert_episode(630, "EP630 台股佈局", "2026-01-24", "3100")
    db.update_episode_transcript(630, json.dumps([{"text": "test", "start": 0, "end": 5}]))
    db.insert_pick(630, "2330", "台積電", "tw", "doing", sector="Semi")
    db.update_pick_prices(630, "2330", entry=580.0, w1=2.5, status="backfilling")
    from backend.server import app
    return TestClient(app)


def test_episodes_empty(client):
    resp = client.get("/api/episodes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["episodes"] == []


def test_episodes_with_data(seeded_db):
    resp = seeded_db.get("/api/episodes")
    assert resp.status_code == 200
    data = resp.json()
    eps = data["episodes"]
    assert len(eps) == 2
    assert eps[0]["ep"] == 654
    assert eps[0]["status"] == "pending"
    assert eps[0]["has_transcript"] is False
    assert eps[0]["picks_count"] == 0
    assert eps[1]["ep"] == 630
    assert eps[1]["status"] == "partial"
    assert eps[1]["has_transcript"] is True
    assert eps[1]["picks_count"] == 1
    assert eps[1]["has_prices"] is False
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py -v`
Expected: FAIL (cannot import backend.server)

- [ ] **Step 4: Implement backend/server.py with /api/episodes**

Create `backend/server.py`:

```python
from fastapi import FastAPI
from backend import db

app = FastAPI(title="Gooaye API")


@app.on_event("startup")
def startup():
    db.init_db()


@app.get("/api/episodes")
def list_episodes():
    episodes = db.get_latest_episodes(n=100)
    result = []
    for ep_row in episodes:
        ep_num = ep_row["ep"]
        has_transcript = ep_row["transcript"] is not None
        picks = db.get_picks_for_episode(ep_num)
        picks_count = len(picks)
        has_prices = picks_count > 0 and all(p["entry"] is not None for p in picks)

        if has_transcript and picks_count > 0 and has_prices:
            status = "completed"
        elif has_transcript or picks_count > 0:
            status = "partial"
        else:
            status = "pending"

        result.append({
            "ep": ep_num,
            "title": ep_row["title"],
            "date": ep_row["date"],
            "duration": ep_row["duration"],
            "has_transcript": has_transcript,
            "picks_count": picks_count,
            "has_prices": has_prices,
            "status": status,
        })
    return {"episodes": result}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/server.py tests/test_server.py requirements.txt
git commit -m "feat: add FastAPI server with GET /api/episodes endpoint"
```

---

## Task 2: FastAPI Server — `/api/scan` endpoint

**Files:**
- Modify: `backend/server.py`
- Modify: `tests/test_server.py`

- [ ] **Step 1: Write the failing test for POST /api/scan**

Add to `tests/test_server.py`:

```python
from unittest.mock import patch


def test_scan_no_new(client):
    with patch("backend.rss.check_new", return_value=[]):
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_new"] == 0
    assert data["new_episodes"] == []


def test_scan_finds_new(client):
    fake_episodes = [
        {"ep": 659, "title": "EP659 新一集", "date": "2026-04-25",
         "duration": "3000", "audio_url": "https://example.com/ep659.mp3"}
    ]
    with patch("backend.rss.check_new", return_value=fake_episodes), \
         patch("backend.rss.download_audio"):
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_new"] == 1
    assert data["new_episodes"][0]["ep"] == 659
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py::test_scan_no_new tests/test_server.py::test_scan_finds_new -v`
Expected: FAIL

- [ ] **Step 3: Implement POST /api/scan**

Add to `backend/server.py`:

```python
from backend import rss


@app.post("/api/scan")
def scan_episodes():
    new_episodes = rss.check_new()
    result = []
    for ep_info in new_episodes:
        db.insert_episode(
            ep_info["ep"], ep_info["title"], ep_info["date"],
            ep_info.get("duration"), ep_info.get("audio_url"),
        )
        rss.download_audio(ep_info["ep"], ep_info["audio_url"])
        result.append({"ep": ep_info["ep"], "title": ep_info["title"]})
    return {"new_episodes": result, "total_new": len(result)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/server.py tests/test_server.py
git commit -m "feat: add POST /api/scan endpoint for RSS episode scanning"
```

---

## Task 3: FastAPI Server — `/api/process/{ep}` endpoint

**Files:**
- Modify: `backend/server.py`
- Modify: `tests/test_server.py`

- [ ] **Step 1: Write the failing test for POST /api/process/{ep}**

Add to `tests/test_server.py`:

```python
def test_process_episode_not_found(client):
    resp = client.post("/api/process/999")
    assert resp.status_code == 404


def test_process_episode_full_pipeline(seeded_db):
    with patch("backend.transcribe.run") as mock_stt, \
         patch("backend.extract.run") as mock_extract, \
         patch("backend.prices.fetch_new_picks") as mock_prices:
        resp = seeded_db.post("/api/process/654")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["steps"]["stt"] == "done"
    assert data["steps"]["extract"] == "done"
    assert data["steps"]["prices"] == "done"
    mock_stt.assert_called_once_with(654)
    mock_extract.assert_called_once_with(654)
    mock_prices.assert_called_once_with(654)


def test_process_episode_skips_completed_steps(seeded_db):
    """EP630 already has transcript and picks — STT and extract should be skipped."""
    with patch("backend.transcribe.run") as mock_stt, \
         patch("backend.extract.run") as mock_extract, \
         patch("backend.prices.fetch_new_picks") as mock_prices:
        resp = seeded_db.post("/api/process/630")
    assert resp.status_code == 200
    data = resp.json()
    assert data["steps"]["stt"] == "skipped"
    assert data["steps"]["extract"] == "skipped"
    assert data["steps"]["prices"] == "done"
    mock_stt.assert_not_called()
    mock_extract.assert_not_called()
    mock_prices.assert_called_once_with(630)


def test_process_episode_handles_failure(seeded_db):
    with patch("backend.transcribe.run", side_effect=Exception("STT API timeout")):
        resp = seeded_db.post("/api/process/654")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "STT API timeout" in data["error"]
    assert data["steps"]["stt"] == "failed"
    assert data["steps"]["extract"] == "skipped"
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py::test_process_episode_not_found tests/test_server.py::test_process_episode_full_pipeline -v`
Expected: FAIL

- [ ] **Step 3: Implement POST /api/process/{ep}**

Add to `backend/server.py`:

```python
from fastapi import HTTPException
from backend import transcribe, extract, prices


@app.post("/api/process/{ep}")
def process_episode(ep: int):
    episode = db.get_episode(ep)
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode {ep} not found")

    steps = {"stt": "skipped", "extract": "skipped", "prices": "skipped"}

    try:
        # Step 1: STT
        if episode["transcript"] is None:
            transcribe.run(ep)
            steps["stt"] = "done"

        # Step 2: Extract
        picks = db.get_picks_for_episode(ep)
        if len(picks) == 0:
            extract.run(ep)
            steps["extract"] = "done"

        # Step 3: Prices
        prices.fetch_new_picks(ep)
        steps["prices"] = "done"

        return {"success": True, "steps": steps}

    except Exception as e:
        for key in steps:
            if steps[key] == "skipped" and key != list(steps.keys())[0]:
                pass
            if steps[key] not in ("done", "skipped"):
                steps[key] = "skipped"
        # Mark the current failing step
        for key in ["stt", "extract", "prices"]:
            if steps[key] not in ("done", "skipped"):
                steps[key] = "failed"
                break
        # If we haven't marked any as failed yet, find the first non-done/skipped
        if "failed" not in steps.values():
            for key in ["stt", "extract", "prices"]:
                if steps[key] == "skipped":
                    steps[key] = "failed"
                    break
        return {"success": False, "steps": steps, "error": str(e)}
```

Wait — the error handling logic above is fragile. Let me rewrite it with a cleaner approach:

```python
@app.post("/api/process/{ep}")
def process_episode(ep: int):
    episode = db.get_episode(ep)
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode {ep} not found")

    steps = {}
    pipeline = []

    # Determine which steps to run
    if episode["transcript"] is None:
        pipeline.append(("stt", lambda: transcribe.run(ep)))
    else:
        steps["stt"] = "skipped"

    existing_picks = db.get_picks_for_episode(ep)
    if len(existing_picks) == 0:
        pipeline.append(("extract", lambda: extract.run(ep)))
    else:
        steps["extract"] = "skipped"

    pipeline.append(("prices", lambda: prices.fetch_new_picks(ep)))

    for name, fn in pipeline:
        try:
            fn()
            steps[name] = "done"
        except Exception as e:
            steps[name] = "failed"
            # Mark remaining steps as skipped
            remaining = [n for n, _ in pipeline if n not in steps]
            for r in remaining:
                steps[r] = "skipped"
            return {"success": False, "steps": steps, "error": str(e)}

    return {"success": True, "steps": steps}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/server.py tests/test_server.py
git commit -m "feat: add POST /api/process/{ep} endpoint with smart step skipping"
```

---

## Task 4: FastAPI Server — `/api/data` endpoint

**Files:**
- Modify: `backend/server.py`
- Modify: `tests/test_server.py`

- [ ] **Step 1: Write the failing test for GET /api/data**

Add to `tests/test_server.py`:

```python
def test_data_endpoint(seeded_db):
    resp = seeded_db.get("/api/data")
    assert resp.status_code == 200
    data = resp.json()
    assert "episodes" in data
    assert "picks" in data
    assert "stats" in data
    assert "us" in data["stats"]
    assert "tw" in data["stats"]


def test_data_endpoint_empty(client):
    resp = client.get("/api/data")
    assert resp.status_code == 200
    data = resp.json()
    assert data["episodes"] == []
    assert data["picks"] == []
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py::test_data_endpoint tests/test_server.py::test_data_endpoint_empty -v`
Expected: FAIL

- [ ] **Step 3: Implement GET /api/data**

Add to `backend/server.py`:

```python
from backend.generate import format_episodes, format_picks, compute_stats


@app.get("/api/data")
def get_data():
    episodes = db.get_latest_episodes(n=10)
    if not episodes:
        return {"episodes": [], "picks": [], "stats": {"us": {}, "tw": {}}}

    ep_list = [e["ep"] for e in episodes]
    picks = db.get_picks_for_episodes(ep_list)
    ep_dates = {e["ep"]: e["date"] for e in episodes}

    formatted_eps = format_episodes(episodes)
    formatted_picks = format_picks(picks, ep_dates)

    us_picks = [p for p in formatted_picks if p["market"] == "us"]
    tw_picks = [p for p in formatted_picks if p["market"] == "tw"]

    return {
        "episodes": formatted_eps,
        "picks": formatted_picks,
        "stats": {
            "us": compute_stats(us_picks, "us"),
            "tw": compute_stats(tw_picks, "tw"),
        },
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py -v`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/server.py tests/test_server.py
git commit -m "feat: add GET /api/data endpoint replacing data.js"
```

---

## Task 5: Update run.py to start FastAPI server

**Files:**
- Modify: `run.py`

- [ ] **Step 1: Update run.py**

Replace `run.py` content with:

```python
import argparse
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("gooaye")


def main():
    parser = argparse.ArgumentParser(description="Gooaye Backend")
    parser.add_argument("--now", action="store_true", help="Run pipeline once and exit")
    parser.add_argument("--port", type=int, default=5001, help="API server port")
    args = parser.parse_args()

    if args.now:
        from backend.pipeline import run_full
        logger.info("Running pipeline now...")
        run_full()
        return

    import uvicorn
    logger.info("Starting API server on port %d", args.port)
    uvicorn.run("backend.server:app", host="0.0.0.0", port=args.port, reload=False)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify server starts**

Run: `cd /Users/yushao/claude_workspace/gooaye && timeout 5 python run.py --port 5001 || true`
Expected: Server starts, then timeout kills it. Should see "Starting API server on port 5001" in output.

- [ ] **Step 3: Verify --now still works**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/ -v --ignore=tests/test_server.py -x -q`
Expected: All existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add run.py
git commit -m "refactor: update run.py to start FastAPI server, keep --now for one-shot pipeline"
```

---

## Task 6: Vite Project Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/constants.js`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "gooaye-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.3.0"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
});
```

- [ ] **Step 3: Create frontend/index.html**

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<title>Gooaye 股癌監控</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --font-sans: "Noto Sans TC", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
  button { font-family: inherit; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d0d5dd; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #98a2b3; }
</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create frontend/src/constants.js**

Extract from `v1-dense.jsx`:

```js
export const C = {
  bg: '#f7f8fa', surface: '#ffffff', surfaceAlt: '#f1f3f7',
  border: '#e4e7ec', borderStrong: '#d0d5dd',
  text: '#0b1220', textMuted: '#475467', textSubtle: '#98a2b3',
  up: '#067647', upBg: '#ecfdf3', down: '#b42318', downBg: '#fef3f2',
  accent: '#3e4ccf', accentBg: '#eef0ff', warn: '#b54708', warnBg: '#fffaeb',
};

export function fmt(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(dp) + '%';
}

export function fmtPrice(n) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(2);
}

export const PERIOD_DAYS = { w1: 5, w2: 10, m1: 21, q1: 63 };

export const DEFAULT_CONFIG = {
  followOnly: 'doing',
  capitalPerEpisode: 10000,
  entryDelay: 0,
  showBenchOverlay: true,
  actionFollow: 'all',
};
```

- [ ] **Step 5: Create frontend/src/main.jsx (placeholder)**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return <div style={{ padding: 40 }}>Gooaye — migrating...</div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 6: Install dependencies and verify dev server starts**

Run:
```bash
cd /Users/yushao/claude_workspace/gooaye/frontend && npm install
```

Then test:
```bash
cd /Users/yushao/claude_workspace/gooaye/frontend && npx vite --port 5173 &
sleep 3 && curl -s http://localhost:5173 | head -5
kill %1
```

Expected: HTML with `<div id="root">` returned.

- [ ] **Step 7: Add frontend/node_modules to .gitignore**

Create `frontend/.gitignore`:
```
node_modules
dist
```

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/vite.config.js frontend/index.html frontend/src/main.jsx frontend/src/constants.js frontend/.gitignore frontend/package-lock.json
git commit -m "feat: scaffold Vite + React frontend project"
```

---

## Task 7: Migrate Shared Components

**Files:**
- Create: `frontend/src/components/shared/Spark.jsx`
- Create: `frontend/src/components/shared/Pill.jsx`
- Create: `frontend/src/components/shared/Delta.jsx`
- Create: `frontend/src/components/shared/StatCard.jsx`

- [ ] **Step 1: Create Spark.jsx**

From `v1-dense.jsx` lines 19-32:

```jsx
import { C } from '../../constants.js';

export function Spark({ data, width = 120, height = 32, positive }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, height - ((v - min) / range) * height]).map(p => p.join(',')).join(' ');
  const last = data[data.length - 1];
  const lastY = height - ((last - min) / range) * height;
  const color = positive ? C.up : C.down;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} stroke={color} strokeWidth="1.25" fill="none" />
      <circle cx={width - 1} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
```

- [ ] **Step 2: Create Pill.jsx**

From `v1-dense.jsx` lines 34-50:

```jsx
import { C } from '../../constants.js';

export function Pill({ kind }) {
  const s = {
    doing: { bg: C.accentBg, color: C.accent, label: '有在做' },
    watching: { bg: C.warnBg, color: C.warn, label: '觀察中' },
    mention: { bg: C.surfaceAlt, color: C.textMuted, label: '只是提到' },
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
```

- [ ] **Step 3: Create Delta.jsx**

From `v1-dense.jsx` lines 53-62:

```jsx
import { C, fmt } from '../../constants.js';

export function Delta({ value, strong }) {
  if (value === null || value === undefined) return <span style={{ color: C.textSubtle }}>—</span>;
  const positive = value >= 0;
  return (
    <span style={{
      color: positive ? C.up : C.down, fontWeight: strong ? 600 : 500,
      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
    }}>{fmt(value)}</span>
  );
}
```

- [ ] **Step 4: Create StatCard.jsx**

From `v1-dense.jsx` lines 170-187:

```jsx
import { C } from '../../constants.js';

export function StatCard({ label, value, sub, subKind, mono = true }) {
  return (
    <div style={{ padding: '14px 16px', borderRight: `1px solid ${C.border}`, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 600, color: C.text,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, marginTop: 4,
          color: subKind === 'up' ? C.up : subKind === 'down' ? C.down : C.textMuted,
          fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        }}>{sub}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create barrel export**

Create `frontend/src/components/shared/index.js`:

```js
export { Spark } from './Spark.jsx';
export { Pill } from './Pill.jsx';
export { Delta } from './Delta.jsx';
export { StatCard } from './StatCard.jsx';
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/shared/
git commit -m "feat: migrate shared components (Spark, Pill, Delta, StatCard) to ES modules"
```

---

## Task 8: Migrate Header, Sidebar, DetailPanel, TweaksPanel

**Files:**
- Create: `frontend/src/components/Header.jsx`
- Create: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/DetailPanel.jsx`
- Create: `frontend/src/components/TweaksPanel.jsx`

- [ ] **Step 1: Create Header.jsx**

From `v1-dense.jsx` lines 64-103. Update: add `'episodes'` route display text.

```jsx
import { C } from '../constants.js';

export function Header({ market, setMarket, period, setPeriod, route }) {
  const routeLabel = {
    action: '決策 · Action',
    analysis: '歷史回測 · Analysis',
    episodes: '集數管理 · Episodes',
  }[route];

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`, background: C.surface,
      padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 24,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
        {routeLabel}
      </div>
      <div style={{ flex: 1 }} />
      {route !== 'episodes' && (
        <div style={{ display: 'inline-flex', background: C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${C.border}` }}>
          {['us', 'tw'].map(m => (
            <button key={m} onClick={() => setMarket(m)} style={{
              border: 'none', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
              background: market === m ? C.surface : 'transparent',
              color: market === m ? C.text : C.textMuted,
              boxShadow: market === m ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
            }}>{m === 'us' ? '美股 US' : '台股 TW'}</button>
          ))}
        </div>
      )}
      {route === 'analysis' && (
        <div style={{ display: 'inline-flex', background: C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${C.border}` }}>
          {[['w1', '1W'], ['w2', '2W'], ['m1', '1M'], ['q1', '1Q']].map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
              background: period === k ? C.surface : 'transparent',
              color: period === k ? C.text : C.textMuted,
              boxShadow: period === k ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
              fontFamily: 'var(--font-mono)',
            }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSubtle, fontFamily: 'var(--font-mono)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.up }} />
        LIVE · 更新於 {(() => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar.jsx**

From `v1-dense.jsx` lines 106-167. Add Episodes nav item.

```jsx
import { C } from '../constants.js';

export function Sidebar({ route, setRoute }) {
  const items = [
    { k: 'action', label: 'Action', sub: '決策', desc: '最新 4 集 · 該跟哪幾檔' },
    { k: 'analysis', label: 'Analysis', sub: '分析', desc: '歷史回測 · 命中率' },
    { k: 'episodes', label: 'Episodes', sub: '集數管理', desc: '掃描 · 處理 · 狀態' },
  ];
  return (
    <div style={{
      width: 220, background: C.surface, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ padding: '20px 18px 18px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: C.text, color: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>G</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Gooaye</div>
            <div style={{ fontSize: 10.5, color: C.textSubtle, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>MONITOR</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 10px' }}>
        <div style={{
          fontSize: 10, color: C.textSubtle, textTransform: 'uppercase',
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
              background: active ? C.text : 'transparent',
              color: active ? '#fff' : C.text,
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
        padding: '14px 18px', borderTop: `1px solid ${C.border}`,
        fontSize: 10.5, color: C.textSubtle, lineHeight: 1.5,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 4 }}>
          v1 · {new Date().toISOString().slice(0, 10)}
        </div>
        <div>合成資料原型 · 非投資建議</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DetailPanel.jsx**

Copy from `v1-dense.jsx` the `V1_DetailPanel` component (approximately lines 350-490). This is a large component — copy it exactly, changing only:
- Add `import { C, fmt, fmtPrice } from '../constants.js';`
- Add `import { Spark } from './shared/Spark.jsx';`
- Add `import { Pill } from './shared/Pill.jsx';`
- Add `import { Delta } from './shared/Delta.jsx';`
- Rename `V1_DetailPanel` → `DetailPanel`
- Replace `V1_C` → `C`, `V1_fmt` → `fmt`, `V1_fmtPrice` → `fmtPrice`
- Replace `V1_Spark` → `Spark`, `V1_Pill` → `Pill`, `V1_Delta` → `Delta`
- Add `export` to the function declaration

- [ ] **Step 4: Create TweaksPanel.jsx**

Copy from `v1-dense.jsx` the `V1_TweaksPanel` component (approximately lines 676-764). Same renaming pattern:
- Add `import { C, DEFAULT_CONFIG } from '../constants.js';`
- Rename `V1_TweaksPanel` → `TweaksPanel`, `V1_C` → `C`
- Add `export`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Header.jsx frontend/src/components/Sidebar.jsx frontend/src/components/DetailPanel.jsx frontend/src/components/TweaksPanel.jsx
git commit -m "feat: migrate layout components (Header, Sidebar, DetailPanel, TweaksPanel)"
```

---

## Task 9: Migrate ActionPage

**Files:**
- Create: `frontend/src/pages/ActionPage.jsx`

- [ ] **Step 1: Create ActionPage.jsx**

Copy the entire `v1-action.jsx` (459 lines) into `frontend/src/pages/ActionPage.jsx`. Apply these changes:

Top of file — add imports:
```jsx
import { useState } from 'react';
import { C, fmt, fmtPrice } from '../constants.js';
import { Pill } from '../components/shared/Pill.jsx';
```

Rename throughout:
- `V1A_computeExpected` → `computeExpected`
- `V1A_entryTiming` → `entryTiming`
- `V1A_fmtPrice` → `actionFmtPrice` (keep separate from shared fmtPrice since it has market-specific logic)
- `V1A_daysAgo` → `daysAgo`
- `V1A_ActionCard` → `ActionCard`
- `V1A_ActionPage` → `ActionPage`
- `V1_C` → `C`
- `V1_fmt` → `fmt`
- `V1_Pill` → `Pill`

Change data access: the component currently reads `window.GOOAYE_DATA`. Instead, accept `data` as a prop:
- `V1A_ActionPage({ market, config })` → `ActionPage({ market, config, data })`
- Replace `window.GOOAYE_DATA.episodes` → `data.episodes`
- Replace `window.GOOAYE_DATA.picks` → `data.picks`

Add `export` to `ActionPage`.

- [ ] **Step 2: Verify no remaining references to window or V1_ prefix**

Search the file for `window.` and `V1_` — there should be none.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ActionPage.jsx
git commit -m "feat: migrate ActionPage to ES module"
```

---

## Task 10: Migrate AnalysisPage

**Files:**
- Create: `frontend/src/pages/AnalysisPage.jsx`

- [ ] **Step 1: Create AnalysisPage.jsx**

This file combines components from both `v1-dense.jsx` (StatsBar, EpList, LatestEpisode, PicksTable, StrategyTable) and `v1-analytics.jsx` (CumulativeChart, ConfidenceBreakdown) into a single page module.

Top of file — add imports:
```jsx
import { useState } from 'react';
import { C, fmt, fmtPrice, PERIOD_DAYS } from '../constants.js';
import { Spark } from '../components/shared/Spark.jsx';
import { Pill } from '../components/shared/Pill.jsx';
import { Delta } from '../components/shared/Delta.jsx';
import { StatCard } from '../components/shared/StatCard.jsx';
```

Copy these components from `v1-dense.jsx` into this file (keeping them as non-exported local functions):
- `V1_StatsBar` → `StatsBar`
- `V1_EpList` → `EpList`
- `V1_LatestEpisode` → `LatestEpisode`
- `V1_PicksTable` → `PicksTable`
- `V1_StrategyTable` → `StrategyTable`

Copy these from `v1-analytics.jsx`:
- `V1_computeDelayed` → `computeDelayed`
- `V1_benchForPeriod` → `benchForPeriod`
- `V1_filterByConfidence` → `filterByConfidence`
- `V1_CumulativeChart` → `CumulativeChart`
- `V1_ConfidenceBreakdown` → `ConfidenceBreakdown`

Apply same renaming pattern: drop `V1_` prefix, replace `V1_C` → `C`, `V1_fmt` → `fmt`.

Create and export the page wrapper at the bottom:
```jsx
export function AnalysisPage({ data, market, period, config, selected, setSelected, activeEp, setActiveEp }) {
  const stats = data.stats[market] || {};
  const allPicks = data.picks || [];
  const episodes = data.episodes || [];
  const marketPicks = allPicks.filter(p => p.market === market);

  return (
    <>
      <StatsBar stats={stats} market={market} period={period} />
      <EpList episodes={episodes} picks={allPicks} market={market} onPickEp={setActiveEp} activeEp={activeEp} />
      <LatestEpisode ep={episodes[0]} picks={marketPicks.filter(p => p.ep === episodes[0]?.ep)} period={period} market={market} onSelect={setSelected} />
      <PicksTable picks={marketPicks} episodes={episodes} period={period} market={market} onSelect={setSelected} selected={selected} />
      <StrategyTable episodes={episodes} picks={allPicks} market={market} period={period} config={config} />
      <CumulativeChart episodes={episodes} picks={allPicks} market={market} period={period} config={config} />
      <ConfidenceBreakdown episodes={episodes} picks={allPicks} market={market} period={period} config={config} />
    </>
  );
}
```

Note: The exact rendering order and props should match the current `V1_App` analysis rendering block in `v1-dense.jsx` (lines ~790-815).

- [ ] **Step 2: Verify no remaining references to window or V1_ prefix**

Search the file for `window.` and `V1_` — there should be none.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AnalysisPage.jsx
git commit -m "feat: migrate AnalysisPage with all sub-components to ES module"
```

---

## Task 11: Create EpisodesPage

**Files:**
- Create: `frontend/src/pages/EpisodesPage.jsx`

- [ ] **Step 1: Create EpisodesPage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { C } from '../constants.js';
import { StatCard } from '../components/shared/StatCard.jsx';

export function EpisodesPage() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchEpisodes = async () => {
    try {
      const res = await fetch('/api/episodes');
      const data = await res.json();
      setEpisodes(data.episodes);
      setError(null);
    } catch {
      setError('無法連線到 API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEpisodes(); }, []);

  const handleScan = async () => {
    setScanning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();
      setMessage(data.total_new > 0
        ? `找到 ${data.total_new} 個新集數`
        : '沒有找到新集數');
      await fetchEpisodes();
    } catch {
      setMessage('掃描失敗');
    } finally {
      setScanning(false);
    }
  };

  const handleProcess = async (ep) => {
    setProcessing(ep);
    setMessage(null);
    try {
      const res = await fetch(`/api/process/${ep}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(`EP${ep} 處理完成`);
      } else {
        setMessage(`EP${ep} 處理失敗: ${data.error}`);
      }
      await fetchEpisodes();
    } catch {
      setMessage(`EP${ep} 處理失敗`);
    } finally {
      setProcessing(null);
    }
  };

  const completed = episodes.filter(e => e.status === 'completed').length;
  const pending = episodes.length - completed;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>{error}</div>
        <button onClick={fetchEpisodes} style={{
          border: `1px solid ${C.border}`, background: C.surface, padding: '6px 16px',
          borderRadius: 6, cursor: 'pointer', fontSize: 12, color: C.text,
        }}>重試</button>
      </div>
    );
  }

  return (
    <div>
      {/* Top action bar */}
      <div style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {message && (
            <span style={{
              fontSize: 12, color: message.includes('失敗') ? C.down : C.up,
              background: message.includes('失敗') ? C.downBg : C.upBg,
              padding: '4px 10px', borderRadius: 4,
            }}>{message}</span>
          )}
        </div>
        <button onClick={handleScan} disabled={scanning} style={{
          border: 'none', background: C.text, color: '#fff',
          padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: scanning ? 'default' : 'pointer', opacity: scanning ? 0.6 : 1,
          fontFamily: 'var(--font-sans)',
        }}>
          {scanning ? '掃描中...' : '掃描新集數'}
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface,
      }}>
        <StatCard label="總集數" value={loading ? '—' : episodes.length} />
        <StatCard label="已完成" value={loading ? '—' : completed} sub={null} />
        <StatCard label="待處理" value={loading ? '—' : pending}
          sub={pending > 0 ? '需要處理' : null} subKind={pending > 0 ? 'down' : null} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          載入中...
        </div>
      ) : (
        <div style={{ background: C.surface }}>
          {/* Table header */}
          <div style={{
            display: 'flex', padding: '10px 24px', background: C.surfaceAlt,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10.5, fontWeight: 600, color: C.textSubtle,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <div style={{ width: 70 }}>集數</div>
            <div style={{ flex: 1 }}>標題</div>
            <div style={{ width: 80, textAlign: 'center' }}>日期</div>
            <div style={{ width: 50, textAlign: 'center' }}>STT</div>
            <div style={{ width: 50, textAlign: 'center' }}>股票</div>
            <div style={{ width: 50, textAlign: 'center' }}>績效</div>
            <div style={{ width: 80, textAlign: 'center' }}>操作</div>
          </div>

          {/* Table rows */}
          {episodes.map((ep, i) => (
            <div key={ep.ep} style={{
              display: 'flex', padding: '12px 24px', alignItems: 'center',
              borderBottom: `1px solid ${C.border}`,
              background: i % 2 === 0 ? C.surface : C.surfaceAlt,
            }}>
              <div style={{
                width: 70, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: C.text, fontSize: 13,
              }}>EP{ep.ep}</div>
              <div style={{
                flex: 1, fontSize: 12, color: C.textMuted,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                paddingRight: 12,
              }}>{ep.title}</div>
              <div style={{
                width: 80, textAlign: 'center', fontSize: 11,
                fontFamily: 'var(--font-mono)', color: C.textSubtle,
              }}>{ep.date?.slice(5)}</div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13 }}>
                {ep.has_transcript
                  ? <span style={{ color: C.up }}>✓</span>
                  : <span style={{ color: C.warn }}>✗</span>}
              </div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13 }}>
                {ep.picks_count > 0
                  ? <span style={{ color: C.up }}>{ep.picks_count}</span>
                  : ep.has_transcript
                    ? <span style={{ color: C.warn }}>✗</span>
                    : <span style={{ color: C.textSubtle }}>—</span>}
              </div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13 }}>
                {ep.has_prices
                  ? <span style={{ color: C.up }}>✓</span>
                  : ep.picks_count > 0
                    ? <span style={{ color: C.warn }}>✗</span>
                    : <span style={{ color: C.textSubtle }}>—</span>}
              </div>
              <div style={{ width: 80, textAlign: 'center' }}>
                {ep.status === 'completed' ? (
                  <span style={{ color: C.up, fontSize: 11, fontWeight: 600 }}>完成</span>
                ) : (
                  <button
                    onClick={() => handleProcess(ep.ep)}
                    disabled={processing !== null}
                    style={{
                      border: 'none', borderRadius: 4, padding: '4px 12px',
                      fontSize: 11, fontWeight: 600, cursor: processing !== null ? 'default' : 'pointer',
                      background: processing === ep.ep ? C.surfaceAlt : C.accent,
                      color: processing === ep.ep ? C.textMuted : '#fff',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {processing === ep.ep ? '處理中...' : '處理'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {episodes.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              尚無集數資料，請先掃描新集數
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/EpisodesPage.jsx
git commit -m "feat: create EpisodesPage with scan and process functionality"
```

---

## Task 12: Create App.jsx — Root Component with API Data Fetching

**Files:**
- Create: `frontend/src/App.jsx`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Create App.jsx**

This replaces `V1_App` from `v1-dense.jsx`. Key changes:
- Data comes from `fetch('/api/data')` instead of `window.GOOAYE_DATA`
- Adds `'episodes'` route
- Uses ES module imports

```jsx
import { useState, useEffect } from 'react';
import { C, DEFAULT_CONFIG } from './constants.js';
import { Header } from './components/Header.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { DetailPanel } from './components/DetailPanel.jsx';
import { TweaksPanel } from './components/TweaksPanel.jsx';
import { ActionPage } from './pages/ActionPage.jsx';
import { AnalysisPage } from './pages/AnalysisPage.jsx';
import { EpisodesPage } from './pages/EpisodesPage.jsx';

export default function App() {
  const [market, setMarket] = useState('us');
  const [period, setPeriod] = useState('q1');
  const [selected, setSelected] = useState(null);
  const [activeEp, setActiveEp] = useState(null);
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [route, setRoute] = useState(() => localStorage.getItem('gooaye_route') || 'action');
  const [data, setData] = useState({ episodes: [], picks: [], stats: { us: {}, tw: {} } });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => { setData(d); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, []);

  useEffect(() => { localStorage.setItem('gooaye_route', route); }, [route]);

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'gooaye-tweaks') setTweaksVisible(v => !v);
      if (e.data?.type === 'gooaye-set-config') setConfig(c => ({ ...c, ...e.data.payload }));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        setTweaksVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const episodes = data.episodes || [];
  const allPicks = data.picks || [];
  const selectedPick = selected ? allPicks.find(p => p.ticker === selected && p.market === market) : null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar route={route} setRoute={setRoute} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header market={market} setMarket={setMarket} period={period} setPeriod={setPeriod} route={route} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {dataLoading && route !== 'episodes' ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>載入中...</div>
          ) : route === 'action' ? (
            <ActionPage market={market} config={config} data={data} />
          ) : route === 'analysis' ? (
            <AnalysisPage
              data={data} market={market} period={period} config={config}
              selected={selected} setSelected={setSelected}
              activeEp={activeEp} setActiveEp={setActiveEp}
            />
          ) : route === 'episodes' ? (
            <EpisodesPage />
          ) : null}
        </div>
      </div>
      {selectedPick && (
        <DetailPanel pick={selectedPick} episodes={episodes} onClose={() => setSelected(null)} />
      )}
      <TweaksPanel config={config} setConfig={setConfig} visible={tweaksVisible} />
    </div>
  );
}
```

- [ ] **Step 2: Update main.jsx**

Replace `frontend/src/main.jsx`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx frontend/src/main.jsx
git commit -m "feat: create App root component with API data fetching and route management"
```

---

## Task 13: Add Static File Serving to FastAPI

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Add static file mounting for production**

Add to the bottom of `backend/server.py`:

```python
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if _frontend_dist.exists():
    @app.get("/{path:path}")
    def serve_spa(path: str):
        file = _frontend_dist / path
        if file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(_frontend_dist / "index.html")
```

- [ ] **Step 2: Verify API routes still work (not shadowed by SPA catch-all)**

Run: `cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/test_server.py -v`
Expected: All tests PASS (API routes registered before catch-all)

- [ ] **Step 3: Commit**

```bash
git add backend/server.py
git commit -m "feat: serve frontend dist as SPA with catch-all fallback"
```

---

## Task 14: Build and Integration Test

**Files:**
- No new files

- [ ] **Step 1: Build frontend**

```bash
cd /Users/yushao/claude_workspace/gooaye/frontend && npm run build
```

Expected: `frontend/dist/` created with `index.html` and JS bundles, no build errors.

- [ ] **Step 2: Start backend server**

```bash
cd /Users/yushao/claude_workspace/gooaye && python run.py --port 5001 &
sleep 2
```

- [ ] **Step 3: Verify API endpoints**

```bash
curl -s http://localhost:5001/api/episodes | python -m json.tool | head -10
curl -s http://localhost:5001/api/data | python -m json.tool | head -10
```

Expected: JSON responses with episode and data structures.

- [ ] **Step 4: Verify frontend is served**

```bash
curl -s http://localhost:5001/ | head -5
```

Expected: HTML with `<div id="root">`.

- [ ] **Step 5: Browser test — open http://localhost:5001 in browser**

Verify with Playwright MCP:
1. Navigate to http://localhost:5001
2. Verify sidebar shows 3 navigation items (Action, Analysis, Episodes)
3. Click "Episodes" nav item
4. Verify Episodes page loads with table headers
5. Click "Action" — verify Action page renders
6. Click "Analysis" — verify Analysis page renders

- [ ] **Step 6: Kill the background server**

```bash
kill %1
```

- [ ] **Step 7: Run all backend tests**

```bash
cd /Users/yushao/claude_workspace/gooaye && python -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 8: Commit build artifacts update to .gitignore if needed**

Verify `frontend/dist` is in `.gitignore`. If not, add it.

---

## Task 15: Cleanup Old Frontend Files

**Files:**
- Remove: `index.html` (root level — replaced by `frontend/index.html`)
- Remove: `v1-dense.jsx`
- Remove: `v1-action.jsx`
- Remove: `v1-analytics.jsx`
- Remove: `data.js`

- [ ] **Step 1: Verify new frontend works completely before removing old files**

Open http://localhost:5001 in browser. Navigate all 3 pages. Verify:
- Action page shows stock picks (or empty state)
- Analysis page shows charts and tables
- Episodes page shows episode list

- [ ] **Step 2: Remove old frontend files**

```bash
cd /Users/yushao/claude_workspace/gooaye
git rm index.html v1-dense.jsx v1-action.jsx v1-analytics.jsx data.js
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove old CDN-based frontend files (replaced by Vite app)"
```

---

## Summary

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1 | FastAPI + /api/episodes | 10 min |
| 2 | /api/scan | 5 min |
| 3 | /api/process/{ep} | 10 min |
| 4 | /api/data | 5 min |
| 5 | Update run.py | 5 min |
| 6 | Vite scaffold | 10 min |
| 7 | Shared components | 10 min |
| 8 | Layout components | 15 min |
| 9 | ActionPage migration | 10 min |
| 10 | AnalysisPage migration | 15 min |
| 11 | EpisodesPage (new) | 10 min |
| 12 | App.jsx root | 10 min |
| 13 | Static file serving | 5 min |
| 14 | Build + integration test | 15 min |
| 15 | Cleanup old files | 5 min |
| **Total** | | **~140 min** |
