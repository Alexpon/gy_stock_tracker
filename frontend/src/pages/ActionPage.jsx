// Action: 決策頁 — 最新 4 集提到的可跟標的
// 每檔一張大卡，顯示預期 1M 回報（含信心區間）+ 進場時機提示

import { useState } from 'react';
import { C, fmt, fmtPrice } from '../constants.js';
import { Pill } from '../components/shared/Pill.jsx';

// ─── 計算引擎 ───────────────────────────────────────
function computeExpected(pick, allPicks, market) {
  // 三個獨立來源 → 平均 → 取標準差當區間
  const period = 'm1';

  // Source A: 同信心度 (doing/watching) 在該市場的 1M 平均
  const sameConf = allPicks.filter(p =>
    p.market === market && p.confidence === pick.confidence
  );
  const srcA = sameConf.length
    ? sameConf.reduce((s, p) => s + p[period], 0) / sameConf.length
    : 0;

  // Source B: 該個股過去被提及時的 1M 平均（如果只被提過一次，用 doing 整體均值）
  const sameTicker = allPicks.filter(p => p.ticker === pick.ticker);
  const srcB = sameTicker.length >= 2
    ? sameTicker.reduce((s, p) => s + p[period], 0) / sameTicker.length
    : srcA;

  // Source C: 同產業 × 同信心度
  const sameSector = allPicks.filter(p =>
    p.market === market && p.sector === pick.sector && p.confidence === pick.confidence
  );
  const srcC = sameSector.length
    ? sameSector.reduce((s, p) => s + p[period], 0) / sameSector.length
    : srcA;

  const sources = [srcA, srcB, srcC];
  const mean = sources.reduce((s, v) => s + v, 0) / 3;
  const variance = sources.reduce((s, v) => s + (v - mean) ** 2, 0) / 3;
  const stdev = Math.sqrt(variance);

  return {
    expected: mean,
    low: mean - stdev,
    high: mean + stdev,
    sources: { sameConf: srcA, sameTicker: srcB, sameSector: srcC },
    sampleSizes: {
      conf: sameConf.length,
      ticker: sameTicker.length,
      sector: sameSector.length,
    },
  };
}

function entryTiming(pick) {
  // current = sparkline 最新, entry = 節目當時
  const current = pick.sparkline[pick.sparkline.length - 1];
  const entry = pick.entry;
  const change = (current - entry) / entry * 100;

  let tier, label, detail, color;
  if (change < -2) {
    tier = 'great';
    label = '低於當時價';
    detail = '可能是機會，比節目當時更便宜';
    color = '#067647';
  } else if (change < 2) {
    tier = 'good';
    label = '接近當時價';
    detail = '仍在節目提及時的合理區間';
    color = '#067647';
  } else if (change < 10) {
    tier = 'ok';
    label = '略高於當時價';
    detail = '已上漲，但尚未過熱';
    color = '#b54708';
  } else {
    tier = 'wait';
    label = '已漲超過 10%';
    detail = '建議等回檔或設定分批進場';
    color = '#b42318';
  }
  return { tier, label, detail, color, change, current, entry };
}

function actionFmtPrice(n, market) {
  if (market === 'tw') return Math.round(n).toLocaleString();
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(2);
}

function daysAgo(dateStr) {
  // 以 2026-04-19 (今天) 為基準
  const today = new Date('2026-04-19');
  const d = new Date(dateStr);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

// ─── 卡片 ───────────────────────────────────────────
function ActionCard({ pick, episode, allPicks }) {
  const market = pick.market;
  const exp = computeExpected(pick, allPicks, market);
  const timing = entryTiming(pick);
  const ccy = market === 'us' ? '$' : 'NT$';
  const isPositive = exp.expected >= 0;

  // 區間條參數
  const range = Math.max(Math.abs(exp.low), Math.abs(exp.high), 5);
  const pctToX = (v) => ((v + range) / (range * 2)) * 100;

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 頂部：ticker + confidence + days ago */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{
                fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
                color: C.text, letterSpacing: '-0.02em',
              }}>{pick.ticker}</span>
              <Pill kind={pick.confidence} />
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{pick.name}</div>
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
            <div style={{ fontSize: 11, color: C.textSubtle, letterSpacing: '0.04em' }}>
              EP {pick.ep} · {daysAgo(pick.mention_date)}天前
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {pick.mention_date}
            </div>
          </div>
        </div>
        {/* sector tag */}
        <div style={{
          display: 'inline-block', fontSize: 10.5, padding: '2px 8px',
          background: C.surfaceAlt, color: C.textMuted,
          borderRadius: 3, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        }}>
          {pick.sector}
        </div>
      </div>

      {/* 主角：預期 1M 回報 + 區間 */}
      <div style={{ padding: '18px 20px 14px' }}>
        <div style={{
          fontSize: 10, color: C.textSubtle, textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8,
        }}>
          預期 1 個月回報
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <div style={{
            fontSize: 42, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: isPositive ? C.up : C.down, letterSpacing: '-0.03em',
            lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(exp.expected, 1)}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: 'var(--font-mono)' }}>
            信心區間 {fmt(exp.low, 1)} ~ {fmt(exp.high, 1)}
          </div>
        </div>

        {/* 區間 bar */}
        <div style={{ position: 'relative', height: 28, marginBottom: 4 }}>
          {/* 0% baseline */}
          <div style={{
            position: 'absolute', left: `${pctToX(0)}%`, top: 0, bottom: 0,
            width: 1, background: C.borderStrong,
          }} />
          {/* bar */}
          <div style={{
            position: 'absolute',
            left: `${pctToX(exp.low)}%`,
            width: `${pctToX(exp.high) - pctToX(exp.low)}%`,
            top: 10, height: 8,
            background: isPositive ? C.upBg : C.downBg,
            border: `1px solid ${isPositive ? C.up : C.down}`,
            borderRadius: 2,
          }} />
          {/* expected dot */}
          <div style={{
            position: 'absolute', left: `${pctToX(exp.expected)}%`,
            top: 6, width: 4, height: 16, marginLeft: -2,
            background: isPositive ? C.up : C.down, borderRadius: 1,
          }} />
          {/* scale labels */}
          <div style={{
            position: 'absolute', bottom: -2, left: 0, right: 0,
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9.5, color: C.textSubtle, fontFamily: 'var(--font-mono)',
          }}>
            <span>{fmt(-range, 0)}</span>
            <span>0</span>
            <span>+{range.toFixed(0)}%</span>
          </div>
        </div>

        {/* 三個來源 */}
        <div style={{
          marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, paddingTop: 12, borderTop: `1px dashed ${C.border}`,
        }}>
          {[
            { label: '同信心度', val: exp.sources.sameConf, n: exp.sampleSizes.conf },
            { label: '該個股史', val: exp.sources.sameTicker, n: exp.sampleSizes.ticker },
            { label: '同產業', val: exp.sources.sameSector, n: exp.sampleSizes.sector },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: C.textSubtle, marginBottom: 2, fontWeight: 500 }}>
                {s.label}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)',
                color: s.val >= 0 ? C.up : C.down,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(s.val, 1)}
              </div>
              <div style={{ fontSize: 9.5, color: C.textSubtle, fontFamily: 'var(--font-mono)' }}>
                n={s.n}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 進場時機 */}
      <div style={{
        padding: '14px 20px',
        background: C.surfaceAlt,
        borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: timing.color, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: timing.color, marginBottom: 2 }}>
            {timing.label}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>
            {timing.detail}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: C.textSubtle, letterSpacing: '0.04em' }}>
            現價 / 當時
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>
            {ccy}{actionFmtPrice(timing.current, market)}
          </div>
          <div style={{
            fontSize: 11, color: timing.change >= 0 ? C.up : C.down,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {timing.change >= 0 ? '+' : ''}{timing.change.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 引用 */}
      <div style={{
        padding: '14px 20px 16px',
        borderTop: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        <div style={{
          fontSize: 10, color: C.textSubtle, textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6,
        }}>
          股癌原話
        </div>
        <div style={{
          fontSize: 12.5, color: C.textMuted, lineHeight: 1.55,
          fontStyle: 'italic', letterSpacing: '0.01em',
        }}>
          「{pick.quote}」
        </div>
      </div>
    </div>
  );
}

// ─── Action 頁面主體 ────────────────────────────────
export function ActionPage({ market, config, data }) {
  const { episodes, picks } = data;

  // 最新 4 集
  const latestEpisodes = [...episodes]
    .sort((a, b) => b.ep - a.ep)
    .slice(0, 4);
  const latestEpNums = new Set(latestEpisodes.map(e => e.ep));

  // 過濾：市場 + 最新 4 集 + 隱藏 mention（「只是提到」不算可跟）
  let candidates = picks.filter(p =>
    p.market === market &&
    latestEpNums.has(p.ep) &&
    p.confidence !== 'mention'
  );

  // Tweaks filter
  if (config.actionFollow === 'doing') {
    candidates = candidates.filter(p => p.confidence === 'doing');
  }

  // 排序：發布日期新到舊
  candidates.sort((a, b) => {
    if (b.ep !== a.ep) return b.ep - a.ep;
    if (a.confidence === 'doing' && b.confidence !== 'doing') return -1;
    if (b.confidence === 'doing' && a.confidence !== 'doing') return 1;
    return 0;
  });

  // summary stats
  const expectations = candidates.map(p =>
    computeExpected(p, picks, market).expected
  );
  const avgExpected = expectations.length
    ? expectations.reduce((s, v) => s + v, 0) / expectations.length
    : 0;
  const timings = candidates.map(p => entryTiming(p));
  const greatCount = timings.filter(t => t.tier === 'great' || t.tier === 'good').length;

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1680, margin: '0 auto' }}>
      {/* 頁面標題 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11, color: C.accent, fontFamily: 'var(--font-mono)',
          fontWeight: 700, letterSpacing: '0.14em', marginBottom: 6,
        }}>
          ACTION · 最新 4 集 · {market === 'us' ? '美股' : '台股'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 700,
            color: C.text, letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>
            今天該跟哪幾檔？
          </h1>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            EP {latestEpisodes[latestEpisodes.length - 1].ep} – EP {latestEpisodes[0].ep}
            ·  {latestEpisodes[latestEpisodes.length - 1].date} ~ {latestEpisodes[0].date}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        marginBottom: 28,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            可跟標的
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {candidates.length}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            來自 4 集 · 已隱藏「只是提到」
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            平均預期 1M
          </div>
          <div style={{
            fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: avgExpected >= 0 ? C.up : C.down,
            letterSpacing: '-0.02em', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(avgExpected, 1)}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            綜合三種歷史模型
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            時機良好
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.up, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {greatCount}<span style={{ fontSize: 16, color: C.textSubtle, fontWeight: 500 }}> / {candidates.length}</span>
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            當前價近當時進場價
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            最新集數
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
            EP {latestEpisodes[0].ep}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            {daysAgo(latestEpisodes[0].date)} 天前 · {latestEpisodes[0].date}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {candidates.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '60px 20px', textAlign: 'center',
          color: C.textMuted, fontSize: 14,
        }}>
          此市場最新 4 集沒有符合條件的可跟標的。
          <div style={{ marginTop: 8, fontSize: 12, color: C.textSubtle }}>
            試試切換市場，或在 Tweaks 面板中放寬信心度篩選。
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 20,
        }}>
          {candidates.map(pick => {
            const ep = episodes.find(e => e.ep === pick.ep);
            return (
              <ActionCard key={`${pick.ep}-${pick.ticker}`}
                pick={pick} episode={ep} allPicks={picks} />
            );
          })}
        </div>
      )}

      {/* 免責 */}
      <div style={{
        marginTop: 32, padding: '14px 18px',
        background: C.surfaceAlt, borderRadius: 6,
        fontSize: 11, color: C.textMuted, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.text }}>預期回報計算方式：</strong>
        綜合三個歷史來源的 1M 平均報酬 —
        (1) 相同信心度類別的所有個股、
        (2) 該個股過去被提及時的表現、
        (3) 同產業同信心度的歷史平均。
        三者取平均為「預期」、取標準差為「信心區間」。
        「進場時機」根據當前價 vs 節目當時價的差距判斷。
        <strong style={{ color: C.text }}>本頁僅供參考，並非投資建議。</strong>
      </div>
    </div>
  );
}
