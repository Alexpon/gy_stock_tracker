# Gooaye Backend Pipeline Design

## Overview

Python pipeline 將 mock data 替換為真實資料。每天排程檢查股癌 Podcast RSS，有新集時自動轉錄、抽取個股、拉股價回測，產出 `data.js` 給前端直接使用。

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 每日排程 18:00 (TST)                   │
│                                                       │
│  ① rss.py           檢查 RSS，有新集 → 下載 MP3       │
│         ↓                                             │
│  ② transcribe.py    MP3 → DeepQ STT API → transcript │
│         ↓                                             │
│  ③ extract.py       transcript → Azure OpenAI → picks│
│         ↓                                             │
│  ④ prices.py        yfinance → entry, returns, spark │
│         ↓                                             │
│  ⑤ generate.py      SQLite → 重算 stats → data.js    │
│                                                       │
│  每日也跑 ④⑤ 回填舊 picks 的 m1/q1                     │
└─────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌────────────────┐
│  SQLite  │ ──→ │ data.js  │ ──→ │ 前端 (不動)     │
│ gooaye.db│     │ (自動產出) │     │ index.html     │
└──────────┘     └──────────┘     └────────────────┘
```

## Project Structure

```
gooaye/
├── index.html, v1-*.jsx, data.js    # 前端（不動）
├── backend/
│   ├── config.py           # 環境變數、API keys、常數
│   ├── db.py               # SQLite schema + CRUD
│   ├── rss.py              # RSS 解析、新集偵測、MP3 下載
│   ├── transcribe.py       # DeepQ STT API 呼叫
│   ├── extract.py          # Azure OpenAI 個股抽取
│   ├── prices.py           # yfinance 股價拉取 + 回測計算
│   ├── generate.py         # 從 DB 產出 data.js
│   ├── pipeline.py         # 串接 ①~⑤ 的主流程
│   └── ticker_map.py       # 中文公司名 ↔ ticker 對照表
├── data/
│   ├── gooaye.db           # SQLite 資料庫
│   └── audio/              # 下載的 MP3 暫存
├── .env                    # API keys（不進 git）
├── .env.example            # 範本
├── requirements.txt
└── run.py                  # 入口：python run.py
```

## Database Schema

```sql
CREATE TABLE episodes (
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

CREATE TABLE picks (
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
```

### Design Notes

- `transcript` stored as JSON (array of STT segments with start/end/text) in episodes table for re-extraction without re-transcription.
- `sparkline` stored as JSON string (SQLite has no array type).
- `status` tracks backfill progress: `pending` → `backfilling` → `completed` (90 days reached).
- `stats` not stored in DB; computed on-the-fly by `generate.py` from picks.

## Pipeline Steps

### Step 1: RSS Check + Download (`rss.py`)

- Source: Apple Podcast RSS feed for 股癌 (Gooaye).
- Compare RSS entries against `episodes` table; only process new episodes.
- Download MP3 to `data/audio/EP{ep}.mp3`.
- Parse `title`, `date`, `duration` from RSS and insert into `episodes`.

### Step 2: Transcription (`transcribe.py`)

- Call DeepQ STT API: `POST /v1/audio/transcriptions`.
- Auth: Bearer token from `STT_API_KEY`.
- Input: MP3 file as multipart/form-data.
- `phrase_list`: auto-generated from `ticker_map.py` keys (stock names in Chinese/English) to boost recognition accuracy.
- Response: JSON with `segments[]` containing `start`, `end`, `text`, `speaker`.
- Store full segments JSON in `episodes.transcript`.

### Step 3: Stock Extraction (`extract.py`)

- Feed transcript to Azure OpenAI.
- Model: `gpt-4.1-mini` (testing) / `gpt-5.4` (production), configured via `AZURE_OPENAI_MODEL` env var.

**Extracted fields per stock:**

| Field | Description | Example |
|-------|-------------|---------|
| `ticker` | Stock code | `AVGO` / `2330` |
| `name` | Company name | `Broadcom` / `台積電` |
| `market` | Market | `us` / `tw` |
| `confidence` | Conviction level | `doing` / `watching` / `mention` |
| `sector` | Industry classification | `ASIC` / `Power` / `Cooling` |
| `quote` | Representative quote (1-2 sentences) | `「博通這段我還抱著…」` |
| `segment_indices` | Indices into STT segments | `[42, 43, 44]` |

**Confidence classification criteria:**

- `doing`: Host explicitly holds or is adding positions ("我加了", "我抱著", "我這邊有", "主力是")
- `watching`: Host is observing but not in ("我在看", "放在雷達上", "還沒出手", "觀察一下")
- `mention`: Just mentioned in passing ("提一下", "我不碰", "太飆了")

**Sector categories:** ASIC / Semi-foundry / Semi-equip / Optics / CPU-IP / Cooling / Connector / Power / EV-Robotics / Quantum / Financial / Other

**Prompt template:**

```
你是股癌 Podcast 分析助手。從以下文字稿中抽取所有被提到的個股。

對每檔個股，回傳：
1. ticker：股票代號（美股用英文代號如 AVGO，台股用數字代號如 2330）
2. name：公司名稱
3. market："us" 或 "tw"
4. confidence：判斷股癌的態度
   - "doing"：明確有在做/加碼（「我加了」「我抱著」「我這邊有」）
   - "watching"：在觀察但未進場（「我在看」「放在雷達上」「還沒出手」）
   - "mention"：只是順帶提到（「提一下」「我不碰」「太飆了」）
5. sector：產業分類（ASIC / Semi-foundry / Semi-equip / Optics / CPU-IP / Cooling / Connector / Power / EV-Robotics / Quantum / Financial / Other）
6. quote：最能代表他對該股態度的原話（1-2 句，保留原文）
7. segment_indices：quote 對應的 segment 索引（用來回查時間戳）

回傳 JSON array。若無任何個股提及，回傳空 array。
```

**Unknown stock handling:** If LLM returns a ticker not in `ticker_map.py`, auto-add to map and log `[WARNING] 未知股票: {name}` for manual review.

**Time mapping:** `segment_indices` → look up original STT segments → earliest `start` and latest `end` → stored as `segment_start` / `segment_end` in picks.

### Step 4: Price Fetching (`prices.py`)

- **Entry price:** Next trading day's open after `mention_date`.
  - Fetch 5 trading days after mention_date via yfinance; take first valid Open.
  - Taiwan stock ticker format: `2330` → `2330.TW`.
- **Returns calculation** (from entry date):
  - `w1` = trading day 5 close vs entry (%)
  - `w2` = trading day 10
  - `m1` = trading day 21
  - `q1` = trading day 63
  - Leave `NULL` if period hasn't elapsed yet.
- **Benchmark:** SPY (US) / 0050.TW (TW) return over same period → `bench_q1`.
- **Sparkline:** 24 equally-spaced daily close prices from entry to today.
- **Daily backfill:** Scan all picks where `status != 'completed'`; update returns and sparkline. Mark `completed` after 90 trading days.

### Step 5: Generate data.js (`generate.py`)

- Read latest 10 episodes + all their picks from SQLite.
- Compute `stats.us` and `stats.tw` on-the-fly:
  - `total_picks`, `doing`, `watching`, `mention` counts
  - `hit_rate_w1/w2/m1/q1` (fraction with positive return)
  - `avg_w1/w2/m1/q1` (mean return %)
  - `vs_spy_q1` / `vs_0050_q1` (alpha)
  - `best_pick`, `worst_pick` (by q1)
- Output `window.GOOAYE_DATA = { episodes, picks, stats }` matching existing schema exactly.
- Overwrite `gooaye/data.js`.

## Ticker Map (`ticker_map.py`)

Mapping table for Chinese company names ↔ ticker codes. Used for:

1. Normalizing LLM output (if it returns "博通" instead of "AVGO")
2. Auto-generating `phrase_list` for DeepQ STT API
3. Validating extracted tickers

```python
TICKER_MAP = {
    "博通": ("AVGO", "Broadcom", "us"),
    "Broadcom": ("AVGO", "Broadcom", "us"),
    "台積電": ("2330", "台積電", "tw"),
    "世芯": ("3661", "世芯-KY", "tw"),
    # ... expanded as new stocks are mentioned
}
```

## Main Flow (`pipeline.py`)

```python
def run():
    new_episodes = rss.check_new()
    for ep in new_episodes:
        rss.download_audio(ep)
        transcribe.run(ep)
        extract.run(ep)
        prices.fetch_new_picks(ep)

    prices.backfill_all()
    generate.write_data_js()
```

## Scheduling (`run.py`)

- Uses Python `schedule` package.
- Runs daily at 18:00 TST (Taiwan Standard Time).
- Manual execution: `python run.py --now`.

## Environment Variables (`.env`)

```env
# DeepQ STT
STT_API_URL=https://llminternal-dev.deepq.ai:50500/v1/audio/transcriptions
STT_API_KEY=

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_MODEL=gpt-4.1-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Schedule
SCHEDULE_TIME=18:00
```

## Dependencies (`requirements.txt`)

```
requests
openai
yfinance
feedparser
schedule
python-dotenv
```

## Testing Flow

```bash
cp .env.example .env              # Fill in API keys
pip install -r requirements.txt

# Test each step independently
python -m backend.rss                    # Test RSS fetch
python -m backend.transcribe EP542.mp3   # Test single episode transcription
python -m backend.extract 542            # Test single episode extraction
python -m backend.prices 542             # Test single episode price fetch
python -m backend.generate               # Generate data.js

# Full pipeline
python run.py --now                      # Run once immediately

# Start scheduler
python run.py                            # Daily at 18:00 TST
```

## Out of Scope

- Frontend changes (current CDN React stays as-is)
- Vercel deployment (future phase)
- Long-term audio storage (delete after transcription; transcript saved in DB)
- User authentication / multi-user support
- Audio playback integration in frontend (segment timestamps stored for future use)
