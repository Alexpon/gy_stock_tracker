import json
import logging

import requests
from openai import AzureOpenAI

from backend import config, db, ticker_map

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是股癌 Podcast 分析助手。從以下文字稿中抽取所有被提到的**上市/上櫃股票**。

重要規則：
- 只抽取真正的上市/上櫃公司股票，不要抽取：
  - 贊助商、廣告品牌（如 New Balance、Pluggable、蝦皮、Uber Eats 外送服務等）
  - 非上市公司或產品名稱
  - 語音辨識錯誤產生的假公司名（如「軍華」「萬倫」等不存在的公司）
- 台股必須用數字代號（如 2330、3661、2327），不要用中文名稱當 ticker
- 美股必須用標準英文代號（如 NVDA、AAPL、AVGO），不要用中文名稱當 ticker
- ETF 也算（如 0050）

對每檔個股，回傳：
1. ticker：股票代號（美股英文代號如 AVGO，台股數字代號如 2330）
2. name：公司名稱（中文或英文皆可）
3. market："us" 或 "tw"
4. confidence：判斷股癌的態度
   - "doing"：明確有在做/加碼（「我加了」「我抱著」「我這邊有」「主力是」）
   - "watching"：在觀察但未進場（「我在看」「放在雷達上」「還沒出手」「觀察一下」）
   - "mention"：只是順帶提到（「提一下」「我不碰」「太飆了」）
5. sector：產業分類（ASIC / Semi-foundry / Semi-equip / Optics / CPU-IP / Cooling / Connector / Power / EV-Robotics / Quantum / Financial / ETF / Other）
6. quote：最能代表他對該股態度的原話（1-2 句，保留原文）
7. segment_indices：quote 對應的 segment 索引（用來回查時間戳）

請以 JSON 格式回傳：{"picks": [...]}
若無任何個股提及，回傳 JSON：{"picks": []}"""

KNOWN_NON_STOCKS = {
    "new balance", "pluggable", "蝦皮", "shopee", "uber eats",
    "軍華", "萬倫", "line", "youtube", "podcast", "apple podcast",
    "spotify", "firstory", "soundon", "patreon",
}


def _build_transcript_text(segments):
    lines = []
    for i, seg in enumerate(segments):
        lines.append(f"[{i}] [{seg['start']:.1f}-{seg['end']:.1f}] {seg['text']}")
    return "\n".join(lines)


def _map_segment_timestamps(segment_indices, segments):
    if not segment_indices:
        return None, None
    valid = [i for i in segment_indices if 0 <= i < len(segments)]
    if not valid:
        return None, None
    start = min(segments[i]["start"] for i in valid)
    end = max(segments[i]["end"] for i in valid)
    return start, end


def _resolve_ticker_web(name, market):
    """Use Yahoo Finance search API to resolve a company name to its ticker."""
    try:
        resp = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": name, "quotesCount": 5, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        quotes = resp.json().get("quotes", [])
        if not quotes:
            logger.warning("Yahoo search for '%s': no results", name)
            return None

        for q in quotes:
            symbol = q.get("symbol", "")
            exchange = q.get("exchange", "")
            if market == "tw" and (symbol.endswith(".TW") or symbol.endswith(".TWO") or exchange in ("TAI", "TWO")):
                ticker = symbol.replace(".TW", "").replace(".TWO", "")
                logger.info("Yahoo resolved '%s' → %s (TW)", name, ticker)
                return ticker
            if market == "us" and exchange in ("NMS", "NYQ", "NGM", "PCX", "NAS"):
                logger.info("Yahoo resolved '%s' → %s (US)", name, symbol)
                return symbol

        first = quotes[0]
        symbol = first.get("symbol", "")
        if market == "tw":
            symbol = symbol.replace(".TW", "").replace(".TWO", "")
        logger.info("Yahoo resolved '%s' → %s (fallback first result)", name, symbol)
        return symbol
    except Exception as e:
        logger.warning("Yahoo search failed for '%s': %s", name, e)
        return None


def _is_valid_pick(pick):
    """Filter out non-stock items."""
    name_lower = pick.get("name", "").lower().strip()
    ticker = pick.get("ticker", "").strip()
    if name_lower in KNOWN_NON_STOCKS:
        return False
    if not ticker or ticker == name_lower:
        return False
    if pick.get("market") == "tw" and not ticker.isdigit():
        return False
    return True


def _determine_market_focus(picks):
    us = sum(1 for p in picks if p.get("market") == "us")
    tw = sum(1 for p in picks if p.get("market") == "tw")
    if us == 0 and tw == 0:
        return "mixed"
    if us > tw * 2:
        return "us"
    if tw > us * 2:
        return "tw"
    return "mixed"


def run(ep):
    episode = db.get_episode(ep)
    if not episode or not episode["transcript"]:
        logger.error("EP%d: no transcript found", ep)
        return []

    segments = json.loads(episode["transcript"])
    transcript_text = _build_transcript_text(segments)

    client = AzureOpenAI(
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT,
        api_key=config.AZURE_OPENAI_API_KEY,
        api_version=config.AZURE_OPENAI_API_VERSION,
    )

    response = client.chat.completions.create(
        model=config.AZURE_OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript_text},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    result = json.loads(response.choices[0].message.content)
    raw_picks = result.get("picks", [])
    logger.info("EP%d: LLM returned %d raw picks", ep, len(raw_picks))

    picks = []
    for pick in raw_picks:
        t = pick.get("ticker", "").strip()
        name = pick.get("name", "").strip()
        market = pick.get("market", "us")

        if name.lower() in KNOWN_NON_STOCKS:
            logger.info("EP%d: filtered non-stock '%s'", ep, name)
            continue

        known = ticker_map.lookup(name) or ticker_map.lookup(t)
        if known:
            t = known[0]
            market = known[2]
        elif not t or (market == "tw" and not t.isdigit()):
            resolved = _resolve_ticker_web(name, market)
            if resolved:
                t = resolved
                ticker_map.add(name, t, name, market)
            else:
                logger.warning("EP%d: could not resolve ticker for '%s', skipping", ep, name)
                continue

        pick["ticker"] = t
        pick["market"] = market

        if not _is_valid_pick(pick):
            logger.info("EP%d: filtered invalid pick '%s' (%s)", ep, name, t)
            continue

        if not ticker_map.lookup_by_ticker(t):
            ticker_map.add(name, t, name, market)

        seg_start, seg_end = _map_segment_timestamps(
            pick.get("segment_indices", []), segments
        )

        db.insert_pick(
            ep=ep,
            ticker=t,
            name=pick["name"],
            market=market,
            confidence=pick["confidence"],
            sector=pick.get("sector"),
            quote=pick.get("quote"),
            segment_start=seg_start,
            segment_end=seg_end,
        )
        picks.append(pick)

    market_focus = _determine_market_focus(picks)
    db.update_episode_market_focus(ep, market_focus)

    logger.info("EP%d: extracted %d valid picks (market_focus=%s)", ep, len(picks), market_focus)
    return picks


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python -m backend.extract 542")
        sys.exit(1)
    ep_num = int(sys.argv[1])
    picks = run(ep_num)
    for p in picks:
        print(f"  {p['ticker']} ({p['confidence']}): {p.get('quote', '')[:40]}...")
