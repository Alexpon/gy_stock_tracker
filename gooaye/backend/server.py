import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from backend import config, db, rss, transcribe, extract, prices
from backend.generate import format_episodes, format_picks, format_sectors, compute_stats

logger = logging.getLogger(__name__)
_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"


def _next_run_time():
    """Find the nearest upcoming time from SCHEDULE_TIMES."""
    now = datetime.now()
    candidates = []
    for t in config.SCHEDULE_TIMES:
        h, m = (int(x) for x in t.strip().split(":"))
        candidate = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        candidates.append(candidate)
    return min(candidates)


async def _daily_backfill():
    """Background task: run backfill + regenerate data at SCHEDULE_TIMES daily."""
    while True:
        target = _next_run_time()
        wait = (target - datetime.now()).total_seconds()
        logger.info("Next backfill scheduled at %s (in %.0f seconds)", target, wait)
        await asyncio.sleep(wait)
        try:
            logger.info("Starting daily backfill...")
            await asyncio.to_thread(prices.backfill_all)
            from backend.generate import write_data_js
            await asyncio.to_thread(write_data_js)
            logger.info("Daily backfill complete")
        except Exception:
            logger.exception("Daily backfill failed")


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    task = asyncio.create_task(_daily_backfill())
    yield
    task.cancel()


app = FastAPI(title="Gooaye API", lifespan=lifespan)


@app.get("/api/episodes")
def list_episodes():
    episodes = db.get_latest_episodes(n=100)
    result = []
    for ep_row in episodes:
        ep_num = ep_row["ep"]
        has_transcript = ep_row["transcript"] is not None
        extracted = ep_row.get("market_focus") is not None
        picks = db.get_picks_for_episode(ep_num)
        picks_count = len(picks)
        has_prices = picks_count > 0 and any(
            p["entry"] is not None for p in picks
        )

        if has_transcript and extracted and (picks_count == 0 or has_prices):
            status = "completed"
        elif has_transcript or picks_count > 0:
            status = "partial"
        else:
            status = "pending"

        result.append({
            "ep": ep_num,
            "title": ep_row["title"],
            "date": ep_row["date"],
            "duration": ep_row["duration"],
            "has_transcript": has_transcript,
            "picks_count": picks_count,
            "has_prices": has_prices,
            "status": status,
        })
    total_in_db = db.get_episode_count()
    completed_count = sum(1 for r in result if r["status"] == "completed")
    return {
        "episodes": result,
        "total": total_in_db,
        "completed": completed_count,
    }


@app.post("/api/scan")
def scan_episodes():
    try:
        new_episodes = rss.check_new()
    except Exception as e:
        logger.exception("RSS scan failed")
        return {"new_episodes": [], "total_new": 0, "error": str(e)}
    result = []
    for ep_info in new_episodes:
        audio_url = ep_info.get("rss_url", "")
        db.insert_episode(
            ep_info["ep"], ep_info["title"], ep_info["date"],
            ep_info.get("duration"), audio_url,
        )
        result.append({"ep": ep_info["ep"], "title": ep_info["title"]})
    return {"new_episodes": result, "total_new": len(result)}


@app.post("/api/process/{ep}")
def process_episode(ep: int):
    episode = db.get_episode(ep)
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode {ep} not found")

    steps = {}
    pipeline = []

    need_stt = episode["transcript"] is None
    if not need_stt:
        audio_path = config.AUDIO_DIR / f"EP{ep}.mp3"
        if audio_path.exists():
            import json as _json
            segs = _json.loads(episode["transcript"])
            max_offset = max((s["end"] for s in segs), default=0) if segs else 0
            duration = transcribe._get_duration(audio_path)
            if duration > 0 and max_offset < duration * 0.8:
                need_stt = True

    if need_stt:
        if not episode.get("audio_path"):
            audio_url = episode.get("rss_url", "")
            if audio_url:
                pipeline.append(("download", lambda: rss.download_audio(ep, audio_url)))
            else:
                steps["download"] = "skipped"
        else:
            steps["download"] = "skipped"
        pipeline.append(("stt", lambda: transcribe.run(ep)))
    else:
        steps["download"] = "skipped"
        steps["stt"] = "skipped"

    existing_picks = db.get_picks_for_episode(ep)
    if len(existing_picks) == 0 and (need_stt or not episode.get("market_focus")):
        pipeline.append(("extract", lambda: extract.run(ep)))
    else:
        steps["extract"] = "skipped"

    pipeline.append(("prices", lambda: prices.fetch_new_picks(ep)))

    for name, fn in pipeline:
        try:
            fn()
            steps[name] = "done"
        except Exception as e:
            steps[name] = "failed"
            remaining = [n for n, _ in pipeline if n not in steps]
            for r in remaining:
                steps[r] = "skipped"
            return {"success": False, "steps": steps, "error": str(e)}

    return {"success": True, "steps": steps}


@app.get("/api/data")
def get_data():
    episodes = db.get_latest_episodes(n=10)
    if not episodes:
        return {"episodes": [], "picks": [], "stats": {"us": {}, "tw": {}}}

    ep_list = [e["ep"] for e in episodes]
    picks = db.get_picks_for_episodes(ep_list)
    sectors = db.get_sectors_for_episodes(ep_list)
    ep_dates = {e["ep"]: e["date"] for e in episodes}

    formatted_eps = format_episodes(episodes)
    formatted_picks = format_picks(picks, ep_dates)

    us_picks = [p for p in formatted_picks if p["market"] == "us"]
    tw_picks = [p for p in formatted_picks if p["market"] == "tw"]

    return {
        "episodes": formatted_eps,
        "picks": formatted_picks,
        "sectors": format_sectors(sectors, ep_dates),
        "stats": {
            "us": compute_stats(us_picks, "us"),
            "tw": compute_stats(tw_picks, "tw"),
        },
    }


if _frontend_dist.exists():
    @app.get("/{path:path}")
    def serve_spa(path: str):
        file = _frontend_dist / path
        if file.exists() and file.is_file():
            return FileResponse(file)
        return FileResponse(_frontend_dist / "index.html")
