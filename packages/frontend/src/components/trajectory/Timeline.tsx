import { useRef, useCallback, useState, useMemo } from 'react';

import type { Trajectory } from '@horus/shared';
import { getMaxActivation } from '../../utils';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function StepForwardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <rect x="15" y="4" width="4" height="16" />
    </svg>
  );
}

function StepBackwardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="5" y="4" width="4" height="16" />
      <polygon points="19 4 9 12 19 20 19 4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Timeline Component
// ---------------------------------------------------------------------------

interface TimelineProps {
  /** The trajectory to display */
  trajectory: Trajectory;
  /** Current playback position (0-1 normalized) */
  position: number;
  /** Callback when position changes */
  onPositionChange: (position: number) => void;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Callback for play/pause toggle */
  onPlayPause: () => void;
  /** Callback to step forward one token */
  onStepForward?: () => void;
  /** Callback to step backward one token */
  onStepBackward?: () => void;
  /** Current playback speed (tokens per second) */
  speed?: number;
  /** Callback to change playback speed */
  onSpeedChange?: (speed: number) => void;
}

/**
 * Timeline scrubber for trajectory playback.
 * Features:
 * - Waveform showing activation intensity per token
 * - Draggable playhead
 * - Play/pause button
 * - Token preview on hover
 * - Step forward/backward controls
 */
export function Timeline({
  trajectory,
  position,
  onPositionChange,
  isPlaying,
  onPlayPause,
  onStepForward,
  onStepBackward,
  speed = 2,
  onSpeedChange,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate current token index
  const currentTokenIndex = useMemo(() => {
    if (trajectory.points.length <= 1) return 0;
    return Math.floor(position * (trajectory.points.length - 1));
  }, [position, trajectory.points.length]);

  // Calculate activation waveform heights
  const waveformData = useMemo(() => {
    return trajectory.points.map((point) => {
      const maxActivation = getMaxActivation(point);
      // Normalize to 0-1 range, assuming max activation of ~10
      return Math.min(maxActivation / 5, 1);
    });
  }, [trajectory.points]);

  // Handle click/drag on timeline
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newPosition = Math.max(0, Math.min(1, x / rect.width));
      onPositionChange(newPosition);
    },
    [onPositionChange]
  );

  // Handle mouse move for hover preview
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current || trajectory.points.length === 0) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const hoverPosition = x / rect.width;
      const tokenIndex = Math.floor(
        hoverPosition * (trajectory.points.length - 1)
      );
      setHoveredToken(Math.max(0, Math.min(trajectory.points.length - 1, tokenIndex)));

      // If dragging, update position
      if (isDragging) {
        handleTimelineClick(e);
      }
    },
    [trajectory.points.length, isDragging, handleTimelineClick]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredToken(null);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleTimelineClick(e);
    },
    [handleTimelineClick]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        handleTimelineClick(e);
      }
    },
    [isDragging, handleTimelineClick]
  );

  // Speed control
  const handleSpeedClick = useCallback(() => {
    if (!onSpeedChange) return;

    // Cycle through speeds: 0.5 -> 1 -> 2 -> 4 -> 0.5
    const speeds = [0.5, 1, 2, 4];
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    onSpeedChange(speeds[nextIndex]);
  }, [speed, onSpeedChange]);

  // Don't render if no trajectory
  if (trajectory.points.length === 0) {
    return (
      <div className="timeline-container timeline-empty">
        <span className="timeline-empty-text">No trajectory loaded</span>
      </div>
    );
  }

  const currentToken = trajectory.points[currentTokenIndex]?.token ?? '';
  const hoveredTokenText =
    hoveredToken !== null ? trajectory.points[hoveredToken]?.token ?? '' : '';

  return (
    <div className="timeline-container">
      {/* Controls row */}
      <div className="timeline-controls">
        {/* Step backward */}
        <button
          className="timeline-btn timeline-btn-step"
          onClick={onStepBackward}
          disabled={!onStepBackward || position <= 0}
          aria-label="Step backward"
          title="Step backward"
        >
          <StepBackwardIcon className="timeline-icon" />
        </button>

        {/* Play/Pause */}
        <button
          className="timeline-btn timeline-btn-play"
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <PauseIcon className="timeline-icon" />
          ) : (
            <PlayIcon className="timeline-icon" />
          )}
        </button>

        {/* Step forward */}
        <button
          className="timeline-btn timeline-btn-step"
          onClick={onStepForward}
          disabled={!onStepForward || position >= 1}
          aria-label="Step forward"
          title="Step forward"
        >
          <StepForwardIcon className="timeline-icon" />
        </button>

        {/* Speed indicator */}
        {onSpeedChange && (
          <button
            className="timeline-btn timeline-btn-speed"
            onClick={handleSpeedClick}
            title={`Speed: ${speed}x (click to change)`}
          >
            {speed}x
          </button>
        )}
      </div>

      {/* Timeline track */}
      <div
        ref={timelineRef}
        className="timeline-track"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Waveform visualization */}
        <svg
          className="timeline-waveform"
          viewBox={`0 0 ${trajectory.points.length} 20`}
          preserveAspectRatio="none"
        >
          {waveformData.map((height, i) => {
            const isPast = i / (trajectory.points.length - 1) <= position;
            const barHeight = Math.max(2, height * 18);

            return (
              <rect
                key={i}
                x={i}
                y={20 - barHeight}
                width={0.8}
                height={barHeight}
                fill={isPast ? '#d4af37' : '#3a3a3a'}
                opacity={isPast ? 1 : 0.6}
              />
            );
          })}
        </svg>

        {/* Playhead */}
        <div
          className="timeline-playhead"
          style={{ left: `${position * 100}%` }}
        />

        {/* Hover preview */}
        {hoveredToken !== null && !isDragging && (
          <div
            className="timeline-hover-preview"
            style={{
              left: `${(hoveredToken / (trajectory.points.length - 1)) * 100}%`,
            }}
          >
            <span className="timeline-hover-token">{hoveredTokenText}</span>
          </div>
        )}
      </div>

      {/* Position info */}
      <div className="timeline-info">
        <span className="timeline-current-token" title={currentToken}>
          {currentToken.slice(0, 20)}
          {currentToken.length > 20 ? '...' : ''}
        </span>
        <span className="timeline-position">
          {currentTokenIndex + 1} / {trajectory.points.length}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline for now, can be extracted to CSS)
// ---------------------------------------------------------------------------

// Note: These styles should be added to a CSS file for production
// For now, we'll use Tailwind classes in the actual implementation
// The component structure above uses className placeholders
