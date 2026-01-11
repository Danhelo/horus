/**
 * Model Configuration Types
 *
 * Defines supported Gemma models and their configurations for HORUS.
 */

/**
 * Configuration for a supported language model
 */
export interface ModelConfig {
  /** Unique model identifier (e.g., 'gemma-2-2b') */
  modelId: string;

  /** Human-readable display name */
  displayName: string;

  /** Number of layers in the model */
  numLayers: number;

  /** Number of SAE features per layer */
  featuresPerLayer: number;

  /** Dimension of the model's residual stream */
  decoderDim: number;

  /** Neuronpedia source set identifier */
  neuronpediaSourceSet: string;

  /** HuggingFace repository for SAE weights */
  huggingfaceRepo: string;

  /** Maximum context size in tokens */
  contextSize: number;
}

/**
 * Supported model configurations
 */
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  'gemma-2-2b': {
    modelId: 'gemma-2-2b',
    displayName: 'Gemma 2 2B',
    numLayers: 26,
    featuresPerLayer: 16384,
    decoderDim: 2304,
    neuronpediaSourceSet: 'gemmascope-res-16k',
    huggingfaceRepo: 'google/gemma-scope-2b-pt-res',
    contextSize: 1024,
  },
  'gemma-2-9b': {
    modelId: 'gemma-2-9b',
    displayName: 'Gemma 2 9B',
    numLayers: 42,
    featuresPerLayer: 16384,
    decoderDim: 3584,
    neuronpediaSourceSet: 'gemmascope-9b-res-16k',
    huggingfaceRepo: 'google/gemma-scope-9b-pt-res',
    contextSize: 1024,
  },
};

/**
 * Default model to use when none is specified
 */
export const DEFAULT_MODEL_ID = 'gemma-2-2b';

/**
 * Get model configuration by ID
 * @throws Error if model is not supported
 */
export function getModelConfig(modelId: string): ModelConfig {
  const config = SUPPORTED_MODELS[modelId];
  if (!config) {
    const supported = Object.keys(SUPPORTED_MODELS).join(', ');
    throw new Error(`Unsupported model: ${modelId}. Supported models: ${supported}`);
  }
  return config;
}

/**
 * Get the Neuronpedia source ID for a specific layer
 * @param modelId Model identifier
 * @param layer Layer number (0-indexed)
 */
export function getSourceId(modelId: string, layer: number): string {
  const config = getModelConfig(modelId);
  return `${layer}-${config.neuronpediaSourceSet}`;
}

/**
 * Check if a model ID is supported
 */
export function isModelSupported(modelId: string): boolean {
  return modelId in SUPPORTED_MODELS;
}

/**
 * Get list of all supported model IDs
 */
export function getSupportedModelIds(): string[] {
  return Object.keys(SUPPORTED_MODELS);
}

/**
 * Get list of all supported models with their configs
 */
export function getSupportedModels(): ModelConfig[] {
  return Object.values(SUPPORTED_MODELS);
}

/**
 * Validate layer number for a given model
 */
export function isValidLayer(modelId: string, layer: number): boolean {
  const config = SUPPORTED_MODELS[modelId];
  if (!config) return false;
  return layer >= 0 && layer < config.numLayers && Number.isInteger(layer);
}

/**
 * Validate feature index for a given model
 */
export function isValidFeatureIndex(modelId: string, index: number): boolean {
  const config = SUPPORTED_MODELS[modelId];
  if (!config) return false;
  return index >= 0 && index < config.featuresPerLayer && Number.isInteger(index);
}
