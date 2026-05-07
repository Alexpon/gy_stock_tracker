import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# DeepQ STT
STT_API_URL = os.getenv(
    "STT_API_URL",
    "https://llminternal-dev.deepq.ai:50500/v1/audio/transcriptions",
)
STT_API_KEY = os.getenv("STT_API_KEY", "")

# Azure OpenAI
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL", "gpt-4.1-mini")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

# Podcast RSS
RSS_URL = os.getenv("RSS_URL", "")

# Schedule
SCHEDULE_TIMES = os.getenv("SCHEDULE_TIMES", "06:00,16:00").split(",")

# Paths
DB_PATH = BASE_DIR / "data" / "gooaye.db"
AUDIO_DIR = BASE_DIR / "data" / "audio"
DATA_JS_PATH = BASE_DIR / "data.js"
