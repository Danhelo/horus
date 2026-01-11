import { LRUCache } from 'lru-cache';
import { env } from '../env';
import { db, schema } from '../db';
import { eq, and, gt, lt } from 'drizzle-orm';
import {
  AppError,
  createNeuronpediaError,
} from '../middleware/error-handler';
import type { FeatureData } from '../db/schema/features';

/**
 * Gemma-2-2B model configuration
 */
export const GEMMA_CONFIG = {
  modelId: 'gemma-2-2b',
  layers: 26, // 0-25
  getSourceId: (layer: number) => `${layer}-gemmascope-res-16k`,
  featuresPerLayer: 16384,
  contextSize: 1024,
};

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  memoryTtl: 3600000, // 1 hour for memory cache
  dbTtl: 24 * 60 * 60 * 1000, // 24 hours for DB cache
  staleThreshold: 12 * 60 * 60 * 1000, // 12 hours - after this, trigger background refresh
  statsLogInterval: 60000, // Log stats every minute
};

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  memoryHits: number;
  dbHits: number;
  dbHitsStale: number;
  misses: number;
  backgroundRefreshes: number;
  backgroundRefreshErrors: number;
  totalRequests: number;
}

/**
 * Activation response from Neuronpedia
 */
export interface ActivationResponse {
  tokens: string[];
  activations: Array<{
    layer: number;
    features: Array<{ index: number; activation: number }>;
  }>;
}

/**
 * Search result from Neuronpedia
 */
export interface SearchResult {
  modelId: string;
  layer: number;
  index: number;
  label?: string;
  description?: string;
  score: number;
}

/**
 * Feature response with cache metadata
 */
export interface FeatureResponse extends FeatureData {
  cached: boolean;
  cachedAt?: string;
  stale?: boolean;
}

/**
 * Neuronpedia API client with caching and retry logic
 */
class NeuronpediaService {
  private baseUrl = 'https://www.neuronpedia.org';
  private apiKey: string;

  // In-memory LRU cache for features (1 hour TTL, max 1000 entries)
  private memoryCache = new LRUCache<string, FeatureData>({
    max: 1000,
    ttl: CACHE_CONFIG.memoryTtl,
  });

  // Search result cache (5 min TTL, max 100 entries)
  private searchCache = new LRUCache<string, SearchResult[]>({
    max: 100,
    ttl: 300000, // 5 minutes
  });

  // Cache statistics
  private stats: CacheStats = {
    memoryHits: 0,
    dbHits: 0,
    dbHitsStale: 0,
    misses: 0,
    backgroundRefreshes: 0,
    backgroundRefreshErrors: 0,
    totalRequests: 0,
  };

  // Track in-flight background refreshes to avoid duplicates
  private pendingRefreshes = new Set<string>();

  // Stats logging interval
  private statsLogTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.apiKey = env.NEURONPEDIA_API_KEY;

    // Start periodic stats logging
    this.statsLogTimer = setInterval(() => {
      this.logCacheStats();
    }, CACHE_CONFIG.statsLogInterval);
  }

  /**
   * Get current cache statistics
   */
  getCacheStats(): CacheStats & { hitRate: number } {
    const total = this.stats.totalRequests || 1;
    const hits = this.stats.memoryHits + this.stats.dbHits;
    return {
      ...this.stats,
      hitRate: Math.round((hits / total) * 100) / 100,
    };
  }

  /**
   * Log cache statistics
   */
  private logCacheStats(): void {
    if (this.stats.totalRequests === 0) return;

    const stats = this.getCacheStats();
    console.log(
      `[Cache Stats] Total: ${stats.totalRequests}, ` +
        `Memory: ${stats.memoryHits}, DB: ${stats.dbHits} (${stats.dbHitsStale} stale), ` +
        `Miss: ${stats.misses}, Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%, ` +
        `BG Refreshes: ${stats.backgroundRefreshes} (${stats.backgroundRefreshErrors} errors)`
    );
  }

  /**
   * Reset cache statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      memoryHits: 0,
      dbHits: 0,
      dbHitsStale: 0,
      misses: 0,
      backgroundRefreshes: 0,
      backgroundRefreshErrors: 0,
      totalRequests: 0,
    };
  }

  /**
   * Cleanup resources (for graceful shutdown)
   */
  cleanup(): void {
    if (this.statsLogTimer) {
      clearInterval(this.statsLogTimer);
      this.statsLogTimer = null;
    }
  }

  /**
   * Get a feature by model, layer, and index
   * Uses multi-level caching: memory -> SQLite -> API
   * Implements stale-while-revalidate: serves stale data immediately while refreshing in background
   */
  async getFeature(
    model: string,
    layer: number,
    index: number
  ): Promise<FeatureResponse> {
    const cacheKey = `${model}:${layer}:${index}`;
    this.stats.totalRequests++;

    // Level 1: Check memory cache
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached) {
      this.stats.memoryHits++;
      return { ...memoryCached, cached: true };
    }

    // Level 2: Check SQLite cache
    const dbCached = await this.getFromDb(cacheKey);
    if (dbCached) {
      // Check if data is stale (older than staleThreshold)
      const isStale =
        Date.now() - dbCached.cachedAt.getTime() > CACHE_CONFIG.staleThreshold;

      if (isStale) {
        this.stats.dbHitsStale++;
        // Trigger background refresh (non-blocking)
        this.backgroundRefresh(cacheKey, model, layer, index);
      } else {
        this.stats.dbHits++;
      }

      // Populate memory cache and return immediately
      this.memoryCache.set(cacheKey, dbCached.data);
      return {
        ...dbCached.data,
        cached: true,
        cachedAt: dbCached.cachedAt.toISOString(),
        stale: isStale,
      };
    }

    // Level 3: Fetch from API (cache miss)
    this.stats.misses++;
    const feature = await this.fetchAndCache(cacheKey, model, layer, index);
    return { ...feature, cached: false };
  }

  /**
   * Fetch feature from API and store in cache
   */
  private async fetchAndCache(
    cacheKey: string,
    model: string,
    layer: number,
    index: number
  ): Promise<FeatureData> {
    const sourceId = GEMMA_CONFIG.getSourceId(layer);
    const feature = await this.fetchFromApi<FeatureData>(
      `/api/feature/${model}/${sourceId}/${index}`
    );

    // Normalize response
    const normalizedFeature: FeatureData = {
      modelId: model,
      layer,
      index,
      label: feature.label,
      description: feature.description,
      explanations: feature.explanations,
      topLogits: feature.topLogits,
    };

    // Store in both caches
    this.memoryCache.set(cacheKey, normalizedFeature);
    await this.saveToDb(cacheKey, model, layer, index, normalizedFeature);

    return normalizedFeature;
  }

  /**
   * Background refresh for stale cache entries
   * Non-blocking - fires and forgets, logs errors
   */
  private backgroundRefresh(
    cacheKey: string,
    model: string,
    layer: number,
    index: number
  ): void {
    // Avoid duplicate refreshes for the same key
    if (this.pendingRefreshes.has(cacheKey)) {
      return;
    }

    this.pendingRefreshes.add(cacheKey);
    this.stats.backgroundRefreshes++;

    // Use setImmediate to not block the response
    setImmediate(async () => {
      try {
        await this.fetchAndCache(cacheKey, model, layer, index);
        console.log(`[Cache] Background refresh complete for ${cacheKey}`);
      } catch (error) {
        this.stats.backgroundRefreshErrors++;
        console.error(
          `[Cache] Background refresh failed for ${cacheKey}:`,
          error instanceof Error ? error.message : error
        );
      } finally {
        this.pendingRefreshes.delete(cacheKey);
      }
    });
  }

  /**
   * Get activations for text input
   */
  async getActivations(
    text: string,
    model: string = 'gemma-2-2b',
    layers?: number[]
  ): Promise<ActivationResponse> {
    // Validate text length
    if (text.length > 4096) {
      throw new AppError(
        'Text too long. Maximum 4096 characters.',
        400,
        'BAD_REQUEST'
      );
    }

    // Use all layers if not specified
    const targetLayers = layers || Array.from({ length: 26 }, (_, i) => i);

    // Build source IDs for requested layers
    const sources = targetLayers.map((layer) => GEMMA_CONFIG.getSourceId(layer));

    const response = await this.fetchFromApi<{
      tokens: string[];
      activations: Array<{
        source: string;
        values: Array<{ index: number; value: number }>;
      }>;
    }>('/api/activation/new', {
      method: 'POST',
      body: JSON.stringify({
        modelId: model,
        source: sources,
        text,
      }),
    });

    // Transform response to our format
    return {
      tokens: response.tokens,
      activations: response.activations.map((act, i) => ({
        layer: targetLayers[i],
        features: act.values.map((v) => ({
          index: v.index,
          activation: v.value,
        })),
      })),
    };
  }

  /**
   * Search for features matching a query
   */
  async searchFeatures(
    query: string,
    limit: number = 20,
    model: string = 'gemma-2-2b'
  ): Promise<SearchResult[]> {
    const cacheKey = `search:${model}:${query}:${limit}`;

    // Check search cache
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      console.log(`[Cache] Search hit for "${query}"`);
      return cached;
    }

    const response = await this.fetchFromApi<{
      results: Array<{
        modelId: string;
        layer: string;
        index: number;
        label?: string;
        description?: string;
        score: number;
      }>;
    }>('/api/search-all', {
      method: 'POST',
      body: JSON.stringify({
        modelId: model,
        text: query,
        topK: Math.min(limit, 100),
      }),
    });

    const results: SearchResult[] = response.results.map((r) => ({
      modelId: r.modelId,
      layer: parseInt(r.layer.split('-')[0], 10), // Extract layer from source ID
      index: r.index,
      label: r.label,
      description: r.description,
      score: r.score,
    }));

    // Cache results
    this.searchCache.set(cacheKey, results);

    return results;
  }

  /**
   * Fetch from Neuronpedia API with error handling and retries
   */
  private async fetchFromApi<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            ...options.headers,
          },
        });

        if (!response.ok) {
          const retryAfter = response.headers.get('Retry-After');
          const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;

          // Don't retry 400 or 404 errors
          if (response.status === 400 || response.status === 404) {
            throw createNeuronpediaError(response.status);
          }

          // Retry on rate limit or server errors
          if (response.status === 429 || response.status >= 500) {
            if (attempt < maxRetries) {
              const delay = this.getBackoffDelay(attempt, retrySeconds);
              console.log(
                `[API] Retry ${attempt}/${maxRetries} after ${delay}ms`
              );
              await this.sleep(delay);
              continue;
            }
          }

          throw createNeuronpediaError(response.status, retrySeconds);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = this.getBackoffDelay(attempt);
          console.log(
            `[API] Network error, retry ${attempt}/${maxRetries} after ${delay}ms`
          );
          await this.sleep(delay);
        }
      }
    }

    throw new AppError(
      `Failed to fetch from Neuronpedia: ${lastError?.message || 'Unknown error'}`,
      502,
      'SERVER_ERROR'
    );
  }

  /**
   * Get exponential backoff delay
   */
  private getBackoffDelay(attempt: number, retryAfter?: number): number {
    if (retryAfter) {
      return retryAfter * 1000;
    }
    // Exponential backoff: 1s, 2s, 4s, etc.
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get feature from SQLite cache
   */
  private async getFromDb(id: string) {
    const now = new Date();
    const result = await db
      .select()
      .from(schema.features)
      .where(
        and(eq(schema.features.id, id), gt(schema.features.expiresAt, now))
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Save feature to SQLite cache
   */
  private async saveToDb(
    id: string,
    modelId: string,
    layer: number,
    index: number,
    data: FeatureData
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await db
      .insert(schema.features)
      .values({
        id,
        modelId,
        layer,
        featureIndex: index,
        data,
        cachedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: schema.features.id,
        set: {
          data,
          cachedAt: now,
          expiresAt,
        },
      });
  }

  /**
   * Clear expired cache entries (can be called periodically)
   */
  async cleanupExpiredCache(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(schema.features)
      .where(lt(schema.features.expiresAt, now));

    return result.changes;
  }
}

export const neuronpediaService = new NeuronpediaService();
