import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { featuresRoutes } from '../routes/features';
import { neuronpediaService } from '../services/neuronpedia';

// Type for feature response
interface FeatureResponse {
  modelId: string;
  layer: number;
  index: number;
  label?: string;
  description?: string;
  cached?: boolean;
  cachedAt?: string;
  stale?: boolean;
}

interface SearchResponse {
  results: FeatureResponse[];
  count: number;
}

// Mock the neuronpedia service
vi.mock('../services/neuronpedia', () => ({
  neuronpediaService: {
    getFeature: vi.fn(),
    searchFeatures: vi.fn(),
    getCacheStats: vi.fn(),
  },
  GEMMA_CONFIG: {
    modelId: 'gemma-2-2b',
    layers: 26,
    getSourceId: (layer: number) => `${layer}-gemmascope-res-16k`,
    featuresPerLayer: 16384,
    contextSize: 1024,
  },
}));

// Mock rate limit to avoid test interference
vi.mock('../middleware/rate-limit', () => ({
  proxyRateLimit: vi.fn((c, next) => next()),
}));

describe('Features Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono().route('/api/features', featuresRoutes);
    vi.clearAllMocks();
  });

  describe('GET /api/features/stats', () => {
    it('returns cache statistics', async () => {
      const mockStats = {
        memoryHits: 100,
        dbHits: 50,
        dbHitsStale: 5,
        misses: 20,
        backgroundRefreshes: 5,
        backgroundRefreshErrors: 1,
        totalRequests: 170,
        hitRate: 0.88,
      };

      vi.mocked(neuronpediaService.getCacheStats).mockReturnValue(mockStats);

      const res = await app.request('/api/features/stats');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockStats);
    });
  });

  describe('GET /api/features/:model/:layer/:index', () => {
    it('returns feature data', async () => {
      const mockFeature = {
        modelId: 'gemma-2-2b',
        layer: 12,
        index: 1622,
        label: 'test feature',
        description: 'A test feature',
        cached: false,
      };

      vi.mocked(neuronpediaService.getFeature).mockResolvedValue(mockFeature);

      const res = await app.request('/api/features/gemma-2-2b/12/1622');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockFeature);
      expect(neuronpediaService.getFeature).toHaveBeenCalledWith(
        'gemma-2-2b',
        12,
        1622
      );
    });

    it('validates layer range', async () => {
      const res = await app.request('/api/features/gemma-2-2b/30/1622');

      expect(res.status).toBe(400);
    });

    it('validates index range', async () => {
      const res = await app.request('/api/features/gemma-2-2b/12/999999');

      expect(res.status).toBe(400);
    });

    it('returns cached feature with cache metadata', async () => {
      const mockFeature = {
        modelId: 'gemma-2-2b',
        layer: 12,
        index: 1622,
        label: 'cached feature',
        cached: true,
        cachedAt: '2025-01-10T12:00:00.000Z',
        stale: false,
      };

      vi.mocked(neuronpediaService.getFeature).mockResolvedValue(mockFeature);

      const res = await app.request('/api/features/gemma-2-2b/12/1622');
      const json = (await res.json()) as FeatureResponse;

      expect(res.status).toBe(200);
      expect(json.cached).toBe(true);
      expect(json.cachedAt).toBeDefined();
    });

    it('indicates stale cache in response', async () => {
      const mockFeature = {
        modelId: 'gemma-2-2b',
        layer: 12,
        index: 1622,
        label: 'stale feature',
        cached: true,
        cachedAt: '2025-01-09T00:00:00.000Z',
        stale: true,
      };

      vi.mocked(neuronpediaService.getFeature).mockResolvedValue(mockFeature);

      const res = await app.request('/api/features/gemma-2-2b/12/1622');
      const json = (await res.json()) as FeatureResponse;

      expect(res.status).toBe(200);
      expect(json.stale).toBe(true);
    });
  });

  describe('POST /api/features/search', () => {
    it('returns search results', async () => {
      const mockResults = [
        { modelId: 'gemma-2-2b', layer: 12, index: 100, score: 0.9 },
        { modelId: 'gemma-2-2b', layer: 12, index: 200, score: 0.8 },
      ];

      vi.mocked(neuronpediaService.searchFeatures).mockResolvedValue(
        mockResults
      );

      const res = await app.request('/api/features/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query', limit: 20 }),
      });
      const json = (await res.json()) as SearchResponse;

      expect(res.status).toBe(200);
      expect(json.results).toEqual(mockResults);
      expect(json.count).toBe(2);
    });

    it('validates query length', async () => {
      const res = await app.request('/api/features/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'a' }), // Too short
      });

      expect(res.status).toBe(400);
    });

    it('validates limit range', async () => {
      const res = await app.request('/api/features/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', limit: 500 }), // Too high
      });

      expect(res.status).toBe(400);
    });
  });
});
