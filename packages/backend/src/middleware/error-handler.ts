import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

/**
 * Custom application error with status code and error code
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Neuronpedia-specific error codes
 */
export type NeuronpediaErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE';

/**
 * Create an AppError from Neuronpedia response status
 */
export function createNeuronpediaError(
  status: number,
  retryAfter?: number
): AppError {
  switch (status) {
    case 400:
      return new AppError('Invalid request to Neuronpedia', 400, 'BAD_REQUEST');
    case 401:
      return new AppError(
        'Neuronpedia API key is invalid',
        500,
        'UNAUTHORIZED'
      );
    case 404:
      return new AppError('Feature not found', 404, 'NOT_FOUND');
    case 429:
      return new AppError(
        'Rate limit exceeded. Please try again later.',
        429,
        'RATE_LIMITED',
        retryAfter
      );
    case 503:
      return new AppError(
        'Neuronpedia GPUs are busy. Please try again.',
        503,
        'SERVICE_UNAVAILABLE',
        retryAfter || 30
      );
    default:
      if (status >= 500) {
        return new AppError(
          'Neuronpedia service error',
          502,
          'SERVER_ERROR',
          retryAfter
        );
      }
      return new AppError(`Upstream error: ${status}`, 502, 'SERVER_ERROR');
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error, c: Context) {
  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message } }, err.status);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  // Handle custom app errors
  if (err instanceof AppError) {
    const response: {
      error: {
        message: string;
        code?: string;
      };
    } = {
      error: {
        message: err.message,
        code: err.code,
      },
    };

    // Set Retry-After header for rate limit errors
    if (err.retryAfter) {
      c.header('Retry-After', String(err.retryAfter));
    }

    return c.json(response, err.statusCode as 400 | 404 | 429 | 500 | 502 | 503);
  }

  // Log unexpected errors
  console.error('Unhandled error:', err);

  return c.json(
    {
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    },
    500
  );
}

/**
 * Not found handler
 */
export function notFoundHandler(c: Context) {
  return c.json(
    {
      error: {
        message: 'Not found',
        code: 'NOT_FOUND',
      },
    },
    404
  );
}
