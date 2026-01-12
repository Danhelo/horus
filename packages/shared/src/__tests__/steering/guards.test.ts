import { describe, it, expect } from 'vitest';
import {
  isSteeringFeature,
  isSteeringVector,
  isSteeringConfig,
  isConflictSeverity,
  isDialConflict,
  isSteerRequest,
  isSteerResponse,
} from '../../steering/guards';
import type { SteeringVector, SteeringConfig, DialConflict } from '../../steering/types';

describe('isSteeringFeature', () => {
  it('validates correct steering feature', () => {
    expect(
      isSteeringFeature({
        source: '12-gemmascope-res-16k',
        index: 456,
        strength: 1.5,
      })
    ).toBe(true);
  });

  it('validates negative strength', () => {
    expect(
      isSteeringFeature({
        source: '12-gemmascope-res-16k',
        index: 456,
        strength: -1.5,
      })
    ).toBe(true);
  });

  it('validates zero values', () => {
    expect(
      isSteeringFeature({
        source: 'test',
        index: 0,
        strength: 0,
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isSteeringFeature(null)).toBe(false);
    expect(isSteeringFeature(undefined)).toBe(false);
  });

  it('rejects empty source', () => {
    expect(isSteeringFeature({ source: '', index: 0, strength: 0 })).toBe(false);
  });

  it('rejects negative index', () => {
    expect(isSteeringFeature({ source: 'test', index: -1, strength: 0 })).toBe(false);
  });

  it('rejects non-integer index', () => {
    expect(isSteeringFeature({ source: 'test', index: 1.5, strength: 0 })).toBe(false);
  });

  it('rejects non-finite strength', () => {
    expect(isSteeringFeature({ source: 'test', index: 0, strength: NaN })).toBe(false);
    expect(isSteeringFeature({ source: 'test', index: 0, strength: Infinity })).toBe(false);
  });
});

describe('isSteeringVector', () => {
  const validVector: SteeringVector = {
    features: [{ source: '12-gemmascope-res-16k', index: 456, strength: 1.0 }],
    modelId: 'gemma-2-2b',
    timestamp: Date.now(),
  };

  it('validates correct steering vector', () => {
    expect(isSteeringVector(validVector)).toBe(true);
  });

  it('validates empty features array', () => {
    expect(
      isSteeringVector({
        features: [],
        modelId: 'gemma-2-2b',
        timestamp: Date.now(),
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isSteeringVector(null)).toBe(false);
    expect(isSteeringVector(undefined)).toBe(false);
  });

  it('rejects empty modelId', () => {
    expect(isSteeringVector({ ...validVector, modelId: '' })).toBe(false);
  });

  it('rejects invalid feature in array', () => {
    expect(
      isSteeringVector({
        ...validVector,
        features: [{ source: '', index: 0, strength: 0 }],
      })
    ).toBe(false);
  });

  it('rejects non-finite timestamp', () => {
    expect(isSteeringVector({ ...validVector, timestamp: NaN })).toBe(false);
    expect(isSteeringVector({ ...validVector, timestamp: Infinity })).toBe(false);
  });
});

describe('isSteeringConfig', () => {
  const validConfig: SteeringConfig = {
    method: 'SIMPLE_ADDITIVE',
    maxFeatures: 20,
    strengthMultiplier: 1.0,
    clampRange: [-2, 2],
  };

  it('validates correct steering config', () => {
    expect(isSteeringConfig(validConfig)).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isSteeringConfig(null)).toBe(false);
    expect(isSteeringConfig(undefined)).toBe(false);
  });

  it('rejects invalid method', () => {
    expect(isSteeringConfig({ ...validConfig, method: 'INVALID' })).toBe(false);
  });

  it('rejects non-positive maxFeatures', () => {
    expect(isSteeringConfig({ ...validConfig, maxFeatures: 0 })).toBe(false);
    expect(isSteeringConfig({ ...validConfig, maxFeatures: -1 })).toBe(false);
  });

  it('rejects non-integer maxFeatures', () => {
    expect(isSteeringConfig({ ...validConfig, maxFeatures: 1.5 })).toBe(false);
  });

  it('rejects non-finite strengthMultiplier', () => {
    expect(isSteeringConfig({ ...validConfig, strengthMultiplier: NaN })).toBe(false);
  });

  it('rejects invalid clampRange', () => {
    expect(isSteeringConfig({ ...validConfig, clampRange: [2, -2] })).toBe(false); // min > max
    expect(isSteeringConfig({ ...validConfig, clampRange: [1] })).toBe(false);
    expect(isSteeringConfig({ ...validConfig, clampRange: [1, 2, 3] })).toBe(false);
  });
});

describe('isConflictSeverity', () => {
  it('validates low', () => {
    expect(isConflictSeverity('low')).toBe(true);
  });

  it('validates medium', () => {
    expect(isConflictSeverity('medium')).toBe(true);
  });

  it('validates high', () => {
    expect(isConflictSeverity('high')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isConflictSeverity('extreme')).toBe(false);
    expect(isConflictSeverity('')).toBe(false);
    expect(isConflictSeverity(null)).toBe(false);
  });
});

describe('isDialConflict', () => {
  const validConflict: DialConflict = {
    dialIds: ['tone:formality', 'style:casual'],
    conflictingFeatures: [{ featureId: 'gemma-2-2b:12:456', contributions: [0.5, -0.5] }],
    severity: 'medium',
  };

  it('validates correct dial conflict', () => {
    expect(isDialConflict(validConflict)).toBe(true);
  });

  it('validates empty conflicting features', () => {
    expect(
      isDialConflict({
        ...validConflict,
        conflictingFeatures: [],
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isDialConflict(null)).toBe(false);
    expect(isDialConflict(undefined)).toBe(false);
  });

  it('rejects invalid dialIds tuple', () => {
    expect(isDialConflict({ ...validConflict, dialIds: ['only-one'] })).toBe(false);
    expect(isDialConflict({ ...validConflict, dialIds: ['a', 'b', 'c'] })).toBe(false);
    expect(isDialConflict({ ...validConflict, dialIds: [123, 456] })).toBe(false);
  });

  it('rejects invalid conflicting feature', () => {
    expect(
      isDialConflict({
        ...validConflict,
        conflictingFeatures: [{ featureId: 123, contributions: [0.5, -0.5] }],
      })
    ).toBe(false);
    expect(
      isDialConflict({
        ...validConflict,
        conflictingFeatures: [{ featureId: 'test', contributions: [0.5] }],
      })
    ).toBe(false);
  });

  it('rejects invalid severity', () => {
    expect(isDialConflict({ ...validConflict, severity: 'extreme' })).toBe(false);
  });
});

describe('isSteerRequest', () => {
  const validRequest = {
    modelId: 'gemma-2-2b',
    features: [
      { modelId: 'gemma-2-2b', layer: '12-gemmascope-res-16k', index: 456, strength: 1.0 },
    ],
    prompt: 'Hello',
  };

  it('validates correct steer request', () => {
    expect(isSteerRequest(validRequest)).toBe(true);
  });

  it('validates with optional fields', () => {
    expect(
      isSteerRequest({
        ...validRequest,
        temperature: 0.7,
        n_tokens: 100,
        steer_method: 'SIMPLE_ADDITIVE',
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isSteerRequest(null)).toBe(false);
    expect(isSteerRequest(undefined)).toBe(false);
  });

  it('rejects empty modelId', () => {
    expect(isSteerRequest({ ...validRequest, modelId: '' })).toBe(false);
  });

  it('rejects invalid feature in array', () => {
    expect(
      isSteerRequest({
        ...validRequest,
        features: [{ modelId: 123, layer: 'test', index: 0, strength: 0 }],
      })
    ).toBe(false);
  });
});

describe('isSteerResponse', () => {
  const validResponse = {
    defaultOutput: { text: 'Default text', logprobs: [0.1, 0.2] },
    steeredOutput: { text: 'Steered text', logprobs: [0.3, 0.4] },
  };

  it('validates correct steer response', () => {
    expect(isSteerResponse(validResponse)).toBe(true);
  });

  it('validates empty logprobs', () => {
    expect(
      isSteerResponse({
        defaultOutput: { text: '', logprobs: [] },
        steeredOutput: { text: '', logprobs: [] },
      })
    ).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isSteerResponse(null)).toBe(false);
    expect(isSteerResponse(undefined)).toBe(false);
  });

  it('rejects missing output', () => {
    expect(isSteerResponse({ defaultOutput: validResponse.defaultOutput })).toBe(false);
    expect(isSteerResponse({ steeredOutput: validResponse.steeredOutput })).toBe(false);
  });

  it('rejects invalid output format', () => {
    expect(
      isSteerResponse({
        defaultOutput: { text: 123, logprobs: [] },
        steeredOutput: validResponse.steeredOutput,
      })
    ).toBe(false);
  });
});
