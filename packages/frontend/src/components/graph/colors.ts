import * as THREE from 'three';

/**
 * HORUS color palette - Sacred Gold theme
 * @module components/graph/colors
 */

// ---------------------------------------------------------------------------
// Color Constants
// ---------------------------------------------------------------------------

export const HORUS_COLORS = {
  background: '#0a0a0f',      // Cosmic void
  inactive: '#12121a',        // Dormant nodes (very dark)
  lowActivation: '#8b6914',   // Dim gold
  midActivation: '#d4a017',   // Sacred gold
  highActivation: '#ffd700',  // Bright gold
  selected: '#00ffff',        // Cyan highlight
  hovered: '#ff6b6b',         // Warm highlight for hover
  edge: '#ffffff',            // White edges
  edgeActive: '#ffd700',      // Gold for active edges
  // Vicinity highlighting (golden ripple)
  vicinityDepth1: '#ffd700',  // Bright gold for direct neighbors
  vicinityDepth2: '#d4af37',  // Dim gold for neighbors of neighbors
} as const;

// Pre-computed THREE.Color instances for performance
export const COLORS = {
  inactive: new THREE.Color(HORUS_COLORS.inactive),
  lowActivation: new THREE.Color(HORUS_COLORS.lowActivation),
  midActivation: new THREE.Color(HORUS_COLORS.midActivation),
  highActivation: new THREE.Color(HORUS_COLORS.highActivation),
  selected: new THREE.Color(HORUS_COLORS.selected),
  hovered: new THREE.Color(HORUS_COLORS.hovered),
  vicinityDepth1: new THREE.Color(HORUS_COLORS.vicinityDepth1),
  vicinityDepth2: new THREE.Color(HORUS_COLORS.vicinityDepth2),
} as const;

// Vicinity intensity multipliers (how bright the golden ripple is at each depth)
const VICINITY_INTENSITY = {
  1: 0.8,  // Depth 1: 80% intensity
  2: 0.4,  // Depth 2: 40% intensity
} as const;

// ---------------------------------------------------------------------------
// Color Mapping Functions
// ---------------------------------------------------------------------------

/**
 * Map an activation value to a color using the sacred gold gradient.
 * Does NOT create new Color objects - reuses the provided tempColor.
 *
 * @param value - Activation value (typically 0-10, clamped to 0-5 for display)
 * @param isSelected - Whether this node is currently selected
 * @param isHovered - Whether this node is currently hovered
 * @param tempColor - Pre-allocated Color object to write result into
 * @param vicinityDepth - Optional vicinity depth (1 = direct neighbor, 2 = neighbor of neighbor)
 * @returns The tempColor object (for chaining)
 */
export function activationToColor(
  value: number,
  isSelected: boolean,
  isHovered: boolean,
  tempColor: THREE.Color,
  vicinityDepth?: number
): THREE.Color {
  // Selection takes highest priority
  if (isSelected) {
    return tempColor.copy(COLORS.selected);
  }

  // Hover takes second priority
  if (isHovered) {
    return tempColor.copy(COLORS.hovered);
  }

  // Vicinity highlighting (golden ripple)
  if (vicinityDepth === 1) {
    // Bright gold for direct neighbors
    return tempColor.copy(COLORS.vicinityDepth1).multiplyScalar(VICINITY_INTENSITY[1]);
  }
  if (vicinityDepth === 2) {
    // Dim gold for neighbors of neighbors
    return tempColor.copy(COLORS.vicinityDepth2).multiplyScalar(VICINITY_INTENSITY[2]);
  }

  // Inactive nodes
  if (value < 0.01) {
    return tempColor.copy(COLORS.inactive);
  }

  // Normalize activation to 0-1 range (clamp at 5 for display)
  const normalizedValue = Math.min(value / 5, 1);

  // Gold gradient using HSL for smooth transitions
  // Hue: 45 (gold) stays constant
  // Saturation: 0.7 to 0.9 (richer as activation increases)
  // Lightness: 0.25 to 0.55 (brighter as activation increases)
  const hue = 45 / 360; // Gold hue in 0-1 range
  const saturation = 0.7 + normalizedValue * 0.2;
  const lightness = 0.25 + normalizedValue * 0.3;

  return tempColor.setHSL(hue, saturation, lightness);
}

/**
 * Get RGB values for an activation level.
 * Returns values in 0-1 range for Three.js.
 */
export function activationToRGB(
  value: number,
  isSelected: boolean,
  isHovered: boolean
): [number, number, number] {
  const tempColor = new THREE.Color();
  activationToColor(value, isSelected, isHovered, tempColor);
  return [tempColor.r, tempColor.g, tempColor.b];
}

/**
 * Map edge weight to opacity.
 * Stronger connections are more visible.
 */
export function edgeWeightToOpacity(weight: number): number {
  // Minimum opacity of 0.05, maximum of 0.4
  return 0.05 + weight * 0.35;
}

/**
 * Update a Float32Array of colors based on activations.
 * Optimized for batch updates of many nodes.
 *
 * @param colors - The Float32Array to update (length = nodeCount * 3)
 * @param activations - Map of nodeId -> activation value
 * @param nodeIndexMap - Map of nodeId -> array index
 * @param selectedIds - Set of selected node IDs
 * @param hoveredId - Currently hovered node ID (or null)
 * @param vicinityMap - Optional map of nodeId -> depth for vicinity highlighting
 */
export function updateNodeColors(
  colors: Float32Array,
  activations: Map<string, number>,
  nodeIndexMap: Map<string, number>,
  selectedIds: Set<string>,
  hoveredId: string | null,
  vicinityMap?: Map<string, number>
): void {
  const tempColor = new THREE.Color();

  for (const [nodeId, index] of nodeIndexMap) {
    const activation = activations.get(nodeId) ?? 0;
    const isSelected = selectedIds.has(nodeId);
    const isHovered = nodeId === hoveredId;
    const vicinityDepth = vicinityMap?.get(nodeId);

    activationToColor(activation, isSelected, isHovered, tempColor, vicinityDepth);

    const offset = index * 3;
    colors[offset] = tempColor.r;
    colors[offset + 1] = tempColor.g;
    colors[offset + 2] = tempColor.b;
  }
}

/**
 * Set default colors for all nodes (inactive state).
 * Used during initial load.
 */
export function setDefaultColors(colors: Float32Array, nodeCount: number): void {
  const r = COLORS.inactive.r;
  const g = COLORS.inactive.g;
  const b = COLORS.inactive.b;

  for (let i = 0; i < nodeCount; i++) {
    const offset = i * 3;
    colors[offset] = r;
    colors[offset + 1] = g;
    colors[offset + 2] = b;
  }
}
