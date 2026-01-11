import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { neuronpediaService } from '../services/neuronpedia';

// Mock the neuronpedia service
vi.mock('../services/neuronpedia', () => ({
  neuronpediaService: {
    steer: vi.fn(),
  },
  GEMMA_CONFIG: {
    modelId: 'gemma-2-2b',
    layers: 26,
    getSourceId: (layer: number) => `${layer}-gemmascope-res-16k`,
    featuresPerLayer: 16384,
    contextSize: 1024,
  },
}));

describe('Generation Routes', () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module cache to get fresh rate limiter state
    vi.resetModules();
    // Re-import with fresh module
    const { generationRoutes } = await import('../routes/generation');
    app = new Hono().route('/api/generation', generationRoutes);
  });

  describe('GET /api/generation/status', () => {
    it('returns service status', async () => {
      const res = await app.request('/api/generation/status');
      const json = (await res.json()) as {
        service: string;
        status: string;
        rateLimit: { limit: number; remaining: number; resetAt: string };
      };

      expect(res.status).toBe(200);
      expect(json.service).toBe('generation');
      expect(json.status).toBe('operational');
      expect(json.rateLimit).toBeDefined();
      expect(json.rateLimit.limit).toBe(10);
    });
  });

  describe('POST /api/generation/generate (non-streaming)', () => {
    it('returns generated text without streaming', async () => {
      const mockResponse = {
        defaultOutput: { text: 'Hello world', logprobs: [0.1] },
        steeredOutput: { text: 'Hello steered world', logprobs: [0.1] },
      };

      vi.mocked(neuronpediaService.steer).mockResolvedValue(mockResponse);

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Say hello',
          steeringVector: {
            features: [
              { source: '12-gemmascope-res-16k', index: 1622, strength: 1.5 },
            ],
            modelId: 'gemma-2-2b',
          },
          options: {
            stream: false,
            maxTokens: 50,
            temperature: 0.7,
          },
        }),
      });

      const json = (await res.json()) as {
        defaultText: string;
        steeredText: string;
        appliedFeatures: number;
      };

      expect(res.status).toBe(200);
      expect(json.defaultText).toBe('Hello world');
      expect(json.steeredText).toBe('Hello steered world');
      expect(json.appliedFeatures).toBe(1);
      expect(neuronpediaService.steer).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Say hello',
          features: [
            expect.objectContaining({
              index: 1622,
              strength: 1.5,
            }),
          ],
        })
      );
    });

    it('skips zero-strength features', async () => {
      const mockResponse = {
        defaultOutput: { text: 'Hello', logprobs: [] },
        steeredOutput: { text: 'Hello', logprobs: [] },
      };

      vi.mocked(neuronpediaService.steer).mockResolvedValue(mockResponse);

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: {
            features: [
              { source: '12-gemmascope-res-16k', index: 100, strength: 0 },
              { source: '12-gemmascope-res-16k', index: 200, strength: 1.0 },
            ],
            modelId: 'gemma-2-2b',
          },
          options: { stream: false },
        }),
      });

      expect(res.status).toBe(200);
      expect(neuronpediaService.steer).toHaveBeenCalledWith(
        expect.objectContaining({
          features: [
            expect.objectContaining({
              index: 200,
              strength: 1.0,
            }),
          ],
        })
      );
    });

    it('validates prompt is required', async () => {
      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: false },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('validates prompt max length', async () => {
      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'a'.repeat(5000), // Too long
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: false },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('validates feature index range', async () => {
      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: {
            features: [
              { source: '12-gemmascope-res-16k', index: 999999, strength: 1.0 },
            ],
            modelId: 'gemma-2-2b',
          },
          options: { stream: false },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('validates feature strength range', async () => {
      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: {
            features: [
              { source: '12-gemmascope-res-16k', index: 100, strength: 200 },
            ],
            modelId: 'gemma-2-2b',
          },
          options: { stream: false },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('validates maxTokens range', async () => {
      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: false, maxTokens: 1000 },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('validates temperature range', async () => {
      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: false, temperature: 5.0 },
        }),
      });

      expect(res.status).toBe(400);
    });

    it('limits number of features', async () => {
      const features = Array.from({ length: 25 }, (_, i) => ({
        source: '12-gemmascope-res-16k',
        index: i,
        strength: 1.0,
      }));

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: { features, modelId: 'gemma-2-2b' },
          options: { stream: false },
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/generation/generate (streaming)', () => {
    it('returns SSE stream with token events', async () => {
      const mockResponse = {
        defaultOutput: { text: 'Hello world', logprobs: [0.1] },
        steeredOutput: { text: 'Hello world', logprobs: [0.1] },
      };

      vi.mocked(neuronpediaService.steer).mockResolvedValue(mockResponse);

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Say hello',
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: true, maxTokens: 50 },
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');

      // Read the stream
      const text = await res.text();

      // Check for token events
      expect(text).toContain('event: token');
      expect(text).toContain('event: done');

      // Verify data format
      const lines = text.split('\n');
      const tokenLine = lines.find((l) => l.startsWith('data:') && l.includes('token'));
      if (tokenLine) {
        const data = JSON.parse(tokenLine.replace('data: ', ''));
        expect(data).toHaveProperty('token');
        expect(data).toHaveProperty('index');
      }
    });

    it('includes done event with finishReason', async () => {
      const mockResponse = {
        defaultOutput: { text: 'Hi', logprobs: [] },
        steeredOutput: { text: 'Hi', logprobs: [] },
      };

      vi.mocked(neuronpediaService.steer).mockResolvedValue(mockResponse);

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hi',
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: true },
        }),
      });

      const text = await res.text();
      expect(text).toContain('event: done');
      expect(text).toContain('finishReason');
      expect(text).toContain('complete');
    });

    it('defaults to streaming when stream option not specified', async () => {
      const mockResponse = {
        defaultOutput: { text: 'Test', logprobs: [] },
        steeredOutput: { text: 'Test', logprobs: [] },
      };

      vi.mocked(neuronpediaService.steer).mockResolvedValue(mockResponse);

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
        }),
      });

      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    });
  });

  describe('Rate limiting', () => {
    it('includes rate limit headers in response', async () => {
      const mockResponse = {
        defaultOutput: { text: 'Hi', logprobs: [] },
        steeredOutput: { text: 'Hi', logprobs: [] },
      };

      vi.mocked(neuronpediaService.steer).mockResolvedValue(mockResponse);

      const res = await app.request('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test',
          steeringVector: { features: [], modelId: 'gemma-2-2b' },
          options: { stream: false },
        }),
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });
});

describe('Tokenizer utility', () => {
  it('tokenizes text into words and whitespace', async () => {
    const { tokenize } = await import('../utils/tokenizer');

    const tokens = tokenize('Hello world!');
    expect(tokens).toEqual(['Hello', ' ', 'world!']);
  });

  it('handles empty text', async () => {
    const { tokenize } = await import('../utils/tokenizer');

    const tokens = tokenize('');
    expect(tokens).toEqual([]);
  });

  it('preserves multiple spaces', async () => {
    const { tokenize } = await import('../utils/tokenizer');

    const tokens = tokenize('Hello  world');
    expect(tokens).toEqual(['Hello', '  ', 'world']);
  });

  it('handles newlines', async () => {
    const { tokenize } = await import('../utils/tokenizer');

    const tokens = tokenize('Hello\nworld');
    expect(tokens).toEqual(['Hello', '\n', 'world']);
  });
});
