import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DialPolarity = 'bipolar' | 'unipolar';

interface UseDialOptions {
  value: number;
  polarity: DialPolarity;
  disabled?: boolean;
  locked?: boolean;
  onChange: (value: number) => void;
}

interface UseDialKeyboardOptions {
  value: number;
  polarity: DialPolarity;
  disabled?: boolean;
  locked?: boolean;
  onChange: (value: number) => void;
}

interface UseDialWheelOptions {
  ref: RefObject<HTMLDivElement>;
  value: number;
  polarity: DialPolarity;
  disabled?: boolean;
  locked?: boolean;
  onChange: (value: number) => void;
}

interface UseDialResetOptions {
  defaultValue: number;
  disabled?: boolean;
  locked?: boolean;
  onChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Value Range Helpers
// ---------------------------------------------------------------------------

function getValueRange(polarity: DialPolarity): { min: number; max: number } {
  return polarity === 'bipolar' ? { min: -1, max: 1 } : { min: 0, max: 1 };
}

function clampValue(value: number, polarity: DialPolarity): number {
  const { min, max } = getValueRange(polarity);
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// useDial - Main drag interaction hook
// ---------------------------------------------------------------------------

export function useDial(options: UseDialOptions) {
  const { value, polarity, disabled = false, locked = false, onChange } = options;

  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || locked) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      startY.current = e.clientY;
      startValue.current = value;
    },
    [disabled, locked, value]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;

      // Vertical drag: up = increase, down = decrease
      const deltaY = startY.current - e.clientY;
      // Fine control with Shift key
      const sensitivity = e.shiftKey ? 0.001 : 0.005;
      const deltaValue = deltaY * sensitivity;

      const newValue = clampValue(startValue.current + deltaValue, polarity);
      onChange(newValue);
    },
    [isDragging, polarity, onChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
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

// ---------------------------------------------------------------------------
// useDialKeyboard - Keyboard navigation
// ---------------------------------------------------------------------------

export function useDialKeyboard(options: UseDialKeyboardOptions) {
  const { value, polarity, disabled = false, locked = false, onChange } = options;
  const { min, max } = getValueRange(polarity);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || locked) return;

      // Fine control with Shift key (0.01 vs 0.05)
      const step = e.shiftKey ? 0.01 : 0.05;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault();
          onChange(Math.min(max, value + step));
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault();
          onChange(Math.max(min, value - step));
          break;
        case 'Home':
          e.preventDefault();
          onChange(min);
          break;
        case 'End':
          e.preventDefault();
          onChange(max);
          break;
        case 'PageUp':
          e.preventDefault();
          onChange(Math.min(max, value + 0.1));
          break;
        case 'PageDown':
          e.preventDefault();
          onChange(Math.max(min, value - 0.1));
          break;
      }
    },
    [value, disabled, locked, onChange, min, max]
  );

  return { onKeyDown: handleKeyDown };
}

// ---------------------------------------------------------------------------
// useDialWheel - Scroll wheel adjustment
// ---------------------------------------------------------------------------

export function useDialWheel(options: UseDialWheelOptions) {
  const { ref, value, polarity, disabled = false, locked = false, onChange } = options;
  const { min, max } = getValueRange(polarity);

  // Store current values in refs to avoid stale closures
  const valueRef = useRef(value);
  // eslint-disable-next-line react-hooks/refs -- Updating refs during render to avoid stale closures is intentional
  valueRef.current = value;

  const onChangeRef = useRef(onChange);
  // eslint-disable-next-line react-hooks/refs -- Updating refs during render to avoid stale closures is intentional
  onChangeRef.current = onChange;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      if (disabled || locked) return;
      e.preventDefault();

      // Fine control with Shift key
      const step = e.shiftKey ? 0.01 : 0.05;
      const delta = e.deltaY > 0 ? -step : step;

      const newValue = Math.max(min, Math.min(max, valueRef.current + delta));
      onChangeRef.current(newValue);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [ref, disabled, locked, min, max]);
}

// ---------------------------------------------------------------------------
// useDialReset - Double-click to reset
// ---------------------------------------------------------------------------

export function useDialReset(options: UseDialResetOptions) {
  const { defaultValue, disabled = false, locked = false, onChange } = options;

  const handleDoubleClick = useCallback(() => {
    if (disabled || locked) return;
    onChange(defaultValue);
  }, [defaultValue, disabled, locked, onChange]);

  return { onDoubleClick: handleDoubleClick };
}

// ---------------------------------------------------------------------------
// Rotation Math
// ---------------------------------------------------------------------------

export const VALUE_TO_ROTATION = {
  bipolar: {
    min: -1,
    max: 1,
    startAngle: -135, // degrees from top
    endAngle: 135,
    totalArc: 270,
  },
  unipolar: {
    min: 0,
    max: 1,
    startAngle: -135,
    endAngle: 135,
    totalArc: 270,
  },
} as const;

export function valueToAngle(value: number, polarity: DialPolarity): number {
  const config = VALUE_TO_ROTATION[polarity];
  const normalized = (value - config.min) / (config.max - config.min);
  return config.startAngle + normalized * config.totalArc;
}

export function angleToValue(angle: number, polarity: DialPolarity): number {
  const config = VALUE_TO_ROTATION[polarity];
  const normalized = (angle - config.startAngle) / config.totalArc;
  return config.min + normalized * (config.max - config.min);
}
