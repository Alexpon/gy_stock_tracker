import { C, fmt } from '../../constants.js';

export function Delta({ value, strong }) {
  if (value === null || value === undefined) return <span style={{ color: C.textSubtle }}>—</span>;
  const positive = value >= 0;
  return (
    <span style={{
      color: positive ? C.up : C.down, fontWeight: strong ? 600 : 500,
      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
    }}>{fmt(value)}</span>
  );
}
