import { C } from '../../constants.js';

export function StatCard({ label, value, sub, subKind, mono = true }) {
  return (
    <div style={{ padding: '14px 16px', borderRight: `1px solid ${C.border}`, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 600, color: C.text,
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, marginTop: 4,
          color: subKind === 'up' ? C.up : subKind === 'down' ? C.down : C.textMuted,
          fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        }}>{sub}</div>
      )}
    </div>
  );
}
