import { useRef, useState, useCallback } from 'react';

import type { Dial as DialData } from '@horus/shared';

import { DialArc } from './DialArc';
import {
  useDial,
  useDialKeyboard,
  useDialWheel,
  useDialReset,
  type DialPolarity,
} from './useDial';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Props with individual properties (most flexible)
interface IndividualDialProps {
  id: string;
  label: string;
  value: number;
  defaultValue?: number;
  polarity: DialPolarity;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  locked?: boolean;
  onChange: (value: number) => void;
  onHover?: (hovered: boolean) => void;
  dial?: never;
  onReset?: never;
}

// Props with dial object (for convenience with store data)
interface ObjectDialProps {
  dial: DialData;
  size?: 'sm' | 'md' | 'lg';
  onChange: (value: number) => void;
  onReset?: () => void;
  onHover?: (hovered: boolean) => void;
  // Individual props should not be passed when dial object is provided
  id?: never;
  label?: never;
  value?: never;
  defaultValue?: never;
  polarity?: never;
  disabled?: never;
  locked?: never;
}

export type DialProps = IndividualDialProps | ObjectDialProps;

// ---------------------------------------------------------------------------
// Size Configuration
// ---------------------------------------------------------------------------

const SIZES = {
  sm: 32,
  md: 48,
  lg: 64,
} as const;

// ---------------------------------------------------------------------------
// Lock Icon Component
// ---------------------------------------------------------------------------

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Type Guard
// ---------------------------------------------------------------------------

function hasDialObject(props: DialProps): props is ObjectDialProps {
  return 'dial' in props && props.dial !== undefined;
}

// ---------------------------------------------------------------------------
// Dial Component
// ---------------------------------------------------------------------------

export function Dial(props: DialProps) {
  // Extract properties from either props style
  let id: string;
  let label: string;
  let value: number;
  let defaultValue: number;
  let polarity: DialPolarity;
  let disabled: boolean;
  let locked: boolean;
  let onChange: (value: number) => void;
  let onHover: ((hovered: boolean) => void) | undefined;
  let onReset: (() => void) | undefined;

  if (hasDialObject(props)) {
    // Object-style props
    id = props.dial.id;
    label = props.dial.label;
    value = props.dial.value;
    defaultValue = props.dial.defaultValue;
    polarity = props.dial.polarity;
    disabled = false;
    locked = props.dial.locked;
    onChange = props.onChange;
    onHover = props.onHover;
    onReset = props.onReset;
  } else {
    // Individual props
    id = props.id;
    label = props.label;
    value = props.value;
    defaultValue = props.defaultValue ?? 0;
    polarity = props.polarity;
    disabled = props.disabled ?? false;
    locked = props.locked ?? false;
    onChange = props.onChange;
    onHover = props.onHover;
    onReset = undefined; // Individual props version uses defaultValue
  }

  const size = props.size ?? 'md';
  const ref = useRef<HTMLDivElement>(null);
  const pixelSize = SIZES[size];
  const [isHovered, setIsHovered] = useState(false);

  // Hooks for interaction
  const { isDragging, handlers: dragHandlers } = useDial({
    value,
    polarity,
    disabled,
    locked,
    onChange,
  });

  const { onKeyDown } = useDialKeyboard({
    value,
    polarity,
    disabled,
    locked,
    onChange,
  });

  useDialWheel({ ref, value, polarity, disabled, locked, onChange });

  // Double-click reset handler
  const handleDoubleClick = useCallback(() => {
    if (disabled || locked) return;
    if (onReset) {
      onReset();
    } else {
      onChange(defaultValue);
    }
  }, [disabled, locked, onReset, onChange, defaultValue]);

  // Hover handling
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    onHover?.(true);
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHover?.(false);
  }, [onHover]);

  // Value range for aria
  const { min, max } = polarity === 'bipolar'
    ? { min: -1, max: 1 }
    : { min: 0, max: 1 };

  // Compute CSS classes
  const containerClasses = [
    'dial',
    isDragging && 'dial--dragging',
    disabled && 'dial--disabled',
    locked && 'dial--locked',
    isHovered && 'dial--hovered',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={containerClasses}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      data-dial-id={id}
      onKeyDown={onKeyDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...dragHandlers}
    >
      <div className="dial__knob" style={{ width: pixelSize, height: pixelSize }}>
        <DialArc
          value={value}
          polarity={polarity}
          size={pixelSize}
          isDragging={isDragging}
          isHovered={isHovered}
        />
        {locked && (
          <div className="dial__lock-overlay">
            <LockIcon className="dial__lock-icon" />
          </div>
        )}
      </div>

      <span className="dial__label">{label}</span>
      <span className="dial__value">{formatValue(value, polarity)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value Formatting
// ---------------------------------------------------------------------------

function formatValue(value: number, polarity: DialPolarity): string {
  // Show sign for bipolar, no sign for unipolar
  if (polarity === 'bipolar') {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  }
  return value.toFixed(2);
}
