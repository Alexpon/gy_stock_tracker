import json
import logging
from datetime import datetime, timedelta

import yfinance as yf

from backend import config, db

logger = logging.getLogger(__name__)

RETURN_PERIODS = [("w1", 5), ("w2", 10), ("m1", 21), ("q1", 63)]


def yf_ticker(ticker, market):
    return f"{ticker}.TW" if market == "tw" else ticker


def bench_ticker(market):
    return "0050.TW" if market == "tw" else "SPY"


def _flatten_columns(data, ticker_symbol):
    """Flatten MultiIndex columns returned by yfinance 0.2.x for single ticker."""
    if isinstance(data.columns, pd.MultiIndex):
        # Drop the ticker level to get single-level columns
        data = data.droplevel(1, axis=1)
    return data


def fetch_entry_price(ticker, market, mention_date):
    import pandas as pd
    yf_t = yf_ticker(ticker, market)
    start = datetime.strptime(mention_date, "%Y-%m-%d") + timedelta(days=1)
    end = start + timedelta(days=10)
    data = yf.download(yf_t, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), progress=False)
    if data.empty:
        logger.warning("No price data for %s after %s", ticker, mention_date)
        return None
    # Flatten MultiIndex columns if present (yfinance 0.2.x single ticker)
    if isinstance(data.columns, pd.MultiIndex):
        data = data.droplevel(1, axis=1)
    return round(float(data["Open"].iloc[0]), 2)


def calculate_returns(ticker, market, entry_date_str, entry_price):
    import pandas as pd
    yf_t = yf_ticker(ticker, market)
    start = datetime.strptime(entry_date_str, "%Y-%m-%d")
    end = datetime.now() + timedelta(days=1)
    data = yf.download(yf_t, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), progress=False)

    if data.empty:
        return {"w1": None, "w2": None, "m1": None, "q1": None, "sparkline": []}

    # Flatten MultiIndex columns if present (yfinance 0.2.x single ticker)
    if isinstance(data.columns, pd.MultiIndex):
        data = data.droplevel(1, axis=1)

    trading_days = len(data)
    returns = {}
    for period, days in RETURN_PERIODS:
        if trading_days >= days:
            close = float(data["Close"].iloc[days - 1])
            returns[period] = round((close - entry_price) / entry_price * 100, 1)
        else:
            returns[period] = None

    import math
    closes = [float(c) for c in data["Close"].values.tolist() if not (isinstance(c, float) and math.isnan(c))]
    if len(closes) >= 24:
        indices = [int(i * (len(closes) - 1) / 23) for i in range(24)]
        sparkline = [round(closes[i], 2) for i in indices]
    else:
        sparkline = [round(c, 2) for c in closes]

    returns["sparkline"] = sparkline
    return returns


def calculate_bench_returns(market, entry_date_str):
    import pandas as pd
    bt = bench_ticker(market)
    start = datetime.strptime(entry_date_str, "%Y-%m-%d")
    end = datetime.now() + timedelta(days=1)
    data = yf.download(bt, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), progress=False)
    if data.empty:
        return {"bench_w1": None, "bench_w2": None, "bench_m1": None, "bench_q1": None}
    if isinstance(data.columns, pd.MultiIndex):
        data = data.droplevel(1, axis=1)
    entry = float(data["Open"].iloc[0])
    results = {}
    for period, days in RETURN_PERIODS:
        if len(data) >= days:
            close = float(data["Close"].iloc[days - 1])
            results[f"bench_{period}"] = round((close - entry) / entry * 100, 1)
        else:
            results[f"bench_{period}"] = None
    return results


def fetch_new_picks(ep):
    episode = db.get_episode(ep)
    if not episode:
        return
    mention_date = episode["date"]
    picks = db.get_picks_for_episode(ep)

    for pick in picks:
        if pick["entry"] is not None:
            continue
        entry = fetch_entry_price(pick["ticker"], pick["market"], mention_date)
        if entry is None:
            continue

        entry_date = datetime.strptime(mention_date, "%Y-%m-%d") + timedelta(days=1)
        while entry_date.weekday() >= 5:
            entry_date += timedelta(days=1)
        entry_date_str = entry_date.strftime("%Y-%m-%d")

        returns = calculate_returns(pick["ticker"], pick["market"], entry_date_str, entry)
        bench = calculate_bench_returns(pick["market"], entry_date_str)

        status = "completed" if returns.get("q1") is not None else "backfilling"

        db.update_pick_prices(
            ep=ep,
            ticker=pick["ticker"],
            entry=entry,
            w1=returns.get("w1"),
            w2=returns.get("w2"),
            m1=returns.get("m1"),
            q1=returns.get("q1"),
            bench_w1=bench.get("bench_w1"),
            bench_w2=bench.get("bench_w2"),
            bench_m1=bench.get("bench_m1"),
            bench_q1=bench.get("bench_q1"),
            sparkline=json.dumps(returns.get("sparkline", [])),
            status=status,
        )
        logger.info("EP%d %s: entry=%.2f, w1=%s, status=%s", ep, pick["ticker"], entry, returns.get("w1"), status)


def backfill_all():
    pending = db.get_pending_picks()
    logger.info("Backfilling %d pending picks", len(pending))

    for pick in pending:
        if pick["entry"] is None:
            continue
        mention_date = pick["mention_date"]
        entry_date = datetime.strptime(mention_date, "%Y-%m-%d") + timedelta(days=1)
        while entry_date.weekday() >= 5:
            entry_date += timedelta(days=1)
        entry_date_str = entry_date.strftime("%Y-%m-%d")

        returns = calculate_returns(pick["ticker"], pick["market"], entry_date_str, pick["entry"])
        bench = calculate_bench_returns(pick["market"], entry_date_str)

        status = "completed" if returns.get("q1") is not None else "backfilling"

        db.update_pick_prices(
            ep=pick["ep"],
            ticker=pick["ticker"],
            w1=returns.get("w1"),
            w2=returns.get("w2"),
            m1=returns.get("m1"),
            q1=returns.get("q1"),
            bench_w1=bench.get("bench_w1"),
            bench_w2=bench.get("bench_w2"),
            bench_m1=bench.get("bench_m1"),
            bench_q1=bench.get("bench_q1"),
            sparkline=json.dumps(returns.get("sparkline", [])),
            status=status,
        )


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m backend.prices 542")
        sys.exit(1)
    ep_num = int(sys.argv[1])
    fetch_new_picks(ep_num)
