// Action: 決策頁 — 最新 4 集標的，以個股為單位合併

import { useState } from 'react';
import { C, fmt } from '../constants.js';
import { Pill } from '../components/shared/Pill.jsx';
import { SentimentPill } from '../components/shared/SentimentPill.jsx';

// ─── Helpers ────────────────────────────────────────

function entryTiming(entry, sparkline) {
  const current = sparkline?.length ? sparkline[sparkline.length - 1] : null;
  if (current == null || entry == null || entry === 0) {
    return { tier: 'unknown', label: '資料不足', color: '#98a2b3', change: null, current, entry };
  }
  const change = (current - entry) / entry * 100;
  if (change < -2) return { tier: 'great', label: '低於當時價', color: '#067647', change, current, entry };
  if (change < 2) return { tier: 'good', label: '接近當時價', color: '#067647', change, current, entry };
  if (change < 10) return { tier: 'ok', label: '略高於當時', color: '#b54708', change, current, entry };
  return { tier: 'wait', label: '已漲超 10%', color: '#b42318', change, current, entry };
}

function fmtPrice(n, market) {
  if (n == null) return '—';
  if (market === 'tw') return Math.round(n).toLocaleString();
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(2);
}

function daysAgo(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function MiniSparkline({ data, width = 100, height = 28, color }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
  ).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── 合併邏輯 ───────────────────────────────────────

const CONF_RANK = { doing: 3, watching: 2, mention: 1 };

function mergePicks(picks) {
  const map = new Map();
  for (const p of picks) {
    const key = p.ticker;
    if (!map.has(key)) {
      map.set(key, {
        ticker: p.ticker,
        name: p.name,
        market: p.market,
        sector: p.sector,
        confidence: p.confidence,
        entries: [p],
        latest: p,
        earliest: p,
      });
    } else {
      const g = map.get(key);
      g.entries.push(p);
      if ((CONF_RANK[p.confidence] || 0) > (CONF_RANK[g.confidence] || 0)) {
        g.confidence = p.confidence;
      }
      if (p.ep > g.latest.ep) g.latest = p;
      if (p.ep < g.earliest.ep) g.earliest = p;
    }
  }

  return [...map.values()].map(g => {
    const p = g.latest;
    const timing = entryTiming(p.entry, p.sparkline);
    const periods = ['w1', 'w2', 'm1', 'q1']
      .map(k => ({ key: k, val: g.earliest[k] }))
      .filter(x => x.val != null);
    return {
      ...g,
      timing,
      periods,
      mentionCount: g.entries.length,
      sparkline: p.sparkline,
      entry: p.entry,
    };
  });
}

// ─── 族群合併邏輯 ─────────────────────────────────────

const SENT_RANK = { bullish: 3, neutral: 2, bearish: 1 };

function mergeSectors(sectors) {
  const map = new Map();
  for (const s of sectors) {
    if (!map.has(s.name)) {
      map.set(s.name, { name: s.name, entries: [s], latest: s });
    } else {
      const g = map.get(s.name);
      g.entries.push(s);
      if (s.ep > g.latest.ep) g.latest = s;
    }
  }
  return [...map.values()]
    .map(g => ({
      ...g,
      sentiment: g.latest.sentiment,
      quote: g.latest.quote,
      tickers: g.latest.tickers || [],
      mentionCount: g.entries.length,
    }))
    .sort((a, b) => (SENT_RANK[b.sentiment] || 0) - (SENT_RANK[a.sentiment] || 0));
}

function SectorCard({ group }) {
  const [open, setOpen] = useState(false);
  const truncatedQuote = group.quote
    ? group.quote.length > 30 ? group.quote.slice(0, 30) + '…' : group.quote
    : null;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        minWidth: 180,
        flex: '1 1 180px',
        maxWidth: 280,
      }}
      onClick={() => setOpen(!open)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{group.name}</span>
        <SentimentPill sentiment={group.sentiment} />
      </div>
      <div style={{ fontSize: 10, color: C.textSubtle, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
        EP {group.latest.ep}
        {group.mentionCount > 1 && ` · 共 ${group.mentionCount} 集提及`}
      </div>
      {truncatedQuote && (
        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.4 }}>
          「{truncatedQuote}」
        </div>
      )}
      {group.tickers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {group.tickers.slice(0, 4).map(t => (
            <span key={t} style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '1px 6px', borderRadius: 3,
              background: C.surfaceAlt, color: C.textMuted,
            }}>{t}</span>
          ))}
          {group.tickers.length > 4 && (
            <span style={{ fontSize: 10, color: C.textSubtle }}>+{group.tickers.length - 4}</span>
          )}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {group.quote && group.quote.length > 30 && (
            <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 10 }}>
              「{group.quote}」
            </div>
          )}
          {group.entries.length > 1 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: C.textSubtle, fontWeight: 700, marginBottom: 6 }}>歷史觀點</div>
              {group.entries.sort((a, b) => b.ep - a.ep).map(s => (
                <div key={s.ep} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: C.text, minWidth: 50 }}>
                    EP {s.ep}
                  </span>
                  <SentimentPill sentiment={s.sentiment} />
                  {s.quote && (
                    <span style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>
                      「{s.quote.length > 20 ? s.quote.slice(0, 20) + '…' : s.quote}」
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 表格行 ─────────────────────────────────────────

function PickRow({ group, muted }) {
  const [open, setOpen] = useState(false);
  const { timing, mentionCount, sparkline } = group;
  const market = group.market;
  const ccy = market === 'us' ? '$' : 'NT$';
  const change = timing.change;
  const isPos = change != null && change >= 0;
  const changeColor = change != null ? (isPos ? C.up : C.down) : C.textSubtle;

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '2fr 80px 100px 100px 120px 100px',
    alignItems: 'center',
    padding: '12px 20px',
    background: C.surface,
    cursor: 'pointer',
    borderBottom: `1px solid ${C.border}`,
    transition: 'background 0.1s',
    ...(muted ? { opacity: 0.5 } : {}),
  };

  return (
    <>
      <div style={rowStyle}
        onClick={() => setOpen(!open)}
        onMouseEnter={e => { e.currentTarget.style.background = C.surfaceAlt; }}
        onMouseLeave={e => { e.currentTarget.style.background = C.surface; }}
      >
        {/* Ticker + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: C.text, letterSpacing: '-0.01em',
          }}>{group.ticker}</span>
          <span style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.name}
          </span>
          <Pill kind={group.confidence} />
        </div>

        {/* 提及次數 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {Array.from({ length: mentionCount }, (_, i) => (
            <span key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: group.confidence === 'mention' ? C.textSubtle : C.accent,
            }} />
          ))}
          <span style={{ fontSize: 10, color: C.textSubtle, fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
            {mentionCount}集
          </span>
        </div>

        {/* 進場價 */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {ccy}{fmtPrice(group.entry, market)}
        </div>

        {/* 漲跌 */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
          color: changeColor, fontVariantNumeric: 'tabular-nums',
        }}>
          {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
        </div>

        {/* Sparkline */}
        <div>
          <MiniSparkline data={sparkline} color={changeColor} />
        </div>

        {/* 進場時機 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: timing.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: timing.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {timing.label}
          </span>
        </div>
      </div>

      {/* 展開：各集細節 */}
      {open && (
        <div style={{
          background: C.surfaceAlt,
          borderBottom: `1px solid ${C.border}`,
          padding: '12px 20px 16px',
        }}>
          {group.entries.sort((a, b) => b.ep - a.ep).map(p => {
            const t = entryTiming(p.entry, p.sparkline);
            return (
              <div key={p.ep} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '10px 0',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ minWidth: 80, flexShrink: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', color: C.text,
                  }}>
                    EP {p.ep}
                  </div>
                  <div style={{ fontSize: 10, color: C.textSubtle, marginTop: 2 }}>
                    {p.mention_date} · {daysAgo(p.mention_date)}天前
                  </div>
                  <Pill kind={p.confidence} />
                </div>
                <div style={{ minWidth: 90, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: C.textSubtle, marginBottom: 2 }}>進場價</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: C.text }}>
                    {ccy}{fmtPrice(p.entry, market)}
                  </div>
                  {t.change != null && (
                    <div style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 2,
                      color: t.change >= 0 ? C.up : C.down,
                    }}>
                      {t.change >= 0 ? '+' : ''}{t.change.toFixed(1)}%
                    </div>
                  )}
                </div>
                {/* 期數回報 */}
                {['w1', 'w2', 'm1', 'q1'].some(k => p[k] != null) && (
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    {['w1', 'w2', 'm1', 'q1'].filter(k => p[k] != null).map(k => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: C.textSubtle }}>{k.toUpperCase()}</div>
                        <div style={{
                          fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                          color: p[k] >= 0 ? C.up : C.down,
                        }}>{fmt(p[k], 1)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {p.quote && (
                  <div style={{
                    flex: 1, fontSize: 12, color: C.textMuted, lineHeight: 1.5,
                    fontStyle: 'italic', minWidth: 0,
                  }}>
                    「{p.quote}」
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── 表格標題行 ──────────────────────────────────────

function TableHeader() {
  const hdr = { fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 80px 100px 100px 120px 100px',
      padding: '8px 20px',
      borderBottom: `1px solid ${C.borderStrong}`,
    }}>
      <span style={hdr}>標的</span>
      <span style={hdr}>提及</span>
      <span style={hdr}>進場價</span>
      <span style={hdr}>漲跌</span>
      <span style={hdr}>走勢</span>
      <span style={hdr}>時機</span>
    </div>
  );
}

// ─── Action 頁面主體 ────────────────────────────────

export function ActionPage({ market, config, data }) {
  const { episodes, picks } = data;

  const latestEpisodes = [...episodes]
    .sort((a, b) => b.ep - a.ep)
    .slice(0, 4);
  const latestEpNums = new Set(latestEpisodes.map(e => e.ep));

  const allCandidates = picks.filter(p =>
    p.market === market && latestEpNums.has(p.ep)
  );

  const actionablePicks = allCandidates.filter(p => p.confidence !== 'mention');
  const mentionPicks = allCandidates.filter(p => p.confidence === 'mention');

  const actionable = mergePicks(actionablePicks)
    .sort((a, b) => b.mentionCount - a.mentionCount || b.latest.ep - a.latest.ep);
  const mentions = mergePicks(mentionPicks)
    .sort((a, b) => b.mentionCount - a.mentionCount || b.latest.ep - a.latest.ep);

  // summary stats
  const changes = actionable.filter(g => g.timing.change != null).map(g => g.timing.change);
  const avgChange = changes.length
    ? changes.reduce((s, v) => s + v, 0) / changes.length
    : null;
  const greatCount = actionable.filter(g => g.timing.tier === 'great' || g.timing.tier === 'good').length;

  // sector groups
  const allSectors = (data.sectors || []).filter(s => {
    if (!s.tickers || s.tickers.length === 0) return true;
    const tickerMarkets = s.tickers
      .map(t => picks.find(p => p.ticker === t))
      .filter(Boolean)
      .map(p => p.market);
    return tickerMarkets.length === 0 || tickerMarkets.includes(market);
  }).filter(s => latestEpNums.has(s.ep));
  const sectorGroups = mergeSectors(allSectors);

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
          {latestEpisodes.length > 0 && (
            <div style={{ fontSize: 13, color: C.textMuted }}>
              EP {latestEpisodes[latestEpisodes.length - 1].ep} – EP {latestEpisodes[0].ep}
              ·  {latestEpisodes[latestEpisodes.length - 1].date} ~ {latestEpisodes[0].date}
            </div>
          )}
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
            {actionable.length}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            來自 4 集 · 合併後{mentions.length > 0 ? ` · 另有 ${mentions.length} 檔提到` : ''}
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            平均漲跌
          </div>
          <div style={{
            fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: avgChange != null ? (avgChange >= 0 ? C.up : C.down) : C.textSubtle,
            letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {avgChange != null ? fmt(avgChange, 1) : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            提及以來實際表現
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
            時機良好
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: C.up, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {greatCount}<span style={{ fontSize: 16, color: C.textSubtle, fontWeight: 500 }}> / {actionable.length}</span>
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
            EP {latestEpisodes[0]?.ep ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            {latestEpisodes[0] ? `${daysAgo(latestEpisodes[0].date)} 天前 · ${latestEpisodes[0].date}` : ''}
          </div>
        </div>
      </div>

      {/* 族群觀點卡片 */}
      {sectorGroups.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, color: C.textSubtle, fontFamily: 'var(--font-mono)',
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            族群觀點 · 最新 4 集
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {sectorGroups.map(g => (
              <SectorCard key={g.name} group={g} />
            ))}
          </div>
        </div>
      )}

      {/* 可跟標的表格 */}
      {actionable.length > 0 && (
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <TableHeader />
          {actionable.map(g => (
            <PickRow key={g.ticker} group={g} />
          ))}
        </div>
      )}

      {/* 只是提到 */}
      {mentions.length > 0 && (
        <>
          <div style={{
            marginTop: actionable.length > 0 ? 32 : 0,
            marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              fontSize: 11, color: C.textSubtle, fontFamily: 'var(--font-mono)',
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              只是提到 · {mentions.length} 檔
            </div>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <TableHeader />
            {mentions.map(g => (
              <PickRow key={g.ticker} group={g} muted />
            ))}
          </div>
        </>
      )}

      {/* 完全無資料 */}
      {actionable.length === 0 && mentions.length === 0 && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '60px 20px', textAlign: 'center',
          color: C.textMuted, fontSize: 14,
        }}>
          此市場最新 4 集沒有任何標的。
          <div style={{ marginTop: 8, fontSize: 12, color: C.textSubtle }}>
            試試切換市場。
          </div>
        </div>
      )}

      {/* 免責 */}
      <div style={{
        marginTop: 32, padding: '14px 18px',
        background: C.surfaceAlt, borderRadius: 6,
        fontSize: 11, color: C.textMuted, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.text }}>數據說明：</strong>
        同一檔股票在不同集數提及時合併為一行，提及次數以圓點表示（越多 = 信號越強）。
        漲跌為最新一次進場價到目前價的實際變動。點擊可展開查看各集細節與股癌原話。
        <strong style={{ color: C.text }}>本頁僅供參考，並非投資建議。</strong>
      </div>
    </div>
  );
}
