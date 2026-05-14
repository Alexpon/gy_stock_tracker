// frontend/src/utils/returnToday.js

export function calcReturnToday(pick) {
  const spark = pick.sparkline;
  if (!spark || spark.length === 0 || !pick.entry) return null;
  const currentPrice = spark[spark.length - 1];
  const returnPct = (currentPrice - pick.entry) / pick.entry * 100;
  const mentionDate = new Date(pick.mention_date);
  const today = new Date();
  const holdingDays = Math.floor((today - mentionDate) / (1000 * 60 * 60 * 24));
  return { currentPrice, returnPct, holdingDays };
}

export function bestBenchReturn(pick) {
  return pick.bench_q1 ?? pick.bench_m1 ?? pick.bench_w2 ?? pick.bench_w1 ?? 0;
}

export function computeStats(picks, market) {
  const marketPicks = picks.filter(p => p.market === market);
  const total = marketPicks.length;
  const doing = marketPicks.filter(p => p.confidence === 'doing').length;
  const watching = marketPicks.filter(p => p.confidence === 'watching').length;
  const mention = marketPicks.filter(p => p.confidence === 'mention').length;

  const withReturn = marketPicks
    .map(p => ({ ...p, _rt: calcReturnToday(p) }))
    .filter(p => p._rt !== null);

  const hitRate = withReturn.length > 0
    ? withReturn.filter(p => p._rt.returnPct > 0).length / withReturn.length
    : 0;
  const avgReturn = withReturn.length > 0
    ? withReturn.reduce((sum, p) => sum + p._rt.returnPct, 0) / withReturn.length
    : 0;
  const avgBench = withReturn.length > 0
    ? withReturn.reduce((sum, p) => sum + bestBenchReturn(p), 0) / withReturn.length
    : 0;

  const benchKey = market === 'us' ? 'vs_spy' : 'vs_0050';

  let bestPick = { ticker: '-', returnPct: 0 };
  let worstPick = { ticker: '-', returnPct: 0 };
  if (withReturn.length > 0) {
    const best = withReturn.reduce((a, b) => a._rt.returnPct > b._rt.returnPct ? a : b);
    const worst = withReturn.reduce((a, b) => a._rt.returnPct < b._rt.returnPct ? a : b);
    bestPick = { ticker: best.ticker, returnPct: best._rt.returnPct };
    worstPick = { ticker: worst.ticker, returnPct: worst._rt.returnPct };
  }

  return {
    total_picks: total, doing, watching, mention,
    hit_rate: Math.round(hitRate * 100) / 100,
    avg_return: Math.round(avgReturn * 10) / 10,
    [benchKey]: Math.round((avgReturn - avgBench) * 10) / 10,
    best_pick: bestPick,
    worst_pick: worstPick,
  };
}
