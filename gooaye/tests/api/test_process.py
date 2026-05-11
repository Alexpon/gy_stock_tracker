"""API tests for POST /api/process/{ep}

Verifies:
  - 404 when episode doesn't exist
  - Full pipeline: STT → extract → prices all run
  - Skip STT when transcript exists
  - Skip extract when picks exist
  - Pipeline failure halts remaining steps
  - Failure at different stages (STT, extract, prices)
"""
import json
from unittest.mock import patch

from backend import db


def test_process_not_found(client):
    resp = client.post("/api/process/999")
    assert resp.status_code == 404


def test_process_full_pipeline(client):
    """Episode with no data — all 3 steps should run."""
    db.insert_episode(800, "EP800", "2026-06-01")
    with patch("backend.transcribe.run") as m_stt, \
         patch("backend.extract.run") as m_ext, \
         patch("backend.prices.fetch_new_picks") as m_pri:
        resp = client.post("/api/process/800")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["steps"]["stt"] == "done"
    assert data["steps"]["extract"] == "done"
    assert data["steps"]["prices"] == "done"
    m_stt.assert_called_once_with(800)
    m_ext.assert_called_once_with(800)
    m_pri.assert_called_once_with(800)


def test_process_skips_stt_when_transcript_exists(client):
    db.insert_episode(801, "EP801", "2026-06-02")
    db.update_episode_transcript(801, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    with patch("backend.transcribe.run") as m_stt, \
         patch("backend.extract.run") as m_ext, \
         patch("backend.prices.fetch_new_picks") as m_pri:
        resp = client.post("/api/process/801")
    data = resp.json()
    assert data["success"] is True
    assert data["steps"]["stt"] == "skipped"
    assert data["steps"]["extract"] == "done"
    assert data["steps"]["prices"] == "done"
    m_stt.assert_not_called()


def test_process_skips_extract_when_picks_exist(client):
    db.insert_episode(802, "EP802", "2026-06-03")
    db.update_episode_transcript(802, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    db.insert_pick(802, "AAPL", "Apple", "us", "mention")
    db.insert_sector(802, "Tech", "bullish")
    with patch("backend.transcribe.run") as m_stt, \
         patch("backend.extract.run") as m_ext, \
         patch("backend.prices.fetch_new_picks") as m_pri:
        resp = client.post("/api/process/802")
    data = resp.json()
    assert data["success"] is True
    assert data["steps"]["stt"] == "skipped"
    assert data["steps"]["extract"] == "skipped"
    assert data["steps"]["prices"] == "done"
    m_stt.assert_not_called()
    m_ext.assert_not_called()
    m_pri.assert_called_once_with(802)


def test_process_stt_failure_skips_rest(client):
    db.insert_episode(803, "EP803", "2026-06-04")
    with patch("backend.transcribe.run", side_effect=Exception("STT API timeout")):
        resp = client.post("/api/process/803")
    data = resp.json()
    assert data["success"] is False
    assert "STT API timeout" in data["error"]
    assert data["steps"]["stt"] == "failed"
    assert data["steps"]["extract"] == "skipped"
    assert data["steps"]["prices"] == "skipped"


def test_process_extract_failure_skips_prices(client):
    db.insert_episode(804, "EP804", "2026-06-05")
    db.update_episode_transcript(804, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    with patch("backend.extract.run", side_effect=Exception("LLM rate limit")), \
         patch("backend.prices.fetch_new_picks") as m_pri:
        resp = client.post("/api/process/804")
    data = resp.json()
    assert data["success"] is False
    assert "LLM rate limit" in data["error"]
    assert data["steps"]["stt"] == "skipped"
    assert data["steps"]["extract"] == "failed"
    assert data["steps"]["prices"] == "skipped"
    m_pri.assert_not_called()


def test_process_prices_failure(client):
    db.insert_episode(805, "EP805", "2026-06-06")
    db.update_episode_transcript(805, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    db.insert_pick(805, "AAPL", "Apple", "us", "mention")
    db.insert_sector(805, "Tech", "bullish")
    with patch("backend.prices.fetch_new_picks", side_effect=Exception("Yahoo Finance down")):
        resp = client.post("/api/process/805")
    data = resp.json()
    assert data["success"] is False
    assert "Yahoo Finance down" in data["error"]
    assert data["steps"]["stt"] == "skipped"
    assert data["steps"]["extract"] == "skipped"
    assert data["steps"]["prices"] == "failed"


def test_process_seeded_ep654(seeded_client):
    """EP654 has transcript + picks → only prices runs."""
    with patch("backend.transcribe.run") as m_stt, \
         patch("backend.extract.run") as m_ext, \
         patch("backend.prices.fetch_new_picks") as m_pri:
        resp = seeded_client.post("/api/process/654")
    data = resp.json()
    assert data["success"] is True
    assert data["steps"]["stt"] == "skipped"
    assert data["steps"]["extract"] == "skipped"
    assert data["steps"]["prices"] == "done"
    m_stt.assert_not_called()
    m_ext.assert_not_called()
    m_pri.assert_called_once_with(654)
