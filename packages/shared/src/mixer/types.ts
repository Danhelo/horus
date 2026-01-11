/**
 * Dial types for the Mixer panel
 * Dials are rotary controls that manipulate feature strengths
 */

/**
 * Trace connecting a dial to features in the graph
 * Shows which nodes are affected when a dial is adjusted
 */
export interface DialTrace {
  /** Features affected by this dial */
  features: Array<{
    /** Graph node ID (format: modelId:layer:index) */
    nodeId: string;
    /** Weight of this feature in the dial's effect (0-1) */
    weight: number;
  }>;
  /** Optional custom color for trace visualization */
  color?: string;
}

/**
 * A single dial control in the mixer
 */
export interface Dial {
  /** Unique identifier for this dial */
  id: string;
  /** Human-readable label displayed on the dial */
  label: string;
  /** Current value of the dial */
  value: number;
  /** Default value (used for reset on double-click) */
  defaultValue: number;
  /** Whether dial ranges from -1 to 1 (bipolar) or 0 to 1 (unipolar) */
  polarity: DialPolarity;
  /** Trace showing which features this dial affects */
  trace: DialTrace;
  /** Whether the dial is locked from user interaction */
  locked: boolean;
}

/**
 * Dial polarity determines the value range
 * - bipolar: -1 to 1 (good for opposing concepts like formal/casual)
 * - unipolar: 0 to 1 (good for presence/absence like "nostalgia")
 */
export type DialPolarity = 'bipolar' | 'unipolar';

/**
 * A group of related dials (e.g., "Emotion", "Style")
 */
export interface DialGroup {
  /** Unique identifier for this group */
  id: string;
  /** Display label for the group */
  label: string;
  /** IDs of dials in this group */
  dials: string[];
  /** Whether the group is collapsed in the UI */
  collapsed: boolean;
}

/**
 * Highlight state for a dial's trace in the graph
 * Used when hovering or adjusting a dial
 */
export interface TraceHighlight {
  /** ID of the dial being highlighted */
  dialId: string;
  /** Set of node IDs to highlight */
  nodeIds: Set<string>;
  /** Weight of each node in the highlight (for intensity) */
  weights: Map<string, number>;
  /** Whether the highlight is currently active */
  active: boolean;
}

/**
 * Create a dial ID from components
 */
export function createDialId(groupId: string, name: string): string {
  return `${groupId}:${name}`;
}

/**
 * Parse a dial ID into components
 */
export function parseDialId(id: string): { groupId: string; name: string } | null {
  const colonIndex = id.indexOf(':');
  if (colonIndex === -1) return null;

  return {
    groupId: id.slice(0, colonIndex),
    name: id.slice(colonIndex + 1),
  };
}

/**
 * Get the min/max values for a dial based on its polarity
 */
export function getDialRange(polarity: DialPolarity): { min: number; max: number } {
  return polarity === 'bipolar'
    ? { min: -1, max: 1 }
    : { min: 0, max: 1 };
}

/**
 * Clamp a value to a dial's valid range
 */
export function clampDialValue(value: number, polarity: DialPolarity): number {
  const { min, max } = getDialRange(polarity);
  return Math.max(min, Math.min(max, value));
}
