import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  getSupportedModelIds,
  getModelConfig,
  isModelSupported,
  DEFAULT_MODEL_ID,
} from '@horus/shared';
import { AppError } from '../middleware/error-handler';

const modelsRoutes = new Hono()
  /**
   * GET /api/models
   * List all supported models with their metadata
   */
  .get('/', (c) => {
    const models = getSupportedModelIds().map((modelId) => {
      const config = getModelConfig(modelId);
      return {
        modelId: config.modelId,
        displayName: config.displayName,
        numLayers: config.numLayers,
        featuresPerLayer: config.featuresPerLayer,
        contextSize: config.contextSize,
        isDefault: modelId === DEFAULT_MODEL_ID,
      };
    });

    return c.json({
      models,
      defaultModelId: DEFAULT_MODEL_ID,
    });
  })

  /**
   * GET /api/models/:modelId
   * Get detailed config for a specific model
   */
  .get(
    '/:modelId',
    zValidator(
      'param',
      z.object({
        modelId: z.string().min(1),
      })
    ),
    (c) => {
      const { modelId } = c.req.valid('param');

      if (!isModelSupported(modelId)) {
        throw new AppError(
          `Unsupported model: ${modelId}. Supported models: ${getSupportedModelIds().join(', ')}`,
          404,
          'NOT_FOUND'
        );
      }

      const config = getModelConfig(modelId);
      return c.json({
        modelId: config.modelId,
        displayName: config.displayName,
        numLayers: config.numLayers,
        featuresPerLayer: config.featuresPerLayer,
        decoderDim: config.decoderDim,
        contextSize: config.contextSize,
        neuronpediaSourceSet: config.neuronpediaSourceSet,
        huggingfaceRepo: config.huggingfaceRepo,
        isDefault: modelId === DEFAULT_MODEL_ID,
      });
    }
  )

  /**
   * GET /api/models/:modelId/layers
   * Get available layers for a specific model
   */
  .get(
    '/:modelId/layers',
    zValidator(
      'param',
      z.object({
        modelId: z.string().min(1),
      })
    ),
    (c) => {
      const { modelId } = c.req.valid('param');

      if (!isModelSupported(modelId)) {
        throw new AppError(
          `Unsupported model: ${modelId}. Supported models: ${getSupportedModelIds().join(', ')}`,
          404,
          'NOT_FOUND'
        );
      }

      const config = getModelConfig(modelId);
      const layers = Array.from({ length: config.numLayers }, (_, i) => ({
        layer: i,
        sourceId: `${i}-${config.neuronpediaSourceSet}`,
        featuresPerLayer: config.featuresPerLayer,
      }));

      return c.json({
        modelId: config.modelId,
        displayName: config.displayName,
        numLayers: config.numLayers,
        layers,
      });
    }
  );

export { modelsRoutes };
