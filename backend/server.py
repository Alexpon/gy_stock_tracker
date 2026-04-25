from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from backend import db, rss


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
