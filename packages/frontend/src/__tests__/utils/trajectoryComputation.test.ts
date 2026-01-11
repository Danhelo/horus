import { describe, it, expect } from 'vitest';
import {
  computeCentroid,
  buildNodePositionsMap,
  createTrajectoryPoints,
  interpolateTrajectoryPosition,
  positionToTokenIndex,
  tokenIndexToPosition,
  calculatePathLength,
  getMaxActivation,
  getTopActivations,
} from '../../utils/trajectoryComputation';
import type { TrajectoryPoint } from '@horus/shared';

describe('computeCentroid', () => {
  const nodePositions = new Map<string, [number, number, number]>([
    ['node-1', [0, 0, 0]],
    ['node-2', [10, 0, 0]],
    ['node-3', [5, 10, 0]],
    ['node-4', [0, 0, 10]],
  ]);

  it('computes weighted centroid correctly', () => {
    const activations = new Map<string, number>([
      ['node-1', 1.0],
      ['node-2', 1.0],
    ]);

    const result = computeCentroid(activations, nodePositions);

    // Weighted average of [0,0,0] and [10,0,0] with equal weights
    expect(result).toEqual([5, 0, 0]);
  });

  it('weights positions by activation value', () => {
    const activations = new Map<string, number>([
      ['node-1', 0.25], // [0,0,0]
      ['node-2', 0.75], // [10,0,0]
    ]);

    const result = computeCentroid(activations, nodePositions);

    // Weighted: (0.25 * 0 + 0.75 * 10) / 1.0 = 7.5
    expect(result).toEqual([7.5, 0, 0]);
  });

  it('filters activations below threshold', () => {
    const activations = new Map<string, number>([
      ['node-1', 0.05], // Below default threshold of 0.1
      ['node-2', 1.0],
    ]);

    const result = computeCentroid(activations, nodePositions);

    // Only node-2 should contribute
    expect(result).toEqual([10, 0, 0]);
  });

  it('respects custom threshold', () => {
    const activations = new Map<string, number>([
      ['node-1', 0.3],
      ['node-2', 1.0],
    ]);

    // Threshold 0.5 should exclude node-1
    const result = computeCentroid(activations, nodePositions, 0.5);

    expect(result).toEqual([10, 0, 0]);
  });

  it('returns origin when no activations meet threshold', () => {
    const activations = new Map<string, number>([
      ['node-1', 0.01],
      ['node-2', 0.02],
    ]);

    const result = computeCentroid(activations, nodePositions);

    expect(result).toEqual([0, 0, 0]);
  });

  it('returns origin when activations map is empty', () => {
    const activations = new Map<string, number>();

    const result = computeCentroid(activations, nodePositions);

    expect(result).toEqual([0, 0, 0]);
  });

  it('handles missing node positions gracefully', () => {
    const activations = new Map<string, number>([
      ['node-1', 1.0],
      ['unknown-node', 1.0],
    ]);

    const result = computeCentroid(activations, nodePositions);

    // Only node-1 should contribute
    expect(result).toEqual([0, 0, 0]);
  });

  it('handles 3D positions correctly', () => {
    const activations = new Map<string, number>([
      ['node-3', 1.0], // [5, 10, 0]
      ['node-4', 1.0], // [0, 0, 10]
    ]);

    const result = computeCentroid(activations, nodePositions);

    expect(result).toEqual([2.5, 5, 5]);
  });
});

describe('buildNodePositionsMap', () => {
  it('converts Float32Array to Map correctly', () => {
    const positions = new Float32Array([
      1, 2, 3, // node-a at index 0
      4, 5, 6, // node-b at index 1
      7, 8, 9, // node-c at index 2
    ]);
    const nodeIndexMap = new Map<string, number>([
      ['node-a', 0],
      ['node-b', 1],
      ['node-c', 2],
    ]);

    const result = buildNodePositionsMap(positions, nodeIndexMap);

    expect(result.get('node-a')).toEqual([1, 2, 3]);
    expect(result.get('node-b')).toEqual([4, 5, 6]);
    expect(result.get('node-c')).toEqual([7, 8, 9]);
    expect(result.size).toBe(3);
  });
});

describe('createTrajectoryPoints', () => {
  const nodePositions = new Map<string, [number, number, number]>([
    ['node-1', [0, 0, 0]],
    ['node-2', [10, 0, 0]],
  ]);

  it('creates trajectory points from tokens and activations', () => {
    const tokens = ['Hello', 'world'];
    const tokenActivations = [
      new Map([['node-1', 1.0]]),
      new Map([['node-2', 1.0]]),
    ];

    const result = createTrajectoryPoints(tokens, tokenActivations, nodePositions);

    expect(result.length).toBe(2);
    expect(result[0].token).toBe('Hello');
    expect(result[0].tokenIndex).toBe(0);
    expect(result[0].position).toEqual([0, 0, 0]);
    expect(result[1].token).toBe('world');
    expect(result[1].tokenIndex).toBe(1);
    expect(result[1].position).toEqual([10, 0, 0]);
  });

  it('includes activations in points', () => {
    const tokens = ['Test'];
    const tokenActivations = [
      new Map([
        ['node-1', 0.5],
        ['node-2', 0.8],
      ]),
    ];

    const result = createTrajectoryPoints(tokens, tokenActivations, nodePositions);

    expect(result[0].activations.get('node-1')).toBe(0.5);
    expect(result[0].activations.get('node-2')).toBe(0.8);
  });
});

describe('interpolateTrajectoryPosition', () => {
  const createPoints = (positions: [number, number, number][]): TrajectoryPoint[] => {
    return positions.map((position, index) => ({
      tokenIndex: index,
      token: `token${index}`,
      activations: new Map(),
      position,
    }));
  };

  it('returns exact position at t=0', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ]);

    const result = interpolateTrajectoryPosition(points, 0);

    expect(result).toEqual([0, 0, 0]);
  });

  it('returns exact position at t=1', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ]);

    const result = interpolateTrajectoryPosition(points, 1);

    expect(result).toEqual([20, 0, 0]);
  });

  it('interpolates correctly at t=0.5', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ]);

    const result = interpolateTrajectoryPosition(points, 0.5);

    // Middle point
    expect(result).toEqual([10, 0, 0]);
  });

  it('interpolates between points', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
    ]);

    const result = interpolateTrajectoryPosition(points, 0.5);

    expect(result).toEqual([5, 0, 0]);
  });

  it('handles single point', () => {
    const points = createPoints([[5, 5, 5]]);

    const result = interpolateTrajectoryPosition(points, 0.5);

    expect(result).toEqual([5, 5, 5]);
  });

  it('returns origin for empty points', () => {
    const result = interpolateTrajectoryPosition([], 0.5);

    expect(result).toEqual([0, 0, 0]);
  });

  it('clamps t to valid range', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
    ]);

    expect(interpolateTrajectoryPosition(points, -0.5)).toEqual([0, 0, 0]);
    expect(interpolateTrajectoryPosition(points, 1.5)).toEqual([10, 0, 0]);
  });
});

describe('positionToTokenIndex', () => {
  it('returns 0 for position 0', () => {
    expect(positionToTokenIndex(0, 10)).toBe(0);
  });

  it('returns last index for position 1', () => {
    expect(positionToTokenIndex(1, 10)).toBe(9);
  });

  it('calculates correct index for middle positions', () => {
    expect(positionToTokenIndex(0.5, 9)).toBe(4);
  });

  it('handles single point', () => {
    expect(positionToTokenIndex(0.5, 1)).toBe(0);
  });

  it('handles zero points', () => {
    expect(positionToTokenIndex(0.5, 0)).toBe(0);
  });
});

describe('tokenIndexToPosition', () => {
  it('returns 0 for first token', () => {
    expect(tokenIndexToPosition(0, 10)).toBe(0);
  });

  it('returns 1 for last token', () => {
    expect(tokenIndexToPosition(9, 10)).toBe(1);
  });

  it('calculates correct position for middle tokens', () => {
    expect(tokenIndexToPosition(4, 9)).toBeCloseTo(0.5);
  });

  it('handles single point', () => {
    expect(tokenIndexToPosition(0, 1)).toBe(0);
  });

  it('clamps index to valid range', () => {
    expect(tokenIndexToPosition(-5, 10)).toBe(0);
    expect(tokenIndexToPosition(100, 10)).toBe(1);
  });
});

describe('calculatePathLength', () => {
  const createPoints = (positions: [number, number, number][]): TrajectoryPoint[] => {
    return positions.map((position, index) => ({
      tokenIndex: index,
      token: `token${index}`,
      activations: new Map(),
      position,
    }));
  };

  it('returns 0 for empty points', () => {
    expect(calculatePathLength([])).toBe(0);
  });

  it('returns 0 for single point', () => {
    const points = createPoints([[0, 0, 0]]);
    expect(calculatePathLength(points)).toBe(0);
  });

  it('calculates correct length for two points', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
    ]);
    expect(calculatePathLength(points)).toBe(10);
  });

  it('sums segment lengths', () => {
    const points = createPoints([
      [0, 0, 0],
      [10, 0, 0],
      [10, 10, 0],
    ]);
    expect(calculatePathLength(points)).toBe(20);
  });

  it('handles 3D paths', () => {
    const points = createPoints([
      [0, 0, 0],
      [3, 4, 0], // distance = 5
    ]);
    expect(calculatePathLength(points)).toBe(5);
  });
});

describe('getMaxActivation', () => {
  it('returns 0 for empty activations', () => {
    const point: TrajectoryPoint = {
      tokenIndex: 0,
      token: 'test',
      activations: new Map(),
      position: [0, 0, 0],
    };

    expect(getMaxActivation(point)).toBe(0);
  });

  it('returns maximum activation value', () => {
    const point: TrajectoryPoint = {
      tokenIndex: 0,
      token: 'test',
      activations: new Map([
        ['node-1', 0.5],
        ['node-2', 0.8],
        ['node-3', 0.3],
      ]),
      position: [0, 0, 0],
    };

    expect(getMaxActivation(point)).toBe(0.8);
  });
});

describe('getTopActivations', () => {
  it('returns empty array for empty activations', () => {
    const point: TrajectoryPoint = {
      tokenIndex: 0,
      token: 'test',
      activations: new Map(),
      position: [0, 0, 0],
    };

    expect(getTopActivations(point, 3)).toEqual([]);
  });

  it('returns top N activations sorted descending', () => {
    const point: TrajectoryPoint = {
      tokenIndex: 0,
      token: 'test',
      activations: new Map([
        ['node-1', 0.5],
        ['node-2', 0.8],
        ['node-3', 0.3],
        ['node-4', 0.9],
        ['node-5', 0.1],
      ]),
      position: [0, 0, 0],
    };

    const result = getTopActivations(point, 3);

    expect(result.length).toBe(3);
    expect(result[0]).toEqual(['node-4', 0.9]);
    expect(result[1]).toEqual(['node-2', 0.8]);
    expect(result[2]).toEqual(['node-1', 0.5]);
  });

  it('returns all activations when N exceeds count', () => {
    const point: TrajectoryPoint = {
      tokenIndex: 0,
      token: 'test',
      activations: new Map([
        ['node-1', 0.5],
        ['node-2', 0.8],
      ]),
      position: [0, 0, 0],
    };

    const result = getTopActivations(point, 10);

    expect(result.length).toBe(2);
  });
});
