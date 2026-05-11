import json
import socket
import threading
import time

import pytest
import uvicorn

from backend import db


def _free_port():
    with socket.socket() as s:
        s.bind(("", 0))
        return s.getsockname()[1]


def _seed_db():
    """Seed DB with deterministic test data for e2e verification."""
    db.insert_episode(654, "EP654 | 🌵", "2026-04-18", "2999")
    db.insert_episode(630, "EP630 | ⭐", "2026-01-24", "3100")

    db.update_episode_transcript(654, json.dumps([{"text": "test", "start": 0, "end": 5}]))
    db.update_episode_transcript(630, json.dumps([{"text": "test", "start": 0, "end": 5}]))

    # EP654 TW picks (5) — no performance data
    db.insert_pick(654, "2330", "台積電", "tw", "doing", sector="ASIC",
                   quote="台積電在接下來的蓋的狀態是給的非常好啦")
    db.insert_pick(654, "0050", "元大台灣50", "tw", "doing", sector="ETF",
                   quote="今年靠美以1戰爭股市拉回持續加碼台積電0050")
    db.insert_pick(654, "2317", "鴻海", "tw", "mention", sector="Other")
    db.insert_pick(654, "2327", "國巨", "tw", "watching", sector="Other",
                   quote="那上次有聊到說國巨的法說會說什麼")
    db.insert_pick(654, "6415", "矽力-KY", "tw", "mention", sector="Other")

    # EP654 US picks (4) — no performance data
    db.insert_pick(654, "NVDA", "NVIDIA", "us", "mention", sector="ASIC")
    db.insert_pick(654, "META", "Meta Platforms", "us", "mention", sector="Other")
    db.insert_pick(654, "AMZN", "Amazon", "us", "mention", sector="Other")
    db.insert_pick(654, "AAPL", "Apple", "us", "watching", sector="Other",
                   quote="甚至像那種蘋果的論述")

    for ticker in ["2330", "0050", "2317", "2327", "6415"]:
        db.update_pick_prices(654, ticker, entry=100.0, sparkline="[100,101]", status="backfilling")
    db.update_pick_prices(654, "2330", entry=2030.0, sparkline="[2030,2050]")
    db.update_pick_prices(654, "0050", entry=84.55, sparkline="[84.55,86]")
    db.update_pick_prices(654, "2317", entry=206.0, sparkline="[206,207]")
    db.update_pick_prices(654, "2327", entry=320.0, sparkline="[320,323]")
    db.update_pick_prices(654, "6415", entry=361.0, sparkline="[361,362]")
    db.update_pick_prices(654, "NVDA", entry=199.98, sparkline="[199.98,202]", status="backfilling")
    db.update_pick_prices(654, "META", entry=681.36, sparkline="[681,672]", status="backfilling")
    db.update_pick_prices(654, "AMZN", entry=249.19, sparkline="[249,252]", status="backfilling")
    db.update_pick_prices(654, "AAPL", entry=270.33, sparkline="[273,267.12]", status="backfilling")

    # EP630 TW picks (4) — with performance data
    db.insert_pick(630, "2330", "台積電", "tw", "mention", sector="ASIC")
    db.insert_pick(630, "2454", "聯發科", "tw", "doing", sector="ASIC")
    db.insert_pick(630, "0050", "元大台灣50", "tw", "mention", sector="ETF")
    db.insert_pick(630, "2337", "旺宏", "tw", "mention", sector="Other")
    db.update_pick_prices(630, "2330", entry=1759.26, w1=0.6, w2=0.8, m1=7.6,
                          sparkline="[1759,1800]", status="backfilling")
    db.update_pick_prices(630, "2454", entry=1740.0, w1=1.1, w2=-1.7, m1=2.0,
                          sparkline="[1740,1760]", status="backfilling")
    db.update_pick_prices(630, "0050", entry=72.25, w1=0.5, w2=-0.5, m1=7.1,
                          sparkline="[72.25,73]", status="backfilling")
    db.update_pick_prices(630, "2337", entry=72.5, w1=28.0, w2=11.4, m1=48.3,
                          sparkline="[72.5,100]", status="backfilling")

    # EP630 US picks (2) — with performance data
    db.insert_pick(630, "ASTS", "AST SpaceMobile", "us", "mention", sector="Other")
    db.insert_pick(630, "PSTG", "Pure Storage", "us", "mention", sector="Other")
    db.update_pick_prices(630, "ASTS", entry=112.55, w1=-1.2, w2=-9.6, m1=-23.7,
                          bench_w1=-0.1, bench_w2=-0.3, bench_m1=-0.8,
                          sparkline="[112,86]", status="backfilling")
    db.update_pick_prices(630, "PSTG", entry=69.89, w1=-0.5, w2=1.6, m1=-3.1,
                          bench_w1=-0.1, bench_w2=-0.3, bench_m1=-0.8,
                          sparkline="[69.89,68]", status="backfilling")

    # --- Sector groups ---
    db.insert_sector(654, "ASIC", "bullish", quote="ASIC 族群表現不錯", tickers=["2330"])
    db.insert_sector(654, "散熱", "neutral", quote="散熱還在觀察")
    db.insert_sector(630, "ASIC", "bullish", quote="ASIC 持續看好", tickers=["2330", "2454"])


@pytest.fixture(scope="session")
def server_url(tmp_path_factory):
    """Start a FastAPI server with seeded test data, return its base URL."""
    tmp_dir = tmp_path_factory.mktemp("e2e")
    db_path = tmp_dir / "test.db"
    audio_dir = tmp_dir / "audio"
    audio_dir.mkdir()

    import backend.config as cfg
    orig_db, orig_audio = cfg.DB_PATH, cfg.AUDIO_DIR
    cfg.DB_PATH = db_path
    cfg.AUDIO_DIR = audio_dir

    db.init_db()
    _seed_db()

    port = _free_port()

    from backend.server import app
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError("Test server failed to start")

    yield f"http://127.0.0.1:{port}"

    server.should_exit = True
    thread.join(timeout=5)
    cfg.DB_PATH, cfg.AUDIO_DIR = orig_db, orig_audio


@pytest.fixture
def home(page, server_url):
    """Navigate to the app and clear localStorage so we start fresh."""
    page.goto(server_url)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")
    return page
