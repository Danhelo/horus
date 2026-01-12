/**
 * Steering State Serialization
 *
 * Utilities for saving and loading steering state (dial values + config).
 * This enables sharing steering configurations as shareable links or
 * saving them to localStorage.
 */

import type { Dial, SteeringConfig, SerializedSteeringState } from '@horus/shared';
import { DEFAULT_STEERING_CONFIG } from '@horus/shared';

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serializes the current steering state (dial values + config) to a JSON string.
 *
 * This serializes:
 * - All dial values (not traces - those are computed from feature search)
 * - The steering config
 *
 * @param dials - Map of dial IDs to Dial objects
 * @param config - Current steering configuration
 * @returns JSON string representation of the state
 */
export function serializeSteeringState(dials: Map<string, Dial>, config: SteeringConfig): string {
  const state: SerializedSteeringState = {
    version: 1,
    dials: Array.from(dials.values())
      .filter((d) => d.value !== d.defaultValue) // Only include modified dials
      .map((d) => ({
        id: d.id,
        value: d.value,
      })),
    config,
  };

  return JSON.stringify(state);
}

/**
 * Serializes steering state to a compact base64 URL-safe string.
 * Useful for shareable links.
 *
 * @param dials - Map of dial IDs to Dial objects
 * @param config - Current steering configuration
 * @returns Base64 URL-safe string
 */
export function serializeSteeringStateToBase64(
  dials: Map<string, Dial>,
  config: SteeringConfig
): string {
  const json = serializeSteeringState(dials, config);
  // Use URL-safe base64 encoding
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

/**
 * Error thrown when deserialization fails
 */
export class SteeringDeserializationError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_JSON' | 'INVALID_VERSION' | 'INVALID_STRUCTURE'
  ) {
    super(message);
    this.name = 'SteeringDeserializationError';
  }
}

/**
 * Deserializes a JSON string to a SerializedSteeringState object.
 *
 * @param json - JSON string to deserialize
 * @returns Parsed steering state
 * @throws SteeringDeserializationError if the JSON is invalid
 */
export function deserializeSteeringState(json: string): SerializedSteeringState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SteeringDeserializationError('Invalid JSON format', 'INVALID_JSON');
  }

  // Validate structure
  if (!parsed || typeof parsed !== 'object') {
    throw new SteeringDeserializationError('Expected an object', 'INVALID_STRUCTURE');
  }

  const obj = parsed as Record<string, unknown>;

  // Validate version
  if (obj.version !== 1) {
    throw new SteeringDeserializationError(
      `Unsupported version: ${obj.version}`,
      'INVALID_VERSION'
    );
  }

  // Validate dials array
  if (!Array.isArray(obj.dials)) {
    throw new SteeringDeserializationError('Missing or invalid dials array', 'INVALID_STRUCTURE');
  }

  const dials: Array<{ id: string; value: number }> = [];
  for (const dial of obj.dials) {
    if (!dial || typeof dial !== 'object') {
      throw new SteeringDeserializationError('Invalid dial entry', 'INVALID_STRUCTURE');
    }
    const d = dial as Record<string, unknown>;
    if (typeof d.id !== 'string' || typeof d.value !== 'number') {
      throw new SteeringDeserializationError(
        'Dial must have id (string) and value (number)',
        'INVALID_STRUCTURE'
      );
    }
    dials.push({ id: d.id, value: d.value });
  }

  // Validate config (with defaults)
  const config = validateAndMergeConfig(obj.config);

  return {
    version: 1,
    dials,
    config,
  };
}

/**
 * Deserializes a base64 URL-safe string to a SerializedSteeringState.
 *
 * @param base64 - Base64 URL-safe string
 * @returns Parsed steering state
 * @throws SteeringDeserializationError if invalid
 */
export function deserializeSteeringStateFromBase64(base64: string): SerializedSteeringState {
  try {
    // Restore standard base64 characters
    const standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = standardBase64 + '==='.slice((standardBase64.length + 3) % 4);
    const json = atob(padded);
    return deserializeSteeringState(json);
  } catch (error) {
    if (error instanceof SteeringDeserializationError) {
      throw error;
    }
    throw new SteeringDeserializationError('Invalid base64 encoding', 'INVALID_JSON');
  }
}

// ---------------------------------------------------------------------------
// Config Validation
// ---------------------------------------------------------------------------

/**
 * Validates a config object and merges with defaults.
 */
function validateAndMergeConfig(config: unknown): SteeringConfig {
  if (!config || typeof config !== 'object') {
    return { ...DEFAULT_STEERING_CONFIG };
  }

  const c = config as Record<string, unknown>;

  return {
    method: c.method === 'SIMPLE_ADDITIVE' ? 'SIMPLE_ADDITIVE' : DEFAULT_STEERING_CONFIG.method,
    maxFeatures:
      typeof c.maxFeatures === 'number' && c.maxFeatures > 0
        ? Math.min(c.maxFeatures, 100)
        : DEFAULT_STEERING_CONFIG.maxFeatures,
    strengthMultiplier:
      typeof c.strengthMultiplier === 'number'
        ? c.strengthMultiplier
        : DEFAULT_STEERING_CONFIG.strengthMultiplier,
    clampRange: isValidClampRange(c.clampRange)
      ? (c.clampRange as [number, number])
      : DEFAULT_STEERING_CONFIG.clampRange,
  };
}

/**
 * Validates that a value is a valid clamp range tuple.
 */
function isValidClampRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    value[0] < value[1]
  );
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/**
 * Applies a serialized steering state to a dials Map.
 * Returns a new Map with updated values.
 *
 * @param dials - Current dials Map
 * @param state - Serialized state to apply
 * @returns New Map with applied values
 */
export function applySerializedState(
  dials: Map<string, Dial>,
  state: SerializedSteeringState
): Map<string, Dial> {
  const newDials = new Map(dials);

  // First, reset all dials to default
  for (const [id, dial] of newDials) {
    newDials.set(id, { ...dial, value: dial.defaultValue });
  }

  // Then apply the serialized values
  for (const { id, value } of state.dials) {
    const dial = newDials.get(id);
    if (dial) {
      // Clamp value based on polarity
      const clampedValue =
        dial.polarity === 'bipolar'
          ? Math.max(-1, Math.min(1, value))
          : Math.max(0, Math.min(1, value));
      newDials.set(id, { ...dial, value: clampedValue });
    }
  }

  return newDials;
}

// ---------------------------------------------------------------------------
// LocalStorage Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'horus-steering-state';

/**
 * Saves the current steering state to localStorage.
 *
 * @param dials - Map of dial IDs to Dial objects
 * @param config - Current steering configuration
 */
export function saveSteeringStateToStorage(dials: Map<string, Dial>, config: SteeringConfig): void {
  try {
    const json = serializeSteeringState(dials, config);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    console.warn('Failed to save steering state to localStorage:', error);
  }
}

/**
 * Loads steering state from localStorage.
 *
 * @returns Parsed steering state, or null if not found or invalid
 */
export function loadSteeringStateFromStorage(): SerializedSteeringState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return deserializeSteeringState(json);
  } catch (error) {
    console.warn('Failed to load steering state from localStorage:', error);
    return null;
  }
}

/**
 * Clears saved steering state from localStorage.
 */
export function clearSteeringStateFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear steering state from localStorage:', error);
  }
}
