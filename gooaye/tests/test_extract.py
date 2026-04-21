import json
from unittest.mock import patch, MagicMock
from backend import extract, db


SAMPLE_TRANSCRIPT = [
    {"start": 0.0, "end": 3.2, "text": "哈囉大家好", "speaker": "SPEAKER_00"},
    {"start": 3.2, "end": 8.5, "text": "今天來聊博通", "speaker": "SPEAKER_00"},
    {"start": 8.5, "end": 15.1, "text": "博通這段我還抱著ASIC的能見度明年都看得到", "speaker": "SPEAKER_00"},
    {"start": 15.1, "end": 22.0, "text": "拉回就是加的機會我沒有要跑", "speaker": "SPEAKER_00"},
    {"start": 22.0, "end": 30.5, "text": "台積電就不用多說了法說再看", "speaker": "SPEAKER_00"},
]

SAMPLE_LLM_RESPONSE = {
    "picks": [
        {
            "ticker": "AVGO",
            "name": "Broadcom",
            "market": "us",
            "confidence": "doing",
            "sector": "ASIC",
            "quote": "博通這段我還抱著，ASIC的能見度明年都看得到，拉回就是加的機會，我沒有要跑。",
            "segment_indices": [2, 3],
        },
        {
            "ticker": "2330",
            "name": "台積電",
            "market": "tw",
            "confidence": "mention",
            "sector": "Semi-foundry",
            "quote": "台積電就不用多說了法說再看",
            "segment_indices": [4],
        },
    ]
}


def _mock_openai_response(content):
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps(content, ensure_ascii=False)
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    return mock_resp


@patch("backend.extract.AzureOpenAI")
def test_extract_picks(mock_client_cls, tmp_db):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(SAMPLE_LLM_RESPONSE)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    picks = extract.run(542)

    assert len(picks) == 2
    assert picks[0]["ticker"] == "AVGO"
    assert picks[0]["confidence"] == "doing"

    db_picks = db.get_picks_for_episode(542)
    assert len(db_picks) == 2
    assert db_picks[0]["ticker"] == "AVGO"


@patch("backend.extract.AzureOpenAI")
def test_extract_maps_segment_timestamps(mock_client_cls, tmp_db):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(SAMPLE_LLM_RESPONSE)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    extract.run(542)

    db_picks = db.get_picks_for_episode(542)
    avgo = db_picks[0]
    assert avgo["segment_start"] == 8.5
    assert avgo["segment_end"] == 22.0

    tsmc = db_picks[1]
    assert tsmc["segment_start"] == 22.0
    assert tsmc["segment_end"] == 30.5


@patch("backend.extract.AzureOpenAI")
def test_extract_updates_market_focus(mock_client_cls, tmp_db):
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(SAMPLE_LLM_RESPONSE)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    extract.run(542)

    episode = db.get_episode(542)
    assert episode["market_focus"] == "mixed"


@patch("backend.extract.AzureOpenAI")
def test_extract_handles_unknown_ticker(mock_client_cls, tmp_db):
    response_with_unknown = {
        "picks": [
            {
                "ticker": "NEWCO",
                "name": "新公司",
                "market": "us",
                "confidence": "mention",
                "sector": "Other",
                "quote": "新公司提一下",
                "segment_indices": [0],
            }
        ]
    }
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _mock_openai_response(response_with_unknown)
    mock_client_cls.return_value = mock_client

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.update_episode_transcript(542, json.dumps(SAMPLE_TRANSCRIPT))

    from backend import ticker_map
    extract.run(542)

    result = ticker_map.lookup_by_ticker("NEWCO")
    assert result is not None
    assert result[1] == "新公司"
