import { C } from '../../constants.js';

const STYLES = {
  bullish: { bg: C.upBg, color: C.up, label: '看好' },
  neutral: { bg: C.warnBg, color: C.warn, label: '中立' },
  bearish: { bg: C.downBg, color: C.down, label: '看壞' },
};

export function SentimentPill({ sentiment }) {
  const s = STYLES[sentiment] || STYLES.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 3,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
      background: s.bg, color: s.color, fontFamily: 'var(--font-sans)',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}
