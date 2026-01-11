/**
 * Type guards for model types
 */

import type { ModelConfig } from './types';

/**
 * Type guard for ModelConfig
 */
export function isModelConfig(value: unknown): value is ModelConfig {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.modelId === 'string' &&
    typeof obj.displayName === 'string' &&
    typeof obj.numLayers === 'number' &&
    Number.isInteger(obj.numLayers) &&
    obj.numLayers > 0 &&
    typeof obj.featuresPerLayer === 'number' &&
    Number.isInteger(obj.featuresPerLayer) &&
    obj.featuresPerLayer > 0 &&
    typeof obj.decoderDim === 'number' &&
    Number.isInteger(obj.decoderDim) &&
    obj.decoderDim > 0 &&
    typeof obj.neuronpediaSourceSet === 'string' &&
    typeof obj.huggingfaceRepo === 'string' &&
    typeof obj.contextSize === 'number' &&
    Number.isInteger(obj.contextSize) &&
    obj.contextSize > 0
  );
}
