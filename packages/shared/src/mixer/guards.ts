import type {
  Dial,
  DialTrace,
  DialGroup,
  TraceHighlight,
  DialPolarity,
} from './types';

const VALID_POLARITIES: DialPolarity[] = ['bipolar', 'unipolar'];

/**
 * Type guard for DialPolarity
 */
export function isDialPolarity(value: unknown): value is DialPolarity {
  return typeof value === 'string' && VALID_POLARITIES.includes(value as DialPolarity);
}

/**
 * Type guard for trace feature entry
 */
export function isTraceFeature(
  value: unknown
): value is { nodeId: string; weight: number } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.nodeId === 'string' &&
    obj.nodeId.length > 0 &&
    typeof obj.weight === 'number' &&
    obj.weight >= 0 &&
    obj.weight <= 1
  );
}

/**
 * Type guard for DialTrace
 */
export function isDialTrace(value: unknown): value is DialTrace {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.features)) return false;
  if (!obj.features.every(isTraceFeature)) return false;
  if (obj.color !== undefined && typeof obj.color !== 'string') return false;

  return true;
}

/**
 * Type guard for Dial
 */
export function isDial(value: unknown): value is Dial {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.label === 'string' &&
    typeof obj.value === 'number' &&
    Number.isFinite(obj.value) &&
    typeof obj.defaultValue === 'number' &&
    Number.isFinite(obj.defaultValue) &&
    isDialPolarity(obj.polarity) &&
    isDialTrace(obj.trace) &&
    typeof obj.locked === 'boolean'
  );
}

/**
 * Type guard for DialGroup
 */
export function isDialGroup(value: unknown): value is DialGroup {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.label === 'string' &&
    Array.isArray(obj.dials) &&
    obj.dials.every((d) => typeof d === 'string') &&
    typeof obj.collapsed === 'boolean'
  );
}

/**
 * Type guard for TraceHighlight
 */
export function isTraceHighlight(value: unknown): value is TraceHighlight {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.dialId === 'string' &&
    obj.dialId.length > 0 &&
    obj.nodeIds instanceof Set &&
    obj.weights instanceof Map &&
    typeof obj.active === 'boolean'
  );
}
