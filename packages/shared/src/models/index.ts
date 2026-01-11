/**
 * Model Configuration Module
 *
 * Exports model types, configurations, and utility functions.
 */

export {
  type ModelConfig,
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  getModelConfig,
  getSourceId,
  isModelSupported,
  getSupportedModelIds,
  getSupportedModels,
  isValidLayer,
  isValidFeatureIndex,
} from './types';

export { isModelConfig } from './guards';
