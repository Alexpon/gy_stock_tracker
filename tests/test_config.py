def test_config_loads_defaults():
    from backend import config

    assert config.STT_API_URL == "https://llminternal-dev.deepq.ai:50500/v1/audio/transcriptions"
    assert config.AZURE_OPENAI_MODEL == "gpt-4.1-mini"
    assert config.SCHEDULE_TIMES == ["06:00", "16:00"]
    assert config.DB_PATH.name == "gooaye.db"
    assert config.AUDIO_DIR.name == "audio"
    assert config.DATA_JS_PATH.name == "data.js"


def test_config_paths_are_absolute():
    from backend import config

    assert config.DB_PATH.is_absolute()
    assert config.AUDIO_DIR.is_absolute()
    assert config.DATA_JS_PATH.is_absolute()
    assert config.BASE_DIR.is_absolute()
