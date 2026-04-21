import pytest
from pathlib import Path


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("backend.config.DB_PATH", db_path)
    monkeypatch.setattr("backend.config.AUDIO_DIR", tmp_path / "audio")
    (tmp_path / "audio").mkdir()
    from backend import db
    db.init_db()
    return db_path
