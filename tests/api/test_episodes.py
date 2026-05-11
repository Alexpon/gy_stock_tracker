"""API tests for GET /api/episodes

Verifies:
  - Empty DB returns empty list
  - Episode fields (ep, title, date, duration, has_transcript, picks_count, has_prices, status)
  - Status logic: pending / partial / completed
  - Ordering: newest episode first
  - Picks count matches actual picks in DB
"""
import json

from backend import db


def test_episodes_empty(client):
    resp = client.get("/api/episodes")
    assert resp.status_code == 200
    assert resp.json()["episodes"] == []


def test_episodes_returns_all_seeded(seeded_client):
    resp = seeded_client.get("/api/episodes")
    assert resp.status_code == 200
    eps = resp.json()["episodes"]
    assert len(eps) == 2


def test_episodes_ordered_newest_first(seeded_client):
    eps = seeded_client.get("/api/episodes").json()["episodes"]
    assert eps[0]["ep"] == 654
    assert eps[1]["ep"] == 630


def test_episode_fields_ep654(seeded_client):
    eps = seeded_client.get("/api/episodes").json()["episodes"]
    ep654 = eps[0]
    assert ep654["ep"] == 654
    assert ep654["title"] == "EP654 | 🌵"
    assert ep654["date"] == "2026-04-18"
    assert ep654["duration"] == "2999"
    assert ep654["has_transcript"] is True
    assert ep654["picks_count"] == 9
    assert ep654["has_prices"] is True


def test_episode_fields_ep630(seeded_client):
    eps = seeded_client.get("/api/episodes").json()["episodes"]
    ep630 = eps[1]
    assert ep630["ep"] == 630
    assert ep630["title"] == "EP630 | ⭐"
    assert ep630["date"] == "2026-01-24"
    assert ep630["duration"] == "3100"
    assert ep630["has_transcript"] is True
    assert ep630["picks_count"] == 6
    assert ep630["has_prices"] is True


def test_status_pending(client):
    """Episode with no transcript, no picks → pending."""
    db.insert_episode(100, "EP100", "2026-01-01")
    eps = client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "pending"


def test_status_partial_transcript_only(client):
    """Episode with transcript but no picks → partial."""
    db.insert_episode(101, "EP101", "2026-01-02")
    db.update_episode_transcript(101, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    eps = client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "partial"


def test_status_partial_picks_only(client):
    """Episode with picks but no transcript → partial."""
    db.insert_episode(102, "EP102", "2026-01-03")
    db.insert_pick(102, "AAPL", "Apple", "us", "mention")
    eps = client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "partial"


def test_status_partial_picks_without_q1(client):
    """Episode with transcript + picks + entry but no market_focus → partial."""
    db.insert_episode(103, "EP103", "2026-01-04")
    db.update_episode_transcript(103, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    db.insert_pick(103, "AAPL", "Apple", "us", "mention")
    db.update_pick_prices(103, "AAPL", entry=150.0, w1=1.0)
    eps = client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "partial"
    assert eps[0]["has_prices"] is True


def test_status_completed(client):
    """Episode with transcript + market_focus + entry prices → completed."""
    db.insert_episode(104, "EP104", "2026-01-05")
    db.update_episode_transcript(104, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    db.update_episode_market_focus(104, "us")
    db.insert_pick(104, "AAPL", "Apple", "us", "mention")
    db.update_pick_prices(104, "AAPL", entry=150.0, q1=5.0)
    eps = client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "completed"
    assert eps[0]["has_prices"] is True


def test_status_completed_requires_all_picks_have_q1(client):
    """If any pick lacks q1, status is partial."""
    db.insert_episode(105, "EP105", "2026-01-06")
    db.update_episode_transcript(105, json.dumps([{"text": "t", "start": 0, "end": 1}]))
    db.insert_pick(105, "AAPL", "Apple", "us", "mention")
    db.insert_pick(105, "NVDA", "NVIDIA", "us", "doing")
    db.update_pick_prices(105, "AAPL", entry=150.0, q1=5.0)
    eps = client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "partial"


def test_seeded_status_both_partial(seeded_client):
    """Both seeded episodes have transcript + picks but no q1 → partial."""
    eps = seeded_client.get("/api/episodes").json()["episodes"]
    assert eps[0]["status"] == "partial"
    assert eps[1]["status"] == "partial"
