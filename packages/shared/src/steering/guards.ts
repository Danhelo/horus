import type {
  SteeringFeature,
  SteeringVector,
  SteeringConfig,
  DialConflict,
  SteerRequest,
  SteerResponse,
} from './types';

const VALID_STEER_METHODS = ['SIMPLE_ADDITIVE', 'ORTHOGONAL_DECOMP'];
const VALID_CONFLICT_SEVERITIES = ['low', 'medium', 'high'];

/**
 * Type guard for SteeringFeature
 */
export function isSteeringFeature(value: unknown): value is SteeringFeature {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.source === 'string' &&
    obj.source.length > 0 &&
    typeof obj.index === 'number' &&
    Number.isInteger(obj.index) &&
    obj.index >= 0 &&
    typeof obj.strength === 'number' &&
    Number.isFinite(obj.strength)
  );
}

/**
 * Type guard for SteeringVector
 */
export function isSteeringVector(value: unknown): value is SteeringVector {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    Array.isArray(obj.features) &&
    obj.features.every(isSteeringFeature) &&
    typeof obj.modelId === 'string' &&
    obj.modelId.length > 0 &&
    typeof obj.timestamp === 'number' &&
    Number.isFinite(obj.timestamp)
  );
}

/**
 * Type guard for SteeringConfig
 */
export function isSteeringConfig(value: unknown): value is SteeringConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.method !== 'string' || obj.method !== 'SIMPLE_ADDITIVE') {
    return false;
  }

  if (
    typeof obj.maxFeatures !== 'number' ||
    !Number.isInteger(obj.maxFeatures) ||
    obj.maxFeatures <= 0
  ) {
    return false;
  }

  if (typeof obj.strengthMultiplier !== 'number' || !Number.isFinite(obj.strengthMultiplier)) {
    return false;
  }

  if (
    !Array.isArray(obj.clampRange) ||
    obj.clampRange.length !== 2 ||
    typeof obj.clampRange[0] !== 'number' ||
    typeof obj.clampRange[1] !== 'number' ||
    obj.clampRange[0] >= obj.clampRange[1]
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard for conflict severity
 */
export function isConflictSeverity(value: unknown): value is 'low' | 'medium' | 'high' {
  return typeof value === 'string' && VALID_CONFLICT_SEVERITIES.includes(value);
}

/**
 * Type guard for DialConflict
 */
export function isDialConflict(value: unknown): value is DialConflict {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Validate dialIds is a tuple of two strings
  if (
    !Array.isArray(obj.dialIds) ||
    obj.dialIds.length !== 2 ||
    typeof obj.dialIds[0] !== 'string' ||
    typeof obj.dialIds[1] !== 'string'
  ) {
    return false;
  }

  // Validate conflictingFeatures
  if (!Array.isArray(obj.conflictingFeatures)) {
    return false;
  }

  for (const feature of obj.conflictingFeatures) {
    if (typeof feature !== 'object' || feature === null) return false;
    const f = feature as Record<string, unknown>;
    if (typeof f.featureId !== 'string') return false;
    if (
      !Array.isArray(f.contributions) ||
      f.contributions.length !== 2 ||
      typeof f.contributions[0] !== 'number' ||
      typeof f.contributions[1] !== 'number'
    ) {
      return false;
    }
  }

  return isConflictSeverity(obj.severity);
}

/**
 * Type guard for SteerRequest (Neuronpedia API format)
 */
export function isSteerRequest(value: unknown): value is SteerRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.modelId !== 'string' || obj.modelId.length === 0) return false;
  if (typeof obj.prompt !== 'string') return false;

  if (!Array.isArray(obj.features)) return false;
  for (const f of obj.features) {
    if (typeof f !== 'object' || f === null) return false;
    const feature = f as Record<string, unknown>;
    if (
      typeof feature.modelId !== 'string' ||
      typeof feature.layer !== 'string' ||
      typeof feature.index !== 'number' ||
      typeof feature.strength !== 'number'
    ) {
      return false;
    }
  }

  // Optional fields
  if (obj.temperature !== undefined && typeof obj.temperature !== 'number') return false;
  if (obj.n_tokens !== undefined && typeof obj.n_tokens !== 'number') return false;
  if (obj.freq_penalty !== undefined && typeof obj.freq_penalty !== 'number') return false;
  if (obj.seed !== undefined && typeof obj.seed !== 'number') return false;
  if (obj.strength_multiplier !== undefined && typeof obj.strength_multiplier !== 'number') {
    return false;
  }
  if (
    obj.steer_method !== undefined &&
    typeof obj.steer_method === 'string' &&
    !VALID_STEER_METHODS.includes(obj.steer_method)
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard for SteerResponse (Neuronpedia API format)
 */
export function isSteerResponse(value: unknown): value is SteerResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  const isOutputValid = (output: unknown): boolean => {
    if (typeof output !== 'object' || output === null) return false;
    const o = output as Record<string, unknown>;
    return (
      typeof o.text === 'string' &&
      Array.isArray(o.logprobs) &&
      o.logprobs.every((l) => typeof l === 'number')
    );
  };

  return isOutputValid(obj.defaultOutput) && isOutputValid(obj.steeredOutput);
}
