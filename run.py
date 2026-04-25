import argparse
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Gooaye Backend")
    parser.add_argument("--now", action="store_true", help="Run pipeline once and exit")
    parser.add_argument("--port", type=int, default=5001, help="API server port")
    args = parser.parse_args()

    if args.now:
        from backend.pipeline import run_full
        logger.info("Running pipeline now...")
        run_full()
        return

    import uvicorn
    logger.info("Starting API server on port %d", args.port)
    uvicorn.run("backend.server:app", host="0.0.0.0", port=args.port, reload=False)


if __name__ == "__main__":
    main()
