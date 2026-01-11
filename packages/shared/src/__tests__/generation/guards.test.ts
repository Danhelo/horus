import { describe, it, expect } from 'vitest';
import {
  isFinishReason,
  isGenerationOptions,
  isGenerationMetadata,
  isGenerationResponse,
  isGenerationRequest,
  isStreamingGenerationEvent,
  isGenerationError,
} from '../../generation/guards';
import type { GenerationOptions, GenerationResponse, GenerationMetadata } from '../../generation/types';

describe('isFinishReason', () => {
  it('validates stop', () => {
    expect(isFinishReason('stop')).toBe(true);
  });

  it('validates max_tokens', () => {
    expect(isFinishReason('max_tokens')).toBe(true);
  });

  it('validates stop_sequence', () => {
    expect(isFinishReason('stop_sequence')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isFinishReason('cancelled')).toBe(false);
    expect(isFinishReason('')).toBe(false);
    expect(isFinishReason(null)).toBe(false);
  });
});

describe('isGenerationOptions', () => {
  const validOptions: GenerationOptions = {
    maxTokens: 100,
    temperature: 0.7,
    stream: true,
    returnActivations: false,
  };

  it('validates correct options', () => {
    expect(isGenerationOptions(validOptions)).toBe(true);
  });

  it('validates with optional fields', () => {
    expect(isGenerationOptions({
      ...validOptions,
      topP: 0.9,
      stopSequences: ['END', 'STOP'],
    })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGenerationOptions(null)).toBe(false);
    expect(isGenerationOptions(undefined)).toBe(false);
  });

  it('rejects non-positive maxTokens', () => {
    expect(isGenerationOptions({ ...validOptions, maxTokens: 0 })).toBe(false);
    expect(isGenerationOptions({ ...validOptions, maxTokens: -1 })).toBe(false);
  });

  it('rejects non-integer maxTokens', () => {
    expect(isGenerationOptions({ ...validOptions, maxTokens: 1.5 })).toBe(false);
  });

  it('rejects invalid temperature range', () => {
    expect(isGenerationOptions({ ...validOptions, temperature: -0.1 })).toBe(false);
    expect(isGenerationOptions({ ...validOptions, temperature: 2.1 })).toBe(false);
  });

  it('rejects invalid topP range', () => {
    expect(isGenerationOptions({ ...validOptions, topP: -0.1 })).toBe(false);
    expect(isGenerationOptions({ ...validOptions, topP: 1.1 })).toBe(false);
  });

  it('rejects non-array stopSequences', () => {
    expect(isGenerationOptions({ ...validOptions, stopSequences: 'END' })).toBe(false);
  });

  it('rejects non-string stopSequences entries', () => {
    expect(isGenerationOptions({ ...validOptions, stopSequences: [123] })).toBe(false);
  });

  it('rejects non-boolean stream', () => {
    expect(isGenerationOptions({ ...validOptions, stream: 'yes' })).toBe(false);
  });

  it('rejects non-boolean returnActivations', () => {
    expect(isGenerationOptions({ ...validOptions, returnActivations: 'yes' })).toBe(false);
  });
});

describe('isGenerationMetadata', () => {
  const validMetadata: GenerationMetadata = {
    modelId: 'gemma-2-2b',
    tokenCount: 50,
    latencyMs: 1200,
    finishReason: 'stop',
  };

  it('validates correct metadata', () => {
    expect(isGenerationMetadata(validMetadata)).toBe(true);
  });

  it('validates zero token count', () => {
    expect(isGenerationMetadata({ ...validMetadata, tokenCount: 0 })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGenerationMetadata(null)).toBe(false);
    expect(isGenerationMetadata(undefined)).toBe(false);
  });

  it('rejects empty modelId', () => {
    expect(isGenerationMetadata({ ...validMetadata, modelId: '' })).toBe(false);
  });

  it('rejects negative tokenCount', () => {
    expect(isGenerationMetadata({ ...validMetadata, tokenCount: -1 })).toBe(false);
  });

  it('rejects non-integer tokenCount', () => {
    expect(isGenerationMetadata({ ...validMetadata, tokenCount: 1.5 })).toBe(false);
  });

  it('rejects negative latencyMs', () => {
    expect(isGenerationMetadata({ ...validMetadata, latencyMs: -1 })).toBe(false);
  });

  it('rejects invalid finishReason', () => {
    expect(isGenerationMetadata({ ...validMetadata, finishReason: 'cancelled' })).toBe(false);
  });
});

describe('isGenerationResponse', () => {
  const validResponse: GenerationResponse = {
    text: 'Hello world',
    tokens: ['Hello', ' world'],
    metadata: {
      modelId: 'gemma-2-2b',
      tokenCount: 2,
      latencyMs: 500,
      finishReason: 'stop',
    },
  };

  it('validates correct response', () => {
    expect(isGenerationResponse(validResponse)).toBe(true);
  });

  it('validates with activations', () => {
    expect(isGenerationResponse({
      ...validResponse,
      activations: [],
    })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGenerationResponse(null)).toBe(false);
    expect(isGenerationResponse(undefined)).toBe(false);
  });

  it('rejects non-string text', () => {
    expect(isGenerationResponse({ ...validResponse, text: 123 })).toBe(false);
  });

  it('rejects non-array tokens', () => {
    expect(isGenerationResponse({ ...validResponse, tokens: 'string' })).toBe(false);
  });

  it('rejects non-string tokens entries', () => {
    expect(isGenerationResponse({ ...validResponse, tokens: [123] })).toBe(false);
  });

  it('rejects invalid metadata', () => {
    expect(isGenerationResponse({ ...validResponse, metadata: {} })).toBe(false);
  });
});

describe('isGenerationRequest', () => {
  const validRequest = {
    prompt: 'Hello',
    steeringVector: {
      features: [],
      modelId: 'gemma-2-2b',
      timestamp: Date.now(),
    },
    options: {
      maxTokens: 100,
      temperature: 0.7,
      stream: true,
      returnActivations: false,
    },
  };

  it('validates correct request', () => {
    expect(isGenerationRequest(validRequest)).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGenerationRequest(null)).toBe(false);
    expect(isGenerationRequest(undefined)).toBe(false);
  });

  it('rejects non-string prompt', () => {
    expect(isGenerationRequest({ ...validRequest, prompt: 123 })).toBe(false);
  });

  it('rejects null steeringVector', () => {
    expect(isGenerationRequest({ ...validRequest, steeringVector: null })).toBe(false);
  });

  it('rejects invalid options', () => {
    expect(isGenerationRequest({ ...validRequest, options: {} })).toBe(false);
  });
});

describe('isStreamingGenerationEvent', () => {
  it('validates token event', () => {
    expect(isStreamingGenerationEvent({
      type: 'token',
      data: { token: 'Hello', index: 0 },
    })).toBe(true);
  });

  it('validates activation event', () => {
    expect(isStreamingGenerationEvent({
      type: 'activation',
      data: { point: { tokenIndex: 0, token: 'Hi', activations: {}, position: [0, 0, 0] } },
    })).toBe(true);
  });

  it('validates done event', () => {
    expect(isStreamingGenerationEvent({
      type: 'done',
      data: {
        metadata: {
          modelId: 'gemma-2-2b',
          tokenCount: 10,
          latencyMs: 500,
          finishReason: 'stop',
        },
      },
    })).toBe(true);
  });

  it('validates error event', () => {
    expect(isStreamingGenerationEvent({
      type: 'error',
      data: { message: 'Something went wrong' },
    })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isStreamingGenerationEvent(null)).toBe(false);
    expect(isStreamingGenerationEvent(undefined)).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(isStreamingGenerationEvent({
      type: 'invalid',
      data: {},
    })).toBe(false);
  });

  it('rejects missing data', () => {
    expect(isStreamingGenerationEvent({ type: 'token' })).toBe(false);
  });

  it('rejects token event with missing token', () => {
    expect(isStreamingGenerationEvent({
      type: 'token',
      data: { index: 0 },
    })).toBe(false);
  });

  it('rejects error event with missing message', () => {
    expect(isStreamingGenerationEvent({
      type: 'error',
      data: {},
    })).toBe(false);
  });
});

describe('isGenerationError', () => {
  it('validates RATE_LIMITED error', () => {
    expect(isGenerationError({
      type: 'RATE_LIMITED',
      retryAfter: 60,
    })).toBe(true);
  });

  it('validates INVALID_STEERING error', () => {
    expect(isGenerationError({
      type: 'INVALID_STEERING',
      details: 'Too many features',
    })).toBe(true);
  });

  it('validates MODEL_UNAVAILABLE error', () => {
    expect(isGenerationError({
      type: 'MODEL_UNAVAILABLE',
      message: 'Model is offline',
    })).toBe(true);
  });

  it('validates NETWORK_ERROR', () => {
    expect(isGenerationError({
      type: 'NETWORK_ERROR',
      message: 'Connection timeout',
    })).toBe(true);
  });

  it('validates CANCELLED error', () => {
    expect(isGenerationError({
      type: 'CANCELLED',
    })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGenerationError(null)).toBe(false);
    expect(isGenerationError(undefined)).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(isGenerationError({ type: 'UNKNOWN' })).toBe(false);
  });

  it('rejects RATE_LIMITED with negative retryAfter', () => {
    expect(isGenerationError({
      type: 'RATE_LIMITED',
      retryAfter: -1,
    })).toBe(false);
  });

  it('rejects INVALID_STEERING with non-string details', () => {
    expect(isGenerationError({
      type: 'INVALID_STEERING',
      details: 123,
    })).toBe(false);
  });
});
