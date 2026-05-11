import json
import logging
import subprocess
import tempfile
from pathlib import Path

import requests

from backend import config, db, ticker_map

logger = logging.getLogger(__name__)

CHUNK_SECONDS = 300  # 5 minutes per chunk


def _build_phrase_list():
    names = ticker_map.get_all_names()
    return ",".join(names)


def _get_duration(audio_path):
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(audio_path)],
            capture_output=True, text=True,
        )
        return float(result.stdout.strip())
    except (ValueError, FileNotFoundError):
        return 0


def _split_audio(audio_path, chunk_dir):
    duration = _get_duration(audio_path)
    chunks = []
    start = 0
    idx = 0
    while start < duration:
        chunk_path = chunk_dir / f"chunk_{idx:03d}.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(audio_path), "-ss", str(start),
             "-t", str(CHUNK_SECONDS), "-acodec", "copy", str(chunk_path)],
            capture_output=True,
        )
        chunks.append((chunk_path, start))
        start += CHUNK_SECONDS
        idx += 1
    logger.info("Split into %d chunks of %ds each", len(chunks), CHUNK_SECONDS)
    return chunks


def _transcribe_chunk(chunk_path, phrase_list, time_offset, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            with open(chunk_path, "rb") as f:
                resp = requests.post(
                    config.STT_API_URL,
                    headers={"Authorization": f"Bearer {config.STT_API_KEY}"},
                    files={"file": (chunk_path.name, f, "audio/mpeg")},
                    data={"phrase_list": phrase_list},
                    timeout=600,
                )
            resp.raise_for_status()
            result = resp.json()
            segments = result.get("segments", [])
            for seg in segments:
                seg["start"] = round(seg["start"] + time_offset, 2)
                seg["end"] = round(seg["end"] + time_offset, 2)
            return segments
        except requests.RequestException as e:
            logger.warning("Chunk at offset %.0fs: attempt %d/%d failed: %s", time_offset, attempt, max_retries, e)
            if attempt == max_retries:
                logger.error("Chunk at offset %.0fs: all retries exhausted, skipping", time_offset)
                return []
    return []


def _get_existing_segments(ep):
    episode = db.get_episode(ep)
    if episode and episode.get("transcript"):
        try:
            return json.loads(episode["transcript"])
        except (json.JSONDecodeError, TypeError):
            pass
    return []


def _max_transcribed_offset(segments):
    if not segments:
        return -1
    return max(seg["end"] for seg in segments)


def run(ep, audio_path=None):
    if audio_path is None:
        audio_path = config.AUDIO_DIR / f"EP{ep}.mp3"

    logger.info("Transcribing EP%d from %s", ep, audio_path)
    phrase_list = _build_phrase_list()

    duration = _get_duration(audio_path)
    if duration <= CHUNK_SECONDS + 30:
        logger.info("Short audio (%.0fs), sending as single file", duration)
        all_segments = _transcribe_chunk(audio_path, phrase_list, 0)
        db.update_episode_transcript(ep, json.dumps(all_segments, ensure_ascii=False))
        logger.info("EP%d: %d total segments transcribed", ep, len(all_segments))
        return all_segments

    existing = _get_existing_segments(ep)
    max_offset = _max_transcribed_offset(existing)
    all_segments = list(existing)

    with tempfile.TemporaryDirectory() as tmp:
        chunks = _split_audio(audio_path, Path(tmp))
        for i, (chunk_path, time_offset) in enumerate(chunks):
            if time_offset + CHUNK_SECONDS <= max_offset:
                logger.info("Chunk %d/%d (offset %.0fs) — already done, skipping", i + 1, len(chunks), time_offset)
                continue

            logger.info("Chunk %d/%d (offset %.0fs)...", i + 1, len(chunks), time_offset)
            segs = _transcribe_chunk(chunk_path, phrase_list, time_offset)
            if segs:
                all_segments.extend(segs)
                db.update_episode_transcript(ep, json.dumps(all_segments, ensure_ascii=False))
                logger.info("  → %d segments (saved, total %d)", len(segs), len(all_segments))
            else:
                logger.warning("  → chunk failed, continuing to next")

    logger.info("EP%d: %d total segments transcribed", ep, len(all_segments))
    return all_segments


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
    run(ep_num, Path(filename))
