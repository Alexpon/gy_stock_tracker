import argparse
import logging
import time

import schedule

from backend import config
from backend.pipeline import run_full

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Gooaye Backend Pipeline")
    parser.add_argument("--now", action="store_true", help="Run pipeline immediately")
    args = parser.parse_args()

    if args.now:
        logger.info("Running pipeline now...")
        run_full()
        return

    logger.info("Scheduling daily run at %s TST", config.SCHEDULE_TIME)
    schedule.every().day.at(config.SCHEDULE_TIME).do(run_full)

    run_full()

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
