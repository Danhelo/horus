import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { featuresRoutes, activationsRoutes, generationRoutes, modelsRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { generalRateLimit } from './middleware/rate-limit';

const app = new Hono()
  // Logging
  .use('*', logger())
  // CORS - allow frontend access
  .use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Retry-After',
      ],
      maxAge: 86400,
    })
  )
  // General rate limiting
  .use('*', generalRateLimit)
  // Health check endpoint
  .get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  })
  // API routes
  .route('/api/models', modelsRoutes)
  .route('/api/features', featuresRoutes)
  .route('/api/activations', activationsRoutes)
  .route('/api/generation', generationRoutes)
  // Error handling
  .onError(errorHandler)
  .notFound(notFoundHandler);

export type AppType = typeof app;
export default app;
