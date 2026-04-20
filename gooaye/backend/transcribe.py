import json
import logging

import requests

from backend import config, db, ticker_map

logger = logging.getLogger(__name__)


def _build_phrase_list():
    names = ticker_map.get_all_names()
    return ",".join(names)


def run(ep, audio_path=None):
    if audio_path is None:
        audio_path = config.AUDIO_DIR / f"EP{ep}.mp3"

    logger.info("Transcribing EP%d from %s", ep, audio_path)

    phrase_list = _build_phrase_list()

    with open(audio_path, "rb") as f:
        resp = requests.post(
            config.STT_API_URL,
            headers={"Authorization": f"Bearer {config.STT_API_KEY}"},
            files={"file": (audio_path.name, f, "audio/mpeg")},
            data={"phrase_list": phrase_list},
        )
    resp.raise_for_status()

    result = resp.json()
    segments = result.get("segments", [])

    db.update_episode_transcript(ep, json.dumps(segments, ensure_ascii=False))
    logger.info("EP%d: %d segments transcribed", ep, len(segments))
    return segments


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m backend.transcribe EP542.mp3")
        sys.exit(1)
    filename = sys.argv[1]
    import re
    m = re.search(r"(\d+)", filename)
    if not m:
        print("Cannot parse episode number from filename")
        sys.exit(1)
    ep_num = int(m.group(1))
    from pathlib import Path
    run(ep_num, Path(filename))
