import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { neuronpediaService } from '../services/neuronpedia';
import { proxyRateLimit } from '../middleware/rate-limit';
import {
  isModelSupported,
  isValidLayer,
  isValidFeatureIndex,
  getSupportedModelIds,
  getModelConfig,
  DEFAULT_MODEL_ID,
} from '@horus/shared';
import { AppError } from '../middleware/error-handler';

const featuresRoutes = new Hono()
  /**
   * GET /api/features/stats
   * Get cache statistics (for monitoring)
   */
  .get('/stats', async (c) => {
    const stats = neuronpediaService.getCacheStats();
    return c.json(stats);
  })

  /**
   * GET /api/features/:model/:layer/:index
   * Get a specific feature by model, layer, and index
   * Supports multiple models with dynamic layer/index validation
   */
  .get(
    '/:model/:layer/:index',
    proxyRateLimit,
    zValidator(
      'param',
      z.object({
        model: z.string().min(1),
        layer: z.coerce.number().int().min(0),
        index: z.coerce.number().int().min(0),
      })
    ),
    async (c) => {
      const { model, layer, index } = c.req.valid('param');

      // Validate model
      if (!isModelSupported(model)) {
        throw new AppError(
          `Unsupported model: ${model}. Supported models: ${getSupportedModelIds().join(', ')}`,
          400,
          'BAD_REQUEST'
        );
      }

      // Validate layer for this model
      if (!isValidLayer(model, layer)) {
        const config = getModelConfig(model);
        throw new AppError(
          `Invalid layer ${layer} for model ${model}. Valid range: 0-${config.numLayers - 1}`,
          400,
          'BAD_REQUEST'
        );
      }

      // Validate feature index for this model
      if (!isValidFeatureIndex(model, index)) {
        const config = getModelConfig(model);
        throw new AppError(
          `Invalid feature index ${index} for model ${model}. Valid range: 0-${config.featuresPerLayer - 1}`,
          400,
          'BAD_REQUEST'
        );
      }

      const feature = await neuronpediaService.getFeature(model, layer, index);
      return c.json(feature);
    }
  )

  /**
   * POST /api/features/search
   * Search for features by query text
   */
  .post(
    '/search',
    proxyRateLimit,
    zValidator(
      'json',
      z.object({
        query: z.string().min(2).max(200),
        limit: z.number().int().min(1).max(100).default(20),
        model: z.string().default(DEFAULT_MODEL_ID),
      })
    ),
    async (c) => {
      const { query, limit, model } = c.req.valid('json');
      const results = await neuronpediaService.searchFeatures(
        query,
        limit,
        model
      );
      return c.json({ results, count: results.length });
    }
  )

  /**
   * POST /api/features/batch
   * Fetch labels for multiple features at once (for vicinity loading)
   * Returns only labels to minimize payload size
   */
  .post(
    '/batch',
    proxyRateLimit,
    zValidator(
      'json',
      z.object({
        features: z
          .array(
            z.object({
              modelId: z.string(),
              layer: z.number().int().min(0),
              index: z.number().int().min(0),
            })
          )
          .min(1)
          .max(50), // Max 50 features per batch to respect rate limits
      })
    ),
    async (c) => {
      const { features } = c.req.valid('json');

      // Validate all features
      for (const f of features) {
        if (!isModelSupported(f.modelId)) {
          throw new AppError(`Unsupported model: ${f.modelId}`, 400, 'BAD_REQUEST');
        }
        if (!isValidLayer(f.modelId, f.layer)) {
          throw new AppError(`Invalid layer ${f.layer} for model ${f.modelId}`, 400, 'BAD_REQUEST');
        }
        if (!isValidFeatureIndex(f.modelId, f.index)) {
          throw new AppError(`Invalid index ${f.index} for model ${f.modelId}`, 400, 'BAD_REQUEST');
        }
      }

      // Fetch all features in parallel (they each hit cache first)
      const results = await Promise.allSettled(
        features.map((f) => neuronpediaService.getFeature(f.modelId, f.layer, f.index))
      );

      // Build response with only labels (minimal payload)
      const labels: Array<{
        modelId: string;
        layer: number;
        index: number;
        label: string | null;
      }> = features.map((f, i) => {
        const result = results[i];
        return {
          modelId: f.modelId,
          layer: f.layer,
          index: f.index,
          label: result.status === 'fulfilled' ? (result.value.label ?? null) : null,
        };
      });

      return c.json({ labels });
    }
  );

export { featuresRoutes };
