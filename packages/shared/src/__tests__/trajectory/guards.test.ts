import { describe, it, expect } from 'vitest';
import {
  isPlaybackState,
  isTrajectoryPoint,
  isTrajectoryMetadata,
  isTrajectory,
  isSerializedTrajectoryPoint,
  deserializeTrajectoryPoint,
  serializeTrajectoryPoint,
} from '../../trajectory/guards';
import type { TrajectoryPoint, Trajectory } from '../../trajectory/types';

describe('isPlaybackState', () => {
  it('validates idle', () => {
    expect(isPlaybackState('idle')).toBe(true);
  });

  it('validates playing', () => {
    expect(isPlaybackState('playing')).toBe(true);
  });

  it('validates paused', () => {
    expect(isPlaybackState('paused')).toBe(true);
  });

  it('validates seeking', () => {
    expect(isPlaybackState('seeking')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isPlaybackState('stopped')).toBe(false);
    expect(isPlaybackState('')).toBe(false);
    expect(isPlaybackState(null)).toBe(false);
    expect(isPlaybackState(undefined)).toBe(false);
  });
});

describe('isTrajectoryPoint', () => {
  const validPoint: TrajectoryPoint = {
    tokenIndex: 0,
    token: 'Hello',
    activations: new Map([['gemma-2-2b:12:456', 0.8]]),
    position: [1.0, 2.0, 3.0],
  };

  it('validates correct trajectory point', () => {
    expect(isTrajectoryPoint(validPoint)).toBe(true);
  });

  it('validates with empty activations', () => {
    expect(
      isTrajectoryPoint({
        ...validPoint,
        activations: new Map(),
      })
    ).toBe(true);
  });

  it('validates with optional timestamp', () => {
    expect(
      isTrajectoryPoint({
        ...validPoint,
        timestamp: Date.now(),
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isTrajectoryPoint(null)).toBe(false);
    expect(isTrajectoryPoint(undefined)).toBe(false);
  });

  it('rejects negative tokenIndex', () => {
    expect(isTrajectoryPoint({ ...validPoint, tokenIndex: -1 })).toBe(false);
  });

  it('rejects non-integer tokenIndex', () => {
    expect(isTrajectoryPoint({ ...validPoint, tokenIndex: 1.5 })).toBe(false);
  });

  it('rejects non-string token', () => {
    expect(isTrajectoryPoint({ ...validPoint, token: 123 })).toBe(false);
  });

  it('rejects non-Map activations', () => {
    expect(isTrajectoryPoint({ ...validPoint, activations: {} })).toBe(false);
    expect(isTrajectoryPoint({ ...validPoint, activations: [] })).toBe(false);
  });

  it('rejects Map with invalid entries', () => {
    expect(
      isTrajectoryPoint({
        ...validPoint,
        activations: new Map([[123, 0.5]]),
      })
    ).toBe(false);
    expect(
      isTrajectoryPoint({
        ...validPoint,
        activations: new Map([['key', 'value']]),
      })
    ).toBe(false);
  });

  it('rejects invalid position', () => {
    expect(isTrajectoryPoint({ ...validPoint, position: [1, 2] })).toBe(false);
    expect(isTrajectoryPoint({ ...validPoint, position: [1, 2, 3, 4] })).toBe(false);
  });

  it('rejects non-number timestamp', () => {
    expect(isTrajectoryPoint({ ...validPoint, timestamp: 'now' })).toBe(false);
  });
});

describe('isTrajectoryMetadata', () => {
  it('validates correct metadata', () => {
    expect(
      isTrajectoryMetadata({
        modelId: 'gemma-2-2b',
        createdAt: '2025-01-10T00:00:00Z',
      })
    ).toBe(true);
  });

  it('validates with optional label', () => {
    expect(
      isTrajectoryMetadata({
        modelId: 'gemma-2-2b',
        createdAt: '2025-01-10T00:00:00Z',
        label: 'Test trajectory',
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isTrajectoryMetadata(null)).toBe(false);
    expect(isTrajectoryMetadata(undefined)).toBe(false);
  });

  it('rejects empty modelId', () => {
    expect(
      isTrajectoryMetadata({
        modelId: '',
        createdAt: '2025-01-10T00:00:00Z',
      })
    ).toBe(false);
  });

  it('rejects non-string label', () => {
    expect(
      isTrajectoryMetadata({
        modelId: 'gemma-2-2b',
        createdAt: '2025-01-10T00:00:00Z',
        label: 123,
      })
    ).toBe(false);
  });
});

describe('isTrajectory', () => {
  const validPoint: TrajectoryPoint = {
    tokenIndex: 0,
    token: 'Hello',
    activations: new Map([['gemma-2-2b:12:456', 0.8]]),
    position: [1.0, 2.0, 3.0],
  };

  const validTrajectory: Trajectory = {
    id: 'traj-12345',
    text: 'Hello world',
    points: [validPoint],
    color: '#d4af37',
    metadata: {
      modelId: 'gemma-2-2b',
      createdAt: '2025-01-10T00:00:00Z',
    },
  };

  it('validates correct trajectory', () => {
    expect(isTrajectory(validTrajectory)).toBe(true);
  });

  it('validates with empty points', () => {
    expect(
      isTrajectory({
        ...validTrajectory,
        points: [],
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isTrajectory(null)).toBe(false);
    expect(isTrajectory(undefined)).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isTrajectory({ ...validTrajectory, id: '' })).toBe(false);
  });

  it('rejects non-string text', () => {
    expect(isTrajectory({ ...validTrajectory, text: 123 })).toBe(false);
  });

  it('rejects non-array points', () => {
    expect(isTrajectory({ ...validTrajectory, points: 'not-array' })).toBe(false);
  });

  it('rejects invalid point in array', () => {
    expect(
      isTrajectory({
        ...validTrajectory,
        points: [{ tokenIndex: -1, token: '', activations: new Map(), position: [0, 0, 0] }],
      })
    ).toBe(false);
  });

  it('rejects non-string color', () => {
    expect(isTrajectory({ ...validTrajectory, color: 123 })).toBe(false);
  });

  it('rejects invalid metadata', () => {
    expect(isTrajectory({ ...validTrajectory, metadata: {} })).toBe(false);
  });
});

describe('isSerializedTrajectoryPoint', () => {
  it('validates correct serialized point', () => {
    expect(
      isSerializedTrajectoryPoint({
        tokenIndex: 0,
        token: 'Hello',
        activations: [['gemma-2-2b:12:456', 0.8]],
        position: [1.0, 2.0, 3.0],
      })
    ).toBe(true);
  });

  it('validates empty activations array', () => {
    expect(
      isSerializedTrajectoryPoint({
        tokenIndex: 0,
        token: 'Hello',
        activations: [],
        position: [0, 0, 0],
      })
    ).toBe(true);
  });

  it('rejects non-array activations', () => {
    expect(
      isSerializedTrajectoryPoint({
        tokenIndex: 0,
        token: 'Hello',
        activations: new Map(),
        position: [0, 0, 0],
      })
    ).toBe(false);
  });

  it('rejects invalid activation tuple', () => {
    expect(
      isSerializedTrajectoryPoint({
        tokenIndex: 0,
        token: 'Hello',
        activations: [['key']],
        position: [0, 0, 0],
      })
    ).toBe(false);
    expect(
      isSerializedTrajectoryPoint({
        tokenIndex: 0,
        token: 'Hello',
        activations: [[123, 0.5]],
        position: [0, 0, 0],
      })
    ).toBe(false);
  });
});

describe('serializeTrajectoryPoint / deserializeTrajectoryPoint', () => {
  const point: TrajectoryPoint = {
    tokenIndex: 5,
    token: 'world',
    activations: new Map([
      ['gemma-2-2b:12:456', 0.8],
      ['gemma-2-2b:12:789', 0.6],
    ]),
    position: [1.0, 2.0, 3.0],
    timestamp: 1234567890,
  };

  it('serializes point correctly', () => {
    const serialized = serializeTrajectoryPoint(point);

    expect(serialized.tokenIndex).toBe(5);
    expect(serialized.token).toBe('world');
    expect(serialized.position).toEqual([1.0, 2.0, 3.0]);
    expect(serialized.timestamp).toBe(1234567890);
    expect(Array.isArray(serialized.activations)).toBe(true);
    expect(serialized.activations).toHaveLength(2);
  });

  it('deserializes point correctly', () => {
    const serialized = serializeTrajectoryPoint(point);
    const deserialized = deserializeTrajectoryPoint(serialized);

    expect(deserialized.tokenIndex).toBe(5);
    expect(deserialized.token).toBe('world');
    expect(deserialized.position).toEqual([1.0, 2.0, 3.0]);
    expect(deserialized.timestamp).toBe(1234567890);
    expect(deserialized.activations instanceof Map).toBe(true);
    expect(deserialized.activations.get('gemma-2-2b:12:456')).toBe(0.8);
    expect(deserialized.activations.get('gemma-2-2b:12:789')).toBe(0.6);
  });

  it('round-trips correctly', () => {
    const serialized = serializeTrajectoryPoint(point);
    const deserialized = deserializeTrajectoryPoint(serialized);

    expect(deserialized.tokenIndex).toBe(point.tokenIndex);
    expect(deserialized.token).toBe(point.token);
    expect(deserialized.position).toEqual(point.position);
    expect(deserialized.timestamp).toBe(point.timestamp);
    expect(deserialized.activations.size).toBe(point.activations.size);

    for (const [key, value] of point.activations) {
      expect(deserialized.activations.get(key)).toBe(value);
    }
  });
});
