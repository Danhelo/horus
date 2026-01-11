import { useEffect, useCallback } from 'react';

interface TrajectoryPlaybackControls {
  /** Whether playback is currently active */
  isPlaying: boolean;
  /** Current playback position (0-1 normalized) */
  position: number;
  /** Total number of trajectory points */
  pointCount: number;
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Move to next token */
  stepForward: () => void;
  /** Move to previous token */
  stepBackward: () => void;
  /** Seek to a specific position (0-1) */
  seek: (position: number) => void;
  /** Change playback speed */
  setSpeed?: (speed: number) => void;
  /** Current playback speed */
  speed?: number;
}

interface UseTrajectoryKeyboardOptions {
  /** Whether keyboard controls are enabled (default: true) */
  enabled?: boolean;
  /** Selector for elements that should block keyboard handling (e.g., when input is focused) */
  ignoreWhenFocused?: string[];
}

/**
 * Keyboard controls for trajectory playback.
 *
 * Keybindings:
 * - Space: Play/Pause
 * - ArrowRight: Step forward one token
 * - ArrowLeft: Step backward one token
 * - Shift+ArrowRight: Jump forward 10%
 * - Shift+ArrowLeft: Jump backward 10%
 * - Home: Seek to start
 * - End: Seek to end
 * - +/=: Increase playback speed
 * - -: Decrease playback speed
 *
 * @param controls - Playback control functions from trajectory store
 * @param options - Configuration options
 */
export function useTrajectoryKeyboard(
  controls: TrajectoryPlaybackControls,
  options: UseTrajectoryKeyboardOptions = {}
) {
  const { enabled = true, ignoreWhenFocused = ['INPUT', 'TEXTAREA', 'SELECT'] } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if disabled
      if (!enabled) return;

      // Skip if focused on an input element
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toUpperCase();
        if (ignoreWhenFocused.includes(tagName)) return;

        // Also check for contentEditable
        if (activeElement.getAttribute('contenteditable') === 'true') return;
      }

      // Skip if no trajectory
      if (controls.pointCount === 0) return;

      switch (e.key) {
        case ' ':
          // Space: Play/Pause
          e.preventDefault();
          if (controls.isPlaying) {
            controls.pause();
          } else {
            controls.play();
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Right: Jump forward 10%
            const newPosition = Math.min(1, controls.position + 0.1);
            controls.seek(newPosition);
          } else {
            // Right: Step forward one token
            controls.stepForward();
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Left: Jump backward 10%
            const newPosition = Math.max(0, controls.position - 0.1);
            controls.seek(newPosition);
          } else {
            // Left: Step backward one token
            controls.stepBackward();
          }
          break;

        case 'Home':
          e.preventDefault();
          controls.seek(0);
          break;

        case 'End':
          e.preventDefault();
          controls.seek(1);
          break;

        case '+':
        case '=':
          // Increase speed
          if (controls.setSpeed && controls.speed !== undefined) {
            const newSpeed = Math.min(10, controls.speed + 0.5);
            controls.setSpeed(newSpeed);
          }
          break;

        case '-':
          // Decrease speed
          if (controls.setSpeed && controls.speed !== undefined) {
            const newSpeed = Math.max(0.5, controls.speed - 0.5);
            controls.setSpeed(newSpeed);
          }
          break;

        case '0':
          // Reset to start (alternative to Home)
          e.preventDefault();
          controls.seek(0);
          break;

        case 'k':
          // Vim-style play/pause (like YouTube)
          e.preventDefault();
          if (controls.isPlaying) {
            controls.pause();
          } else {
            controls.play();
          }
          break;

        case 'j':
          // Vim-style step backward
          e.preventDefault();
          controls.stepBackward();
          break;

        case 'l':
          // Vim-style step forward
          e.preventDefault();
          controls.stepForward();
          break;

        default:
          // Number keys 1-9: Jump to percentage
          if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            const percent = parseInt(e.key) / 10;
            controls.seek(percent);
          }
          break;
      }
    },
    [controls, enabled, ignoreWhenFocused]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Hook that provides a stable set of controls from the trajectory store slice.
 * Use this to get controls that won't cause re-renders on every position change.
 *
 * @example
 * const controls = useTrajectoryControls();
 * useTrajectoryKeyboard(controls);
 */
export function useTrajectoryControlsFromStore(
  getState: () => {
    isPlaying: boolean;
    playbackPosition: number;
    playbackSpeed: number;
    activeTrajectoryId: string | null;
    trajectories: Map<string, { points: { tokenIndex: number }[] }>;
    play: () => void;
    pause: () => void;
    stepForward: () => void;
    stepBackward: () => void;
    setPlaybackPosition: (position: number) => void;
    setPlaybackSpeed: (speed: number) => void;
  }
): TrajectoryPlaybackControls {
  // Return a stable object that uses getState() internally
  return {
    get isPlaying() {
      return getState().isPlaying;
    },
    get position() {
      return getState().playbackPosition;
    },
    get pointCount() {
      const state = getState();
      const trajectory = state.activeTrajectoryId
        ? state.trajectories.get(state.activeTrajectoryId)
        : null;
      return trajectory?.points.length ?? 0;
    },
    get speed() {
      return getState().playbackSpeed;
    },
    play: () => getState().play(),
    pause: () => getState().pause(),
    stepForward: () => getState().stepForward(),
    stepBackward: () => getState().stepBackward(),
    seek: (position: number) => getState().setPlaybackPosition(position),
    setSpeed: (speed: number) => getState().setPlaybackSpeed(speed),
  };
}
