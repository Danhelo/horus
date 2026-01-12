import type { TrajectoryPoint, Trajectory, TrajectoryMetadata, PlaybackState } from './types';
import { isPosition } from '../graph';

const VALID_PLAYBACK_STATES: PlaybackState[] = ['idle', 'playing', 'paused', 'seeking'];

/**
 * Type guard for PlaybackState
 */
export function isPlaybackState(value: unknown): value is PlaybackState {
  return typeof value === 'string' && VALID_PLAYBACK_STATES.includes(value as PlaybackState);
}

/**
 * Type guard for TrajectoryPoint
 */
export function isTrajectoryPoint(value: unknown): value is TrajectoryPoint {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Validate required fields
  if (
    typeof obj.tokenIndex !== 'number' ||
    !Number.isInteger(obj.tokenIndex) ||
    obj.tokenIndex < 0
  ) {
    return false;
  }

  if (typeof obj.token !== 'string') {
    return false;
  }

  if (!(obj.activations instanceof Map)) {
    return false;
  }

  // Validate activations Map entries
  for (const [key, value] of obj.activations as Map<unknown, unknown>) {
    if (typeof key !== 'string' || typeof value !== 'number') {
      return false;
    }
  }

  if (!isPosition(obj.position)) {
    return false;
  }

  // Validate optional timestamp
  if (obj.timestamp !== undefined && typeof obj.timestamp !== 'number') {
    return false;
  }

  return true;
}

/**
 * Type guard for TrajectoryMetadata
 */
export function isTrajectoryMetadata(value: unknown): value is TrajectoryMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.modelId === 'string' &&
    obj.modelId.length > 0 &&
    typeof obj.createdAt === 'string' &&
    (obj.label === undefined || typeof obj.label === 'string')
  );
}

/**
 * Type guard for Trajectory
 */
export function isTrajectory(value: unknown): value is Trajectory {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  if (typeof obj.text !== 'string') {
    return false;
  }

  if (!Array.isArray(obj.points)) {
    return false;
  }

  // Validate all points
  for (const point of obj.points) {
    if (!isTrajectoryPoint(point)) {
      return false;
    }
  }

  if (typeof obj.color !== 'string') {
    return false;
  }

  return isTrajectoryMetadata(obj.metadata);
}

/**
 * Type guard for serialized TrajectoryPoint (with activations as array)
 * Used when deserializing from JSON
 */
export function isSerializedTrajectoryPoint(
  value: unknown
): value is Omit<TrajectoryPoint, 'activations'> & { activations: Array<[string, number]> } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (
    typeof obj.tokenIndex !== 'number' ||
    !Number.isInteger(obj.tokenIndex) ||
    obj.tokenIndex < 0
  ) {
    return false;
  }

  if (typeof obj.token !== 'string') {
    return false;
  }

  if (!Array.isArray(obj.activations)) {
    return false;
  }

  // Validate activations as array of tuples
  for (const entry of obj.activations) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'number'
    ) {
      return false;
    }
  }

  if (!isPosition(obj.position)) {
    return false;
  }

  if (obj.timestamp !== undefined && typeof obj.timestamp !== 'number') {
    return false;
  }

  return true;
}

/**
 * Convert serialized trajectory point to TrajectoryPoint (with Map)
 */
export function deserializeTrajectoryPoint(
  serialized: Omit<TrajectoryPoint, 'activations'> & { activations: Array<[string, number]> }
): TrajectoryPoint {
  return {
    tokenIndex: serialized.tokenIndex,
    token: serialized.token,
    activations: new Map(serialized.activations),
    position: serialized.position,
    timestamp: serialized.timestamp,
  };
}

/**
 * Convert TrajectoryPoint to serializable format
 */
export function serializeTrajectoryPoint(
  point: TrajectoryPoint
): Omit<TrajectoryPoint, 'activations'> & { activations: Array<[string, number]> } {
  return {
    tokenIndex: point.tokenIndex,
    token: point.token,
    activations: Array.from(point.activations.entries()),
    position: point.position,
    timestamp: point.timestamp,
  };
}
