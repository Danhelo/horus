import { vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
vi.stubEnv('NEURONPEDIA_API_KEY', 'test-api-key');
vi.stubEnv('DATABASE_URL', ':memory:');
vi.stubEnv('NODE_ENV', 'test');

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock console to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
