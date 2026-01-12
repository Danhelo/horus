import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import type { TrajectoryPoint } from '@horus/shared';

// Mock requestAnimationFrame for Node.js environment
const mockRAF = vi.fn((callback: FrameRequestCallback) => {
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
});
const mockCAF = vi.fn((id: number) => {
  clearTimeout(id);
});

describe('TrajectorySlice', () => {
  beforeEach(() => {
    // Polyfill requestAnimationFrame for tests
    vi.stubGlobal('requestAnimationFrame', mockRAF);
    vi.stubGlobal('cancelAnimationFrame', mockCAF);

    // Reset store to default state
    useAppStore.setState({
      trajectories: new Map(),
      activeTrajectoryId: null,
      playbackPosition: 0,
      isPlaying: false,
      playbackSpeed: 2,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    mockRAF.mockClear();
    mockCAF.mockClear();
  });

  const createMockPoints = (count: number): TrajectoryPoint[] => {
    return Array.from({ length: count }, (_, i) => ({
      tokenIndex: i,
      token: `token${i}`,
      activations: new Map([
        [`node-${i}`, i * 0.1],
        [`node-${i + 1}`, i * 0.2],
      ]),
      position: [i * 10, i * 5, i * 2] as [number, number, number],
    }));
  };

  describe('addTrajectory', () => {
    it('creates a trajectory with correct properties', () => {
      const points = createMockPoints(5);

      const trajectoryId = useAppStore.getState().addTrajectory('Hello world', points);

      expect(trajectoryId).toBeDefined();
      expect(trajectoryId.startsWith('traj-')).toBe(true);

      const trajectory = useAppStore.getState().trajectories.get(trajectoryId);
      expect(trajectory).toBeDefined();
      expect(trajectory?.text).toBe('Hello world');
      expect(trajectory?.points.length).toBe(5);
      expect(trajectory?.color).toBe('#d4af37');
      expect(trajectory?.metadata.modelId).toBe('gemma-2-2b');
    });

    it('auto-activates the first trajectory added', () => {
      const points = createMockPoints(3);

      const trajectoryId = useAppStore.getState().addTrajectory('Test', points);

      expect(useAppStore.getState().activeTrajectoryId).toBe(trajectoryId);
      expect(useAppStore.getState().playbackPosition).toBe(0);
    });

    it('does not change active trajectory when adding subsequent trajectories', () => {
      const points = createMockPoints(3);

      const firstId = useAppStore.getState().addTrajectory('First', points);
      const secondId = useAppStore.getState().addTrajectory('Second', points);

      expect(useAppStore.getState().activeTrajectoryId).toBe(firstId);
      expect(useAppStore.getState().trajectories.size).toBe(2);
    });

    it('accepts custom color', () => {
      const points = createMockPoints(2);

      const trajectoryId = useAppStore.getState().addTrajectory('Colored', points, '#00bfff');

      const trajectory = useAppStore.getState().trajectories.get(trajectoryId);
      expect(trajectory?.color).toBe('#00bfff');
    });
  });

  describe('removeTrajectory', () => {
    it('removes a trajectory from the store', () => {
      const points = createMockPoints(3);
      const trajectoryId = useAppStore.getState().addTrajectory('Test', points);

      expect(useAppStore.getState().trajectories.size).toBe(1);

      useAppStore.getState().removeTrajectory(trajectoryId);

      expect(useAppStore.getState().trajectories.size).toBe(0);
    });

    it('clears active trajectory if the active one is removed', () => {
      const points = createMockPoints(3);
      const trajectoryId = useAppStore.getState().addTrajectory('Test', points);

      expect(useAppStore.getState().activeTrajectoryId).toBe(trajectoryId);

      useAppStore.getState().removeTrajectory(trajectoryId);

      expect(useAppStore.getState().activeTrajectoryId).toBeNull();
    });

    it('stops playback when removing active trajectory', () => {
      const points = createMockPoints(3);
      const trajectoryId = useAppStore.getState().addTrajectory('Test', points);

      useAppStore.getState().play();
      expect(useAppStore.getState().isPlaying).toBe(true);

      useAppStore.getState().removeTrajectory(trajectoryId);

      expect(useAppStore.getState().isPlaying).toBe(false);
    });
  });

  describe('clearTrajectories', () => {
    it('removes all trajectories', () => {
      const points = createMockPoints(3);
      useAppStore.getState().addTrajectory('First', points);
      useAppStore.getState().addTrajectory('Second', points);
      useAppStore.getState().addTrajectory('Third', points);

      expect(useAppStore.getState().trajectories.size).toBe(3);

      useAppStore.getState().clearTrajectories();

      expect(useAppStore.getState().trajectories.size).toBe(0);
      expect(useAppStore.getState().activeTrajectoryId).toBeNull();
      expect(useAppStore.getState().playbackPosition).toBe(0);
      expect(useAppStore.getState().isPlaying).toBe(false);
    });
  });

  describe('setActiveTrajectory', () => {
    it('switches to a different trajectory', () => {
      const points = createMockPoints(3);
      const firstId = useAppStore.getState().addTrajectory('First', points);
      const secondId = useAppStore.getState().addTrajectory('Second', points);

      useAppStore.getState().setActiveTrajectory(secondId);

      expect(useAppStore.getState().activeTrajectoryId).toBe(secondId);
    });

    it('resets playback position when switching trajectories', () => {
      const points = createMockPoints(5);
      const firstId = useAppStore.getState().addTrajectory('First', points);
      const secondId = useAppStore.getState().addTrajectory('Second', points);

      useAppStore.getState().setPlaybackPosition(0.5);
      expect(useAppStore.getState().playbackPosition).toBe(0.5);

      useAppStore.getState().setActiveTrajectory(secondId);

      expect(useAppStore.getState().playbackPosition).toBe(0);
    });

    it('stops playback when switching trajectories', () => {
      const points = createMockPoints(3);
      const firstId = useAppStore.getState().addTrajectory('First', points);
      const secondId = useAppStore.getState().addTrajectory('Second', points);

      useAppStore.getState().play();
      expect(useAppStore.getState().isPlaying).toBe(true);

      useAppStore.getState().setActiveTrajectory(secondId);

      expect(useAppStore.getState().isPlaying).toBe(false);
    });
  });

  describe('playback controls', () => {
    it('setPlaybackPosition clamps to [0, 1]', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      useAppStore.getState().setPlaybackPosition(0.5);
      expect(useAppStore.getState().playbackPosition).toBe(0.5);

      useAppStore.getState().setPlaybackPosition(-0.5);
      expect(useAppStore.getState().playbackPosition).toBe(0);

      useAppStore.getState().setPlaybackPosition(1.5);
      expect(useAppStore.getState().playbackPosition).toBe(1);
    });

    it('play sets isPlaying to true', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      expect(useAppStore.getState().isPlaying).toBe(false);

      useAppStore.getState().play();

      expect(useAppStore.getState().isPlaying).toBe(true);
    });

    it('pause sets isPlaying to false', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);
      useAppStore.getState().play();

      expect(useAppStore.getState().isPlaying).toBe(true);

      useAppStore.getState().pause();

      expect(useAppStore.getState().isPlaying).toBe(false);
    });

    it('play does nothing without an active trajectory', () => {
      useAppStore.getState().play();

      expect(useAppStore.getState().isPlaying).toBe(false);
    });

    it('play resets to start if at end', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      useAppStore.getState().setPlaybackPosition(1);
      expect(useAppStore.getState().playbackPosition).toBe(1);

      useAppStore.getState().play();

      expect(useAppStore.getState().playbackPosition).toBe(0);
      expect(useAppStore.getState().isPlaying).toBe(true);
    });
  });

  describe('step controls', () => {
    it('stepForward advances to next token', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      expect(useAppStore.getState().playbackPosition).toBe(0);

      useAppStore.getState().stepForward();

      // Position should move to next token (1/4 = 0.25 for 5 points)
      expect(useAppStore.getState().playbackPosition).toBe(0.25);
    });

    it('stepForward does not go past end', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);
      useAppStore.getState().setPlaybackPosition(1);

      useAppStore.getState().stepForward();

      expect(useAppStore.getState().playbackPosition).toBe(1);
    });

    it('stepBackward moves to previous token', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);
      useAppStore.getState().setPlaybackPosition(0.5);

      useAppStore.getState().stepBackward();

      // From position 0.5 (token 2), should go to token 1 (0.25)
      expect(useAppStore.getState().playbackPosition).toBe(0.25);
    });

    it('stepBackward does not go before start', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);
      useAppStore.getState().setPlaybackPosition(0);

      useAppStore.getState().stepBackward();

      expect(useAppStore.getState().playbackPosition).toBe(0);
    });
  });

  describe('seekToToken', () => {
    it('seeks to specific token index', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      useAppStore.getState().seekToToken(2);

      // Token 2 out of 5 = position 2/4 = 0.5
      expect(useAppStore.getState().playbackPosition).toBe(0.5);
    });

    it('clamps token index to valid range', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      useAppStore.getState().seekToToken(-1);
      expect(useAppStore.getState().playbackPosition).toBe(0);

      useAppStore.getState().seekToToken(100);
      expect(useAppStore.getState().playbackPosition).toBe(1);
    });
  });

  describe('setPlaybackSpeed', () => {
    it('clamps speed to valid range [0.5, 10]', () => {
      const points = createMockPoints(5);
      useAppStore.getState().addTrajectory('Test', points);

      useAppStore.getState().setPlaybackSpeed(5);
      expect(useAppStore.getState().playbackSpeed).toBe(5);

      useAppStore.getState().setPlaybackSpeed(0.1);
      expect(useAppStore.getState().playbackSpeed).toBe(0.5);

      useAppStore.getState().setPlaybackSpeed(15);
      expect(useAppStore.getState().playbackSpeed).toBe(10);
    });
  });
});
