import { describe, it, expect, vi } from 'vitest';
import {
  createGenerationRequest,
  isRetriableError,
  getRetryDelay,
  isTokenEvent,
  isActivationEvent,
  isDoneEvent,
  isErrorEvent,
  DEFAULT_GENERATION_OPTIONS,
} from '../../generation/types';
import type { GenerationError, StreamingGenerationEvent } from '../../generation/types';
import type { SteeringVector } from '../../steering/types';

describe('DEFAULT_GENERATION_OPTIONS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_GENERATION_OPTIONS.maxTokens).toBe(100);
    expect(DEFAULT_GENERATION_OPTIONS.temperature).toBe(0.7);
    expect(DEFAULT_GENERATION_OPTIONS.topP).toBe(0.9);
    expect(DEFAULT_GENERATION_OPTIONS.stream).toBe(true);
    expect(DEFAULT_GENERATION_OPTIONS.returnActivations).toBe(false);
  });
});

describe('createGenerationRequest', () => {
  const mockVector: SteeringVector = {
    features: [],
    modelId: 'gemma-2-2b',
    timestamp: Date.now(),
  };

  it('creates request with default options', () => {
    const request = createGenerationRequest('Hello', mockVector);

    expect(request.prompt).toBe('Hello');
    expect(request.steeringVector).toBe(mockVector);
    expect(request.options.maxTokens).toBe(100);
    expect(request.options.temperature).toBe(0.7);
    expect(request.options.stream).toBe(true);
    expect(request.options.returnActivations).toBe(false);
  });

  it('merges custom options with defaults', () => {
    const request = createGenerationRequest('Hello', mockVector, {
      maxTokens: 50,
      returnActivations: true,
    });

    expect(request.options.maxTokens).toBe(50);
    expect(request.options.temperature).toBe(0.7); // default
    expect(request.options.returnActivations).toBe(true);
  });

  it('overrides all default options', () => {
    const request = createGenerationRequest('Hello', mockVector, {
      maxTokens: 200,
      temperature: 1.0,
      topP: 0.5,
      stopSequences: ['END'],
      stream: false,
      returnActivations: true,
    });

    expect(request.options.maxTokens).toBe(200);
    expect(request.options.temperature).toBe(1.0);
    expect(request.options.topP).toBe(0.5);
    expect(request.options.stopSequences).toEqual(['END']);
    expect(request.options.stream).toBe(false);
    expect(request.options.returnActivations).toBe(true);
  });
});

describe('isRetriableError', () => {
  it('returns true for RATE_LIMITED', () => {
    const error: GenerationError = { type: 'RATE_LIMITED', retryAfter: 60 };
    expect(isRetriableError(error)).toBe(true);
  });

  it('returns true for MODEL_UNAVAILABLE', () => {
    const error: GenerationError = { type: 'MODEL_UNAVAILABLE', message: 'Offline' };
    expect(isRetriableError(error)).toBe(true);
  });

  it('returns true for NETWORK_ERROR', () => {
    const error: GenerationError = { type: 'NETWORK_ERROR', message: 'Timeout' };
    expect(isRetriableError(error)).toBe(true);
  });

  it('returns false for INVALID_STEERING', () => {
    const error: GenerationError = { type: 'INVALID_STEERING', details: 'Too many features' };
    expect(isRetriableError(error)).toBe(false);
  });

  it('returns false for CANCELLED', () => {
    const error: GenerationError = { type: 'CANCELLED' };
    expect(isRetriableError(error)).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('returns retryAfter in milliseconds for RATE_LIMITED', () => {
    const error: GenerationError = { type: 'RATE_LIMITED', retryAfter: 60 };
    expect(getRetryDelay(error)).toBe(60000);
  });

  it('returns 1000ms for other retriable errors', () => {
    const networkError: GenerationError = { type: 'NETWORK_ERROR', message: 'Timeout' };
    expect(getRetryDelay(networkError)).toBe(1000);

    const modelError: GenerationError = { type: 'MODEL_UNAVAILABLE', message: 'Offline' };
    expect(getRetryDelay(modelError)).toBe(1000);
  });

  it('returns 1000ms for non-retriable errors', () => {
    const error: GenerationError = { type: 'INVALID_STEERING', details: 'Bad config' };
    expect(getRetryDelay(error)).toBe(1000);
  });
});

describe('event type guards', () => {
  const tokenEvent: StreamingGenerationEvent = {
    type: 'token',
    data: { token: 'Hello', index: 0 },
  };

  const activationEvent: StreamingGenerationEvent = {
    type: 'activation',
    data: {
      point: {
        tokenIndex: 0,
        token: 'Hello',
        activations: new Map(),
        position: [0, 0, 0],
      },
    },
  };

  const doneEvent: StreamingGenerationEvent = {
    type: 'done',
    data: {
      metadata: {
        modelId: 'gemma-2-2b',
        tokenCount: 10,
        latencyMs: 500,
        finishReason: 'stop',
      },
    },
  };

  const errorEvent: StreamingGenerationEvent = {
    type: 'error',
    data: { message: 'Something went wrong' },
  };

  describe('isTokenEvent', () => {
    it('returns true for token events', () => {
      expect(isTokenEvent(tokenEvent)).toBe(true);
    });

    it('returns false for other events', () => {
      expect(isTokenEvent(activationEvent)).toBe(false);
      expect(isTokenEvent(doneEvent)).toBe(false);
      expect(isTokenEvent(errorEvent)).toBe(false);
    });
  });

  describe('isActivationEvent', () => {
    it('returns true for activation events', () => {
      expect(isActivationEvent(activationEvent)).toBe(true);
    });

    it('returns false for other events', () => {
      expect(isActivationEvent(tokenEvent)).toBe(false);
      expect(isActivationEvent(doneEvent)).toBe(false);
      expect(isActivationEvent(errorEvent)).toBe(false);
    });
  });

  describe('isDoneEvent', () => {
    it('returns true for done events', () => {
      expect(isDoneEvent(doneEvent)).toBe(true);
    });

    it('returns false for other events', () => {
      expect(isDoneEvent(tokenEvent)).toBe(false);
      expect(isDoneEvent(activationEvent)).toBe(false);
      expect(isDoneEvent(errorEvent)).toBe(false);
    });
  });

  describe('isErrorEvent', () => {
    it('returns true for error events', () => {
      expect(isErrorEvent(errorEvent)).toBe(true);
    });

    it('returns false for other events', () => {
      expect(isErrorEvent(tokenEvent)).toBe(false);
      expect(isErrorEvent(activationEvent)).toBe(false);
      expect(isErrorEvent(doneEvent)).toBe(false);
    });
  });
});
