import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { generalRateLimit, proxyRateLimit } from '../middleware/rate-limit';

describe('Rate Limiting Middleware', () => {
  describe('generalRateLimit', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      app.use('*', generalRateLimit);
      app.get('/test', (c) => c.json({ ok: true }));
    });

    it('allows requests within limit', async () => {
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
    });

    it('sets correct rate limit headers', async () => {
      const res = await app.request('/test');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('decrements remaining count with each request', async () => {
      const res1 = await app.request('/test', {
        headers: { 'x-forwarded-for': 'test-client-1' },
      });
      const res2 = await app.request('/test', {
        headers: { 'x-forwarded-for': 'test-client-1' },
      });

      const remaining1 = parseInt(
        res1.headers.get('X-RateLimit-Remaining') || '0',
        10
      );
      const remaining2 = parseInt(
        res2.headers.get('X-RateLimit-Remaining') || '0',
        10
      );

      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('proxyRateLimit', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
      app.use('*', proxyRateLimit);
      app.get('/test', (c) => c.json({ ok: true }));
    });

    it('has lower limit than general rate limit', async () => {
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
    });

    it('returns 429 with Retry-After header when limit exceeded', async () => {
      const { AppError } = await import('../middleware/error-handler');
      const app = new Hono();

      // Error handler that properly handles AppError
      app.onError((err, c) => {
        if (err instanceof AppError) {
          if (err.retryAfter) {
            c.header('Retry-After', String(err.retryAfter));
          }
          return c.json(
            { error: { message: err.message, code: err.code } },
            err.statusCode as 429
          );
        }
        return c.json({ error: { message: 'Internal error' } }, 500);
      });

      app.use('*', proxyRateLimit);
      app.get('/test', (c) => c.json({ ok: true }));

      // Make 21 requests (limit is 20)
      for (let i = 0; i < 20; i++) {
        await app.request('/test', {
          headers: { 'x-forwarded-for': 'rate-limit-test-client-2' },
        });
      }

      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': 'rate-limit-test-client-2' },
      });

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeDefined();
    });
  });
});
