import logging
import re
from email.utils import parsedate_to_datetime

import feedparser
import requests

from backend import config, db

logger = logging.getLogger(__name__)


def parse_ep_number(title):
    m = re.search(r"[Ee][Pp]\s*(\d+)", title)
    return int(m.group(1)) if m else None


def parse_date(date_str):
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return date_str[:10]


def check_new():
    if not config.RSS_URL:
        logger.error("RSS_URL not configured")
        return []

    feed = feedparser.parse(config.RSS_URL)
    new_episodes = []

    for entry in feed.entries:
        ep = parse_ep_number(entry.get("title", ""))
        if ep is None:
            continue
        if db.episode_exists(ep):
            continue

        date = parse_date(entry.get("published", ""))
        duration = entry.get("itunes_duration", "")
        audio_url = ""
        if hasattr(entry, "enclosures") and entry.enclosures:
            audio_url = entry.enclosures[0].get("href", "")

        new_episodes.append({
            "ep": ep,
            "title": entry.title,
            "date": date,
            "duration": duration,
            "rss_url": audio_url,
        })

    new_episodes.sort(key=lambda x: x["ep"])
    logger.info("Found %d new episode(s)", len(new_episodes))
    return new_episodes


def download_audio(ep, audio_url):
    config.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    path = config.AUDIO_DIR / f"EP{ep}.mp3"

    logger.info("Downloading EP%d → %s", ep, path)
    resp = requests.get(audio_url, stream=True)
    resp.raise_for_status()

    with open(path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    db.update_episode_audio_path(ep, path)
    return path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    episodes = check_new()
    for ep_info in episodes:
        print(f"EP{ep_info['ep']}: {ep_info['title']} ({ep_info['date']})")
