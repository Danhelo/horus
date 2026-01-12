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
  labelWidth = 60,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
  labelWidth?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#9a9aaa', minWidth: labelWidth }}>{label}</span>
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
        {value}
        {unit}
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
 * SettingsBar component - collapsible bottom bar with view settings.
 */
export function SettingsBar() {
  // Get settings from store
  const movementSpeed = useAppStore((state) => state.movementSpeed);
  const setMovementSpeed = useAppStore((state) => state.setMovementSpeed);
  const labelCount = useAppStore((state) => state.labelCount);
  const setLabelCount = useAppStore((state) => state.setLabelCount);
  const showLabels = useAppStore((state) => state.showLabels);
  const setShowLabels = useAppStore((state) => state.setShowLabels);
  const labelFontSize = useAppStore((state) => state.labelFontSize);
  const setLabelFontSize = useAppStore((state) => state.setLabelFontSize);
  const edgeFadeStart = useAppStore((state) => state.edgeFadeStart);
  const setEdgeFadeStart = useAppStore((state) => state.setEdgeFadeStart);
  const edgeFadeEnd = useAppStore((state) => state.edgeFadeEnd);
  const setEdgeFadeEnd = useAppStore((state) => state.setEdgeFadeEnd);
  const isCollapsed = useAppStore((state) => state.settingsBarCollapsed);
  const setCollapsed = useAppStore((state) => state.setSettingsBarCollapsed);

  // Sound and animation settings
  const soundEnabled = useAppStore((state) => state.soundEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundEnabled);
  const masterVolume = useAppStore((state) => state.masterVolume);
  const setMasterVolume = useAppStore((state) => state.setMasterVolume);
  const breathingEnabled = useAppStore((state) => state.breathingEnabled);
  const setBreathingEnabled = useAppStore((state) => state.setBreathingEnabled);

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

  const handleFontSizeChange = useCallback(
    (value: number) => setLabelFontSize(value),
    [setLabelFontSize]
  );

  const handleEdgeFadeStartChange = useCallback(
    (value: number) => setEdgeFadeStart(value),
    [setEdgeFadeStart]
  );

  const handleEdgeFadeEndChange = useCallback(
    (value: number) => setEdgeFadeEnd(value),
    [setEdgeFadeEnd]
  );

  const handleSoundEnabledChange = useCallback(
    (checked: boolean) => setSoundEnabled(checked),
    [setSoundEnabled]
  );

  const handleMasterVolumeChange = useCallback(
    (value: number) => setMasterVolume(value),
    [setMasterVolume]
  );

  const handleBreathingEnabledChange = useCallback(
    (checked: boolean) => setBreathingEnabled(checked),
    [setBreathingEnabled]
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

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
          overflow: 'hidden',
          transition: 'max-height 200ms ease-out',
          maxHeight: isCollapsed ? 32 : 200,
        }}
      >
        {/* Collapse toggle button */}
        <button
          onClick={toggleCollapsed}
          style={{
            position: 'absolute',
            top: 4,
            right: 16,
            background: 'transparent',
            border: 'none',
            color: '#9a9aaa',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-gold)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9a9aaa')}
        >
          <span
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          >
            ▼
          </span>
          {isCollapsed ? 'Settings' : ''}
        </button>

        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '8px 16px',
            opacity: isCollapsed ? 0 : 1,
            transition: 'opacity 150ms ease',
            pointerEvents: isCollapsed ? 'none' : 'auto',
          }}
        >
          {/* Row 1: Camera & Labels */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flexWrap: 'wrap',
              marginBottom: 8,
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

            {/* Label Font Size */}
            <Slider
              label="Text"
              value={labelFontSize}
              min={0.5}
              max={2}
              step={0.1}
              onChange={handleFontSizeChange}
              unit="x"
            />

            {/* Show Labels Toggle */}
            <Toggle label="Show" checked={showLabels} onChange={handleShowLabelsChange} />
          </div>

          {/* Row 2: Edges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            {/* Show Edges Toggle */}
            <Toggle label="Edges" checked={showEdges} onChange={handleShowEdgesChange} />

            {/* Divider */}
            <div style={{ height: 16, width: 1, backgroundColor: '#3a3a45' }} />

            {/* Edge Fade Start */}
            <Slider
              label="Fade Start"
              value={edgeFadeStart}
              min={20}
              max={80}
              step={5}
              onChange={handleEdgeFadeStartChange}
              labelWidth={70}
            />

            {/* Edge Fade End */}
            <Slider
              label="Fade End"
              value={edgeFadeEnd}
              min={50}
              max={150}
              step={5}
              onChange={handleEdgeFadeEndChange}
              labelWidth={70}
            />
          </div>

          {/* Row 3: Sound & Animation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            {/* Sound Toggle */}
            <Toggle
              label="Sound"
              checked={soundEnabled}
              onChange={handleSoundEnabledChange}
            />

            {/* Master Volume */}
            <Slider
              label="Volume"
              value={masterVolume}
              min={0}
              max={1}
              step={0.05}
              onChange={handleMasterVolumeChange}
            />

            {/* Divider */}
            <div style={{ height: 16, width: 1, backgroundColor: '#3a3a45' }} />

            {/* Breathing Toggle */}
            <Toggle
              label="Breathing"
              checked={breathingEnabled}
              onChange={handleBreathingEnabledChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
