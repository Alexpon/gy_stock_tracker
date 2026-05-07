import { useState } from 'react';
import { C, fmt, fmtPrice } from '../constants.js';
import { Spark } from '../components/shared/Spark.jsx';
import { Pill } from '../components/shared/Pill.jsx';
import { Delta } from '../components/shared/Delta.jsx';
import { StatCard } from '../components/shared/StatCard.jsx';

function StatsBar({ stats, market, period }) {
  const benchName = market === 'us' ? 'SPY' : '0050';
  const benchKey = market === 'us' ? 'vs_spy_q1' : 'vs_0050_q1';
  const pLabel = { w1: '1W', w2: '2W', m1: '1M', q1: '1Q' }[period];
  const hitRate = stats[`hit_rate_${period}`] ?? 0;
  const avgRet = stats[`avg_${period}`] ?? 0;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      display: 'flex', marginBottom: 20, overflow: 'hidden',
    }}>
      <StatCard label="總計提及個股" value={stats.total_picks}
        sub={`有在做 ${stats.doing} · 觀察 ${stats.watching} · 提到 ${stats.mention}`} />
      <StatCard label={`命中率 (${pLabel})`} value={`${(hitRate * 100).toFixed(0)}%`} />
      <StatCard label={`平均報酬 (${pLabel})`} value={fmt(avgRet)}
        subKind={avgRet >= 0 ? 'up' : 'down'} />
      <StatCard label={`VS ${benchName} (1Q)`} value={fmt(stats[benchKey])}
        sub={stats[benchKey] >= 0 ? '超越大盤' : '落後大盤'}
        subKind={stats[benchKey] >= 0 ? 'up' : 'down'} />
      <StatCard label="表現最佳" value={stats.best_pick?.ticker ?? '—'}
        sub={fmt(stats.best_pick?.q1)} subKind="up" />
      <StatCard label="表現最差" value={stats.worst_pick?.ticker ?? '—'}
        sub={fmt(stats.worst_pick?.q1)} subKind="down" />
    </div>
  );
}

function PicksTable({ picks, period, market }) {
  const [sortKey, setSortKey] = useState('return');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = picks.filter(p => p.market === market);
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortKey === 'return') { av = a[period] ?? 0; bv = b[period] ?? 0; }
    else if (sortKey === 'ep') { av = a.ep; bv = b.ep; }
    else if (sortKey === 'confidence') {
      const rank = { doing: 0, watching: 1, mention: 2 };
      av = rank[a.confidence]; bv = rank[b.confidence];
    }
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const setSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const Th = ({ k, children, align = 'left', width }) => (
    <th style={{
      textAlign: align, padding: '10px 12px', fontSize: 10.5, color: C.textMuted, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
      cursor: k ? 'pointer' : 'default', userSelect: 'none', width, whiteSpace: 'nowrap',
    }} onClick={() => k && setSort(k)}>
      {children}
      {k && sortKey === k && <span style={{ marginLeft: 4, color: C.accent }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  );

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>所有個股回測</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead style={{ background: C.surfaceAlt }}>
            <tr>
              <Th>Ticker</Th><Th>Name</Th><Th k="confidence">Signal</Th>
              <Th k="ep" align="center">EP / Date</Th><Th align="center">Entry</Th>
              <Th align="right" width="90">1W</Th><Th align="right" width="90">2W</Th>
              <Th align="right" width="90">1M</Th><Th align="right" width="90">1Q</Th>
              <Th align="center" width="120">Trend</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const val = p[period] ?? 0;
              const positive = val >= 0;
              return (
                <tr key={`${p.ticker}-${p.ep}`}
                  style={{ background: i % 2 === 0 ? C.surface : '#fbfcfd', borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: C.text }}>{p.ticker}</td>
                  <td style={{ padding: '10px 12px', color: C.textMuted, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={{ padding: '10px 12px' }}><Pill kind={p.confidence} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: C.textMuted, fontSize: 11.5 }}>
                    EP{p.ep} <span style={{ color: C.textSubtle }}>· {p.mention_date?.slice(5)}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p.entry)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='w1' ? C.accentBg : 'transparent' }}><Delta value={p.w1} strong={period==='w1'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='w2' ? C.accentBg : 'transparent' }}><Delta value={p.w2} strong={period==='w2'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='m1' ? C.accentBg : 'transparent' }}><Delta value={p.m1} strong={period==='m1'} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', background: period==='q1' ? C.accentBg : 'transparent' }}><Delta value={p.q1} strong={period==='q1'} /></td>
                  <td style={{ padding: '4px 12px', textAlign: 'center' }}><Spark data={p.sparkline} width={90} height={24} positive={positive} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalysisPage({ data, market }) {
  const [period, setPeriod] = useState('q1');
  const stats = data.stats[market] || {};
  const allPicks = data.picks || [];

  return (
    <div style={{ padding: '20px 28px 60px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Period selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', background: C.surfaceAlt, padding: 2, borderRadius: 6, border: `1px solid ${C.border}` }}>
          {[['w1', '1W'], ['w2', '2W'], ['m1', '1M'], ['q1', '1Q']].map(([k, label]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4,
              background: period === k ? C.surface : 'transparent',
              color: period === k ? C.text : C.textMuted,
              boxShadow: period === k ? '0 1px 2px rgba(16,24,40,0.06)' : 'none',
              fontFamily: 'var(--font-mono)',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <StatsBar stats={stats} market={market} period={period} />
      <PicksTable picks={allPicks} period={period} market={market} />

      <div style={{
        marginTop: 20, padding: '12px 18px',
        background: C.surfaceAlt, borderRadius: 6,
        fontSize: 11, color: C.textMuted, lineHeight: 1.6,
      }}>
        進場假設為節目發布後首個交易日開盤價；與大盤比較的基準為 {market === 'us' ? 'SPY' : '0050'}。未計入手續費、稅、滑價。不構成投資建議。
      </div>
    </div>
  );
}
