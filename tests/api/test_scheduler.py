"""API tests for daily backfill scheduler.

Verifies:
  - _next_run_time picks the nearest upcoming time from SCHEDULE_TIMES
  - backfill_all and write_data_js are called when scheduled time arrives
  - Scheduler survives exceptions and continues to next cycle
  - Multiple schedule times work correctly
"""
import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock

import pytest


@pytest.mark.asyncio
async def test_backfill_calls_backfill_and_generate(tmp_db, monkeypatch):
    monkeypatch.setattr("backend.config.SCHEDULE_TIMES", ["18:00"])
    from backend.server import _daily_backfill

    call_order = []

    def track_backfill():
        call_order.append("backfill")

    def track_generate():
        call_order.append("generate")

    sleep_count = 0

    async def fake_sleep(seconds):
        nonlocal sleep_count
        sleep_count += 1
        if sleep_count >= 2:
            raise asyncio.CancelledError()

    with patch("backend.prices.backfill_all", side_effect=track_backfill), \
         patch("backend.generate.write_data_js", side_effect=track_generate), \
         patch("asyncio.sleep", side_effect=fake_sleep):
        task = asyncio.create_task(_daily_backfill())
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert call_order == ["backfill", "generate"]


@pytest.mark.asyncio
async def test_next_run_picks_nearest_future(tmp_db, monkeypatch):
    """With two times, should pick the one coming up soonest."""
    now = datetime.now()
    soon = (now + timedelta(minutes=10)).strftime("%H:%M")
    later = (now + timedelta(hours=5)).strftime("%H:%M")
    monkeypatch.setattr("backend.config.SCHEDULE_TIMES", [later, soon])
    from backend.server import _next_run_time

    target = _next_run_time()
    wait = (target - now).total_seconds()
    assert 500 < wait < 700, f"Should pick ~10min target, got {wait:.0f}s"


@pytest.mark.asyncio
async def test_next_run_wraps_to_tomorrow(tmp_db, monkeypatch):
    """If all times already passed today, pick earliest tomorrow."""
    now = datetime.now()
    past1 = (now - timedelta(hours=2)).strftime("%H:%M")
    past2 = (now - timedelta(hours=1)).strftime("%H:%M")
    monkeypatch.setattr("backend.config.SCHEDULE_TIMES", [past1, past2])
    from backend.server import _next_run_time

    target = _next_run_time()
    wait = (target - now).total_seconds()
    assert 79000 < wait < 90000, f"Should wait ~22-24h, got {wait:.0f}s"


@pytest.mark.asyncio
async def test_default_schedule_times(tmp_db):
    """Default SCHEDULE_TIMES should be 06:00 and 16:00."""
    from backend import config
    assert config.SCHEDULE_TIMES == ["06:00", "16:00"]


@pytest.mark.asyncio
async def test_backfill_survives_exception(tmp_db, monkeypatch):
    monkeypatch.setattr("backend.config.SCHEDULE_TIMES", ["18:00"])
    from backend.server import _daily_backfill

    attempt = 0

    async def fake_sleep(seconds):
        nonlocal attempt
        attempt += 1
        if attempt >= 3:
            raise asyncio.CancelledError()

    with patch("backend.prices.backfill_all", side_effect=RuntimeError("API down")), \
         patch("backend.generate.write_data_js"), \
         patch("asyncio.sleep", side_effect=fake_sleep):
        task = asyncio.create_task(_daily_backfill())
        try:
            await task
        except asyncio.CancelledError:
            pass

    assert attempt >= 2, "Scheduler should have continued after exception"


@pytest.mark.asyncio
async def test_lifespan_starts_and_cancels_task(tmp_db, monkeypatch):
    monkeypatch.setattr("backend.config.SCHEDULE_TIMES", ["18:00"])
    from backend.server import app, lifespan

    real_sleep = asyncio.sleep

    async def selective_sleep(seconds):
        if seconds == 0:
            return await real_sleep(0)
        raise asyncio.CancelledError()

    with patch("asyncio.sleep", side_effect=selective_sleep):
        async with lifespan(app):
            await real_sleep(0)
