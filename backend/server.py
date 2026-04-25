from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from backend import db, rss, transcribe, extract, prices
from backend.generate import format_episodes, format_picks, compute_stats

_frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    yield


app = FastAPI(title="Gooaye API", lifespan=lifespan)


@app.get("/api/episodes")
def list_episodes():
    episodes = db.get_latest_episodes(n=100)
    result = []
    for ep_row in episodes:
        ep_num = ep_row["ep"]
        has_transcript = ep_row["transcript"] is not None
        picks = db.get_picks_for_episode(ep_num)
        picks_count = len(picks)
        has_prices = picks_count > 0 and all(
            p["q1"] is not None for p in picks
        )

        if has_transcript and picks_count > 0 and has_prices:
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
    return {"episodes": result}


@app.post("/api/scan")
def scan_episodes():
    new_episodes = rss.check_new()
    result = []
    for ep_info in new_episodes:
        db.insert_episode(
            ep_info["ep"], ep_info["title"], ep_info["date"],
            ep_info.get("duration"), ep_info.get("audio_url"),
        )
        rss.download_audio(ep_info["ep"], ep_info["audio_url"])
        result.append({"ep": ep_info["ep"], "title": ep_info["title"]})
    return {"new_episodes": result, "total_new": len(result)}


@app.post("/api/process/{ep}")
def process_episode(ep: int):
    episode = db.get_episode(ep)
    if not episode:
        raise HTTPException(status_code=404, detail=f"Episode {ep} not found")

    steps = {}
    pipeline = []

    if episode["transcript"] is None:
        pipeline.append(("stt", lambda: transcribe.run(ep)))
    else:
        steps["stt"] = "skipped"

    existing_picks = db.get_picks_for_episode(ep)
    if len(existing_picks) == 0:
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
    ep_dates = {e["ep"]: e["date"] for e in episodes}

    formatted_eps = format_episodes(episodes)
    formatted_picks = format_picks(picks, ep_dates)

    us_picks = [p for p in formatted_picks if p["market"] == "us"]
    tw_picks = [p for p in formatted_picks if p["market"] == "tw"]

    return {
        "episodes": formatted_eps,
        "picks": formatted_picks,
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
