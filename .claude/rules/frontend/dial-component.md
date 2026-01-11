# Dial Component Patterns

## Overview

Dials are rotary knob controls for manipulating feature strengths. They feel like professional audio mixing board controls - precise, tactile, and responsive.

---

## Core Architecture

### Rotation Math

Map dial value to visual rotation (270-degree arc):

```typescript
const VALUE_TO_ROTATION = {
  // For bipolar dials (-1 to 1)
  bipolar: {
    min: -1,
    max: 1,
    startAngle: -135,  // degrees from top
    endAngle: 135,
    totalArc: 270,
  },
  // For unipolar dials (0 to 1)
  unipolar: {
    min: 0,
    max: 1,
    startAngle: -135,
    endAngle: 135,
    totalArc: 270,
  },
};

function valueToAngle(value: number, polarity: 'bipolar' | 'unipolar'): number {
  const config = VALUE_TO_ROTATION[polarity];
  const normalized = (value - config.min) / (config.max - config.min);
  return config.startAngle + normalized * config.totalArc;
}

function angleToValue(angle: number, polarity: 'bipolar' | 'unipolar'): number {
  const config = VALUE_TO_ROTATION[polarity];
  const normalized = (angle - config.startAngle) / config.totalArc;
  return config.min + normalized * (config.max - config.min);
}
```

---

## Pointer Capture Pattern

Use pointer capture for smooth drag behavior that continues outside the element:

```typescript
function useDial(options: UseDialOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (options.disabled || options.locked) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = options.value;
  }, [options.disabled, options.locked, options.value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    // Vertical drag: up = increase, down = decrease
    const deltaY = startY.current - e.clientY;
    const sensitivity = e.shiftKey ? 0.001 : 0.005;  // Fine control with Shift
    const deltaValue = deltaY * sensitivity;

    const range = options.polarity === 'bipolar' ? 2 : 1;
    const newValue = Math.max(
      options.polarity === 'bipolar' ? -1 : 0,
      Math.min(1, startValue.current + deltaValue)
    );

    options.onChange(newValue);
  }, [isDragging, options]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  }, []);

  return {
    isDragging,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}
```

---

## SVG Arc Rendering

Draw the dial indicator arc using SVG:

```typescript
interface ArcProps {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;  // degrees
  endAngle: number;    // degrees
  strokeWidth: number;
}

function describeArc({ cx, cy, radius, startAngle, endAngle, strokeWidth }: ArcProps): string {
  // Convert to radians and adjust for SVG coordinate system
  const startRad = (startAngle - 90) * Math.PI / 180;
  const endRad = (endAngle - 90) * Math.PI / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
}

function DialArc({ value, polarity, size }: DialArcProps) {
  const radius = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;

  const currentAngle = valueToAngle(value, polarity);
  const zeroAngle = polarity === 'bipolar' ? 0 : -135;

  // Background arc (full range)
  const bgPath = describeArc({
    cx, cy, radius,
    startAngle: -135,
    endAngle: 135,
    strokeWidth: 3,
  });

  // Value arc (from zero to current)
  const valuePath = describeArc({
    cx, cy, radius,
    startAngle: Math.min(zeroAngle, currentAngle),
    endAngle: Math.max(zeroAngle, currentAngle),
    strokeWidth: 3,
  });

  return (
    <svg width={size} height={size} className="dial-arc">
      {/* Background track */}
      <path
        d={bgPath}
        fill="none"
        stroke="var(--color-bg-tertiary)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Value indicator */}
      <path
        d={valuePath}
        fill="none"
        stroke="var(--color-gold-primary)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Center indicator line */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + (radius - 8) * Math.sin(currentAngle * Math.PI / 180)}
        y2={cy - (radius - 8) * Math.cos(currentAngle * Math.PI / 180)}
        stroke="var(--color-gold-bright)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
```

---

## Keyboard Accessibility

Full keyboard control when focused:

```typescript
function useDialKeyboard(options: UseDialKeyboardOptions) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (options.disabled || options.locked) return;

    const step = e.shiftKey ? 0.01 : 0.05;  // Fine control with Shift
    const { min, max } = options.polarity === 'bipolar'
      ? { min: -1, max: 1 }
      : { min: 0, max: 1 };

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        options.onChange(Math.min(max, options.value + step));
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        options.onChange(Math.max(min, options.value - step));
        break;
      case 'Home':
        e.preventDefault();
        options.onChange(min);
        break;
      case 'End':
        e.preventDefault();
        options.onChange(max);
        break;
      case 'PageUp':
        e.preventDefault();
        options.onChange(Math.min(max, options.value + 0.1));
        break;
      case 'PageDown':
        e.preventDefault();
        options.onChange(Math.max(min, options.value - 0.1));
        break;
    }
  }, [options]);

  return { onKeyDown: handleKeyDown };
}
```

---

## Scroll Wheel Support

Fine adjustment with scroll wheel:

```typescript
function useDialWheel(options: UseDialWheelOptions) {
  const handleWheel = useCallback((e: WheelEvent) => {
    if (options.disabled || options.locked) return;
    e.preventDefault();

    const step = e.shiftKey ? 0.01 : 0.05;
    const delta = e.deltaY > 0 ? -step : step;
    const { min, max } = options.polarity === 'bipolar'
      ? { min: -1, max: 1 }
      : { min: 0, max: 1 };

    options.onChange(Math.max(min, Math.min(max, options.value + delta)));
  }, [options]);

  useEffect(() => {
    const element = options.ref.current;
    if (!element) return;

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [handleWheel, options.ref]);
}
```

---

## Double-Click Reset

Reset to default value on double-click:

```typescript
function useDialReset(options: UseDialResetOptions) {
  const handleDoubleClick = useCallback(() => {
    if (options.disabled || options.locked) return;
    options.onChange(options.defaultValue);
  }, [options]);

  return { onDoubleClick: handleDoubleClick };
}
```

---

## Complete Dial Component

```tsx
interface DialProps {
  id: string;
  label: string;
  value: number;
  defaultValue?: number;
  polarity: 'bipolar' | 'unipolar';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  locked?: boolean;
  onChange: (value: number) => void;
  onHover?: (hovered: boolean) => void;
}

const SIZES = { sm: 32, md: 48, lg: 64 };

export function Dial({
  id,
  label,
  value,
  defaultValue = 0,
  polarity,
  size = 'md',
  disabled = false,
  locked = false,
  onChange,
  onHover,
}: DialProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pixelSize = SIZES[size];

  const { isDragging, handlers: dragHandlers } = useDial({
    value, polarity, disabled, locked, onChange,
  });

  const { onKeyDown } = useDialKeyboard({
    value, polarity, disabled, locked, onChange,
  });

  useDialWheel({ ref, value, polarity, disabled, locked, onChange });

  const { onDoubleClick } = useDialReset({
    defaultValue, disabled, locked, onChange,
  });

  return (
    <div
      ref={ref}
      className={cn(
        'dial',
        isDragging && 'dial--dragging',
        disabled && 'dial--disabled',
        locked && 'dial--locked',
      )}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={polarity === 'bipolar' ? -1 : 0}
      aria-valuemax={1}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      {...dragHandlers}
    >
      <DialArc value={value} polarity={polarity} size={pixelSize} />
      {locked && <LockIcon className="dial__lock" />}
      <span className="dial__label">{label}</span>
      <span className="dial__value">{value.toFixed(2)}</span>
    </div>
  );
}
```

---

## Styling (Tailwind + CSS Variables)

```css
.dial {
  @apply relative flex flex-col items-center gap-1 cursor-grab select-none;
  touch-action: none;
}

.dial--dragging {
  @apply cursor-grabbing;
}

.dial--disabled {
  @apply opacity-50 cursor-not-allowed;
}

.dial--locked {
  @apply cursor-not-allowed;
}

.dial:focus-visible {
  @apply outline-none ring-2 ring-gold-primary ring-offset-2 ring-offset-bg-primary rounded-full;
}

.dial__label {
  @apply text-xs text-text-secondary font-medium tracking-wide uppercase;
}

.dial__value {
  @apply text-xs font-mono text-text-muted tabular-nums;
}

.dial__lock {
  @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-gold-dim;
}
```

---

## Trace Highlight Integration

When dial is hovered or dragged, highlight its trace in the graph:

```typescript
// In useDial hook, add trace highlighting
const handleHoverChange = useCallback((hovered: boolean) => {
  if (options.traceNodeIds && options.traceNodeIds.length > 0) {
    useGraphStore.getState().setTraceHighlight(
      hovered || isDragging ? options.traceNodeIds : null,
      hovered ? 0.5 : isDragging ? 1.0 : 0  // Intensity
    );
  }
  onHover?.(hovered);
}, [options.traceNodeIds, isDragging, onHover]);
```

---

## Performance Considerations

1. **Debounce onChange** for store updates (100ms)
2. **Don't setState during drag** - use refs for intermediate values
3. **Memoize arc paths** - only recompute when value changes
4. **Use CSS transforms** for rotation, not re-rendering SVG

---

## Anti-Patterns

```typescript
// BAD - Creating new functions in render
<Dial onChange={(v) => store.setDialValue(id, v)} />

// GOOD - Stable callback reference
const handleChange = useCallback((v: number) => {
  store.setDialValue(id, v);
}, [id]);
<Dial onChange={handleChange} />
```

```typescript
// BAD - Re-rendering entire mixer on every dial change
function Mixer() {
  const dialValues = useStore(s => s.dialValues);  // Object reference changes
  return dials.map(d => <Dial value={dialValues[d.id]} />);
}

// GOOD - Subscribe to individual values
function DialWrapper({ id }: { id: string }) {
  const value = useStore(s => s.dialValues[id]);
  return <Dial value={value} />;
}
```
