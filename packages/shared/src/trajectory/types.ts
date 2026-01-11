/**
 * A single point in a trajectory through ideaspace.
 * Each point represents a token's position based on its feature activations.
 */
export interface TrajectoryPoint {
  /** Token index in the source text (0-based) */
  tokenIndex: number;

  /** The text token at this position */
  token: string;

  /** Feature activations at this point (featureId -> activation value) */
  activations: Map<string, number>;

  /** 3D position computed as weighted centroid of active features */
  position: [number, number, number];

  /** Optional timestamp for real-time generation scenarios */
  timestamp?: number;
}

/**
 * A complete trajectory showing how text moves through ideaspace.
 * Each token traces a path through feature space.
 */
export interface Trajectory {
  /** Unique identifier for this trajectory */
  id: string;

  /** The source text that generated this trajectory */
  text: string;

  /** Ordered list of trajectory points, one per token */
  points: TrajectoryPoint[];

  /** Display color for the trajectory path */
  color: string;

  /** Metadata about the trajectory */
  metadata: TrajectoryMetadata;
}

/**
 * Metadata associated with a trajectory
 */
export interface TrajectoryMetadata {
  /** Model used to generate activations */
  modelId: string;

  /** When the trajectory was created */
  createdAt: string;

  /** Optional label for the trajectory */
  label?: string;
}

/**
 * Playback state for trajectory animation
 */
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'seeking';

/**
 * Generate a unique trajectory ID
 */
export function createTrajectoryId(): string {
  return `traj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
