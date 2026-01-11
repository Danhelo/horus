import type { StateCreator } from 'zustand';

import type { Trajectory, TrajectoryPoint } from '@horus/shared';
import { createTrajectoryId } from '@horus/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrajectorySlice {
  // State
  trajectories: Map<string, Trajectory>;
  activeTrajectoryId: string | null;
  playbackPosition: number; // 0-1 normalized
  isPlaying: boolean;
  playbackSpeed: number; // tokens per second

  // Actions
  addTrajectory: (text: string, points: TrajectoryPoint[], color?: string) => string;
  removeTrajectory: (id: string) => void;
  clearTrajectories: () => void;
  setActiveTrajectory: (id: string | null) => void;
  setPlaybackPosition: (position: number) => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  setPlaybackSpeed: (speed: number) => void;
  seekToToken: (tokenIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Animation State (module-level, outside React)
// ---------------------------------------------------------------------------

let animationFrameId: number | null = null;
let lastAnimationTime = 0;

// ---------------------------------------------------------------------------
// Slice Creator
// ---------------------------------------------------------------------------

export const createTrajectorySlice: StateCreator<
  TrajectorySlice,
  [],
  [],
  TrajectorySlice
> = (set, get) => {
  // Animation loop function
  const animate = (currentTime: number) => {
    const state = get();

    if (!state.isPlaying || !state.activeTrajectoryId) {
      animationFrameId = null;
      return;
    }

    const trajectory = state.trajectories.get(state.activeTrajectoryId);
    if (!trajectory || trajectory.points.length === 0) {
      animationFrameId = null;
      set({ isPlaying: false });
      return;
    }

    // Calculate time delta
    const delta = (currentTime - lastAnimationTime) / 1000; // seconds
    lastAnimationTime = currentTime;

    // Calculate position advancement
    const tokensAdvanced = delta * state.playbackSpeed;
    const positionDelta = tokensAdvanced / trajectory.points.length;
    const newPosition = Math.min(1, state.playbackPosition + positionDelta);

    // Update position
    set({ playbackPosition: newPosition });

    // Stop at end
    if (newPosition >= 1) {
      set({ isPlaying: false });
      animationFrameId = null;
      return;
    }

    // Continue animation
    animationFrameId = requestAnimationFrame(animate);
  };

  return {
    // Initial state
    trajectories: new Map(),
    activeTrajectoryId: null,
    playbackPosition: 0,
    isPlaying: false,
    playbackSpeed: 2, // 2 tokens per second

    // Actions
    addTrajectory: (text, points, color = '#d4af37') => {
      const id = createTrajectoryId();
      const trajectory: Trajectory = {
        id,
        text,
        points,
        color,
        metadata: {
          modelId: 'gemma-2-2b',
          createdAt: new Date().toISOString(),
        },
      };

      set((state) => {
        const newTrajectories = new Map(state.trajectories);
        newTrajectories.set(id, trajectory);
        return {
          trajectories: newTrajectories,
          // Auto-activate if first trajectory
          activeTrajectoryId: state.activeTrajectoryId ?? id,
          // Reset playback position when adding new trajectory
          playbackPosition: state.activeTrajectoryId ? state.playbackPosition : 0,
        };
      });

      return id;
    },

    removeTrajectory: (id) => {
      // Cancel animation if removing active trajectory
      if (get().activeTrajectoryId === id && animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      set((state) => {
        const newTrajectories = new Map(state.trajectories);
        newTrajectories.delete(id);

        // Clear active if removed
        const newActiveId =
          state.activeTrajectoryId === id ? null : state.activeTrajectoryId;

        return {
          trajectories: newTrajectories,
          activeTrajectoryId: newActiveId,
          isPlaying: newActiveId ? state.isPlaying : false,
          playbackPosition: newActiveId ? state.playbackPosition : 0,
        };
      });
    },

    clearTrajectories: () => {
      // Cancel any ongoing animation
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      set({
        trajectories: new Map(),
        activeTrajectoryId: null,
        playbackPosition: 0,
        isPlaying: false,
      });
    },

    setActiveTrajectory: (id) => {
      // Cancel animation when switching trajectories
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      set({
        activeTrajectoryId: id,
        playbackPosition: 0,
        isPlaying: false,
      });
    },

    setPlaybackPosition: (position) => {
      set({ playbackPosition: Math.max(0, Math.min(1, position)) });
    },

    play: () => {
      const state = get();

      if (state.isPlaying || !state.activeTrajectoryId) return;

      const trajectory = state.trajectories.get(state.activeTrajectoryId);
      if (!trajectory || trajectory.points.length === 0) return;

      // Reset to start if at end
      if (state.playbackPosition >= 1) {
        set({ playbackPosition: 0 });
      }

      set({ isPlaying: true });
      lastAnimationTime = performance.now();
      animationFrameId = requestAnimationFrame(animate);
    },

    pause: () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      set({ isPlaying: false });
    },

    stepForward: () => {
      const state = get();
      if (!state.activeTrajectoryId) return;

      const trajectory = state.trajectories.get(state.activeTrajectoryId);
      if (!trajectory || trajectory.points.length === 0) return;

      const currentIndex = Math.floor(state.playbackPosition * trajectory.points.length);
      const newIndex = Math.min(trajectory.points.length - 1, currentIndex + 1);
      const newPosition = newIndex / Math.max(1, trajectory.points.length - 1);

      set({ playbackPosition: newPosition });
    },

    stepBackward: () => {
      const state = get();
      if (!state.activeTrajectoryId) return;

      const trajectory = state.trajectories.get(state.activeTrajectoryId);
      if (!trajectory || trajectory.points.length === 0) return;

      const currentIndex = Math.floor(state.playbackPosition * trajectory.points.length);
      const newIndex = Math.max(0, currentIndex - 1);
      const newPosition =
        trajectory.points.length > 1
          ? newIndex / (trajectory.points.length - 1)
          : 0;

      set({ playbackPosition: newPosition });
    },

    setPlaybackSpeed: (speed) => {
      set({ playbackSpeed: Math.max(0.5, Math.min(10, speed)) });
    },

    seekToToken: (tokenIndex) => {
      const state = get();
      if (!state.activeTrajectoryId) return;

      const trajectory = state.trajectories.get(state.activeTrajectoryId);
      if (!trajectory || trajectory.points.length === 0) return;

      const clampedIndex = Math.max(
        0,
        Math.min(trajectory.points.length - 1, tokenIndex)
      );
      const position =
        trajectory.points.length > 1
          ? clampedIndex / (trajectory.points.length - 1)
          : 0;

      set({ playbackPosition: position });
    },
  };
};
