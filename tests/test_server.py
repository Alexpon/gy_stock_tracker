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
    assert eps[1]["has_prices"] is True


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
         "duration": "3000", "rss_url": "https://example.com/ep659.mp3"}
    ]
    with patch("backend.rss.check_new", return_value=fake_episodes):
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_new"] == 1
    assert data["new_episodes"][0]["ep"] == 659


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
