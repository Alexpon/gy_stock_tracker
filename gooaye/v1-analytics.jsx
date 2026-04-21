// V1 Analytics: 累積損益曲線、延遲進場模擬、信心度拆分績效
// 依賴 V1_C, V1_fmt (from v1-dense.jsx) — 已掛在 window

// ─── 延遲進場：用 sparkline 模擬 ───────────────────────
// sparkline[0] = 進場日（下個交易日開盤），後續為每個交易日收盤
// 延遲 D 天 = 以 sparkline[D] 為新進場價，重新計算至各期間終點的報酬
// 交易日假設：w1=5, w2=10, m1=21, q1=63
const V1_PERIOD_DAYS = { w1: 5, w2: 10, m1: 21, q1: 63 };

function V1_computeDelayed(pick, period, delayDays) {
  const spark = pick.sparkline;
  if (!spark || spark.length === 0) return pick[period];
  const entryIdx = Math.min(delayDays, spark.length - 1);
  const exitIdx = Math.min(entryIdx + V1_PERIOD_DAYS[period], spark.length - 1);
  const entry = spark[entryIdx], exit = spark[exitIdx];
  if (!entry || entry === 0) return pick[period];
  return (exit - entry) / entry * 100;
}

function V1_benchForPeriod(pick, period) {
  const key = `bench_${period}`;
  const val = pick[key];
  if (val !== null && val !== undefined) return val;
  return 0;
}

function V1_filterByConfidence(pool, followOnly) {
  if (followOnly === 'all') return pool;
  if (followOnly === 'doing_watching') return pool.filter(p => p.confidence === 'doing' || p.confidence === 'watching');
  return pool.filter(p => p.confidence === followOnly);
}

// ─── 累積損益曲線圖 ────────────────────────────────────
function V1_CumulativeChart({ episodes, picks, market, period, config }) {
  // 以每集為時間點，畫累積 P&L ($ 或 NT$)
  const sorted = [...episodes].sort((a, b) => a.ep - b.ep); // 舊 → 新
  const ccy = market === 'us' ? '$' : 'NT$';
  const cap = config.capitalPerEpisode;
  const delay = config.entryDelay || 0;

  // 建三條線：跟單策略 / 大盤 / 差額
  let cumStrat = 0, cumBench = 0;
  const points = sorted.map(ep => {
    const pool = picks.filter(p => p.ep === ep.ep && p.market === market);
    const filt = V1_filterByConfidence(pool, config.followOnly);
    if (filt.length === 0) {
      return { ep: ep.ep, date: ep.date, cumStrat, cumBench, epPnl: 0, epBench: 0, hasData: false };
    }
    const avg = filt.reduce((a, p) => a + V1_computeDelayed(p, period, delay), 0) / filt.length;
    const bench = filt.reduce((a, p) => a + V1_benchForPeriod(p, period), 0) / filt.length;
    const epPnl = cap * avg / 100;
    const epBench = cap * bench / 100;
    cumStrat += epPnl;
    cumBench += epBench;
    return { ep: ep.ep, date: ep.date, cumStrat, cumBench, epPnl, epBench, hasData: true, avg, bench };
  });

  const valid = points.filter(p => p.hasData);
  if (valid.length === 0) return null;

  // chart dims
  const W = 1100, H = 260, padL = 56, padR = 20, padT = 20, padB = 36;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allVals = valid.flatMap(p => [p.cumStrat, p.cumBench, 0]);
  const yMin = Math.min(...allVals), yMax = Math.max(...allVals);
  const yRange = (yMax - yMin) || 1;
  const yPad = yRange * 0.1;
  const yLo = yMin - yPad, yHi = yMax + yPad;
  const yScale = v => padT + innerH - ((v - yLo) / (yHi - yLo)) * innerH;
  const xScale = i => padL + (i / Math.max(valid.length - 1, 1)) * innerW;

  const stratLine = valid.map((p, i) => `${xScale(i)},${yScale(p.cumStrat)}`).join(' ');
  const benchLine = valid.map((p, i) => `${xScale(i)},${yScale(p.cumBench)}`).join(' ');
  const zeroY = yScale(0);

  // area under strat
  const stratArea = `${padL},${zeroY} ${stratLine} ${xScale(valid.length - 1)},${zeroY}`;

  // y ticks
  const yTicks = [yLo, yLo + (yHi - yLo) * 0.25, yLo + (yHi - yLo) * 0.5, yLo + (yHi - yLo) * 0.75, yHi];

  const finalStrat = valid[valid.length - 1].cumStrat;
  const finalBench = valid[valid.length - 1].cumBench;
  const totalCap = valid.length * cap;
  const stratPct = finalStrat / totalCap * 100;
  const benchPct = finalBench / totalCap * 100;

  // max drawdown on strat
  let peak = 0, maxDD = 0;
  valid.forEach(p => {
    if (p.cumStrat > peak) peak = p.cumStrat;
    const dd = p.cumStrat - peak;
    if (dd < maxDD) maxDD = dd;
  });

  const periodLabel = { w1: '1週', w2: '2週', m1: '1個月', q1: '1季' }[period];
  const benchName = market === 'us' ? 'SPY' : '0050';
  const delayLabel = delay === 0 ? '即時' : `延遲 ${delay} 天`;

  return (
    <div style={{ background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${V1_C.border}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10.5, color: V1_C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>CUMULATIVE P&L · 累積損益曲線</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: V1_C.text }}>
            每集投入 {ccy}{cap.toLocaleString()} · 持有 {periodLabel} · {delayLabel}進場
          </div>
          <div style={{ fontSize: 11.5, color: V1_C.textMuted, marginTop: 3 }}>
            時間軸由左（最舊集）至右（最新集）· 面積＝累積損益（實線＝跟單、虛線＝同金額買 {benchName}）
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, fontFamily: 'var(--font-mono)' }}>
          <div>
            <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>最終累積</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: finalStrat >= 0 ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>
              {finalStrat >= 0 ? '+' : ''}{ccy}{Math.round(finalStrat).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: V1_C.textMuted }}>{V1_fmt(stratPct)} / {ccy}{totalCap.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>vs 買 {benchName}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (finalStrat - finalBench) >= 0 ? V1_C.up : V1_C.down, fontVariantNumeric: 'tabular-nums' }}>
              {(finalStrat - finalBench) >= 0 ? '+' : ''}{ccy}{Math.round(finalStrat - finalBench).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: V1_C.textMuted }}>α {V1_fmt(stratPct - benchPct)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>最大回撤</div>
            {maxDD < -0.5 ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: V1_C.down, fontVariantNumeric: 'tabular-nums' }}>
                  {ccy}{Math.round(maxDD).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: V1_C.textMuted }}>由高點最深跌幅</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: V1_C.textMuted, fontVariantNumeric: 'tabular-nums' }}>—</div>
                <div style={{ fontSize: 11, color: V1_C.textMuted }}>期內無回檔</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 8px 4px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: 320 }}>
          {/* y grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={yScale(t)} y2={yScale(t)}
                stroke={t === 0 ? V1_C.borderStrong : V1_C.border} strokeWidth={t === 0 ? 1.2 : 1}
                strokeDasharray={t === 0 ? '' : '2 3'} />
              <text x={padL - 8} y={yScale(t) + 3} textAnchor="end" fontSize="10"
                fontFamily="var(--font-mono)" fill={V1_C.textSubtle}>
                {t >= 0 ? '+' : ''}{ccy}{Math.round(t).toLocaleString()}
              </text>
            </g>
          ))}

          {/* area */}
          <polygon points={stratArea} fill={finalStrat >= 0 ? V1_C.up : V1_C.down} fillOpacity="0.08" />

          {/* bench line (dashed) */}
          <polyline points={benchLine} fill="none" stroke={V1_C.textMuted} strokeWidth="1.5" strokeDasharray="4 3" />

          {/* strat line */}
          <polyline points={stratLine} fill="none" stroke={finalStrat >= 0 ? V1_C.up : V1_C.down} strokeWidth="2" />

          {/* dots + ep labels */}
          {valid.map((p, i) => (
            <g key={p.ep}>
              <circle cx={xScale(i)} cy={yScale(p.cumStrat)} r="3.5" fill={V1_C.surface}
                stroke={finalStrat >= 0 ? V1_C.up : V1_C.down} strokeWidth="1.5" />
              <text x={xScale(i)} y={H - padB + 14} textAnchor="middle" fontSize="9.5"
                fontFamily="var(--font-mono)" fill={V1_C.textSubtle}>
                EP{p.ep}
              </text>
              <text x={xScale(i)} y={H - padB + 25} textAnchor="middle" fontSize="9"
                fontFamily="var(--font-mono)" fill={V1_C.textSubtle}>
                {p.date.slice(5)}
              </text>
            </g>
          ))}

          {/* legend */}
          <g transform={`translate(${padL + 8}, ${padT + 8})`}>
            <rect width="180" height="42" fill={V1_C.surface} fillOpacity="0.95" stroke={V1_C.border} rx="3" />
            <line x1="10" y1="14" x2="28" y2="14" stroke={finalStrat >= 0 ? V1_C.up : V1_C.down} strokeWidth="2" />
            <text x="34" y="17" fontSize="11" fontFamily="var(--font-sans)" fill={V1_C.text} fontWeight="500">跟單策略</text>
            <line x1="10" y1="32" x2="28" y2="32" stroke={V1_C.textMuted} strokeWidth="1.5" strokeDasharray="4 3" />
            <text x="34" y="35" fontSize="11" fontFamily="var(--font-sans)" fill={V1_C.text} fontWeight="500">買 {benchName} 對照組</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─── 信心度拆分績效 ────────────────────────────────────
function V1_ConfidenceBreakdown({ episodes, picks, market, period, config }) {
  const tiers = [
    { key: 'doing', label: '有在做', desc: '實際有持股 / 加倉的個股', color: V1_C.accent, bg: V1_C.accentBg },
    { key: 'watching', label: '觀察中', desc: '放在雷達上、未進場的個股', color: V1_C.warn, bg: V1_C.warnBg },
    { key: 'mention', label: '只是提到', desc: '順便講一下、沒有立場的個股', color: V1_C.textMuted, bg: V1_C.surfaceAlt },
  ];
  const ccy = market === 'us' ? '$' : 'NT$';
  const cap = config.capitalPerEpisode;
  const delay = config.entryDelay || 0;

  const rows = tiers.map(t => {
    const picksInTier = picks.filter(p => p.market === market && p.confidence === t.key);
    if (picksInTier.length === 0) return { ...t, count: 0 };
    // 每集的平均（此信心度）
    const epMap = new Map();
    picksInTier.forEach(p => {
      if (!epMap.has(p.ep)) epMap.set(p.ep, []);
      epMap.get(p.ep).push(p);
    });
    const epRows = [...epMap.entries()].map(([ep, list]) => {
      const avg = list.reduce((a, p) => a + V1_computeDelayed(p, period, delay), 0) / list.length;
      const bench = list.reduce((a, p) => a + V1_benchForPeriod(p, period), 0) / list.length;
      return { ep, avg, bench };
    });
    const avgRet = epRows.reduce((a, r) => a + r.avg, 0) / epRows.length;
    const avgBench = epRows.reduce((a, r) => a + r.bench, 0) / epRows.length;
    const alpha = avgRet - avgBench;
    const hits = epRows.filter(r => r.avg > 0).length;
    const beats = epRows.filter(r => r.avg > r.bench).length;
    const cumPnl = epRows.reduce((a, r) => a + cap * r.avg / 100, 0);
    return {
      ...t, count: picksInTier.length, epCount: epRows.length,
      avgRet, avgBench, alpha, hits, beats, cumPnl,
      totalCap: epRows.length * cap,
    };
  });

  // max for bar scale
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.avgRet || 0)), 1);

  return (
    <div style={{ background: V1_C.surface, border: `1px solid ${V1_C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${V1_C.border}` }}>
        <div style={{ fontSize: 10.5, color: V1_C.accent, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
          CONFIDENCE TIERS · 信心度拆分
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: V1_C.text }}>哪一層的跟單效果最好？</div>
        <div style={{ fontSize: 11.5, color: V1_C.textMuted, marginTop: 3 }}>
          不管右下角 Tweaks 的「跟單範圍」設定，這裡固定比較三個層級的獨立績效。
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {rows.map((r, i) => {
          if (r.count === 0) {
            return (
              <div key={r.key} style={{ padding: '20px 22px', borderRight: i < 2 ? `1px solid ${V1_C.border}` : 'none', color: V1_C.textSubtle, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{r.label}</span> · 本市場無此分類資料
              </div>
            );
          }
          const barPctRet = (r.avgRet / maxAbs) * 100;
          const barPctBench = (r.avgBench / maxAbs) * 100;
          return (
            <div key={r.key} style={{ padding: '18px 22px 22px', borderRight: i < 2 ? `1px solid ${V1_C.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: V1_C.text }}>{r.label}</span>
                <span style={{ fontSize: 11, color: V1_C.textSubtle, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                  {r.count} 檔 · {r.epCount} 集
                </span>
              </div>
              <div style={{ fontSize: 11, color: V1_C.textMuted, marginBottom: 14, lineHeight: 1.4 }}>{r.desc}</div>

              {/* big number */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.avgRet >= 0 ? V1_C.up : V1_C.down, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                  {V1_fmt(r.avgRet)}
                </span>
                <span style={{ fontSize: 11, color: V1_C.textMuted, fontFamily: 'var(--font-mono)' }}>平均每集</span>
              </div>

              {/* strat vs bench bar */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)', marginBottom: 4, color: V1_C.textMuted }}>
                  <span style={{ width: 56 }}>跟單</span>
                  <div style={{ flex: 1, height: 8, background: V1_C.surfaceAlt, position: 'relative', borderRadius: 2 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: V1_C.borderStrong }} />
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: barPctRet >= 0 ? '50%' : `${50 + barPctRet / 2}%`,
                      width: `${Math.abs(barPctRet) / 2}%`,
                      background: r.avgRet >= 0 ? V1_C.up : V1_C.down, borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ width: 52, textAlign: 'right', color: r.avgRet >= 0 ? V1_C.up : V1_C.down, fontWeight: 600 }}>{V1_fmt(r.avgRet)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: V1_C.textMuted }}>
                  <span style={{ width: 56 }}>大盤</span>
                  <div style={{ flex: 1, height: 8, background: V1_C.surfaceAlt, position: 'relative', borderRadius: 2 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: V1_C.borderStrong }} />
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: barPctBench >= 0 ? '50%' : `${50 + barPctBench / 2}%`,
                      width: `${Math.abs(barPctBench) / 2}%`,
                      background: V1_C.textMuted, borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ width: 52, textAlign: 'right', color: V1_C.textMuted }}>{V1_fmt(r.avgBench)}</span>
                </div>
              </div>

              {/* stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${V1_C.border}` }}>
                <div>
                  <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>超額 α</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.alpha >= 0 ? V1_C.up : V1_C.down }}>
                    {V1_fmt(r.alpha)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>命中 · 打敗</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: V1_C.text }}>
                    {r.hits}/{r.epCount} · {r.beats}/{r.epCount}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 10, color: V1_C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>累積損益</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: r.cumPnl >= 0 ? V1_C.up : V1_C.down }}>
                    {r.cumPnl >= 0 ? '+' : ''}{ccy}{Math.round(r.cumPnl).toLocaleString()}
                    <span style={{ fontSize: 10.5, color: V1_C.textSubtle, fontWeight: 500, marginLeft: 6 }}>
                      / {ccy}{r.totalCap.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 20px', background: V1_C.surfaceAlt, fontSize: 10.5, color: V1_C.textSubtle, fontFamily: 'var(--font-mono)' }}>
        * 每集投入 {ccy}{cap.toLocaleString()} · {delay === 0 ? '即時進場' : `延遲 ${delay} 天進場`} · 持有 {{ w1: '1週', w2: '2週', m1: '1個月', q1: '1季' }[period]}
      </div>
    </div>
  );
}

Object.assign(window, { V1_CumulativeChart, V1_ConfidenceBreakdown });
