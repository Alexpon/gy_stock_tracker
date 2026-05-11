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
            bench_w1 REAL, bench_w2 REAL, bench_m1 REAL, bench_q1 REAL,
            sparkline     TEXT,
            status        TEXT DEFAULT 'pending',
            created_at    TEXT DEFAULT (datetime('now')),
            UNIQUE(ep, ticker)
        );

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


def update_pick_prices(ep, ticker, entry=None, w1=None, w2=None, m1=None, q1=None,
                       bench_w1=None, bench_w2=None, bench_m1=None, bench_q1=None,
                       sparkline=None, status=None):
    conn = _connect()
    fields = []
    values = []
    for col, val in [("entry", entry), ("w1", w1), ("w2", w2), ("m1", m1), ("q1", q1),
                     ("bench_w1", bench_w1), ("bench_w2", bench_w2),
                     ("bench_m1", bench_m1), ("bench_q1", bench_q1),
                     ("sparkline", sparkline), ("status", status)]:
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


def get_episode_count():
    conn = _connect()
    row = conn.execute("SELECT COUNT(*) as cnt FROM episodes").fetchone()
    conn.close()
    return row["cnt"]
