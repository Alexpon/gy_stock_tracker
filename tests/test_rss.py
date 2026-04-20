import json
from unittest.mock import patch, MagicMock
import feedparser
from backend import rss

SAMPLE_RSS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>股癌 Gooaye</title>
  <item>
    <title>EP542 | 關稅陰影下的轉單邏輯</title>
    <pubDate>Mon, 14 Apr 2026 00:00:00 +0800</pubDate>
    <itunes:duration>1:42:18</itunes:duration>
    <enclosure url="https://example.com/ep542.mp3" type="audio/mpeg" length="12345"/>
  </item>
  <item>
    <title>EP541 | 財報季前的佈局</title>
    <pubDate>Thu, 10 Apr 2026 00:00:00 +0800</pubDate>
    <itunes:duration>1:28:44</itunes:duration>
    <enclosure url="https://example.com/ep541.mp3" type="audio/mpeg" length="12345"/>
  </item>
</channel>
</rss>"""

# Pre-parse at module level so the result is available before any patches are applied
_PARSED_FEED = feedparser.parse(SAMPLE_RSS_XML)


def test_parse_ep_number():
    assert rss.parse_ep_number("EP542 | 關稅陰影下的轉單邏輯") == 542
    assert rss.parse_ep_number("Ep 541 | 財報季前的佈局") == 541
    assert rss.parse_ep_number("ep543｜測試") == 543
    assert rss.parse_ep_number("沒有集數的標題") is None


def test_parse_date():
    assert rss.parse_date("Mon, 14 Apr 2026 00:00:00 +0800") == "2026-04-14"
    assert rss.parse_date("Thu, 10 Apr 2026 12:00:00 GMT") == "2026-04-10"


@patch("backend.rss.feedparser.parse")
def test_check_new_finds_new_episodes(mock_parse, tmp_db, monkeypatch):
    monkeypatch.setattr("backend.config.RSS_URL", "https://example.com/rss")
    mock_parse.return_value = _PARSED_FEED

    new = rss.check_new()
    assert len(new) == 2
    assert new[0]["ep"] == 541
    assert new[1]["ep"] == 542


@patch("backend.rss.feedparser.parse")
def test_check_new_skips_existing(mock_parse, tmp_db, monkeypatch):
    from backend import db
    monkeypatch.setattr("backend.config.RSS_URL", "https://example.com/rss")
    mock_parse.return_value = _PARSED_FEED

    db.insert_episode(ep=542, title="已存在", date="2026-04-14")
    new = rss.check_new()
    assert len(new) == 1
    assert new[0]["ep"] == 541


@patch("backend.rss.requests.get")
def test_download_audio(mock_get, tmp_db):
    mock_resp = MagicMock()
    mock_resp.iter_content = MagicMock(return_value=[b"fake-mp3-data"])
    mock_resp.raise_for_status = MagicMock()
    mock_get.return_value = mock_resp

    from backend import config
    path = rss.download_audio(542, "https://example.com/ep542.mp3")
    assert path.exists()
    assert path.name == "EP542.mp3"
    assert path.read_bytes() == b"fake-mp3-data"
