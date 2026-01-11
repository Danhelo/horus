/**
 * Steering-related types for HORUS Phase 2
 *
 * These types define the data structures for steering vectors,
 * conflict detection, and Neuronpedia API integration.
 *
 * Dial types are defined in @horus/shared/mixer and re-exported here
 * for convenience.
 */

// Re-export dial types from mixer module for convenience
export type { Dial, DialTrace, DialGroup, DialPolarity, TraceHighlight } from '../mixer';
export { getDialRange, clampDialValue } from '../mixer';

// ---------------------------------------------------------------------------
// Steering Vector Types
// ---------------------------------------------------------------------------

/**
 * A single feature to be steered in the model
 */
export interface SteeringFeature {
  source: string; // Neuronpedia source ID (e.g., "12-gemmascope-res-16k")
  index: number; // Feature index within source
  strength: number; // -2 to 2 (negative = suppress, positive = amplify)
}

/**
 * The steering vector represents the cumulative effect of all active dials
 */
export interface SteeringVector {
  features: SteeringFeature[];
  modelId: string; // Target model (e.g., "gemma-2-2b")
  timestamp: number; // When computed
}

/**
 * Configuration for steering vector computation
 */
export interface SteeringConfig {
  method: 'SIMPLE_ADDITIVE'; // Neuronpedia steering method
  maxFeatures: number; // Limit features in vector (default: 20)
  strengthMultiplier: number; // Scale factor for all strengths (default: 1.0)
  clampRange: [number, number]; // Min/max strength values (default: [-2, 2])
}

/**
 * Default steering configuration
 */
export const DEFAULT_STEERING_CONFIG: SteeringConfig = {
  method: 'SIMPLE_ADDITIVE',
  maxFeatures: 20,
  strengthMultiplier: 1.0,
  clampRange: [-2, 2],
};

// ---------------------------------------------------------------------------
// Conflict Detection Types
// ---------------------------------------------------------------------------

/**
 * Represents a conflict between two dials with opposing contributions
 */
export interface DialConflict {
  dialIds: [string, string];
  conflictingFeatures: Array<{
    featureId: string;
    contributions: [number, number]; // Opposing signs
  }>;
  severity: 'low' | 'medium' | 'high'; // Based on magnitude
}

/**
 * Severity thresholds for conflict detection
 */
export const CONFLICT_THRESHOLDS = {
  low: 0.3,
  medium: 0.6,
} as const;

// ---------------------------------------------------------------------------
// Serialization Types
// ---------------------------------------------------------------------------

/**
 * Serialized steering state for saving/sharing
 */
export interface SerializedSteeringState {
  version: 1;
  dials: Array<{
    id: string;
    value: number;
  }>;
  config: SteeringConfig;
}

// ---------------------------------------------------------------------------
// Neuronpedia API Types
// ---------------------------------------------------------------------------

/**
 * Request format for Neuronpedia steering API
 */
export interface SteerRequest {
  modelId: string;
  features: Array<{
    modelId: string;
    layer: string; // Source ID format (e.g., "12-gemmascope-res-16k")
    index: number;
    strength: number;
  }>;
  prompt: string;
  temperature?: number;
  n_tokens?: number;
  freq_penalty?: number;
  seed?: number;
  strength_multiplier?: number;
  steer_method?: 'SIMPLE_ADDITIVE' | 'ORTHOGONAL_DECOMP';
}

/**
 * Response from Neuronpedia steering API
 */
export interface SteerResponse {
  defaultOutput: {
    text: string;
    logprobs: number[];
  };
  steeredOutput: {
    text: string;
    logprobs: number[];
  };
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Parse a node ID into source ID and index for Neuronpedia API
 * Node ID format: "modelId:layer:index"
 * Returns source ID format: "layer-gemmascope-res-16k"
 */
export function nodeIdToNeuronpediaSource(nodeId: string): {
  source: string;
  index: number;
  modelId: string;
} | null {
  const parts = nodeId.split(':');
  if (parts.length < 3) return null;

  const index = parseInt(parts[parts.length - 1], 10);
  const layer = parseInt(parts[parts.length - 2], 10);
  const modelId = parts.slice(0, -2).join(':');

  if (isNaN(layer) || isNaN(index)) return null;

  return {
    source: `${layer}-gemmascope-res-16k`,
    index,
    modelId,
  };
}

/**
 * Convert a SteeringVector to Neuronpedia SteerRequest format
 */
export function steeringVectorToRequest(
  vector: SteeringVector,
  prompt: string,
  options?: Partial<Omit<SteerRequest, 'modelId' | 'features' | 'prompt'>>
): SteerRequest {
  return {
    modelId: vector.modelId,
    features: vector.features.map((f) => ({
      modelId: vector.modelId,
      layer: f.source,
      index: f.index,
      strength: f.strength,
    })),
    prompt,
    temperature: options?.temperature ?? 0.7,
    n_tokens: options?.n_tokens ?? 100,
    steer_method: options?.steer_method ?? 'SIMPLE_ADDITIVE',
    ...options,
  };
}
