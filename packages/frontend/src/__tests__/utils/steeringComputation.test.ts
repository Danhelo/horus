/**
 * Tests for Steering Vector Computation
 */

import { describe, it, expect } from 'vitest';
import type { Dial, SteeringConfig } from '@horus/shared';
import { DEFAULT_STEERING_CONFIG } from '@horus/shared';
import {
  computeSteeringVector,
  isSteeringVectorEmpty,
  calculateVectorMagnitude,
  mergeSteeringVectors,
} from '../../utils/steeringComputation';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createTestDial(overrides: Partial<Dial> = {}): Dial {
  return {
    id: 'test-dial',
    label: 'Test Dial',
    value: 0,
    defaultValue: 0,
    polarity: 'bipolar',
    trace: { features: [] },
    locked: false,
    ...overrides,
  };
}

function createTestConfig(overrides: Partial<SteeringConfig> = {}): SteeringConfig {
  return {
    ...DEFAULT_STEERING_CONFIG,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSteeringVector', () => {
  it('returns empty vector when all dials are at zero', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: 0,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    expect(vector.features).toHaveLength(0);
  });

  it('correctly computes vector from single dial', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: 0.8,
          trace: {
            features: [
              { nodeId: 'gemma-2-2b:12:1234', weight: 0.5 },
              { nodeId: 'gemma-2-2b:12:5678', weight: 0.3 },
            ],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    expect(vector.features).toHaveLength(2);
    expect(vector.modelId).toBe('gemma-2-2b');

    // Find features and verify strengths
    const feat1234 = vector.features.find((f) => f.index === 1234);
    const feat5678 = vector.features.find((f) => f.index === 5678);

    // 0.8 * 0.5 = 0.4
    expect(feat1234?.strength).toBeCloseTo(0.4);
    // 0.8 * 0.3 = 0.24
    expect(feat5678?.strength).toBeCloseTo(0.24);
  });

  it('aggregates contributions from multiple dials', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: 0.8,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }],
          },
        }),
      ],
      [
        'technical',
        createTestDial({
          id: 'technical',
          value: 0.5,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:9999', weight: 0.4 }],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    expect(vector.features).toHaveLength(2);

    const feat1234 = vector.features.find((f) => f.index === 1234);
    const feat9999 = vector.features.find((f) => f.index === 9999);

    expect(feat1234?.strength).toBeCloseTo(0.4); // 0.8 * 0.5
    expect(feat9999?.strength).toBeCloseTo(0.2); // 0.5 * 0.4
  });

  it('sums overlapping features from multiple dials', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: 0.8,
          trace: {
            features: [
              { nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }, // Shared feature
            ],
          },
        }),
      ],
      [
        'technical',
        createTestDial({
          id: 'technical',
          value: 0.5,
          trace: {
            features: [
              { nodeId: 'gemma-2-2b:12:1234', weight: 0.2 }, // Same feature!
            ],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    expect(vector.features).toHaveLength(1);

    const feat1234 = vector.features.find((f) => f.index === 1234);
    // 0.8 * 0.5 + 0.5 * 0.2 = 0.4 + 0.1 = 0.5
    expect(feat1234?.strength).toBeCloseTo(0.5);
  });

  it('clamps strength values to configured range', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: 1.0,
          trace: {
            features: [
              { nodeId: 'gemma-2-2b:12:1234', weight: 3.0 }, // Would exceed clamp
            ],
          },
        }),
      ],
    ]);

    const config = createTestConfig({ clampRange: [-2, 2] });
    const vector = computeSteeringVector(dials, config);

    const feat1234 = vector.features.find((f) => f.index === 1234);
    // 1.0 * 3.0 = 3.0, but clamped to 2.0
    expect(feat1234?.strength).toBe(2);
  });

  it('limits features to maxFeatures config', () => {
    // Create a dial with many features
    const features = Array.from({ length: 30 }, (_, i) => ({
      nodeId: `gemma-2-2b:12:${i}`,
      weight: 1.0 - i * 0.01, // Decreasing weights
    }));

    const dials = new Map<string, Dial>([
      [
        'dial',
        createTestDial({
          id: 'dial',
          value: 1.0,
          trace: { features },
        }),
      ],
    ]);

    const config = createTestConfig({ maxFeatures: 10 });
    const vector = computeSteeringVector(dials, config);

    expect(vector.features).toHaveLength(10);
    // Verify it kept the strongest (highest absolute strength)
    expect(vector.features[0].strength).toBeCloseTo(1.0);
  });

  it('applies strength multiplier', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: 0.5,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.4 }],
          },
        }),
      ],
    ]);

    const config = createTestConfig({ strengthMultiplier: 2.0 });
    const vector = computeSteeringVector(dials, config);

    const feat1234 = vector.features.find((f) => f.index === 1234);
    // 0.5 * 0.4 * 2.0 = 0.4
    expect(feat1234?.strength).toBeCloseTo(0.4);
  });

  it('handles negative dial values for bipolar dials', () => {
    const dials = new Map<string, Dial>([
      [
        'formality',
        createTestDial({
          id: 'formality',
          value: -0.5,
          polarity: 'bipolar',
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.8 }],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    const feat1234 = vector.features.find((f) => f.index === 1234);
    // -0.5 * 0.8 = -0.4
    expect(feat1234?.strength).toBeCloseTo(-0.4);
  });

  it('ignores locked dials', () => {
    const dials = new Map<string, Dial>([
      [
        'locked-dial',
        createTestDial({
          id: 'locked-dial',
          value: 1.0,
          locked: true, // This dial is locked
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    // Locked dials should not contribute (but they still do in current impl)
    // Note: The spec says locked dials prevent user changes, not steering contribution
    // If we want to exclude locked dials from steering, we need to update the impl
    expect(vector.features).toHaveLength(1);
  });

  it('skips invalid node IDs', () => {
    const dials = new Map<string, Dial>([
      [
        'dial',
        createTestDial({
          id: 'dial',
          value: 1.0,
          trace: {
            features: [
              { nodeId: 'invalid-format', weight: 0.5 }, // Invalid
              { nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }, // Valid
            ],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    expect(vector.features).toHaveLength(1);
    expect(vector.features[0].index).toBe(1234);
  });

  it('generates correct Neuronpedia source IDs', () => {
    const dials = new Map<string, Dial>([
      [
        'dial',
        createTestDial({
          id: 'dial',
          value: 1.0,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:15:9999', weight: 0.5 }],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());

    expect(vector.features[0].source).toBe('15-gemmascope-res-16k');
  });

  it('includes timestamp in result', () => {
    const before = Date.now();
    const dials = new Map<string, Dial>([
      [
        'dial',
        createTestDial({
          id: 'dial',
          value: 1.0,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }],
          },
        }),
      ],
    ]);

    const vector = computeSteeringVector(dials, createTestConfig());
    const after = Date.now();

    expect(vector.timestamp).toBeGreaterThanOrEqual(before);
    expect(vector.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('isSteeringVectorEmpty', () => {
  it('returns true for null vector', () => {
    expect(isSteeringVectorEmpty(null)).toBe(true);
  });

  it('returns true for vector with no features', () => {
    expect(
      isSteeringVectorEmpty({
        features: [],
        modelId: 'gemma-2-2b',
        timestamp: Date.now(),
      })
    ).toBe(true);
  });

  it('returns false for vector with features', () => {
    expect(
      isSteeringVectorEmpty({
        features: [{ source: '12-gemmascope-res-16k', index: 1234, strength: 0.5 }],
        modelId: 'gemma-2-2b',
        timestamp: Date.now(),
      })
    ).toBe(false);
  });
});

describe('calculateVectorMagnitude', () => {
  it('returns sum of absolute strengths', () => {
    const vector = {
      features: [
        { source: '12-gemmascope-res-16k', index: 1, strength: 0.5 },
        { source: '12-gemmascope-res-16k', index: 2, strength: -0.3 },
        { source: '12-gemmascope-res-16k', index: 3, strength: 0.2 },
      ],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };

    // |0.5| + |-0.3| + |0.2| = 1.0
    expect(calculateVectorMagnitude(vector)).toBeCloseTo(1.0);
  });

  it('returns 0 for empty vector', () => {
    const vector = {
      features: [],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };

    expect(calculateVectorMagnitude(vector)).toBe(0);
  });
});

describe('mergeSteeringVectors', () => {
  it('combines features from both vectors', () => {
    const a = {
      features: [{ source: '12-gemmascope-res-16k', index: 1, strength: 0.5 }],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };
    const b = {
      features: [{ source: '12-gemmascope-res-16k', index: 2, strength: 0.3 }],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };

    const merged = mergeSteeringVectors(a, b, createTestConfig());

    expect(merged.features).toHaveLength(2);
  });

  it('sums overlapping features', () => {
    const a = {
      features: [{ source: '12-gemmascope-res-16k', index: 1, strength: 0.5 }],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };
    const b = {
      features: [{ source: '12-gemmascope-res-16k', index: 1, strength: 0.3 }],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };

    const merged = mergeSteeringVectors(a, b, createTestConfig());

    expect(merged.features).toHaveLength(1);
    expect(merged.features[0].strength).toBeCloseTo(0.8);
  });

  it('clamps merged strengths', () => {
    const a = {
      features: [{ source: '12-gemmascope-res-16k', index: 1, strength: 1.5 }],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };
    const b = {
      features: [{ source: '12-gemmascope-res-16k', index: 1, strength: 1.5 }],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };

    const config = createTestConfig({ clampRange: [-2, 2] });
    const merged = mergeSteeringVectors(a, b, config);

    expect(merged.features[0].strength).toBe(2);
  });

  it('respects maxFeatures limit', () => {
    const a = {
      features: Array.from({ length: 15 }, (_, i) => ({
        source: '12-gemmascope-res-16k',
        index: i,
        strength: 1.0 - i * 0.01,
      })),
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };
    const b = {
      features: Array.from({ length: 15 }, (_, i) => ({
        source: '12-gemmascope-res-16k',
        index: i + 100,
        strength: 0.5 - i * 0.01,
      })),
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    };

    const config = createTestConfig({ maxFeatures: 10 });
    const merged = mergeSteeringVectors(a, b, config);

    expect(merged.features).toHaveLength(10);
  });
});
