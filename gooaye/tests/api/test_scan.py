"""API tests for POST /api/scan

Verifies:
  - No new episodes → total_new=0
  - New episodes found → inserted into DB + audio downloaded
  - Multiple new episodes in single scan
  - Response shape (new_episodes list, total_new count)
  - RSS failure returns error instead of 500
  - Missing audio URL skips download gracefully
"""
from unittest.mock import patch

from backend import db


def test_scan_no_new(client):
    with patch("backend.rss.check_new", return_value=[]):
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_new"] == 0
    assert data["new_episodes"] == []


def test_scan_finds_one(client):
    fake = [{"ep": 700, "title": "EP700 新集", "date": "2026-05-01",
             "duration": "3000", "rss_url": "https://example.com/ep700.mp3"}]
    with patch("backend.rss.check_new", return_value=fake):
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_new"] == 1
    assert data["new_episodes"][0]["ep"] == 700
    assert data["new_episodes"][0]["title"] == "EP700 新集"


def test_scan_inserts_episode_into_db(client):
    fake = [{"ep": 701, "title": "EP701", "date": "2026-05-02",
             "duration": "2500", "rss_url": "https://example.com/ep701.mp3"}]
    with patch("backend.rss.check_new", return_value=fake):
        client.post("/api/scan")
    ep = db.get_episode(701)
    assert ep is not None
    assert ep["title"] == "EP701"
    assert ep["date"] == "2026-05-02"


def test_scan_finds_multiple(client):
    fake = [
        {"ep": 702, "title": "EP702", "date": "2026-05-03",
         "rss_url": "https://example.com/702.mp3"},
        {"ep": 703, "title": "EP703", "date": "2026-05-04",
         "rss_url": "https://example.com/703.mp3"},
    ]
    with patch("backend.rss.check_new", return_value=fake):
        resp = client.post("/api/scan")
    data = resp.json()
    assert data["total_new"] == 2
    assert [e["ep"] for e in data["new_episodes"]] == [702, 703]


def test_scan_does_not_duplicate_existing(seeded_client):
    with patch("backend.rss.check_new", return_value=[]):
        resp = seeded_client.post("/api/scan")
    assert resp.json()["total_new"] == 0
    eps = seeded_client.get("/api/episodes").json()["episodes"]
    assert len(eps) == 2


def test_scan_rss_failure_returns_error(client):
    """RSS exception should return 200 with error message, not 500."""
    with patch("backend.rss.check_new", side_effect=Exception("Connection timeout")):
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_new"] == 0
    assert "Connection timeout" in data["error"]


def test_scan_does_not_download_audio(client):
    """Scan only inserts records — audio download is deferred to process step."""
    fake = [{"ep": 710, "title": "EP710", "date": "2026-05-10",
             "rss_url": "https://example.com/ep710.mp3"}]
    with patch("backend.rss.check_new", return_value=fake), \
         patch("backend.rss.download_audio") as mock_dl:
        resp = client.post("/api/scan")
    assert resp.status_code == 200
    assert resp.json()["total_new"] == 1
    mock_dl.assert_not_called()
    assert db.get_episode(710) is not None
