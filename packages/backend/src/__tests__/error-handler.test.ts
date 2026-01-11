import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import {
  AppError,
  createNeuronpediaError,
  errorHandler,
  notFoundHandler,
} from '../middleware/error-handler';

describe('Error Handler', () => {
  describe('AppError', () => {
    it('creates error with default status code', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBeUndefined();
    });

    it('creates error with custom status code and code', () => {
      const error = new AppError('Not found', 404, 'NOT_FOUND');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('stores retryAfter value', () => {
      const error = new AppError('Rate limited', 429, 'RATE_LIMITED', 60);

      expect(error.retryAfter).toBe(60);
    });
  });

  describe('createNeuronpediaError', () => {
    it('returns 400 for bad request', () => {
      const error = createNeuronpediaError(400);

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('returns 404 for not found', () => {
      const error = createNeuronpediaError(404);

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('returns 429 for rate limit with retryAfter', () => {
      const error = createNeuronpediaError(429, 60);

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(60);
    });

    it('returns 503 for service unavailable with default retry', () => {
      const error = createNeuronpediaError(503);

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.retryAfter).toBe(30);
    });

    it('returns 502 for other 5xx errors', () => {
      const error = createNeuronpediaError(500);

      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('SERVER_ERROR');
    });
  });

  describe('errorHandler middleware', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      app.onError(errorHandler);
    });

    it('handles HTTPException', async () => {
      app.get('/test', () => {
        throw new HTTPException(401, { message: 'Unauthorized' });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.message).toBe('Unauthorized');
    });

    it('handles AppError', async () => {
      app.get('/test', () => {
        throw new AppError('Test error', 400, 'TEST_ERROR');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.message).toBe('Test error');
      expect(json.error.code).toBe('TEST_ERROR');
    });

    it('sets Retry-After header for rate limit errors', async () => {
      app.get('/test', () => {
        throw new AppError('Rate limited', 429, 'RATE_LIMITED', 60);
      });

      const res = await app.request('/test');

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
    });

    it('handles ZodError as 400', async () => {
      app.get('/test', () => {
        const error = new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['name'],
            message: 'Expected string',
          },
        ]);
        throw error;
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toBeDefined();
    });

    it('handles unknown errors as 500', async () => {
      app.get('/test', () => {
        throw new Error('Unknown error');
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error.message).toBe('Internal server error');
    });
  });

  describe('notFoundHandler', () => {
    it('returns 404 with proper message', async () => {
      const app = new Hono();
      app.notFound(notFoundHandler);

      const res = await app.request('/nonexistent');
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.message).toBe('Not found');
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });
});
