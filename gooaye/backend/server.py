from contextlib import asynccontextmanager
from fastapi import FastAPI
from backend import db


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
