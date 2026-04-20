import json
import logging

from openai import AzureOpenAI

from backend import config, db, ticker_map

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是股癌 Podcast 分析助手。從以下文字稿中抽取所有被提到的個股。

對每檔個股，回傳：
1. ticker：股票代號（美股用英文代號如 AVGO，台股用數字代號如 2330）
2. name：公司名稱
3. market："us" 或 "tw"
4. confidence：判斷股癌的態度
   - "doing"：明確有在做/加碼（「我加了」「我抱著」「我這邊有」「主力是」）
   - "watching"：在觀察但未進場（「我在看」「放在雷達上」「還沒出手」「觀察一下」）
   - "mention"：只是順帶提到（「提一下」「我不碰」「太飆了」）
5. sector：產業分類（ASIC / Semi-foundry / Semi-equip / Optics / CPU-IP / Cooling / Connector / Power / EV-Robotics / Quantum / Financial / Other）
6. quote：最能代表他對該股態度的原話（1-2 句，保留原文）
7. segment_indices：quote 對應的 segment 索引（用來回查時間戳）

回傳格式：{"picks": [...]}
若無任何個股提及，回傳 {"picks": []}"""


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
    picks = result.get("picks", [])

    for pick in picks:
        t = pick["ticker"]
        if not ticker_map.lookup_by_ticker(t):
            ticker_map.add(pick["name"], t, pick["name"], pick["market"])

        seg_start, seg_end = _map_segment_timestamps(
            pick.get("segment_indices", []), segments
        )

        db.insert_pick(
            ep=ep,
            ticker=t,
            name=pick["name"],
            market=pick["market"],
            confidence=pick["confidence"],
            sector=pick.get("sector"),
            quote=pick.get("quote"),
            segment_start=seg_start,
            segment_end=seg_end,
        )

    market_focus = _determine_market_focus(picks)
    db.update_episode_market_focus(ep, market_focus)

    logger.info("EP%d: extracted %d picks (market_focus=%s)", ep, len(picks), market_focus)
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
