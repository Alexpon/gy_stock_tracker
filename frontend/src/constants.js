export const C = {
  bg: '#f7f8fa', surface: '#ffffff', surfaceAlt: '#f1f3f7',
  border: '#e4e7ec', borderStrong: '#d0d5dd',
  text: '#0b1220', textMuted: '#475467', textSubtle: '#98a2b3',
  up: '#067647', upBg: '#ecfdf3', down: '#b42318', downBg: '#fef3f2',
  accent: '#3e4ccf', accentBg: '#eef0ff', warn: '#b54708', warnBg: '#fffaeb',
};

export function fmt(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(dp) + '%';
}

export function fmtPrice(n) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toFixed(2);
}

export const PERIOD_DAYS = { w1: 5, w2: 10, m1: 21, q1: 63 };

export const DEFAULT_CONFIG = {
  followOnly: 'doing',
  capitalPerEpisode: 10000,
  entryDelay: 0,
  showBenchOverlay: true,
  actionFollow: 'all',
};
