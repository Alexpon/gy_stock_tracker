import json

import pytest
from fastapi.testclient import TestClient

from backend import db


def _seed_db():
    """Seed DB with deterministic data matching e2e/journey fixtures.

    Two episodes:
      EP654 (2026-04-18) — transcript ✓, 9 picks (5 TW + 4 US), no q1 data
      EP630 (2026-01-24) — transcript ✓, 6 picks (4 TW + 2 US), with w1/w2/m1 data
    """
    db.insert_episode(654, "EP654 | 🌵", "2026-04-18", "2999")
    db.insert_episode(630, "EP630 | ⭐", "2026-01-24", "3100")
    db.update_episode_transcript(654, json.dumps([{"text": "test", "start": 0, "end": 5}]))
    db.update_episode_transcript(630, json.dumps([{"text": "test", "start": 0, "end": 5}]))

    # --- EP654 TW picks (5) ---
    db.insert_pick(654, "2330", "台積電", "tw", "doing", sector="ASIC",
                   quote="台積電在接下來的蓋的狀態是給的非常好啦")
    db.insert_pick(654, "0050", "元大台灣50", "tw", "doing", sector="ETF",
                   quote="今年靠美以1戰爭股市拉回持續加碼台積電0050")
    db.insert_pick(654, "2317", "鴻海", "tw", "mention", sector="Other")
    db.insert_pick(654, "2327", "國巨", "tw", "watching", sector="Other",
                   quote="那上次有聊到說國巨的法說會說什麼")
    db.insert_pick(654, "6415", "矽力-KY", "tw", "mention", sector="Other")
    db.update_pick_prices(654, "2330", entry=2030.0, sparkline="[2030,2050]", status="backfilling")
    db.update_pick_prices(654, "0050", entry=84.55, sparkline="[84.55,86]", status="backfilling")
    db.update_pick_prices(654, "2317", entry=206.0, sparkline="[206,207]", status="backfilling")
    db.update_pick_prices(654, "2327", entry=320.0, sparkline="[320,323]", status="backfilling")
    db.update_pick_prices(654, "6415", entry=361.0, sparkline="[361,362]", status="backfilling")

    # --- EP654 US picks (4) ---
    db.insert_pick(654, "NVDA", "NVIDIA", "us", "mention", sector="ASIC")
    db.insert_pick(654, "META", "Meta Platforms", "us", "mention", sector="Other")
    db.insert_pick(654, "AMZN", "Amazon", "us", "mention", sector="Other")
    db.insert_pick(654, "AAPL", "Apple", "us", "watching", sector="Other",
                   quote="甚至像那種蘋果的論述")
    db.update_pick_prices(654, "NVDA", entry=199.98, sparkline="[199.98,202]", status="backfilling")
    db.update_pick_prices(654, "META", entry=681.36, sparkline="[681,672]", status="backfilling")
    db.update_pick_prices(654, "AMZN", entry=249.19, sparkline="[249,252]", status="backfilling")
    db.update_pick_prices(654, "AAPL", entry=270.33, sparkline="[273,267.12]", status="backfilling")

    # --- EP630 TW picks (4) — with performance data ---
    db.insert_pick(630, "2330", "台積電", "tw", "mention", sector="ASIC")
    db.insert_pick(630, "2454", "聯發科", "tw", "doing", sector="ASIC")
    db.insert_pick(630, "0050", "元大台灣50", "tw", "mention", sector="ETF")
    db.insert_pick(630, "2337", "旺宏", "tw", "mention", sector="Other")
    db.update_pick_prices(630, "2330", entry=1759.26, w1=0.6, w2=0.8, m1=7.6,
                          sparkline="[1759,1800]", status="backfilling")
    db.update_pick_prices(630, "2454", entry=1740.0, w1=1.1, w2=-1.7, m1=2.0,
                          sparkline="[1740,2090]", status="backfilling")
    db.update_pick_prices(630, "0050", entry=72.25, w1=0.5, w2=-0.5, m1=7.1,
                          sparkline="[72.25,73]", status="backfilling")
    db.update_pick_prices(630, "2337", entry=72.5, w1=28.0, w2=11.4, m1=48.3,
                          sparkline="[72.5,100]", status="backfilling")

    # --- EP630 US picks (2) — with performance + benchmark data ---
    db.insert_pick(630, "ASTS", "AST SpaceMobile", "us", "mention", sector="Other")
    db.insert_pick(630, "PSTG", "Pure Storage", "us", "mention", sector="Other")
    db.update_pick_prices(630, "ASTS", entry=112.55, w1=-1.2, w2=-9.6, m1=-23.7,
                          bench_w1=-0.1, bench_w2=-0.3, bench_m1=-0.8,
                          sparkline="[112,86]", status="backfilling")
    db.update_pick_prices(630, "PSTG", entry=69.89, w1=-0.5, w2=1.6, m1=-3.1,
                          bench_w1=-0.1, bench_w2=-0.3, bench_m1=-0.8,
                          sparkline="[69.89,68]", status="backfilling")


@pytest.fixture
def client(tmp_db):
    """TestClient with empty DB."""
    from backend.server import app
    return TestClient(app)


@pytest.fixture
def seeded_client(tmp_db):
    """TestClient with fully seeded DB (same data as e2e/journey tests)."""
    _seed_db()
    from backend.server import app
    return TestClient(app)
