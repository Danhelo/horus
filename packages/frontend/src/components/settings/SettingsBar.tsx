import { useCallback } from 'react';
import { useAppStore, useLargeDataStore } from '../../stores';

/**
 * Slider component for settings
 */
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#9a9aaa', minWidth: 60 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: 80,
          height: 4,
          background: '#3a3a45',
          borderRadius: 4,
          appearance: 'none',
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-gold-dim)',
          minWidth: 40,
          textAlign: 'right',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {value}{unit}
      </span>
    </div>
  );
}

/**
 * Toggle component for settings
 */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <span style={{ fontSize: 11, color: '#9a9aaa' }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 32,
          height: 16,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 150ms ease',
          backgroundColor: checked ? 'rgba(212, 168, 67, 0.6)' : '#3a3a45',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 12,
            height: 12,
            borderRadius: 6,
            transition: 'left 150ms ease, background-color 150ms ease',
            backgroundColor: checked ? 'var(--color-gold)' : '#6b6b7b',
          }}
        />
      </button>
    </label>
  );
}

/**
 * SettingsBar component - persistent bottom bar with view settings.
 */
export function SettingsBar() {
  // Get settings from store
  const movementSpeed = useAppStore((state) => state.movementSpeed);
  const setMovementSpeed = useAppStore((state) => state.setMovementSpeed);
  const labelCount = useAppStore((state) => state.labelCount);
  const setLabelCount = useAppStore((state) => state.setLabelCount);
  const showLabels = useAppStore((state) => state.showLabels);
  const setShowLabels = useAppStore((state) => state.setShowLabels);

  // Edge settings from large data store
  const showEdges = useLargeDataStore((state) => state.edgesVisible);
  const setShowEdges = useLargeDataStore((state) => state.setEdgesVisible);

  // Handlers
  const handleSpeedChange = useCallback(
    (value: number) => setMovementSpeed(value),
    [setMovementSpeed]
  );

  const handleLabelCountChange = useCallback(
    (value: number) => setLabelCount(value),
    [setLabelCount]
  );

  const handleShowLabelsChange = useCallback(
    (checked: boolean) => setShowLabels(checked),
    [setShowLabels]
  );

  const handleShowEdgesChange = useCallback(
    (checked: boolean) => setShowEdges(checked),
    [setShowEdges]
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #2a2a35',
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: '8px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            {/* Movement Speed */}
            <Slider
              label="Speed"
              value={movementSpeed}
              min={5}
              max={150}
              step={5}
              onChange={handleSpeedChange}
              unit=" u/s"
            />

            {/* Divider */}
            <div style={{ height: 16, width: 1, backgroundColor: '#3a3a45' }} />

            {/* Label Count */}
            <Slider
              label="Labels"
              value={labelCount}
              min={0}
              max={150}
              step={10}
              onChange={handleLabelCountChange}
            />

            {/* Show Labels Toggle */}
            <Toggle
              label="Show"
              checked={showLabels}
              onChange={handleShowLabelsChange}
            />

            {/* Divider */}
            <div style={{ height: 16, width: 1, backgroundColor: '#3a3a45' }} />

            {/* Show Edges Toggle */}
            <Toggle
              label="Edges"
              checked={showEdges}
              onChange={handleShowEdgesChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
