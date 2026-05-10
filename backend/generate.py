import json
import logging
import math

from backend import config, db

logger = logging.getLogger(__name__)


def compute_stats(picks, market):
    total = len(picks)
    doing = sum(1 for p in picks if p["confidence"] == "doing")
    watching = sum(1 for p in picks if p["confidence"] == "watching")
    mention = sum(1 for p in picks if p["confidence"] == "mention")

    stats = {
        "total_picks": total,
        "doing": doing,
        "watching": watching,
        "mention": mention,
    }

    for period in ["w1", "w2", "m1", "q1"]:
        vals = [p[period] for p in picks if p.get(period) is not None]
        if vals:
            stats[f"hit_rate_{period}"] = round(sum(1 for v in vals if v > 0) / len(vals), 2)
            stats[f"avg_{period}"] = round(sum(vals) / len(vals), 1)
        else:
            stats[f"hit_rate_{period}"] = 0
            stats[f"avg_{period}"] = 0

    bench_key = "vs_spy_q1" if market == "us" else "vs_0050_q1"
    bench_vals = [p.get("bench_q1") for p in picks if p.get("bench_q1") is not None]
    avg_bench = round(sum(bench_vals) / len(bench_vals), 1) if bench_vals else 0
    stats[bench_key] = round(stats.get("avg_q1", 0) - avg_bench, 1)

    q1_picks = [(p, p["q1"]) for p in picks if p.get("q1") is not None]
    if q1_picks:
        best = max(q1_picks, key=lambda x: x[1])
        worst = min(q1_picks, key=lambda x: x[1])
        stats["best_pick"] = {"ticker": best[0]["ticker"], "q1": best[1]}
        stats["worst_pick"] = {"ticker": worst[0]["ticker"], "q1": worst[1]}
    else:
        stats["best_pick"] = {"ticker": "-", "q1": 0}
        stats["worst_pick"] = {"ticker": "-", "q1": 0}

    return stats


def format_episodes(episodes):
    result = []
    for e in episodes:
        result.append({
            "ep": e["ep"],
            "title": e["title"],
            "date": e["date"],
            "duration": e["duration"],
            "market_focus": e["market_focus"],
        })
    return result


def format_picks(picks, ep_dates):
    result = []
    for p in picks:
        sparkline = p["sparkline"]
        if isinstance(sparkline, str):
            try:
                sparkline = json.loads(sparkline)
            except (json.JSONDecodeError, TypeError):
                sparkline = []

        def _clean(v):
            if v is None:
                return None
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            return v

        clean_spark = [s for s in (sparkline or []) if s is not None and not (isinstance(s, float) and math.isnan(s))]

        result.append({
            "ep": p["ep"],
            "ticker": p["ticker"],
            "name": p["name"],
            "market": p["market"],
            "mention_date": ep_dates.get(p["ep"], ""),
            "confidence": p["confidence"],
            "sector": p.get("sector"),
            "quote": p.get("quote"),
            "w1": _clean(p.get("w1")),
            "w2": _clean(p.get("w2")),
            "m1": _clean(p.get("m1")),
            "q1": _clean(p.get("q1")),
            "bench_w1": _clean(p.get("bench_w1")),
            "bench_w2": _clean(p.get("bench_w2")),
            "bench_m1": _clean(p.get("bench_m1")),
            "bench_q1": _clean(p.get("bench_q1")),
            "entry": _clean(p.get("entry")),
            "sparkline": clean_spark,
        })
    return result


def format_sectors(sectors, ep_dates):
    result = []
    for s in sectors:
        tickers = s["tickers"]
        if isinstance(tickers, str):
            try:
                tickers = json.loads(tickers)
            except (json.JSONDecodeError, TypeError):
                tickers = []

        result.append({
            "ep": s["ep"],
            "name": s["name"],
            "sentiment": s["sentiment"],
            "quote": s.get("quote"),
            "tickers": tickers or [],
            "mention_date": ep_dates.get(s["ep"], ""),
        })
    return result


def write_data_js():
    episodes = db.get_latest_episodes(10)
    ep_list = [e["ep"] for e in episodes]
    picks = db.get_picks_for_episodes(ep_list)
    sectors = db.get_sectors_for_episodes(ep_list)

    ep_dates = {e["ep"]: e["date"] for e in episodes}

    us_picks = [p for p in picks if p["market"] == "us"]
    tw_picks = [p for p in picks if p["market"] == "tw"]

    data = {
        "episodes": format_episodes(episodes),
        "picks": format_picks(picks, ep_dates),
        "sectors": format_sectors(sectors, ep_dates),
        "stats": {
            "us": compute_stats(us_picks, "us"),
            "tw": compute_stats(tw_picks, "tw"),
        },
    }

    js = f"window.GOOAYE_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
    config.DATA_JS_PATH.write_text(js, encoding="utf-8")
    logger.info("Wrote data.js with %d episodes, %d picks, %d sectors", len(episodes), len(picks), len(sectors))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db.init_db()
    write_data_js()
