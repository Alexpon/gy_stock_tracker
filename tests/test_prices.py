import json
from datetime import datetime
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from backend import prices, db


def _make_price_df(dates, opens, closes):
    idx = pd.DatetimeIndex(dates)
    return pd.DataFrame({"Open": opens, "Close": closes}, index=idx)


def test_yf_ticker_format():
    assert prices.yf_ticker("AVGO", "us") == "AVGO"
    assert prices.yf_ticker("2330", "tw") == "2330.TW"


def test_bench_ticker():
    assert prices.bench_ticker("us") == "SPY"
    assert prices.bench_ticker("tw") == "0050.TW"


@patch("backend.prices.yf.download")
def test_fetch_entry_price(mock_dl, tmp_db):
    dates = pd.date_range("2026-04-15", periods=5, freq="B")
    df = _make_price_df(dates, [1842.5, 1845, 1850, 1848, 1852], [1845, 1850, 1848, 1852, 1855])
    mock_dl.return_value = df

    entry = prices.fetch_entry_price("AVGO", "us", "2026-04-14")
    assert entry == 1842.5


@patch("backend.prices.yf.download")
def test_fetch_entry_price_no_data(mock_dl, tmp_db):
    mock_dl.return_value = pd.DataFrame()
    entry = prices.fetch_entry_price("AVGO", "us", "2026-04-14")
    assert entry is None


@patch("backend.prices.yf.download")
def test_calculate_returns_partial(mock_dl, tmp_db):
    dates = pd.date_range("2026-04-15", periods=7, freq="B")
    closes = [1842.5, 1860, 1870, 1880, 1890, 1900, 1910]
    df = _make_price_df(dates, closes, closes)
    mock_dl.return_value = df

    result = prices.calculate_returns("AVGO", "us", "2026-04-15", 1842.5)
    assert result["w1"] == round((1890 - 1842.5) / 1842.5 * 100, 1)
    assert result["w2"] is None
    assert result["m1"] is None
    assert result["q1"] is None


@patch("backend.prices.yf.download")
def test_sparkline_generation(mock_dl, tmp_db):
    dates = pd.date_range("2026-01-01", periods=60, freq="B")
    closes = list(range(100, 160))
    df = _make_price_df(dates, closes, closes)
    mock_dl.return_value = df

    result = prices.calculate_returns("AVGO", "us", "2026-01-01", 100)
    assert len(result["sparkline"]) == 24
    assert result["sparkline"][0] == 100.0
    assert result["sparkline"][-1] == 159.0


@patch("backend.prices.yf.download")
def test_fetch_new_picks(mock_dl, tmp_db):
    dates = pd.date_range("2026-04-15", periods=10, freq="B")
    closes = [1842.5 + i * 10 for i in range(10)]
    df = _make_price_df(dates, closes, closes)
    mock_dl.return_value = df

    db.insert_episode(ep=542, title="測試", date="2026-04-14")
    db.insert_pick(ep=542, ticker="AVGO", name="Broadcom", market="us", confidence="doing")

    prices.fetch_new_picks(542)

    picks = db.get_picks_for_episode(542)
    assert picks[0]["entry"] is not None
    assert picks[0]["status"] == "backfilling"
