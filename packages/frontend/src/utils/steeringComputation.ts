/**
 * Steering Vector Computation
 *
 * Computes the steering vector from dial values. The steering vector
 * represents the cumulative effect of all active dials, translating
 * high-level dial positions into feature-level interventions.
 */

import type {
  Dial,
  SteeringVector,
  SteeringConfig,
  SteeringFeature,
} from '@horus/shared';
import { nodeIdToNeuronpediaSource as parseNodeId } from '@horus/shared';

/**
 * Default model ID for steering vectors
 */
const DEFAULT_MODEL_ID = 'gemma-2-2b';

/**
 * Internal representation of feature contributions during computation
 */
interface FeatureContribution {
  source: string;
  index: number;
  strength: number;
}

/**
 * Computes a steering vector from dial values
 *
 * Algorithm:
 * 1. For each dial with non-zero value:
 *    - Multiply each feature weight by dial value
 *    - Add to cumulative feature map
 * 2. If same feature appears in multiple dials: sum contributions
 * 3. Apply strength multiplier
 * 4. Clamp total strength to configured range
 * 5. Sort by absolute strength, take top N features
 * 6. Return sparse vector with only significant features
 *
 * @param dials - Map of dial IDs to Dial objects
 * @param config - Steering configuration
 * @returns Computed steering vector
 */
export function computeSteeringVector(
  dials: Map<string, Dial>,
  config: SteeringConfig
): SteeringVector {
  // Map to accumulate feature contributions (key = source:index)
  const featureMap = new Map<string, FeatureContribution>();

  // Extract model ID from first feature (all should be same model)
  let modelId = DEFAULT_MODEL_ID;

  // Iterate through all dials
  for (const dial of dials.values()) {
    // Skip zero-value or locked dials
    if (dial.value === 0) {
      continue;
    }

    // Process each feature in the dial's trace
    for (const traceFeature of dial.trace.features) {
      // Parse the node ID to get Neuronpedia source format
      const parsed = parseNodeId(traceFeature.nodeId);
      if (!parsed) {
        // Skip invalid node IDs
        continue;
      }

      // Use the model ID from the first valid feature
      if (modelId === DEFAULT_MODEL_ID && parsed.modelId) {
        modelId = parsed.modelId;
      }

      // Calculate this dial's contribution to this feature
      const contribution = dial.value * traceFeature.weight;

      // Create a unique key for this feature
      const featureKey = `${parsed.source}:${parsed.index}`;

      // Add or accumulate the contribution
      const existing = featureMap.get(featureKey);
      if (existing) {
        existing.strength += contribution;
      } else {
        featureMap.set(featureKey, {
          source: parsed.source,
          index: parsed.index,
          strength: contribution,
        });
      }
    }
  }

  // Convert to array and apply config transformations
  let features: SteeringFeature[] = Array.from(featureMap.values())
    .filter((f) => f.strength !== 0) // Remove zeroed-out features
    .map((f) => ({
      source: f.source,
      index: f.index,
      // Apply strength multiplier and clamp
      strength: clampStrength(
        f.strength * config.strengthMultiplier,
        config.clampRange
      ),
    }));

  // Sort by absolute strength (descending) and take top N
  features.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));
  features = features.slice(0, config.maxFeatures);

  return {
    features,
    modelId,
    timestamp: Date.now(),
  };
}

/**
 * Clamps a strength value to the configured range
 */
function clampStrength(value: number, range: [number, number]): number {
  const [min, max] = range;
  return Math.max(min, Math.min(max, value));
}

/**
 * Checks if a steering vector is empty (no features)
 */
export function isSteeringVectorEmpty(vector: SteeringVector | null): boolean {
  return !vector || vector.features.length === 0;
}

/**
 * Calculates the total absolute strength of a steering vector
 * Useful for determining how "extreme" the steering is
 */
export function calculateVectorMagnitude(vector: SteeringVector): number {
  return vector.features.reduce((sum, f) => sum + Math.abs(f.strength), 0);
}

/**
 * Merges two steering vectors, summing overlapping features
 */
export function mergeSteeringVectors(
  a: SteeringVector,
  b: SteeringVector,
  config: SteeringConfig
): SteeringVector {
  const featureMap = new Map<string, SteeringFeature>();

  // Add all features from vector A
  for (const f of a.features) {
    const key = `${f.source}:${f.index}`;
    featureMap.set(key, { ...f });
  }

  // Add/merge features from vector B
  for (const f of b.features) {
    const key = `${f.source}:${f.index}`;
    const existing = featureMap.get(key);
    if (existing) {
      existing.strength = clampStrength(
        existing.strength + f.strength,
        config.clampRange
      );
    } else {
      featureMap.set(key, { ...f });
    }
  }

  // Sort and limit
  let features = Array.from(featureMap.values());
  features.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));
  features = features.slice(0, config.maxFeatures);

  return {
    features,
    modelId: a.modelId || b.modelId,
    timestamp: Date.now(),
  };
}
