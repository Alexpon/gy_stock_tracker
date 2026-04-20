import json
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend import transcribe, db

SAMPLE_STT_RESPONSE = {
    "language": "zh",
    "language_prob": 0.95,
    "duration": 6138.5,
    "duration_after_vad": 5842.1,
    "segments": [
        {"start": 0.0, "end": 3.2, "text": "哈囉大家好歡迎回來股癌", "speaker": "SPEAKER_00"},
        {"start": 3.2, "end": 8.5, "text": "今天我們來聊一下博通", "speaker": "SPEAKER_00"},
        {"start": 8.5, "end": 15.1, "text": "博通這段我還抱著ASIC的能見度明年都看得到", "speaker": "SPEAKER_00"},
    ],
}


@patch("backend.transcribe.requests.post")
def test_transcribe_episode(mock_post, tmp_db, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_STT_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_post.return_value = mock_resp

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    audio_path = tmp_path / "audio" / "EP542.mp3"
    audio_path.write_bytes(b"fake-mp3")

    segments = transcribe.run(542, audio_path)

    assert len(segments) == 3
    assert segments[0]["text"] == "哈囉大家好歡迎回來股癌"

    episode = db.get_episode(542)
    assert episode["transcript"] is not None
    stored = json.loads(episode["transcript"])
    assert len(stored) == 3


@patch("backend.transcribe.requests.post")
def test_transcribe_sends_phrase_list(mock_post, tmp_db, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = SAMPLE_STT_RESPONSE
    mock_resp.raise_for_status = MagicMock()
    mock_post.return_value = mock_resp

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    audio_path = tmp_path / "audio" / "EP542.mp3"
    audio_path.write_bytes(b"fake-mp3")

    transcribe.run(542, audio_path)

    call_kwargs = mock_post.call_args
    data = call_kwargs.kwargs.get("data") or call_kwargs[1].get("data", {})
    assert "phrase_list" in data
    assert "博通" in data["phrase_list"]
