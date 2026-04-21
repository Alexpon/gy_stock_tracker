import logging

logger = logging.getLogger(__name__)

TICKER_MAP = {
    # US - ASIC / AI Chip
    "博通": ("AVGO", "Broadcom", "us"),
    "Broadcom": ("AVGO", "Broadcom", "us"),
    "AVGO": ("AVGO", "Broadcom", "us"),
    "Marvell": ("MRVL", "Marvell Tech", "us"),
    "MRVL": ("MRVL", "Marvell Tech", "us"),
    "Credo": ("CRDO", "Credo Tech", "us"),
    "CRDO": ("CRDO", "Credo Tech", "us"),
    "NVIDIA": ("NVDA", "NVIDIA", "us"),
    "輝達": ("NVDA", "NVIDIA", "us"),
    "NVDA": ("NVDA", "NVIDIA", "us"),
    "AMD": ("AMD", "AMD", "us"),
    "超微": ("AMD", "AMD", "us"),
    "Intel": ("INTC", "Intel", "us"),
    "英特爾": ("INTC", "Intel", "us"),
    "INTC": ("INTC", "Intel", "us"),
    # US - CPU-IP
    "Arm": ("ARM", "Arm Holdings", "us"),
    "ARM": ("ARM", "Arm Holdings", "us"),
    # US - Semi-equip
    "Applied Materials": ("AMAT", "Applied Materials", "us"),
    "AMAT": ("AMAT", "Applied Materials", "us"),
    "KLA": ("KLAC", "KLA Corp", "us"),
    "KLAC": ("KLAC", "KLA Corp", "us"),
    "Lam Research": ("LRCX", "Lam Research", "us"),
    "Lam": ("LRCX", "Lam Research", "us"),
    "LRCX": ("LRCX", "Lam Research", "us"),
    # US - Mega Cap Tech
    "Apple": ("AAPL", "Apple", "us"),
    "蘋果": ("AAPL", "Apple", "us"),
    "AAPL": ("AAPL", "Apple", "us"),
    "Meta": ("META", "Meta Platforms", "us"),
    "META": ("META", "Meta Platforms", "us"),
    "Amazon": ("AMZN", "Amazon", "us"),
    "AMZN": ("AMZN", "Amazon", "us"),
    "Google": ("GOOGL", "Alphabet", "us"),
    "Alphabet": ("GOOGL", "Alphabet", "us"),
    "GOOGL": ("GOOGL", "Alphabet", "us"),
    "Microsoft": ("MSFT", "Microsoft", "us"),
    "微軟": ("MSFT", "Microsoft", "us"),
    "MSFT": ("MSFT", "Microsoft", "us"),
    # US - Power
    "Vistra": ("VST", "Vistra Corp", "us"),
    "VST": ("VST", "Vistra Corp", "us"),
    "Talen": ("TLN", "Talen Energy", "us"),
    "TLN": ("TLN", "Talen Energy", "us"),
    "Constellation": ("CEG", "Constellation Energy", "us"),
    "CEG": ("CEG", "Constellation Energy", "us"),
    # US - EV-Robotics
    "Tesla": ("TSLA", "Tesla", "us"),
    "特斯拉": ("TSLA", "Tesla", "us"),
    "TSLA": ("TSLA", "Tesla", "us"),
    "Serve Robotics": ("SERV", "Serve Robotics", "us"),
    "SERV": ("SERV", "Serve Robotics", "us"),
    "Uber": ("UBER", "Uber", "us"),
    "UBER": ("UBER", "Uber", "us"),
    # US - Quantum
    "IonQ": ("IONQ", "IonQ", "us"),
    "IONQ": ("IONQ", "IonQ", "us"),
    "Rigetti": ("RGTI", "Rigetti Computing", "us"),
    "RGTI": ("RGTI", "Rigetti Computing", "us"),
    # TW - Semi-foundry
    "台積電": ("2330", "台積電", "tw"),
    "TSMC": ("2330", "台積電", "tw"),
    # TW - ASIC
    "世芯": ("3661", "世芯-KY", "tw"),
    "創意": ("3443", "創意", "tw"),
    "智原": ("3035", "智原", "tw"),
    # TW - Optics
    "大立光": ("3008", "大立光", "tw"),
    "穩懋": ("3105", "穩懋", "tw"),
    # TW - CPU-IP
    "晶心科": ("6533", "晶心科", "tw"),
    # TW - Cooling
    "奇鋐": ("3017", "奇鋐", "tw"),
    "健策": ("3653", "健策", "tw"),
    "雙鴻": ("3324", "雙鴻", "tw"),
    # TW - Connector
    "信音": ("6126", "信音", "tw"),
    # TW - Passive
    "國巨": ("2327", "國巨", "tw"),
    # TW - Financial
    "富邦金": ("2881", "富邦金", "tw"),
    "開發金": ("2883", "開發金", "tw"),
    # TW - ETF
    "元大台灣50": ("0050", "元大台灣50", "tw"),
    "0050": ("0050", "元大台灣50", "tw"),
}

_TICKER_REVERSE = {}


def _rebuild_reverse():
    _TICKER_REVERSE.clear()
    for _name, (ticker, display_name, market) in TICKER_MAP.items():
        if ticker not in _TICKER_REVERSE:
            _TICKER_REVERSE[ticker] = (ticker, display_name, market)


_rebuild_reverse()


def lookup(name):
    return TICKER_MAP.get(name)


def lookup_by_ticker(ticker):
    return _TICKER_REVERSE.get(ticker)


def add(name, ticker, display_name, market):
    TICKER_MAP[name] = (ticker, display_name, market)
    _TICKER_REVERSE[ticker] = (ticker, display_name, market)
    logger.warning("未知股票: %s (%s) — auto-added to ticker_map", name, ticker)


def get_all_names():
    return list(TICKER_MAP.keys())


def get_all_tickers():
    return list(_TICKER_REVERSE.keys())
