import { useMemo } from 'react';

import { valueToAngle, type DialPolarity } from './useDial';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DialArcProps {
  value: number;
  polarity: DialPolarity;
  size: number;
  isDragging?: boolean;
  isHovered?: boolean;
}

interface ArcPathParams {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}

// ---------------------------------------------------------------------------
// Arc Path Generation
// ---------------------------------------------------------------------------

/**
 * Generate an SVG arc path.
 * Angles are in degrees, measured from top (12 o'clock).
 */
function describeArc({ cx, cy, radius, startAngle, endAngle }: ArcPathParams): string {
  // Handle zero-length arc
  if (Math.abs(endAngle - startAngle) < 0.001) {
    return '';
  }

  // Convert to radians and adjust for SVG coordinate system
  // In SVG, 0 degrees points right (3 o'clock), so we subtract 90 to start from top
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  // Large arc flag: 1 if arc > 180 degrees
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

  // Sweep flag: 1 for clockwise
  const sweepFlag = endAngle > startAngle ? 1 : 0;

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// DialArc Component
// ---------------------------------------------------------------------------

export function DialArc({
  value,
  polarity,
  size,
  isDragging = false,
  isHovered = false,
}: DialArcProps) {
  const radius = size / 2 - 4; // Padding from edge
  const cx = size / 2;
  const cy = size / 2;

  const currentAngle = valueToAngle(value, polarity);
  // For bipolar, zero is at top (0 degrees); for unipolar, start from -135
  const zeroAngle = polarity === 'bipolar' ? 0 : -135;

  // Memoize arc paths to avoid recalculating unless value changes
  const { bgPath, valuePath, indicatorEnd } = useMemo(() => {
    // Background arc (full range: -135 to +135)
    const bg = describeArc({
      cx,
      cy,
      radius,
      startAngle: -135,
      endAngle: 135,
    });

    // Value arc (from zero to current value)
    // Handle the direction properly for bipolar dials
    const valueStart = Math.min(zeroAngle, currentAngle);
    const valueEnd = Math.max(zeroAngle, currentAngle);

    const val = describeArc({
      cx,
      cy,
      radius,
      startAngle: valueStart,
      endAngle: valueEnd,
    });

    // Calculate indicator line endpoint
    const indicatorLength = radius - 8;
    const indicatorRad = ((currentAngle - 90) * Math.PI) / 180;
    const indicator = {
      x: cx + indicatorLength * Math.cos(indicatorRad),
      y: cy + indicatorLength * Math.sin(indicatorRad),
    };

    return { bgPath: bg, valuePath: val, indicatorEnd: indicator };
  }, [cx, cy, radius, zeroAngle, currentAngle]);

  // Dynamic colors based on state
  const accentColor = isDragging
    ? 'var(--color-gold-bright)'
    : isHovered
      ? 'var(--color-gold)'
      : 'var(--color-gold)';

  const bgColor = 'var(--color-border)';

  return (
    <svg
      width={size}
      height={size}
      className="dial-arc"
      style={{ overflow: 'visible' }}
    >
      {/* Background track */}
      <path
        d={bgPath}
        fill="none"
        stroke={bgColor}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Value indicator arc */}
      {valuePath && (
        <path
          d={valuePath}
          fill="none"
          stroke={accentColor}
          strokeWidth={3}
          strokeLinecap="round"
        />
      )}

      {/* Center indicator line */}
      <line
        x1={cx}
        y1={cy}
        x2={indicatorEnd.x}
        y2={indicatorEnd.y}
        stroke={isDragging ? 'var(--color-gold-bright)' : 'var(--color-gold)'}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill={accentColor} />

      {/* Tick marks at -1, 0, +1 for bipolar or 0, 0.5, 1 for unipolar */}
      {polarity === 'bipolar' ? (
        <>
          {/* -1 tick (left) */}
          <TickMark cx={cx} cy={cy} radius={radius + 4} angle={-135} size={4} />
          {/* 0 tick (top) */}
          <TickMark cx={cx} cy={cy} radius={radius + 4} angle={0} size={6} />
          {/* +1 tick (right) */}
          <TickMark cx={cx} cy={cy} radius={radius + 4} angle={135} size={4} />
        </>
      ) : (
        <>
          {/* 0 tick (left) */}
          <TickMark cx={cx} cy={cy} radius={radius + 4} angle={-135} size={4} />
          {/* 0.5 tick (top) */}
          <TickMark cx={cx} cy={cy} radius={radius + 4} angle={0} size={4} />
          {/* 1 tick (right) */}
          <TickMark cx={cx} cy={cy} radius={radius + 4} angle={135} size={4} />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// TickMark Component
// ---------------------------------------------------------------------------

interface TickMarkProps {
  cx: number;
  cy: number;
  radius: number;
  angle: number; // degrees from top
  size: number;
}

function TickMark({ cx, cy, radius, angle, size }: TickMarkProps) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(rad);
  const y1 = cy + radius * Math.sin(rad);
  const x2 = cx + (radius + size) * Math.cos(rad);
  const y2 = cy + (radius + size) * Math.sin(rad);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--color-text-muted)"
      strokeWidth={1}
      strokeLinecap="round"
    />
  );
}
