import type { TrajectoryPoint } from '@horus/shared';

/**
 * Compute the centroid position from feature activations.
 * The centroid is the weighted average of node positions based on activation values.
 *
 * @param activations - Map of nodeId to activation value
 * @param nodePositions - Map of nodeId to [x, y, z] position
 * @param threshold - Minimum activation to include in centroid calculation (default 0.1)
 * @returns The weighted centroid position [x, y, z]
 */
export function computeCentroid(
  activations: Map<string, number>,
  nodePositions: Map<string, [number, number, number]>,
  threshold = 0.1
): [number, number, number] {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let totalWeight = 0;

  for (const [nodeId, activation] of activations) {
    if (activation < threshold) continue;

    const pos = nodePositions.get(nodeId);
    if (!pos) continue;

    sumX += pos[0] * activation;
    sumY += pos[1] * activation;
    sumZ += pos[2] * activation;
    totalWeight += activation;
  }

  if (totalWeight === 0) {
    return [0, 0, 0];
  }

  return [sumX / totalWeight, sumY / totalWeight, sumZ / totalWeight];
}

/**
 * Compute node positions map from the large data store format.
 * This converts Float32Array positions to a Map for centroid calculation.
 *
 * @param positions - Float32Array with x, y, z positions
 * @param nodeIndexMap - Map of nodeId to array index
 * @returns Map of nodeId to [x, y, z] position
 */
export function buildNodePositionsMap(
  positions: Float32Array,
  nodeIndexMap: Map<string, number>
): Map<string, [number, number, number]> {
  const nodePositions = new Map<string, [number, number, number]>();

  for (const [nodeId, index] of nodeIndexMap) {
    nodePositions.set(nodeId, [
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    ]);
  }

  return nodePositions;
}

/**
 * Create trajectory points from token activations.
 *
 * @param tokens - Array of token strings
 * @param tokenActivations - Array of Maps, each containing nodeId -> activation for that token
 * @param nodePositions - Map of nodeId to [x, y, z] position
 * @param threshold - Minimum activation threshold for centroid calculation
 * @returns Array of TrajectoryPoint objects
 */
export function createTrajectoryPoints(
  tokens: string[],
  tokenActivations: Map<string, number>[],
  nodePositions: Map<string, [number, number, number]>,
  threshold = 0.1
): TrajectoryPoint[] {
  return tokens.map((token, index) => {
    const activations = tokenActivations[index] ?? new Map();
    const position = computeCentroid(activations, nodePositions, threshold);

    return {
      tokenIndex: index,
      token,
      activations,
      position,
      timestamp: Date.now(),
    };
  });
}

/**
 * Interpolate position along a trajectory at a given normalized position.
 *
 * @param points - Array of trajectory points
 * @param t - Normalized position (0-1)
 * @returns Interpolated [x, y, z] position
 */
export function interpolateTrajectoryPosition(
  points: TrajectoryPoint[],
  t: number
): [number, number, number] {
  if (points.length === 0) {
    return [0, 0, 0];
  }

  if (points.length === 1) {
    return [...points[0].position];
  }

  // Clamp t to [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));

  // Calculate the exact position in the points array
  const exactIndex = clampedT * (points.length - 1);
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.min(lowerIndex + 1, points.length - 1);
  const fraction = exactIndex - lowerIndex;

  const p1 = points[lowerIndex].position;
  const p2 = points[upperIndex].position;

  // Linear interpolation between the two points
  return [
    p1[0] + (p2[0] - p1[0]) * fraction,
    p1[1] + (p2[1] - p1[1]) * fraction,
    p1[2] + (p2[2] - p1[2]) * fraction,
  ];
}

/**
 * Get the current token index from a normalized playback position.
 *
 * @param position - Normalized position (0-1)
 * @param pointCount - Total number of trajectory points
 * @returns The current token index (0-based)
 */
export function positionToTokenIndex(position: number, pointCount: number): number {
  if (pointCount <= 0) return 0;
  if (pointCount === 1) return 0;

  const clampedPosition = Math.max(0, Math.min(1, position));
  return Math.floor(clampedPosition * (pointCount - 1));
}

/**
 * Get the normalized playback position from a token index.
 *
 * @param tokenIndex - The token index (0-based)
 * @param pointCount - Total number of trajectory points
 * @returns Normalized position (0-1)
 */
export function tokenIndexToPosition(tokenIndex: number, pointCount: number): number {
  if (pointCount <= 1) return 0;

  const clampedIndex = Math.max(0, Math.min(pointCount - 1, tokenIndex));
  return clampedIndex / (pointCount - 1);
}

/**
 * Calculate the total path length of a trajectory.
 *
 * @param points - Array of trajectory points
 * @returns Total path length in world units
 */
export function calculatePathLength(points: TrajectoryPoint[]): number {
  if (points.length < 2) return 0;

  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1].position;
    const p2 = points[i].position;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = p2[2] - p1[2];

    totalLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return totalLength;
}

/**
 * Get the maximum activation value for a trajectory point.
 *
 * @param point - The trajectory point
 * @returns The maximum activation value
 */
export function getMaxActivation(point: TrajectoryPoint): number {
  let max = 0;
  for (const activation of point.activations.values()) {
    if (activation > max) {
      max = activation;
    }
  }
  return max;
}

/**
 * Get the top N activations for a trajectory point.
 *
 * @param point - The trajectory point
 * @param n - Number of top activations to return
 * @returns Array of [nodeId, activation] pairs sorted by activation descending
 */
export function getTopActivations(
  point: TrajectoryPoint,
  n: number
): [string, number][] {
  const entries = Array.from(point.activations.entries());
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, n);
}
