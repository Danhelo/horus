/**
 * Steering Slice
 *
 * Manages the steering vector computed from dial values.
 * The steering vector is used by the Neuronpedia API to
 * influence model generation.
 */

import type { StateCreator } from 'zustand';
import type { SteeringVector, SteeringConfig, DialConflict, Dial } from '@horus/shared';
import { DEFAULT_STEERING_CONFIG } from '@horus/shared';

import { computeSteeringVector } from '../../utils/steeringComputation';
import { detectConflicts } from '../../utils/conflictDetection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SteeringSlice {
  // State
  vector: SteeringVector | null;
  config: SteeringConfig;
  isStale: boolean;
  conflicts: DialConflict[];
  lastComputedAt: number | null;

  // Actions
  recompute: () => void;
  setConfig: (config: Partial<SteeringConfig>) => void;
  clear: () => void;
  markStale: () => void;
}

// ---------------------------------------------------------------------------
// Slice Creator
// ---------------------------------------------------------------------------

/**
 * Creates the steering slice.
 *
 * Note: This slice depends on the MixerSlice for dial state.
 * The slice creator receives a getDials function that retrieves
 * the current dials from the parent store.
 */
export const createSteeringSlice: StateCreator<
  SteeringSlice & { dials: Map<string, Dial> },
  [],
  [],
  SteeringSlice
> = (set, get) => ({
  // Initial state
  vector: null,
  config: { ...DEFAULT_STEERING_CONFIG },
  isStale: false,
  conflicts: [],
  lastComputedAt: null,

  // Actions
  recompute: () => {
    const { dials, config } = get();

    // Compute the new steering vector
    const vector = computeSteeringVector(dials, config);

    // Detect any conflicts between dials
    const conflicts = detectConflicts(dials);

    set({
      vector: vector.features.length > 0 ? vector : null,
      conflicts,
      isStale: false,
      lastComputedAt: Date.now(),
    });
  },

  setConfig: (partialConfig) => {
    const newConfig = { ...get().config, ...partialConfig };
    set({ config: newConfig, isStale: true });
  },

  clear: () => {
    set({
      vector: null,
      conflicts: [],
      isStale: false,
      lastComputedAt: null,
    });
  },

  markStale: () => {
    set({ isStale: true });
  },
});

// ---------------------------------------------------------------------------
// Subscription Setup
// ---------------------------------------------------------------------------

/**
 * Debounce delay for steering recomputation (ms)
 * This prevents excessive recomputation during rapid dial changes
 */
export const STEERING_RECOMPUTE_DEBOUNCE_MS = 50;

/**
 * Creates a debounced recompute function for use in store subscriptions
 */
export function createDebouncedRecompute(
  recompute: () => void,
  delayMs: number = STEERING_RECOMPUTE_DEBOUNCE_MS
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      recompute();
      timeoutId = null;
    }, delayMs);
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Selector to check if steering is active (has non-empty vector)
 */
export function selectIsSteeringActive(state: SteeringSlice): boolean {
  return state.vector !== null && state.vector.features.length > 0;
}

/**
 * Selector to get total steering magnitude
 */
export function selectSteeringMagnitude(state: SteeringSlice): number {
  if (!state.vector) return 0;
  return state.vector.features.reduce((sum, f) => sum + Math.abs(f.strength), 0);
}

/**
 * Selector to get conflict count by severity
 */
export function selectConflictCounts(state: SteeringSlice): {
  low: number;
  medium: number;
  high: number;
} {
  const counts = { low: 0, medium: 0, high: 0 };
  for (const conflict of state.conflicts) {
    counts[conflict.severity]++;
  }
  return counts;
}

/**
 * Selector to check if there are any high-severity conflicts
 */
export function selectHasHighSeverityConflicts(state: SteeringSlice): boolean {
  return state.conflicts.some((c) => c.severity === 'high');
}
