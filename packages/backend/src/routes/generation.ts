import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { neuronpediaService, type SteerRequest } from '../services/neuronpedia';
import { tokenize, sleep, getStreamingDelay } from '../utils/tokenizer';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../middleware/error-handler';
import { DEFAULT_MODEL_ID, getModelConfig, isValidFeatureIndex } from '@horus/shared';

/**
 * Generation-specific rate limiter (10 requests per minute)
 * More restrictive than general API due to cost of steering calls
 */
interface GenerationRateLimitEntry {
  count: number;
  resetAt: number;
}

const generationRateLimitStore = new Map<string, GenerationRateLimitEntry>();
const GENERATION_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
};

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of generationRateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      generationRateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Get client key for rate limiting
 */
function getClientKey(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return `gen:${forwarded.split(',')[0].trim()}`;
  }
  return `gen:${c.req.header('x-real-ip') || 'default-client'}`;
}

/**
 * Generation rate limit middleware
 */
const generationRateLimit = createMiddleware(async (c, next) => {
  const key = getClientKey(c);
  const now = Date.now();
  const entry = generationRateLimitStore.get(key);

  // No entry or expired - create new window
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + GENERATION_RATE_LIMIT.windowMs;
    generationRateLimitStore.set(key, { count: 1, resetAt });
    c.header('X-RateLimit-Limit', String(GENERATION_RATE_LIMIT.maxRequests));
    c.header(
      'X-RateLimit-Remaining',
      String(GENERATION_RATE_LIMIT.maxRequests - 1)
    );
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    await next();
    return;
  }

  // Increment counter
  entry.count++;

  // Check if over limit
  if (entry.count > GENERATION_RATE_LIMIT.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new AppError('Rate limit exceeded', 429, 'RATE_LIMITED', retryAfter);
  }

  c.header('X-RateLimit-Limit', String(GENERATION_RATE_LIMIT.maxRequests));
  c.header(
    'X-RateLimit-Remaining',
    String(GENERATION_RATE_LIMIT.maxRequests - entry.count)
  );
  c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  await next();
});

/**
 * Steering feature schema
 */
const SteeringFeatureSchema = z.object({
  source: z.string().min(1), // e.g., "12-gemmascope-res-16k"
  index: z.number().int().min(0), // Max validated dynamically based on model
  strength: z.number().min(-100).max(100), // Reasonable bounds
});

/**
 * Steering vector schema
 */
const SteeringVectorSchema = z.object({
  features: z.array(SteeringFeatureSchema).max(20), // Limit number of features
  modelId: z.string().default(DEFAULT_MODEL_ID),
});

/**
 * Generation options schema
 */
const GenerationOptionsSchema = z.object({
  maxTokens: z.number().int().min(1).max(500).default(100),
  temperature: z.number().min(0).max(2).default(0.7),
  stream: z.boolean().default(true),
  returnActivations: z.boolean().default(false),
});

/**
 * Full generation request schema
 */
const GenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(4096),
  steeringVector: SteeringVectorSchema,
  options: GenerationOptionsSchema.default({}),
});

/**
 * SSE Event types
 */
type SSEEvent =
  | { type: 'token'; data: { token: string; index: number } }
  | {
      type: 'activation';
      data: { tokenIndex: number; features: Array<{ index: number; activation: number }> };
    }
  | { type: 'done'; data: { finishReason: 'complete' | 'max_tokens' | 'cancelled' } }
  | {
      type: 'error';
      data: { type: GenerationErrorCode; message: string; retryAfter?: number };
    };

type GenerationErrorCode =
  | 'RATE_LIMITED'
  | 'INVALID_STEERING'
  | 'MODEL_UNAVAILABLE'
  | 'NETWORK_ERROR';

/**
 * Generation routes
 */
const generationRoutes = new Hono()
  /**
   * POST /api/generation/generate
   * Generate text with optional steering
   */
  .post(
    '/generate',
    generationRateLimit,
    zValidator('json', GenerationRequestSchema),
    async (c) => {
      const request = c.req.valid('json');
      const modelId = request.steeringVector.modelId;

      // Validate feature indices before processing
      for (const feature of request.steeringVector.features) {
        if (!isValidFeatureIndex(modelId, feature.index)) {
          const config = getModelConfig(modelId);
          throw new AppError(
            `Invalid feature index ${feature.index} for model ${modelId}. Valid range: 0-${config.featuresPerLayer - 1}`,
            400,
            'BAD_REQUEST'
          );
        }
      }

      // Transform steering vector to Neuronpedia format
      const steerFeatures: SteerRequest['features'] = request.steeringVector.features
        .filter((f) => f.strength !== 0) // Skip zero-strength features
        .map((f) => ({
          modelId: modelId,
          layer: f.source,
          index: f.index,
          strength: f.strength,
        }));

      if (request.options.stream) {
        // Streaming SSE response
        return streamSSE(c, async (stream) => {
          try {
            // Call Neuronpedia steer API
            const response = await neuronpediaService.steer({
              prompt: request.prompt,
              features: steerFeatures,
              temperature: request.options.temperature,
              n_tokens: request.options.maxTokens,
            });

            // Choose output based on whether steering was applied
            const output =
              steerFeatures.length > 0
                ? response.steeredOutput.text
                : response.defaultOutput.text;

            // Tokenize response for streaming
            const tokens = tokenize(output);

            // Stream tokens with realistic timing
            for (let i = 0; i < tokens.length; i++) {
              const tokenEvent: SSEEvent = {
                type: 'token',
                data: { token: tokens[i], index: i },
              };

              await stream.writeSSE({
                event: 'token',
                data: JSON.stringify(tokenEvent.data),
              });

              // Simulate natural typing delay
              await sleep(getStreamingDelay(40, 60));
            }

            // Send done event
            const doneEvent: SSEEvent = {
              type: 'done',
              data: { finishReason: 'complete' },
            };
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify(doneEvent.data),
            });
          } catch (error) {
            // Send error event
            const errorData = mapErrorToSSE(error);
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify(errorData),
            });
          }
        });
      } else {
        // Non-streaming response
        try {
          const response = await neuronpediaService.steer({
            prompt: request.prompt,
            features: steerFeatures,
            temperature: request.options.temperature,
            n_tokens: request.options.maxTokens,
          });

          return c.json({
            defaultText: response.defaultOutput.text,
            steeredText: response.steeredOutput.text,
            appliedFeatures: steerFeatures.length,
          });
        } catch (error) {
          // Let the error handler deal with it
          throw error;
        }
      }
    }
  )

  /**
   * GET /api/generation/status
   * Check generation service status and rate limits
   */
  .get('/status', (c) => {
    const key = getClientKey(c);
    const entry = generationRateLimitStore.get(key);
    const now = Date.now();

    let remaining = GENERATION_RATE_LIMIT.maxRequests;
    let resetAt = now + GENERATION_RATE_LIMIT.windowMs;

    if (entry && now < entry.resetAt) {
      remaining = Math.max(0, GENERATION_RATE_LIMIT.maxRequests - entry.count);
      resetAt = entry.resetAt;
    }

    return c.json({
      service: 'generation',
      status: 'operational',
      rateLimit: {
        limit: GENERATION_RATE_LIMIT.maxRequests,
        remaining,
        resetAt: new Date(resetAt).toISOString(),
        windowMs: GENERATION_RATE_LIMIT.windowMs,
      },
    });
  });

/**
 * Error data structure for SSE events
 */
interface SSEErrorData {
  type: GenerationErrorCode;
  message: string;
  retryAfter?: number;
}

/**
 * Map errors to SSE error format
 */
function mapErrorToSSE(error: unknown): SSEErrorData {
  if (error instanceof AppError) {
    switch (error.code) {
      case 'RATE_LIMITED':
        return {
          type: 'RATE_LIMITED',
          message: error.message,
          retryAfter: error.retryAfter,
        };
      case 'BAD_REQUEST':
        return {
          type: 'INVALID_STEERING',
          message: error.message,
        };
      case 'SERVICE_UNAVAILABLE':
        return {
          type: 'MODEL_UNAVAILABLE',
          message: error.message,
          retryAfter: error.retryAfter,
        };
      default:
        return {
          type: 'NETWORK_ERROR',
          message: error.message,
        };
    }
  }

  return {
    type: 'NETWORK_ERROR',
    message: error instanceof Error ? error.message : 'Unknown error',
  };
}

export { generationRoutes };
