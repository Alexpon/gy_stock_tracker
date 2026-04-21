"""Transcribe a single episode with chunked STT + progress saving.

Usage: python transcribe_ep.py 654
"""
import json
import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

from backend import config, db, transcribe

def main():
    if len(sys.argv) < 2:
        print("Usage: python transcribe_ep.py <episode_number>")
        sys.exit(1)

    ep = int(sys.argv[1])
    db.init_db()

    episode = db.get_episode(ep)
    if not episode:
        print(f"EP{ep} not found in DB")
        sys.exit(1)

    audio_path = config.AUDIO_DIR / f"EP{ep}.mp3"
    if not audio_path.exists():
        print(f"Audio not found: {audio_path}")
        sys.exit(1)

    existing = transcribe._get_existing_segments(ep)
    if existing:
        max_t = max(s["end"] for s in existing)
        logger.info("Resuming EP%d — %d segments already done (up to %.0fs)", ep, len(existing), max_t)
    else:
        logger.info("Starting EP%d from scratch", ep)

    start = time.time()
    segments = transcribe.run(ep, audio_path)
    elapsed = time.time() - start

    logger.info("Finished EP%d in %.0fs — %d total segments", ep, elapsed, len(segments))
    if segments:
        logger.info("First: [%.1f-%.1f] %s", segments[0]["start"], segments[0]["end"], segments[0]["text"][:60])
        logger.info("Last:  [%.1f-%.1f] %s", segments[-1]["start"], segments[-1]["end"], segments[-1]["text"][:60])


if __name__ == "__main__":
    main()
