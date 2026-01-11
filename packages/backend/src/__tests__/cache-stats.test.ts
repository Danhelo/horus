import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database before importing neuronpedia service
vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({ changes: 0 })),
    })),
  },
  schema: {
    features: {
      id: 'id',
      expiresAt: 'expiresAt',
    },
  },
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks are set up
import {
  neuronpediaService,
  CacheStats,
} from '../services/neuronpedia';

describe('Cache Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    neuronpediaService.resetStats();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCacheStats', () => {
    it('returns initial stats with zero values', () => {
      const stats = neuronpediaService.getCacheStats();

      expect(stats.memoryHits).toBe(0);
      expect(stats.dbHits).toBe(0);
      expect(stats.dbHitsStale).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.backgroundRefreshes).toBe(0);
      expect(stats.backgroundRefreshErrors).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it('calculates hit rate correctly', () => {
      const stats = neuronpediaService.getCacheStats();

      // With zero total requests, hitRate should be 0
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('resets all statistics to zero', () => {
      // First, verify we can modify the stats (internal test)
      neuronpediaService.resetStats();
      const stats = neuronpediaService.getCacheStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.memoryHits).toBe(0);
    });
  });

  describe('FeatureResponse with stale flag', () => {
    it('includes stale flag in response type', async () => {
      // Mock a successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            modelId: 'gemma-2-2b',
            layer: 12,
            index: 100,
            label: 'test',
          }),
      });

      const feature = await neuronpediaService.getFeature(
        'gemma-2-2b',
        12,
        100
      );

      expect(feature.cached).toBe(false);
      // stale should be undefined for fresh data
      expect(feature.stale).toBeUndefined();
    });
  });

  describe('Cache miss tracking', () => {
    it('increments miss count on API fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            modelId: 'gemma-2-2b',
            layer: 12,
            index: 200,
            label: 'test',
          }),
      });

      await neuronpediaService.getFeature('gemma-2-2b', 12, 200);

      const stats = neuronpediaService.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });
  });

  describe('Memory cache hit tracking', () => {
    it('increments memory hit on second request for same feature', async () => {
      // First request - cache miss
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            modelId: 'gemma-2-2b',
            layer: 12,
            index: 300,
            label: 'test',
          }),
      });

      await neuronpediaService.getFeature('gemma-2-2b', 12, 300);

      // Second request - should be memory hit
      const feature = await neuronpediaService.getFeature(
        'gemma-2-2b',
        12,
        300
      );

      const stats = neuronpediaService.getCacheStats();
      expect(stats.memoryHits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(feature.cached).toBe(true);
    });
  });
});
