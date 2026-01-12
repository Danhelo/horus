import type {
  GenerationOptions,
  GenerationRequest,
  GenerationResponse,
  GenerationMetadata,
  FinishReason,
  StreamingGenerationEvent,
  GenerationError,
} from './types';

const VALID_FINISH_REASONS: FinishReason[] = ['stop', 'max_tokens', 'stop_sequence'];
const VALID_EVENT_TYPES = ['token', 'activation', 'done', 'error'];
const VALID_ERROR_TYPES = [
  'RATE_LIMITED',
  'INVALID_STEERING',
  'MODEL_UNAVAILABLE',
  'NETWORK_ERROR',
  'CANCELLED',
];

/**
 * Type guard for FinishReason
 */
export function isFinishReason(value: unknown): value is FinishReason {
  return typeof value === 'string' && VALID_FINISH_REASONS.includes(value as FinishReason);
}

/**
 * Type guard for GenerationOptions
 */
export function isGenerationOptions(value: unknown): value is GenerationOptions {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.maxTokens === 'number' &&
    Number.isInteger(obj.maxTokens) &&
    obj.maxTokens > 0 &&
    typeof obj.temperature === 'number' &&
    obj.temperature >= 0 &&
    obj.temperature <= 2 &&
    (obj.topP === undefined || (typeof obj.topP === 'number' && obj.topP >= 0 && obj.topP <= 1)) &&
    (obj.stopSequences === undefined ||
      (Array.isArray(obj.stopSequences) &&
        obj.stopSequences.every((s) => typeof s === 'string'))) &&
    typeof obj.stream === 'boolean' &&
    typeof obj.returnActivations === 'boolean'
  );
}

/**
 * Type guard for GenerationMetadata
 */
export function isGenerationMetadata(value: unknown): value is GenerationMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.modelId === 'string' &&
    obj.modelId.length > 0 &&
    typeof obj.tokenCount === 'number' &&
    Number.isInteger(obj.tokenCount) &&
    obj.tokenCount >= 0 &&
    typeof obj.latencyMs === 'number' &&
    obj.latencyMs >= 0 &&
    isFinishReason(obj.finishReason)
  );
}

/**
 * Type guard for GenerationResponse
 */
export function isGenerationResponse(value: unknown): value is GenerationResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.text === 'string' &&
    Array.isArray(obj.tokens) &&
    obj.tokens.every((t) => typeof t === 'string') &&
    (obj.activations === undefined || Array.isArray(obj.activations)) &&
    isGenerationMetadata(obj.metadata)
  );
}

/**
 * Type guard for GenerationRequest
 * Note: Full validation of SteeringVector should use steering guards
 */
export function isGenerationRequest(value: unknown): value is GenerationRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.prompt === 'string' &&
    typeof obj.steeringVector === 'object' &&
    obj.steeringVector !== null &&
    isGenerationOptions(obj.options)
  );
}

/**
 * Type guard for StreamingGenerationEvent
 */
export function isStreamingGenerationEvent(value: unknown): value is StreamingGenerationEvent {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.type !== 'string' || !VALID_EVENT_TYPES.includes(obj.type)) {
    return false;
  }

  if (typeof obj.data !== 'object' || obj.data === null) {
    return false;
  }

  const data = obj.data as Record<string, unknown>;

  switch (obj.type) {
    case 'token':
      return (
        typeof data.token === 'string' &&
        typeof data.index === 'number' &&
        Number.isInteger(data.index)
      );
    case 'activation':
      return typeof data.point === 'object' && data.point !== null;
    case 'done':
      return isGenerationMetadata(data.metadata);
    case 'error':
      return typeof data.message === 'string';
    default:
      return false;
  }
}

/**
 * Type guard for GenerationError
 */
export function isGenerationError(value: unknown): value is GenerationError {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.type !== 'string' || !VALID_ERROR_TYPES.includes(obj.type)) {
    return false;
  }

  switch (obj.type) {
    case 'RATE_LIMITED':
      return typeof obj.retryAfter === 'number' && obj.retryAfter >= 0;
    case 'INVALID_STEERING':
      return typeof obj.details === 'string';
    case 'MODEL_UNAVAILABLE':
    case 'NETWORK_ERROR':
      return typeof obj.message === 'string';
    case 'CANCELLED':
      return true;
    default:
      return false;
  }
}
