import { createMiddleware } from 'hono/factory';
import { AppError } from './error-handler';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or similar
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed and increment counter
   * Returns remaining requests or throws if limit exceeded
   */
  check(key: string): { remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or expired - create new window
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.config.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { remaining: this.config.maxRequests - 1, resetAt };
    }

    // Increment counter
    entry.count++;

    // Check if over limit
    if (entry.count > this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new AppError(
        'Rate limit exceeded',
        429,
        'RATE_LIMITED',
        retryAfter
      );
    }

    return {
      remaining: this.config.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// General rate limiter: 100 requests per minute
const generalLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

// Proxy rate limiter: 20 requests per minute (for Neuronpedia proxied endpoints)
const proxyLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 20,
});

/**
 * Get client identifier from request
 */
function getClientKey(c: { req: { header: (name: string) => string | undefined } }): string {
  // Use X-Forwarded-For if behind proxy, otherwise use a default
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // In development, use a default key
  return c.req.header('x-real-ip') || 'default-client';
}

/**
 * General rate limit middleware (100 req/min)
 */
export const generalRateLimit = createMiddleware(async (c, next) => {
  const key = getClientKey(c);
  const result = generalLimiter.check(key);

  c.header('X-RateLimit-Limit', '100');
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  await next();
});

/**
 * Proxy rate limit middleware (20 req/min)
 * For endpoints that call Neuronpedia API
 */
export const proxyRateLimit = createMiddleware(async (c, next) => {
  const key = `proxy:${getClientKey(c)}`;
  const result = proxyLimiter.check(key);

  c.header('X-RateLimit-Limit', '20');
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  await next();
});
