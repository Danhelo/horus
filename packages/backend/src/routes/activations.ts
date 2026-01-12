import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { neuronpediaService } from '../services/neuronpedia';
import { proxyRateLimit } from '../middleware/rate-limit';
import { DEFAULT_MODEL_ID } from '@horus/shared';

const activationsRoutes = new Hono()
  /**
   * POST /api/activations
   * Get feature activations for input text
   * Layer validation is done in the service layer based on model
   */
  .post(
    '/',
    proxyRateLimit,
    zValidator(
      'json',
      z.object({
        text: z.string().min(1).max(4096),
        model: z.string().default(DEFAULT_MODEL_ID),
        // Layers are validated dynamically in the service based on model config
        layers: z.array(z.number().int().min(0)).optional(),
      })
    ),
    async (c) => {
      const { text, model, layers } = c.req.valid('json');
      // Service handles model/layer validation
      const activations = await neuronpediaService.getActivations(text, model, layers);
      return c.json(activations);
    }
  );

export { activationsRoutes };
