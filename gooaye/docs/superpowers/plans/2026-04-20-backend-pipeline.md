# Backend Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mock data in `data.js` with a real pipeline: RSS → STT → LLM extraction → price backtest → auto-generated `data.js`.

**Architecture:** Python backend with 5-stage pipeline (rss → transcribe → extract → prices → generate), SQLite for persistence, daily scheduler at 18:00 TST. Each stage is independently testable via `python -m backend.<module>`.

**Tech Stack:** Python 3.11+, feedparser, requests, openai (Azure), yfinance, SQLite3, schedule, python-dotenv, pytest

---

## File Structure

```
gooaye/
├── backend/
│   ├── __init__.py           # Empty package marker
│   ├── config.py             # Env vars, paths, constants
│   ├── db.py                 # SQLite schema + CRUD
│   ├── ticker_map.py         # Chinese name ↔ ticker lookup
│   ├── rss.py                # RSS parse, new-episode detect, MP3 download
│   ├── transcribe.py         # DeepQ STT API call
│   ├── extract.py            # Azure OpenAI stock extraction
│   ├── prices.py             # yfinance price fetch + returns calc
│   ├── generate.py           # DB → data.js output
│   └── pipeline.py           # Orchestrate steps 1-5
├── tests/
│   ├── conftest.py           # Shared fixtures (tmp DB, monkeypatch)
│   ├── test_config.py
│   ├── test_db.py
│   ├── test_ticker_map.py
│   ├── test_rss.py
│   ├── test_transcribe.py
│   ├── test_extract.py
│   ├── test_prices.py
│   └── test_generate.py
├── data/
│   ├── gooaye.db             # SQLite (auto-created)
│   └── audio/                # MP3 temp storage
├── .env.example
├── requirements.txt
└── run.py                    # Entry: scheduler or --now
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `backend/__init__.py`
- Create: `.env.example`
- Create: `requirements.txt`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend tests data/audio
```

- [ ] **Step 2: Create backend/__init__.py**

```bash
touch backend/__init__.py
```

- [ ] **Step 3: Create tests/__init__.py**

```bash
touch tests/__init__.py
```

- [ ] **Step 4: Create .env.example**

```env
# DeepQ STT
STT_API_URL=https://llminternal-dev.deepq.ai:50500/v1/audio/transcriptions
STT_API_KEY=

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_MODEL=gpt-4.1-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Podcast RSS
RSS_URL=

# Schedule (24h format, TST)
SCHEDULE_TIME=18:00
```

- [ ] **Step 5: Create requirements.txt**

```
requests
openai
yfinance
feedparser
schedule
python-dotenv
pytest
```

- [ ] **Step 6: Create tests/conftest.py**

```python
import pytest
from pathlib import Path


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("backend.config.DB_PATH", db_path)
    monkeypatch.setattr("backend.config.AUDIO_DIR", tmp_path / "audio")
    (tmp_path / "audio").mkdir()
    from backend import db
    db.init_db()
    return db_path
```

- [ ] **Step 7: Install dependencies and verify**

```bash
pip install -r requirements.txt
python -c "import feedparser, yfinance, openai, schedule, dotenv; print('OK')"
```

Expected: `OK`

- [ ] **Step 8: Commit**

```bash
git add backend/__init__.py tests/__init__.py tests/conftest.py .env.example requirements.txt
git commit -m "feat: scaffold backend project structure"
```

---

### Task 2: Configuration Module

**Files:**
- Create: `backend/config.py`
- Create: `tests/test_config.py`

- [ ] **Step 1: Write the failing test**

`tests/test_config.py`:

```python
def test_config_loads_defaults():
    from backend import config

    assert config.STT_API_URL == "https://llminternal-dev.deepq.ai:50500/v1/audio/transcriptions"
    assert config.AZURE_OPENAI_MODEL == "gpt-4.1-mini"
    assert config.SCHEDULE_TIME == "18:00"
    assert config.DB_PATH.name == "gooaye.db"
    assert config.AUDIO_DIR.name == "audio"
    assert config.DATA_JS_PATH.name == "data.js"


def test_config_paths_are_absolute():
    from backend import config

    assert config.DB_PATH.is_absolute()
    assert config.AUDIO_DIR.is_absolute()
    assert config.DATA_JS_PATH.is_absolute()
    assert config.BASE_DIR.is_absolute()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_config.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'backend.config'`

- [ ] **Step 3: Implement config.py**

`backend/config.py`:

```python
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# DeepQ STT
STT_API_URL = os.getenv(
    "STT_API_URL",
    "https://llminternal-dev.deepq.ai:50500/v1/audio/transcriptions",
)
STT_API_KEY = os.getenv("STT_API_KEY", "")

# Azure OpenAI
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL", "gpt-4.1-mini")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

# Podcast RSS
RSS_URL = os.getenv("RSS_URL", "")

# Schedule
SCHEDULE_TIME = os.getenv("SCHEDULE_TIME", "18:00")

# Paths
DB_PATH = BASE_DIR / "data" / "gooaye.db"
AUDIO_DIR = BASE_DIR / "data" / "audio"
DATA_JS_PATH = BASE_DIR / "data.js"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_config.py -v
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/config.py tests/test_config.py
git commit -m "feat: add configuration module with env var loading"
```

---

### Task 3: Database Layer

**Files:**
- Create: `backend/db.py`
- Create: `tests/test_db.py`

- [ ] **Step 1: Write failing tests for schema init and episode CRUD**

`tests/test_db.py`:

```python
import json
from backend import db


def test_init_db_creates_tables(tmp_db):
    import sqlite3

    conn = sqlite3.connect(tmp_db)
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    table_names = {t[0] for t in tables}
    assert "episodes" in table_names
    assert "picks" in table_names
    conn.close()


def test_insert_and_get_episode(tmp_db):
    db.insert_episode(
        ep=542,
        title="測試標題",
        date="2026-04-14",
        duration="1:42:18",
        rss_url="https://example.com/ep542.mp3",
    )
    episode = db.get_episode(542)
    assert episode["ep"] == 542
    assert episode["title"] == "測試標題"
    assert episode["date"] == "2026-04-14"
    assert episode["duration"] == "1:42:18"


def test_episode_exists(tmp_db):
    assert db.episode_exists(542) is False
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    assert db.episode_exists(542) is True


def test_update_transcript(tmp_db):
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    segments = [{"start": 0.0, "end": 1.5, "text": "哈囉"}]
    db.update_episode_transcript(542, json.dumps(segments))
    episode = db.get_episode(542)
    assert json.loads(episode["transcript"]) == segments


def test_update_market_focus(tmp_db):
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_market_focus(542, "us")
    episode = db.get_episode(542)
    assert episode["market_focus"] == "us"


def test_insert_and_get_picks(tmp_db):
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.insert_pick(
        ep=542,
        ticker="AVGO",
        name="Broadcom",
        market="us",
        confidence="doing",
        sector="ASIC",
        quote="博通這段我還抱著",
        segment_start=120.5,
        segment_end=135.2,
    )
    picks = db.get_picks_for_episode(542)
    assert len(picks) == 1
    assert picks[0]["ticker"] == "AVGO"
    assert picks[0]["confidence"] == "doing"
    assert picks[0]["segment_start"] == 120.5


def test_insert_pick_upsert(tmp_db):
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us", confidence="doing")
    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us", confidence="watching")
    picks = db.get_picks_for_episode(542)
    assert len(picks) == 1
    assert picks[0]["confidence"] == "watching"


def test_update_pick_prices(tmp_db):
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us", confidence="doing")
    db.update_pick_prices(
        ep=542,
        ticker="AVGO",
        entry=1842.5,
        w1=2.8,
        w2=4.1,
        m1=7.3,
        q1=18.2,
        bench_q1=3.1,
        sparkline=json.dumps([1842, 1851, 1868]),
        status="backfilling",
    )
    picks = db.get_picks_for_episode(542)
    assert picks[0]["entry"] == 1842.5
    assert picks[0]["w1"] == 2.8
    assert picks[0]["status"] == "backfilling"


def test_get_pending_picks(tmp_db):
    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us", confidence="doing")
    db.insert_pick(ep=542, ticker="ARM", name="Arm", market="us", confidence="watching")
    db.update_pick_prices(ep=542, ticker="AVGO", status="completed")
    pending = db.get_pending_picks()
    assert len(pending) == 1
    assert pending[0]["ticker"] == "ARM"


def test_get_latest_episodes(tmp_db):
    for i in range(15):
        db.insert_episode(ep=530 + i, title=f"EP{530+i}", date=f"2026-03-{10+i}")
    episodes = db.get_latest_episodes(10)
    assert len(episodes) == 10
    assert episodes[0]["ep"] == 544
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_db.py -v
```

Expected: FAIL — `cannot import name 'db' from 'backend'`

- [ ] **Step 3: Implement db.py**

`backend/db.py`:

```python
import json
import sqlite3
from backend import config


def _connect():
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS episodes (
            ep          INTEGER PRIMARY KEY,
            title       TEXT NOT NULL,
            date        TEXT NOT NULL,
            duration    TEXT,
            market_focus TEXT,
            rss_url     TEXT,
            audio_path  TEXT,
            transcript  TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS picks (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ep            INTEGER NOT NULL REFERENCES episodes(ep),
            ticker        TEXT NOT NULL,
            name          TEXT NOT NULL,
            market        TEXT NOT NULL,
            confidence    TEXT NOT NULL,
            sector        TEXT,
            quote         TEXT,
            segment_start REAL,
            segment_end   REAL,
            entry         REAL,
            w1 REAL, w2 REAL, m1 REAL, q1 REAL,
            bench_q1      REAL,
            sparkline     TEXT,
            status        TEXT DEFAULT 'pending',
            created_at    TEXT DEFAULT (datetime('now')),
            UNIQUE(ep, ticker)
        );
    """)
    conn.close()


def episode_exists(ep):
    conn = _connect()
    row = conn.execute("SELECT 1 FROM episodes WHERE ep = ?", (ep,)).fetchone()
    conn.close()
    return row is not None


def insert_episode(ep, title, date, duration=None, rss_url=None):
    conn = _connect()
    conn.execute(
        "INSERT OR IGNORE INTO episodes (ep, title, date, duration, rss_url) VALUES (?, ?, ?, ?, ?)",
        (ep, title, date, duration, rss_url),
    )
    conn.commit()
    conn.close()


def get_episode(ep):
    conn = _connect()
    row = conn.execute("SELECT * FROM episodes WHERE ep = ?", (ep,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_episode_transcript(ep, transcript_json):
    conn = _connect()
    conn.execute("UPDATE episodes SET transcript = ? WHERE ep = ?", (transcript_json, ep))
    conn.commit()
    conn.close()


def update_episode_market_focus(ep, market_focus):
    conn = _connect()
    conn.execute("UPDATE episodes SET market_focus = ? WHERE ep = ?", (market_focus, ep))
    conn.commit()
    conn.close()


def update_episode_audio_path(ep, audio_path):
    conn = _connect()
    conn.execute("UPDATE episodes SET audio_path = ? WHERE ep = ?", (str(audio_path), ep))
    conn.commit()
    conn.close()


def insert_pick(ep, ticker, name, market, confidence, sector=None, quote=None,
                segment_start=None, segment_end=None):
    conn = _connect()
    conn.execute("""
        INSERT INTO picks (ep, ticker, name, market, confidence, sector, quote, segment_start, segment_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ep, ticker) DO UPDATE SET
            name=excluded.name, market=excluded.market, confidence=excluded.confidence,
            sector=excluded.sector, quote=excluded.quote,
            segment_start=excluded.segment_start, segment_end=excluded.segment_end
    """, (ep, ticker, name, market, confidence, sector, quote, segment_start, segment_end))
    conn.commit()
    conn.close()


def update_pick_prices(ep, ticker, entry=None, w1=None, w2=None, m1=None, q1=None,
                       bench_q1=None, sparkline=None, status=None):
    conn = _connect()
    fields = []
    values = []
    for col, val in [("entry", entry), ("w1", w1), ("w2", w2), ("m1", m1), ("q1", q1),
                     ("bench_q1", bench_q1), ("sparkline", sparkline), ("status", status)]:
        if val is not None:
            fields.append(f"{col} = ?")
            values.append(val)
    if fields:
        values.extend([ep, ticker])
        conn.execute(
            f"UPDATE picks SET {', '.join(fields)} WHERE ep = ? AND ticker = ?",
            values,
        )
        conn.commit()
    conn.close()


def get_picks_for_episode(ep):
    conn = _connect()
    rows = conn.execute("SELECT * FROM picks WHERE ep = ? ORDER BY id", (ep,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_picks_for_episodes(ep_list):
    if not ep_list:
        return []
    conn = _connect()
    placeholders = ",".join("?" * len(ep_list))
    rows = conn.execute(
        f"SELECT * FROM picks WHERE ep IN ({placeholders}) ORDER BY ep DESC, id",
        ep_list,
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_pending_picks():
    conn = _connect()
    rows = conn.execute(
        "SELECT p.*, e.date as mention_date FROM picks p JOIN episodes e ON p.ep = e.ep "
        "WHERE p.status != 'completed' ORDER BY e.date DESC",
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_latest_episodes(n=10):
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM episodes ORDER BY ep DESC LIMIT ?", (n,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_db.py -v
```

Expected: all 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/db.py tests/test_db.py
git commit -m "feat: add SQLite database layer with episode and pick CRUD"
```

---

### Task 4: Ticker Map

**Files:**
- Create: `backend/ticker_map.py`
- Create: `tests/test_ticker_map.py`

- [ ] **Step 1: Write failing tests**

`tests/test_ticker_map.py`:

```python
from backend import ticker_map


def test_lookup_chinese_name():
    result = ticker_map.lookup("博通")
    assert result == ("AVGO", "Broadcom", "us")


def test_lookup_english_name():
    result = ticker_map.lookup("Broadcom")
    assert result == ("AVGO", "Broadcom", "us")


def test_lookup_tw_stock():
    result = ticker_map.lookup("台積電")
    assert result == ("2330", "台積電", "tw")


def test_lookup_not_found():
    result = ticker_map.lookup("不存在的公司")
    assert result is None


def test_lookup_by_ticker():
    result = ticker_map.lookup_by_ticker("AVGO")
    assert result == ("AVGO", "Broadcom", "us")


def test_lookup_by_ticker_tw():
    result = ticker_map.lookup_by_ticker("2330")
    assert result == ("2330", "台積電", "tw")


def test_add_unknown():
    ticker_map.add("新公司", "NEWCO", "New Company", "us")
    result = ticker_map.lookup("新公司")
    assert result == ("NEWCO", "New Company", "us")


def test_get_all_names():
    names = ticker_map.get_all_names()
    assert "博通" in names
    assert "Broadcom" in names
    assert "台積電" in names
    assert len(names) > 20


def test_get_all_tickers():
    tickers = ticker_map.get_all_tickers()
    assert "AVGO" in tickers
    assert "2330" in tickers
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_ticker_map.py -v
```

Expected: FAIL — `cannot import name 'ticker_map' from 'backend'`

- [ ] **Step 3: Implement ticker_map.py**

`backend/ticker_map.py`:

```python
import logging

logger = logging.getLogger(__name__)

TICKER_MAP = {
    # US - ASIC
    "博通": ("AVGO", "Broadcom", "us"),
    "Broadcom": ("AVGO", "Broadcom", "us"),
    "AVGO": ("AVGO", "Broadcom", "us"),
    "Marvell": ("MRVL", "Marvell Tech", "us"),
    "MRVL": ("MRVL", "Marvell Tech", "us"),
    "Credo": ("CRDO", "Credo Tech", "us"),
    "CRDO": ("CRDO", "Credo Tech", "us"),
    # US - CPU-IP
    "Arm": ("ARM", "Arm Holdings", "us"),
    "ARM": ("ARM", "Arm Holdings", "us"),
    # US - Semi-equip
    "Applied Materials": ("AMAT", "Applied Materials", "us"),
    "AMAT": ("AMAT", "Applied Materials", "us"),
    "KLA": ("KLAC", "KLA Corp", "us"),
    "KLAC": ("KLAC", "KLA Corp", "us"),
    "Lam Research": ("LRCX", "Lam Research", "us"),
    "Lam": ("LRCX", "Lam Research", "us"),
    "LRCX": ("LRCX", "Lam Research", "us"),
    # US - Power
    "Vistra": ("VST", "Vistra Corp", "us"),
    "VST": ("VST", "Vistra Corp", "us"),
    "Talen": ("TLN", "Talen Energy", "us"),
    "TLN": ("TLN", "Talen Energy", "us"),
    "Constellation": ("CEG", "Constellation Energy", "us"),
    "CEG": ("CEG", "Constellation Energy", "us"),
    # US - EV-Robotics
    "Tesla": ("TSLA", "Tesla", "us"),
    "特斯拉": ("TSLA", "Tesla", "us"),
    "TSLA": ("TSLA", "Tesla", "us"),
    "Serve Robotics": ("SERV", "Serve Robotics", "us"),
    "SERV": ("SERV", "Serve Robotics", "us"),
    # US - Quantum
    "IonQ": ("IONQ", "IonQ", "us"),
    "IONQ": ("IONQ", "IonQ", "us"),
    "Rigetti": ("RGTI", "Rigetti Computing", "us"),
    "RGTI": ("RGTI", "Rigetti Computing", "us"),
    # TW - Semi-foundry
    "台積電": ("2330", "台積電", "tw"),
    "TSMC": ("2330", "台積電", "tw"),
    # TW - ASIC
    "世芯": ("3661", "世芯-KY", "tw"),
    "創意": ("3443", "創意", "tw"),
    "智原": ("3035", "智原", "tw"),
    # TW - Optics
    "大立光": ("3008", "大立光", "tw"),
    "穩懋": ("3105", "穩懋", "tw"),
    # TW - CPU-IP
    "晶心科": ("6533", "晶心科", "tw"),
    # TW - Cooling
    "奇鋐": ("3017", "奇鋐", "tw"),
    "健策": ("3653", "健策", "tw"),
    "雙鴻": ("3324", "雙鴻", "tw"),
    # TW - Connector
    "信音": ("6126", "信音", "tw"),
    # TW - Financial
    "富邦金": ("2881", "富邦金", "tw"),
    "開發金": ("2883", "開發金", "tw"),
}

_TICKER_REVERSE = {}


def _rebuild_reverse():
    _TICKER_REVERSE.clear()
    for _name, (ticker, display_name, market) in TICKER_MAP.items():
        if ticker not in _TICKER_REVERSE:
            _TICKER_REVERSE[ticker] = (ticker, display_name, market)


_rebuild_reverse()


def lookup(name):
    return TICKER_MAP.get(name)


def lookup_by_ticker(ticker):
    return _TICKER_REVERSE.get(ticker)


def add(name, ticker, display_name, market):
    TICKER_MAP[name] = (ticker, display_name, market)
    _TICKER_REVERSE[ticker] = (ticker, display_name, market)
    logger.warning("未知股票: %s (%s) — auto-added to ticker_map", name, ticker)


def get_all_names():
    return list(TICKER_MAP.keys())


def get_all_tickers():
    return list(_TICKER_REVERSE.keys())
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_ticker_map.py -v
```

Expected: all 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/ticker_map.py tests/test_ticker_map.py
git commit -m "feat: add ticker map for Chinese name ↔ ticker lookup"
```

---

### Task 5: RSS Module

**Files:**
- Create: `backend/rss.py`
- Create: `tests/test_rss.py`

- [ ] **Step 1: Write failing tests**

`tests/test_rss.py`:

```python
import json
from unittest.mock import patch, MagicMock
from backend import rss

SAMPLE_RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>股癌 Gooaye</title>
  <item>
    <title>EP542 | 關稅陰影下的轉單邏輯</title>
    <pubDate>Mon, 14 Apr 2026 00:00:00 +0800</pubDate>
    <itunes:duration>1:42:18</itunes:duration>
    <enclosure url="https://example.com/ep542.mp3" type="audio/mpeg" length="12345"/>
  </item>
  <item>
    <title>EP541 | 財報季前的佈局</title>
    <pubDate>Thu, 10 Apr 2026 00:00:00 +0800</pubDate>
    <itunes:duration>1:28:44</itunes:duration>
    <enclosure url="https://example.com/ep541.mp3" type="audio/mpeg" length="12345"/>
  </item>
</channel>
</rss>"""


def test_parse_ep_number():
    assert rss.parse_ep_number("EP542 | 關稅陰影下的轉單邏輯") == 542
    assert rss.parse_ep_number("Ep 541 | 財報季前的佈局") == 541
    assert rss.parse_ep_number("ep543｜測試") == 543
    assert rss.parse_ep_number("沒有集數的標題") is None


def test_parse_date():
    assert rss.parse_date("Mon, 14 Apr 2026 00:00:00 +0800") == "2026-04-14"
    assert rss.parse_date("Thu, 10 Apr 2026 12:00:00 GMT") == "2026-04-10"


@patch("backend.rss.feedparser.parse")
def test_check_new_finds_new_episodes(mock_parse, tmp_db):
    import feedparser
    mock_parse.return_value = feedparser.parse(SAMPLE_RSS_XML)

    new = rss.check_new()
    assert len(new) == 2
    assert new[0]["ep"] == 542
    assert new[0]["title"] == "EP542 | 關稅陰影下的轉單邏輯"
    assert new[0]["date"] == "2026-04-14"


@patch("backend.rss.feedparser.parse")
def test_check_new_skips_existing(mock_parse, tmp_db):
    import feedparser
    from backend import db
    mock_parse.return_value = feedparser.parse(SAMPLE_RSS_XML)

    db.insert_episode(ep=542, title="已存在", date="2026-04-14")
    new = rss.check_new()
    assert len(new) == 1
    assert new[0]["ep"] == 541


@patch("backend.rss.requests.get")
def test_download_audio(mock_get, tmp_db):
    mock_resp = MagicMock()
    mock_resp.iter_content = MagicMock(return_value=[b"fake-mp3-data"])
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    from backend import config
    path = rss.download_audio(542, "https://example.com/ep542.mp3")
    assert path.exists()
    assert path.name == "EP542.mp3"
    assert path.read_bytes() == b"fake-mp3-data"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_rss.py -v
```

Expected: FAIL — `cannot import name 'rss' from 'backend'`

- [ ] **Step 3: Implement rss.py**

`backend/rss.py`:

```python
import logging
import re
from email.utils import parsedate_to_datetime

import feedparser
import requests

from backend import config, db

logger = logging.getLogger(__name__)


def parse_ep_number(title):
    m = re.search(r"[Ee][Pp]\s*(\d+)", title)
    return int(m.group(1)) if m else None


def parse_date(date_str):
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return date_str[:10]


def check_new():
    if not config.RSS_URL:
        logger.error("RSS_URL not configured")
        return []

    feed = feedparser.parse(config.RSS_URL)
    new_episodes = []

    for entry in feed.entries:
        ep = parse_ep_number(entry.get("title", ""))
        if ep is None:
            continue
        if db.episode_exists(ep):
            continue

        date = parse_date(entry.get("published", ""))
        duration = entry.get("itunes_duration", "")
        audio_url = ""
        if hasattr(entry, "enclosures") and entry.enclosures:
            audio_url = entry.enclosures[0].get("href", "")

        new_episodes.append({
            "ep": ep,
            "title": entry.title,
            "date": date,
            "duration": duration,
            "rss_url": audio_url,
        })

    new_episodes.sort(key=lambda x: x["ep"])
    logger.info("Found %d new episode(s)", len(new_episodes))
    return new_episodes


def download_audio(ep, audio_url):
    config.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    path = config.AUDIO_DIR / f"EP{ep}.mp3"

    logger.info("Downloading EP%d → %s", ep, path)
    resp = requests.get(audio_url, stream=True)
    resp.raise_for_status()

    with open(path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    db.update_episode_audio_path(ep, path)
    return path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    episodes = check_new()
    for ep_info in episodes:
        print(f"EP{ep_info['ep']}: {ep_info['title']} ({ep_info['date']})")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_rss.py -v
```

Expected: all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/rss.py tests/test_rss.py
git commit -m "feat: add RSS module for podcast episode detection and download"
```

---

### Task 6: Transcription Module

**Files:**
- Create: `backend/transcribe.py`
- Create: `tests/test_transcribe.py`

- [ ] **Step 1: Write failing tests**

`tests/test_transcribe.py`:

```python
import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend import transcribe, db

SAMPLE_STT_RESPONSE = {
    "language": "zh",
    "language_prob": 0.95,
    "duration": 6138.5,
    "duration_after_vad": 5842.1,
    "segments": [
        {"start": 0.0, "end": 3.2, "text": "哈囉大家好歡迎回來股癌", "speaker": "SPEAKER_00"},
        {"start": 3.2, "end": 8.5, "text": "今天我們來聊一下博通", "speaker": "SPEAKER_00"},
        {"start": 8.5, "end": 15.1, "text": "博通這段我還抱著ASIC的能見度明年都看得到", "speaker": "SPEAKER_00"},
    ],
}


@patch("backend.transcribe.requests.post")
def test_transcribe_episode(mock_post, tmp_db, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_STT_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_post.return_value = mock_resp

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    audio_path = tmp_path / "audio" / "EP542.mp3"
    audio_path.write_bytes(b"fake-mp3")

    from backend import config
    segments = transcribe.run(542, audio_path)

    assert len(segments) == 3
    assert segments[0]["text"] == "哈囉大家好歡迎回來股癌"

    episode = db.get_episode(542)
    assert episode["transcript"] is not None
    stored = json.loads(episode["transcript"])
    assert len(stored) == 3


@patch("backend.transcribe.requests.post")
def test_transcribe_sends_phrase_list(mock_post, tmp_db, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_STT_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_post.return_value = mock_resp

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    audio_path = tmp_path / "audio" / "EP542.mp3"
    audio_path.write_bytes(b"fake-mp3")

    transcribe.run(542, audio_path)

    call_kwargs = mock_post.call_args
    data = call_kwargs.kwargs.get("data") or call_kwargs[1].get("data", {})
    assert "phrase_list" in data
    assert "博通" in data["phrase_list"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_transcribe.py -v
```

Expected: FAIL — `cannot import name 'transcribe' from 'backend'`

- [ ] **Step 3: Implement transcribe.py**

`backend/transcribe.py`:

```python
import json
import logging

import requests

from backend import config, db, ticker_map

logger = logging.getLogger(__name__)


def _build_phrase_list():
    names = ticker_map.get_all_names()
    return ",".join(names)


def run(ep, audio_path=None):
    if audio_path is None:
        audio_path = config.AUDIO_DIR / f"EP{ep}.mp3"

    logger.info("Transcribing EP%d from %s", ep, audio_path)

    phrase_list = _build_phrase_list()

    with open(audio_path, "rb") as f:
        resp = requests.post(
            config.STT_API_URL,
            headers={"Authorization": f"Bearer {config.STT_API_KEY}"},
            files={"file": (audio_path.name, f, "audio/mpeg")},
            data={"phrase_list": phrase_list},
        )
    resp.raise_for_status()

    result = resp.json()
    segments = result.get("segments", [])

    db.update_episode_transcript(ep, json.dumps(segments, ensure_ascii=False))
    logger.info("EP%d: %d segments transcribed", ep, len(segments))
    return segments


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m backend.transcribe EP542.mp3")
        sys.exit(1)
    filename = sys.argv[1]
    import re
    m = re.search(r"(\d+)", filename)
    if not m:
        print("Cannot parse episode number from filename")
        sys.exit(1)
    ep_num = int(m.group(1))
    from pathlib import Path
    run(ep_num, Path(filename))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_transcribe.py -v
```

Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/transcribe.py tests/test_transcribe.py
git commit -m "feat: add transcription module using DeepQ STT API"
```

---

### Task 7: Stock Extraction Module

**Files:**
- Create: `backend/extract.py`
- Create: `tests/test_extract.py`

- [ ] **Step 1: Write failing tests**

`tests/test_extract.py`:

```python
import json
from unittest.mock import patch, MagicMock
from backend import extract, db


SAMPLE_TRANSCRIPT = [
    {"start": 0.0, "end": 3.2, "text": "哈囉大家好", "speaker": "SPEAKER_00"},
    {"start": 3.2, "end": 8.5, "text": "今天來聊博通", "speaker": "SPEAKER_00"},
    {"start": 8.5, "end": 15.1, "text": "博通這段我還抱著ASIC的能見度明年都看得到", "speaker": "SPEAKER_00"},
    {"start": 15.1, "end": 22.0, "text": "拉回就是加的機會我沒有要跑", "speaker": "SPEAKER_00"},
    {"start": 22.0, "end": 30.5, "text": "台積電就不用多說了法說再看", "speaker": "SPEAKER_00"},
]

SAMPLE_LLM_RESPONSE = {
    "picks": [
        {
            "ticker": "AVGO",
            "name": "Broadcom",
            "market": "us",
            "confidence": "doing",
            "sector": "ASIC",
            "quote": "博通這段我還抱著，ASIC的能見度明年都看得到，拉回就是加的機會，我沒有要跑。",
            "segment_indices": [2, 3],
        },
        {
            "ticker": "2330",
            "name": "台積電",
            "market": "tw",
            "confidence": "mention",
            "sector": "Semi-foundry",
            "quote": "台積電就不用多說了法說再看",
            "segment_indices": [4],
        },
    ]
}


def _mock_openai_response(content):
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps(content, ensure_ascii=False)
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    return mock_resp


@patch("backend.extract.AzureOpenAI")
def test_extract_picks(mock_client_cls, tmp_db):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(SAMPLE_LLM_RESPONSE)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    picks = extract.run(542)

    assert len(picks) == 2
    assert picks[0]["ticker"] == "AVGO"
    assert picks[0]["confidence"] == "doing"

    db_picks = db.get_picks_for_episode(542)
    assert len(db_picks) == 2
    assert db_picks[0]["ticker"] == "AVGO"


@patch("backend.extract.AzureOpenAI")
def test_extract_maps_segment_timestamps(mock_client_cls, tmp_db):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(SAMPLE_LLM_RESPONSE)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    extract.run(542)

    db_picks = db.get_picks_for_episode(542)
    avgo = db_picks[0]
    assert avgo["segment_start"] == 8.5
    assert avgo["segment_end"] == 22.0

    tsmc = db_picks[1]
    assert tsmc["segment_start"] == 22.0
    assert tsmc["segment_end"] == 30.5


@patch("backend.extract.AzureOpenAI")
def test_extract_updates_market_focus(mock_client_cls, tmp_db):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(SAMPLE_LLM_RESPONSE)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    extract.run(542)

    episode = db.get_episode(542)
    assert episode["market_focus"] == "mixed"


@patch("backend.extract.AzureOpenAI")
def test_extract_handles_unknown_ticker(mock_client_cls, tmp_db):
    response_with_unknown = {
        "picks": [
            {
                "ticker": "NEWCO",
                "name": "新公司",
                "market": "us",
                "confidence": "mention",
                "sector": "Other",
                "quote": "新公司提一下",
                "segment_indices": [0],
            }
        ]
    }
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(response_with_unknown)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    from backend import ticker_map
    extract.run(542)

    result = ticker_map.lookup_by_ticker("NEWCO")
    assert result is not None
    assert result[1] == "新公司"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_extract.py -v
```

Expected: FAIL — `cannot import name 'extract' from 'backend'`

- [ ] **Step 3: Implement extract.py**

`backend/extract.py`:

```python
import json
import logging

from openai import AzureOpenAI

from backend import config, db, ticker_map

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是股癌 Podcast 分析助手。從以下文字稿中抽取所有被提到的個股。

對每檔個股，回傳：
1. ticker：股票代號（美股用英文代號如 AVGO，台股用數字代號如 2330）
2. name：公司名稱
3. market："us" 或 "tw"
4. confidence：判斷股癌的態度
   - "doing"：明確有在做/加碼（「我加了」「我抱著」「我這邊有」「主力是」）
   - "watching"：在觀察但未進場（「我在看」「放在雷達上」「還沒出手」「觀察一下」）
   - "mention"：只是順帶提到（「提一下」「我不碰」「太飆了」）
5. sector：產業分類（ASIC / Semi-foundry / Semi-equip / Optics / CPU-IP / Cooling / Connector / Power / EV-Robotics / Quantum / Financial / Other）
6. quote：最能代表他對該股態度的原話（1-2 句，保留原文）
7. segment_indices：quote 對應的 segment 索引（用來回查時間戳）

回傳格式：{"picks": [...]}
若無任何個股提及，回傳 {"picks": []}"""


def _build_transcript_text(segments):
    lines = []
    for i, seg in enumerate(segments):
        lines.append(f"[{i}] [{seg['start']:.1f}-{seg['end']:.1f}] {seg['text']}")
    return "\n".join(lines)


def _map_segment_timestamps(segment_indices, segments):
    if not segment_indices:
        return None, None
    valid = [i for i in segment_indices if 0 <= i < len(segments)]
    if not valid:
        return None, None
    start = min(segments[i]["start"] for i in valid)
    end = max(segments[i]["end"] for i in valid)
    return start, end


def _determine_market_focus(picks):
    us = sum(1 for p in picks if p.get("market") == "us")
    tw = sum(1 for p in picks if p.get("market") == "tw")
    if us == 0 and tw == 0:
        return "mixed"
    if us > tw * 2:
        return "us"
    if tw > us * 2:
        return "tw"
    return "mixed"


def run(ep):
    episode = db.get_episode(ep)
    if not episode or not episode["transcript"]:
        logger.error("EP%d: no transcript found", ep)
        return []

    segments = json.loads(episode["transcript"])
    transcript_text = _build_transcript_text(segments)

    client = AzureOpenAI(
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
        api_key=config.AZURE_OPENAI_API_KEY,
        api_version=config.AZURE_OPENAI_API_VERSION,
    )

    response = client.chat.completions.create(
        model=config.AZURE_OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript_text},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    result = json.loads(response.choices[0].message.content)
    picks = result.get("picks", [])

    for pick in picks:
        t = pick["ticker"]
        if not ticker_map.lookup_by_ticker(t):
            ticker_map.add(pick["name"], t, pick["name"], pick["market"])

        seg_start, seg_end = _map_segment_timestamps(
            pick.get("segment_indices", []), segments
        )

        db.insert_pick(
            ep=ep,
            ticker=t,
            name=pick["name"],
            market=pick["market"],
            confidence=pick["confidence"],
            sector=pick.get("sector"),
            quote=pick.get("quote"),
            segment_start=seg_start,
            segment_end=seg_end,
        )

    market_focus = _determine_market_focus(picks)
    db.update_episode_market_focus(ep, market_focus)

    logger.info("EP%d: extracted %d picks (market_focus=%s)", ep, len(picks), market_focus)
    return picks


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m backend.extract 542")
        sys.exit(1)
    ep_num = int(sys.argv[1])
    picks = run(ep_num)
    for p in picks:
        print(f"  {p['ticker']} ({p['confidence']}): {p.get('quote', '')[:40]}...")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_extract.py -v
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/extract.py tests/test_extract.py
git commit -m "feat: add stock extraction module using Azure OpenAI"
```

---

### Task 8: Price Module

**Files:**
- Create: `backend/prices.py`
- Create: `tests/test_prices.py`

- [ ] **Step 1: Write failing tests**

`tests/test_prices.py`:

```python
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from backend import prices, db


def _make_price_df(dates, opens, closes):
    idx = pd.DatetimeIndex(dates)
    return pd.DataFrame({"Open": opens, "Close": closes}, index=idx)


def test_yf_ticker_format():
    assert prices.yf_ticker("AVGO", "us") == "AVGO"
    assert prices.yf_ticker("2330", "tw") == "2330.TW"


def test_bench_ticker():
    assert prices.bench_ticker("us") == "SPY"
    assert prices.bench_ticker("tw") == "0050.TW"


@patch("backend.prices.yf.download")
def test_fetch_entry_price(mock_dl, tmp_db):
    dates = pd.date_range("2026-04-15", periods=5, freq="B")
    df = _make_price_df(dates, [1842.5, 1845, 1850, 1848, 1852], [1845, 1850, 1848, 1852, 1855])
    mock_dl.return_value = df

    entry = prices.fetch_entry_price("AVGO", "us", "2026-04-14")
    assert entry == 1842.5


@patch("backend.prices.yf.download")
def test_fetch_entry_price_no_data(mock_dl, tmp_db):
    mock_dl.return_value = pd.DataFrame()
    entry = prices.fetch_entry_price("AVGO", "us", "2026-04-14")
    assert entry is None


@patch("backend.prices.yf.download")
def test_calculate_returns_partial(mock_dl, tmp_db):
    dates = pd.date_range("2026-04-15", periods=7, freq="B")
    closes = [1842.5, 1860, 1870, 1880, 1890, 1900, 1910]
    df = _make_price_df(dates, closes, closes)
    mock_dl.return_value = df

    result = prices.calculate_returns("AVGO", "us", "2026-04-15", 1842.5)
    assert result["w1"] == round((1890 - 1842.5) / 1842.5 * 100, 1)
    assert result["w2"] is None
    assert result["m1"] is None
    assert result["q1"] is None


@patch("backend.prices.yf.download")
def test_sparkline_generation(mock_dl, tmp_db):
    dates = pd.date_range("2026-01-01", periods=60, freq="B")
    closes = list(range(100, 160))
    df = _make_price_df(dates, closes, closes)
    mock_dl.return_value = df

    result = prices.calculate_returns("AVGO", "us", "2026-01-01", 100)
    assert len(result["sparkline"]) == 24
    assert result["sparkline"][0] == 100
    assert result["sparkline"][-1] == 159


@patch("backend.prices.yf.download")
def test_fetch_new_picks(mock_dl, tmp_db):
    dates = pd.date_range("2026-04-15", periods=10, freq="B")
    closes = [1842.5 + i * 10 for i in range(10)]
    df = _make_price_df(dates, closes, closes)
    mock_dl.return_value = df

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us", confidence="doing")

    prices.fetch_new_picks(542)

    picks = db.get_picks_for_episode(542)
    assert picks[0]["entry"] is not None
    assert picks[0]["status"] == "backfilling"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_prices.py -v
```

Expected: FAIL — `cannot import name 'prices' from 'backend'`

- [ ] **Step 3: Implement prices.py**

`backend/prices.py`:

```python
import json
import logging
from datetime import datetime, timedelta

import yfinance as yf

from backend import config, db

logger = logging.getLogger(__name__)

RETURN_PERIODS = [("w1", 5), ("w2", 10), ("m1", 21), ("q1", 63)]


def yf_ticker(ticker, market):
    return f"{ticker}.TW" if market == "tw" else ticker


def bench_ticker(market):
    return "0050.TW" if market == "tw" else "SPY"


def fetch_entry_price(ticker, market, mention_date):
    yf_t = yf_ticker(ticker, market)
    start = datetime.strptime(mention_date, "%Y-%m-%d") + timedelta(days=1)
    end = start + timedelta(days=10)
    data = yf.download(yf_t, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), progress=False)
    if data.empty:
        logger.warning("No price data for %s after %s", ticker, mention_date)
        return None
    return round(float(data["Open"].iloc[0]), 2)


def calculate_returns(ticker, market, entry_date_str, entry_price):
    yf_t = yf_ticker(ticker, market)
    start = datetime.strptime(entry_date_str, "%Y-%m-%d")
    end = datetime.now() + timedelta(days=1)
    data = yf.download(yf_t, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), progress=False)

    if data.empty:
        return {"w1": None, "w2": None, "m1": None, "q1": None, "sparkline": []}

    trading_days = len(data)
    returns = {}
    for period, days in RETURN_PERIODS:
        if trading_days >= days:
            close = float(data["Close"].iloc[days - 1])
            returns[period] = round((close - entry_price) / entry_price * 100, 1)
        else:
            returns[period] = None

    closes = data["Close"].values.tolist()
    if len(closes) >= 24:
        indices = [int(i * (len(closes) - 1) / 23) for i in range(24)]
        sparkline = [round(float(closes[i]), 2) for i in indices]
    else:
        sparkline = [round(float(c), 2) for c in closes]

    returns["sparkline"] = sparkline
    return returns


def _calculate_bench_return(market, entry_date_str, period_days):
    bt = bench_ticker(market)
    start = datetime.strptime(entry_date_str, "%Y-%m-%d")
    end = datetime.now() + timedelta(days=1)
    data = yf.download(bt, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), progress=False)
    if data.empty or len(data) < period_days:
        return None
    entry = float(data["Close"].iloc[0])
    close = float(data["Close"].iloc[period_days - 1])
    return round((close - entry) / entry * 100, 1)


def fetch_new_picks(ep):
    episode = db.get_episode(ep)
    if not episode:
        return
    mention_date = episode["date"]
    picks = db.get_picks_for_episode(ep)

    for pick in picks:
        if pick["entry"] is not None:
            continue
        entry = fetch_entry_price(pick["ticker"], pick["market"], mention_date)
        if entry is None:
            continue

        entry_date = datetime.strptime(mention_date, "%Y-%m-%d") + timedelta(days=1)
        while entry_date.weekday() >= 5:
            entry_date += timedelta(days=1)
        entry_date_str = entry_date.strftime("%Y-%m-%d")

        returns = calculate_returns(pick["ticker"], pick["market"], entry_date_str, entry)
        bench = _calculate_bench_return(pick["market"], entry_date_str, 63)

        status = "completed" if returns.get("q1") is not None else "backfilling"

        db.update_pick_prices(
            ep=ep,
            ticker=pick["ticker"],
            entry=entry,
            w1=returns.get("w1"),
            w2=returns.get("w2"),
            m1=returns.get("m1"),
            q1=returns.get("q1"),
            bench_q1=bench,
            sparkline=json.dumps(returns.get("sparkline", [])),
            status=status,
        )
        logger.info("EP%d %s: entry=%.2f, w1=%s, status=%s", ep, pick["ticker"], entry, returns.get("w1"), status)


def backfill_all():
    pending = db.get_pending_picks()
    logger.info("Backfilling %d pending picks", len(pending))

    for pick in pending:
        if pick["entry"] is None:
            continue
        mention_date = pick["mention_date"]
        entry_date = datetime.strptime(mention_date, "%Y-%m-%d") + timedelta(days=1)
        while entry_date.weekday() >= 5:
            entry_date += timedelta(days=1)
        entry_date_str = entry_date.strftime("%Y-%m-%d")

        returns = calculate_returns(pick["ticker"], pick["market"], entry_date_str, pick["entry"])
        bench = _calculate_bench_return(pick["market"], entry_date_str, 63)

        status = "completed" if returns.get("q1") is not None else "backfilling"

        db.update_pick_prices(
            ep=pick["ep"],
            ticker=pick["ticker"],
            w1=returns.get("w1"),
            w2=returns.get("w2"),
            m1=returns.get("m1"),
            q1=returns.get("q1"),
            bench_q1=bench,
            sparkline=json.dumps(returns.get("sparkline", [])),
            status=status,
        )


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m backend.prices 542")
        sys.exit(1)
    ep_num = int(sys.argv[1])
    fetch_new_picks(ep_num)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_prices.py -v
```

Expected: all 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/prices.py tests/test_prices.py
git commit -m "feat: add price module with yfinance fetch and returns calculation"
```

---

### Task 9: Generate Module

**Files:**
- Create: `backend/generate.py`
- Create: `tests/test_generate.py`

- [ ] **Step 1: Write failing tests**

`tests/test_generate.py`:

```python
import json
from pathlib import Path
from backend import generate, db


def _seed_data(tmp_db):
    db.insert_episode(ep=542, title="EP542 測試", date="2026-04-14", duration="1:42:18")
    db.insert_episode(ep=541, title="EP541 測試", date="2026-04-10", duration="1:28:44")
    db.update_episode_market_focus(542, "us")
    db.update_episode_market_focus(541, "tw")

    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us",
                   confidence="doing", sector="ASIC", quote="博通這段我還抱著")
    db.update_pick_prices(ep=542, ticker="AVGO", entry=1842.5, w1=2.8, w2=4.1,
                          m1=7.3, q1=18.2, bench_q1=3.1,
                          sparkline=json.dumps([1842, 1851, 1868]), status="completed")

    db.insert_pick(ep=542, ticker="ARM", name="Arm Holdings", market="us",
                   confidence="watching", sector="ASIC", quote="Arm 估值看不太下去")
    db.update_pick_prices(ep=542, ticker="ARM", entry=128.4, w1=-1.2, w2=0.8,
                          m1=2.4, q1=5.8, bench_q1=3.1,
                          sparkline=json.dumps([128.4, 130.2, 135.8]), status="completed")

    db.insert_pick(ep=541, ticker="3661", name="世芯-KY", market="tw",
                   confidence="doing", sector="ASIC", quote="世芯我這邊還有單")
    db.update_pick_prices(ep=541, ticker="3661", entry=4285, w1=4.2, w2=8.1,
                          m1=13.5, q1=22.4, bench_q1=4.2,
                          sparkline=json.dumps([4285, 4512, 5245]), status="completed")


def test_compute_stats():
    picks_us = [
        {"confidence": "doing", "w1": 2.8, "w2": 4.1, "m1": 7.3, "q1": 18.2, "bench_q1": 3.1},
        {"confidence": "watching", "w1": -1.2, "w2": 0.8, "m1": 2.4, "q1": 5.8, "bench_q1": 3.1},
    ]
    stats = generate.compute_stats(picks_us, "us")
    assert stats["total_picks"] == 2
    assert stats["doing"] == 1
    assert stats["watching"] == 1
    assert stats["hit_rate_w1"] == 0.5
    assert stats["avg_q1"] == 12.0
    assert stats["vs_spy_q1"] == round(12.0 - 3.1, 1)
    assert stats["best_pick"]["ticker"] is not None


def test_format_episodes():
    episodes = [
        {"ep": 542, "title": "EP542 測試", "date": "2026-04-14", "duration": "1:42:18", "market_focus": "us",
         "rss_url": None, "audio_path": None, "transcript": None, "created_at": "2026-04-14"},
    ]
    result = generate.format_episodes(episodes)
    assert result[0]["ep"] == 542
    assert "transcript" not in result[0]
    assert "rss_url" not in result[0]


def test_format_picks():
    picks = [
        {"id": 1, "ep": 542, "ticker": "AVGO", "name": "Broadcom", "market": "us",
         "confidence": "doing", "sector": "ASIC", "quote": "博通這段我還抱著",
         "segment_start": 8.5, "segment_end": 22.0, "entry": 1842.5,
         "w1": 2.8, "w2": 4.1, "m1": 7.3, "q1": 18.2, "bench_q1": 3.1,
         "sparkline": json.dumps([1842, 1851, 1868]), "status": "completed", "created_at": "2026-04-14"},
    ]
    ep_dates = {542: "2026-04-14"}
    result = generate.format_picks(picks, ep_dates)
    assert result[0]["mention_date"] == "2026-04-14"
    assert result[0]["sparkline"] == [1842, 1851, 1868]
    assert "id" not in result[0]
    assert "status" not in result[0]
    assert "created_at" not in result[0]


def test_write_data_js(tmp_db, tmp_path, monkeypatch):
    monkeypatch.setattr("backend.config.DATA_JS_PATH", tmp_path / "data.js")
    _seed_data(tmp_db)

    generate.write_data_js()

    js_path = tmp_path / "data.js"
    assert js_path.exists()
    content = js_path.read_text(encoding="utf-8")
    assert content.startswith("window.GOOAYE_DATA = ")
    assert content.rstrip().endswith(";")

    json_str = content.replace("window.GOOAYE_DATA = ", "").rstrip().rstrip(";")
    data = json.loads(json_str)

    assert len(data["episodes"]) == 2
    assert len(data["picks"]) == 3
    assert "us" in data["stats"]
    assert "tw" in data["stats"]
    assert data["stats"]["us"]["total_picks"] == 2
    assert data["stats"]["tw"]["total_picks"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_generate.py -v
```

Expected: FAIL — `cannot import name 'generate' from 'backend'`

- [ ] **Step 3: Implement generate.py**

`backend/generate.py`:

```python
import json
import logging

from backend import config, db

logger = logging.getLogger(__name__)


def compute_stats(picks, market):
    total = len(picks)
    doing = sum(1 for p in picks if p["confidence"] == "doing")
    watching = sum(1 for p in picks if p["confidence"] == "watching")
    mention = sum(1 for p in picks if p["confidence"] == "mention")

    stats = {
        "total_picks": total,
        "doing": doing,
        "watching": watching,
        "mention": mention,
    }

    for period in ["w1", "w2", "m1", "q1"]:
        vals = [p[period] for p in picks if p.get(period) is not None]
        if vals:
            stats[f"hit_rate_{period}"] = round(sum(1 for v in vals if v > 0) / len(vals), 2)
            stats[f"avg_{period}"] = round(sum(vals) / len(vals), 1)
        else:
            stats[f"hit_rate_{period}"] = 0
            stats[f"avg_{period}"] = 0

    bench_key = "vs_spy_q1" if market == "us" else "vs_0050_q1"
    bench_vals = [p.get("bench_q1") for p in picks if p.get("bench_q1") is not None]
    avg_bench = round(sum(bench_vals) / len(bench_vals), 1) if bench_vals else 0
    stats[bench_key] = round(stats.get("avg_q1", 0) - avg_bench, 1)

    q1_picks = [(p, p["q1"]) for p in picks if p.get("q1") is not None]
    if q1_picks:
        best = max(q1_picks, key=lambda x: x[1])
        worst = min(q1_picks, key=lambda x: x[1])
        stats["best_pick"] = {"ticker": best[0]["ticker"], "q1": best[1]}
        stats["worst_pick"] = {"ticker": worst[0]["ticker"], "q1": worst[1]}
    else:
        stats["best_pick"] = {"ticker": "-", "q1": 0}
        stats["worst_pick"] = {"ticker": "-", "q1": 0}

    return stats


def format_episodes(episodes):
    result = []
    for e in episodes:
        result.append({
            "ep": e["ep"],
            "title": e["title"],
            "date": e["date"],
            "duration": e["duration"],
            "market_focus": e["market_focus"],
        })
    return result


def format_picks(picks, ep_dates):
    result = []
    for p in picks:
        sparkline = p["sparkline"]
        if isinstance(sparkline, str):
            try:
                sparkline = json.loads(sparkline)
            except (json.JSONDecodeError, TypeError):
                sparkline = []

        result.append({
            "ep": p["ep"],
            "ticker": p["ticker"],
            "name": p["name"],
            "market": p["market"],
            "mention_date": ep_dates.get(p["ep"], ""),
            "confidence": p["confidence"],
            "sector": p.get("sector"),
            "quote": p.get("quote"),
            "w1": p.get("w1"),
            "w2": p.get("w2"),
            "m1": p.get("m1"),
            "q1": p.get("q1"),
            "bench_q1": p.get("bench_q1"),
            "entry": p.get("entry"),
            "sparkline": sparkline or [],
        })
    return result


def write_data_js():
    episodes = db.get_latest_episodes(10)
    ep_list = [e["ep"] for e in episodes]
    picks = db.get_picks_for_episodes(ep_list)

    ep_dates = {e["ep"]: e["date"] for e in episodes}

    us_picks = [p for p in picks if p["market"] == "us"]
    tw_picks = [p for p in picks if p["market"] == "tw"]

    data = {
        "episodes": format_episodes(episodes),
        "picks": format_picks(picks, ep_dates),
        "stats": {
            "us": compute_stats(us_picks, "us"),
            "tw": compute_stats(tw_picks, "tw"),
        },
    }

    js = f"window.GOOAYE_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
    config.DATA_JS_PATH.write_text(js, encoding="utf-8")
    logger.info("Wrote data.js with %d episodes, %d picks", len(episodes), len(picks))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db.init_db()
    write_data_js()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_generate.py -v
```

Expected: all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/generate.py tests/test_generate.py
git commit -m "feat: add generate module to produce data.js from SQLite"
```

---

### Task 10: Pipeline Orchestration & Entry Point

**Files:**
- Create: `backend/pipeline.py`
- Create: `run.py`

- [ ] **Step 1: Implement pipeline.py**

`backend/pipeline.py`:

```python
import logging

from backend import db, rss, transcribe, extract, prices, generate

logger = logging.getLogger(__name__)


def run_new_episodes():
    new_episodes = rss.check_new()

    for ep_info in new_episodes:
        ep = ep_info["ep"]
        logger.info("Processing EP%d: %s", ep, ep_info["title"])

        db.insert_episode(
            ep=ep,
            title=ep_info["title"],
            date=ep_info["date"],
            duration=ep_info.get("duration"),
            rss_url=ep_info.get("rss_url"),
        )

        audio_path = rss.download_audio(ep, ep_info["rss_url"])
        transcribe.run(ep, audio_path)
        extract.run(ep)
        prices.fetch_new_picks(ep)

        logger.info("EP%d complete", ep)

    return new_episodes


def run_backfill():
    prices.backfill_all()


def run_generate():
    generate.write_data_js()


def run_full():
    db.init_db()
    new = run_new_episodes()
    run_backfill()
    run_generate()
    logger.info("Pipeline complete. %d new episodes processed.", len(new))
    return new
```

- [ ] **Step 2: Implement run.py**

`run.py`:

```python
import argparse
import logging
import time

import schedule

from backend import config
from backend.pipeline import run_full

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Gooaye Backend Pipeline")
    parser.add_argument("--now", action="store_true", help="Run pipeline immediately")
    args = parser.parse_args()

    if args.now:
        logger.info("Running pipeline now...")
        run_full()
        return

    logger.info("Scheduling daily run at %s TST", config.SCHEDULE_TIME)
    schedule.every().day.at(config.SCHEDULE_TIME).do(run_full)

    run_full()

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run all tests to verify nothing is broken**

```bash
pytest tests/ -v
```

Expected: all tests pass (approximately 29 tests)

- [ ] **Step 4: Commit**

```bash
git add backend/pipeline.py run.py
git commit -m "feat: add pipeline orchestration and scheduled entry point"
```

---

### Task 11: Integration Smoke Test

- [ ] **Step 1: Create .env from .env.example and fill in API keys**

```bash
cp .env.example .env
# Edit .env to add STT_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, RSS_URL
```

- [ ] **Step 2: Initialize database**

```bash
python -c "from backend import db; db.init_db(); print('DB initialized')"
```

Expected: `DB initialized`, `data/gooaye.db` created

- [ ] **Step 3: Test RSS module**

```bash
python -m backend.rss
```

Expected: Lists new episodes found (or "RSS_URL not configured" if URL not set)

- [ ] **Step 4: Run full pipeline**

```bash
python run.py --now
```

Expected: Pipeline runs through all steps, generates `data.js`

- [ ] **Step 5: Verify data.js is valid**

```bash
python -c "
import json
text = open('data.js').read()
json_str = text.replace('window.GOOAYE_DATA = ', '').rstrip().rstrip(';')
data = json.loads(json_str)
print(f'Episodes: {len(data[\"episodes\"])}')
print(f'Picks: {len(data[\"picks\"])}')
print(f'US stats: {data[\"stats\"][\"us\"][\"total_picks\"]} picks')
print(f'TW stats: {data[\"stats\"][\"tw\"][\"total_picks\"]} picks')
"
```

- [ ] **Step 6: Test frontend with real data**

Open `index.html` in browser and verify:
- Episode list shows real episodes with correct dates
- Stock picks show real tickers with actual returns
- Sparkline charts display correctly
- Stats panel shows computed hit rates

- [ ] **Step 7: Final commit**

```bash
git add data.js
git commit -m "feat: first real data.js from pipeline"
```

---

### Task 12: Add .gitignore entries

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Add these entries to `.gitignore`:

```
# Backend
.env
data/gooaye.db
data/audio/
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add backend entries to .gitignore"
```
