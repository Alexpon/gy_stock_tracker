import pytest
from pathlib import Path


def pytest_collection_modifyitems(items):
    """Run unit tests before e2e/journeys to avoid session-scoped fixture leaks."""
    def _sort_key(item):
        path = str(item.fspath)
        if "/e2e/" in path:
            return 1
        if "/journeys/" in path:
            return 2
        return 0
    items.sort(key=_sort_key)


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("backend.config.DB_PATH", db_path)
    monkeypatch.setattr("backend.config.AUDIO_DIR", tmp_path / "audio")
    (tmp_path / "audio").mkdir()
    from backend import db
    db.init_db()
    return db_path
