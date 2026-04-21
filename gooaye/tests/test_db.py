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
