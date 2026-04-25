import { C } from '../../constants.js';

export function Spark({ data, width = 120, height = 32, positive }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const dx = width / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, height - ((v - min) / range) * height]).map(p => p.join(',')).join(' ');
  const last = data[data.length - 1];
  const lastY = height - ((last - min) / range) * height;
  const color = positive ? C.up : C.down;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} stroke={color} strokeWidth="1.25" fill="none" />
      <circle cx={width - 1} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
