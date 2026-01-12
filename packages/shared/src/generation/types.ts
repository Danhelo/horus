/**
 * Generation types for steered text generation
 * These types define the request/response format for generating text
 * with steering vectors applied.
 */

import type { SteeringVector } from '../steering';
import type { TrajectoryPoint } from '../trajectory';

// ---------------------------------------------------------------------------
// Generation Options
// ---------------------------------------------------------------------------

/**
 * Options controlling the generation process
 */
export interface GenerationOptions {
  /** Maximum number of tokens to generate */
  maxTokens: number;
  /** Sampling temperature (0-2, lower = more deterministic) */
  temperature: number;
  /** Top-p (nucleus) sampling (0-1, lower = more focused) */
  topP?: number;
  /** Stop generation when these sequences are encountered */
  stopSequences?: string[];
  /** Whether to stream tokens as they're generated */
  stream: boolean;
  /** Whether to return activations for each token (for trajectory) */
  returnActivations: boolean;
}

/**
 * Default generation options
 */
export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  maxTokens: 100,
  temperature: 0.7,
  topP: 0.9,
  stream: true,
  returnActivations: false,
};

// ---------------------------------------------------------------------------
// Generation Request/Response
// ---------------------------------------------------------------------------

/**
 * Request to generate steered text
 */
export interface GenerationRequest {
  /** The prompt to complete */
  prompt: string;
  /** Steering vector to apply during generation */
  steeringVector: SteeringVector;
  /** Generation options */
  options: GenerationOptions;
}

/**
 * Reason why generation finished
 */
export type FinishReason = 'stop' | 'max_tokens' | 'stop_sequence';

/**
 * Response from a completed generation
 */
export interface GenerationResponse {
  /** The generated text */
  text: string;
  /** Individual tokens that make up the text */
  tokens: string[];
  /** Trajectory points if returnActivations was true */
  activations?: TrajectoryPoint[];
  /** Metadata about the generation */
  metadata: GenerationMetadata;
}

/**
 * Metadata about a generation
 */
export interface GenerationMetadata {
  /** Model used for generation */
  modelId: string;
  /** Number of tokens generated */
  tokenCount: number;
  /** Time taken to generate in milliseconds */
  latencyMs: number;
  /** Why generation finished */
  finishReason: FinishReason;
}

// ---------------------------------------------------------------------------
// Streaming Events
// ---------------------------------------------------------------------------

/**
 * Event types for streaming generation
 */
export type StreamingEventType = 'token' | 'activation' | 'done' | 'error';

/**
 * A token event during streaming
 */
export interface TokenEvent {
  type: 'token';
  data: {
    /** The generated token */
    token: string;
    /** Token index in the sequence */
    index: number;
  };
}

/**
 * An activation event during streaming (if returnActivations is true)
 */
export interface ActivationEvent {
  type: 'activation';
  data: {
    /** The trajectory point for this token */
    point: TrajectoryPoint;
  };
}

/**
 * Generation completed successfully
 */
export interface DoneEvent {
  type: 'done';
  data: {
    /** Metadata about the completed generation */
    metadata: GenerationMetadata;
  };
}

/**
 * An error occurred during generation
 */
export interface ErrorEvent {
  type: 'error';
  data: {
    /** Error message */
    message: string;
    /** Error code for programmatic handling */
    code?: string;
  };
}

/**
 * Union type of all streaming events
 */
export type StreamingGenerationEvent = TokenEvent | ActivationEvent | DoneEvent | ErrorEvent;

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Rate limited by the API
 */
export interface RateLimitedError {
  type: 'RATE_LIMITED';
  /** Seconds until rate limit resets */
  retryAfter: number;
}

/**
 * Invalid steering configuration
 */
export interface InvalidSteeringError {
  type: 'INVALID_STEERING';
  /** Details about what's wrong with the steering */
  details: string;
}

/**
 * Model is not available
 */
export interface ModelUnavailableError {
  type: 'MODEL_UNAVAILABLE';
  /** Message about why the model is unavailable */
  message: string;
}

/**
 * Network error during request
 */
export interface NetworkError {
  type: 'NETWORK_ERROR';
  /** Description of the network error */
  message: string;
}

/**
 * Generation was cancelled by the user
 */
export interface CancelledError {
  type: 'CANCELLED';
}

/**
 * Union of all generation error types
 */
export type GenerationError =
  | RateLimitedError
  | InvalidSteeringError
  | ModelUnavailableError
  | NetworkError
  | CancelledError;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Create a generation request with default options
 */
export function createGenerationRequest(
  prompt: string,
  steeringVector: SteeringVector,
  options?: Partial<GenerationOptions>
): GenerationRequest {
  return {
    prompt,
    steeringVector,
    options: {
      ...DEFAULT_GENERATION_OPTIONS,
      ...options,
    },
  };
}

/**
 * Check if an error is a retriable error
 */
export function isRetriableError(error: GenerationError): boolean {
  return (
    error.type === 'RATE_LIMITED' ||
    error.type === 'MODEL_UNAVAILABLE' ||
    error.type === 'NETWORK_ERROR'
  );
}

/**
 * Get retry delay for an error (in milliseconds)
 */
export function getRetryDelay(error: GenerationError): number {
  if (error.type === 'RATE_LIMITED') {
    return error.retryAfter * 1000;
  }
  // Default backoff for other retriable errors
  return 1000;
}

/**
 * Type guard for streaming event type
 */
export function isTokenEvent(event: StreamingGenerationEvent): event is TokenEvent {
  return event.type === 'token';
}

export function isActivationEvent(event: StreamingGenerationEvent): event is ActivationEvent {
  return event.type === 'activation';
}

export function isDoneEvent(event: StreamingGenerationEvent): event is DoneEvent {
  return event.type === 'done';
}

export function isErrorEvent(event: StreamingGenerationEvent): event is ErrorEvent {
  return event.type === 'error';
}
