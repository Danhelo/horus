import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { neuronpediaService, GEMMA_CONFIG } from '../services/neuronpedia';
import { proxyRateLimit } from '../middleware/rate-limit';

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
   */
  .get(
    '/:model/:layer/:index',
    proxyRateLimit,
    zValidator(
      'param',
      z.object({
        model: z.string().min(1),
        layer: z.coerce.number().int().min(0).max(GEMMA_CONFIG.layers - 1),
        index: z.coerce
          .number()
          .int()
          .min(0)
          .max(GEMMA_CONFIG.featuresPerLayer - 1),
      })
    ),
    async (c) => {
      const { model, layer, index } = c.req.valid('param');
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
        model: z.string().default('gemma-2-2b'),
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
  );

export { featuresRoutes };
