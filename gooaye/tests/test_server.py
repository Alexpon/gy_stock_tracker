import json
import pytest
from unittest.mock import patch
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
