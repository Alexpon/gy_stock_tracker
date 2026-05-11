import { C } from '../../constants.js';

export function Pill({ kind }) {
  const styles = {
    doing: { bg: C.accentBg, color: C.accent, label: '有在做' },
    watching: { bg: C.warnBg, color: C.warn, label: '觀察中' },
    mention: { bg: C.surfaceAlt, color: C.textMuted, label: '只是提到' },
  };
  const s = styles[kind] || styles.mention;
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
