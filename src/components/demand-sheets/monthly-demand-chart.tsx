'use client';
/** Monthly demand SVG chart. Extracted verbatim from the page. */
import {
  useState,
} from 'react';

export function MonthlyDemandChart({ data }: { data: { month: string; count: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 640;
  const height = 280;
  const padding = { top: 28, right: 24, bottom: 42, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxCount = Math.max(...data.map(item => item.count), 1);
  const points = data.map((item, index) => {
    const x = padding.left + (plotWidth / Math.max(data.length - 1, 1)) * index;
    const y = padding.top + plotHeight - (item.count / maxCount) * plotHeight;
    return { ...item, x, y, index };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding.left} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;
  const yTicks = Array.from({ length: 5 }).map((_, index) => {
    const value = Math.round((maxCount / 4) * (4 - index));
    const y = padding.top + (plotHeight / 4) * index;
    return { value, y };
  });
  const slotWidth = points.length <= 1 ? plotWidth : plotWidth / (points.length - 1);
  // Thin out x-axis labels on wide ranges (e.g. weekly buckets across a
  // year) so they don't collide — aim for at most ~12 labels.
  const labelEvery = Math.max(1, Math.ceil(points.length / 12));

  return (
    <div className="relative rounded-xl bg-slate-50/80 dark:bg-slate-950/30 p-4 select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full overflow-visible" role="img" aria-label="Monthly demand generation chart">
        <defs>
          <linearGradient id="monthlyDemandFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map(tick => (
          <g key={`${tick.value}-${tick.y}`}>
            <line x1={padding.left} x2={width - padding.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padding.left - 12} y={tick.y + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-semibold">
              {tick.value}
            </text>
          </g>
        ))}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke="#cbd5e1" strokeWidth="1.5" />
        <path d={areaPath} fill="url(#monthlyDemandFill)" />
        <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover Guideline */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <line
            x1={points[hoveredIndex].x}
            y1={padding.top}
            x2={points[hoveredIndex].x}
            y2={padding.top + plotHeight}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity={0.6}
          />
        )}

        {points.map(point => {
          const isHovered = hoveredIndex === point.index;
          return (
            <g key={point.month}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isHovered ? 7 : 5}
                fill="#fff"
                stroke="#f59e0b"
                strokeWidth={isHovered ? 4 : 3}
              />
              <text
                x={point.x}
                y={padding.top + plotHeight + 26}
                textAnchor="middle"
                className={`text-[12px] ${isHovered ? 'fill-slate-900 dark:fill-white font-black' : 'fill-slate-600 font-bold'}`}
              >
                {point.index % labelEvery === 0 ? point.month : ""}
              </text>
            </g>
          );
        })}

        {/* Hover detection zones */}
        {points.map((point, idx) => (
          <rect
            key={`hz-${idx}`}
            x={point.x - slotWidth / 2}
            y={padding.top}
            width={slotWidth}
            height={plotHeight}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (() => {
        const p = points[hoveredIndex];
        const xRatio = p.x / width;
        const yRatio = p.y / height;
        const transformX = xRatio > 0.8 ? '-95%' : xRatio < 0.2 ? '-5%' : '-50%';
        const transformY = yRatio < 0.28 ? '12px' : '-115%';

        return (
          <div
            className="absolute pointer-events-none z-20 transition-all duration-75"
            style={{
              left: `${xRatio * 100}%`,
              top: `${yRatio * 100}%`,
              transform: `translate(${transformX}, ${transformY})`,
            }}
          >
            <div className="bg-slate-800/95 dark:bg-slate-900/95 text-white text-[11px] px-3.5 py-2 rounded-lg shadow-xl backdrop-blur-sm whitespace-nowrap border border-slate-700/50" style={{ fontFamily: "'Inter', sans-serif" }}>
              <div className="font-bold mb-1 text-slate-200">{p.month}</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span className="text-slate-300">Demand Records:</span>
                <span className="font-bold text-amber-400">{p.count.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
