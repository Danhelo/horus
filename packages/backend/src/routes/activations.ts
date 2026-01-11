import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { neuronpediaService, GEMMA_CONFIG } from '../services/neuronpedia';
import { proxyRateLimit } from '../middleware/rate-limit';

const activationsRoutes = new Hono()
  /**
   * POST /api/activations
   * Get feature activations for input text
   */
  .post(
    '/',
    proxyRateLimit,
    zValidator(
      'json',
      z.object({
        text: z.string().min(1).max(4096),
        model: z.string().default('gemma-2-2b'),
        layers: z
          .array(z.number().int().min(0).max(GEMMA_CONFIG.layers - 1))
          .optional(),
      })
    ),
    async (c) => {
      const { text, model, layers } = c.req.valid('json');
      const activations = await neuronpediaService.getActivations(
        text,
        model,
        layers
      );
      return c.json(activations);
    }
  );

export { activationsRoutes };
