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
        {"ticker": "AVGO", "confidence": "doing", "w1": 2.8, "w2": 4.1, "m1": 7.3, "q1": 18.2, "bench_q1": 3.1},
        {"ticker": "ARM", "confidence": "watching", "w1": -1.2, "w2": 0.8, "m1": 2.4, "q1": 5.8, "bench_q1": 3.1},
    ]
    stats = generate.compute_stats(picks_us, "us")
    assert stats["total_picks"] == 2
    assert stats["doing"] == 1
    assert stats["watching"] == 1
    assert stats["hit_rate_w1"] == 0.5
    assert stats["avg_q1"] == 12.0
    assert stats["vs_spy_q1"] == round(12.0 - 3.1, 1)
    assert stats["best_pick"]["ticker"] == "AVGO"


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
