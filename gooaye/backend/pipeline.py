import logging

from backend import db, rss, transcribe, extract, prices, generate

logger = logging.getLogger(__name__)


def run_new_episodes():
    new_episodes = rss.check_new()

    for ep_info in new_episodes:
        ep = ep_info["ep"]
        logger.info("Processing EP%d: %s", ep, ep_info["title"])

        db.insert_episode(
            ep=ep,
            title=ep_info["title"],
            date=ep_info["date"],
            duration=ep_info.get("duration"),
            rss_url=ep_info.get("rss_url"),
        )

        audio_path = rss.download_audio(ep, ep_info["rss_url"])
        transcribe.run(ep, audio_path)
        extract.run(ep)
        prices.fetch_new_picks(ep)

        logger.info("EP%d complete", ep)

    return new_episodes


def run_backfill():
    prices.backfill_all()


def run_generate():
    generate.write_data_js()


def run_full():
    db.init_db()
    new = run_new_episodes()
    run_backfill()
    run_generate()
    logger.info("Pipeline complete. %d new episodes processed.", len(new))
    return new
