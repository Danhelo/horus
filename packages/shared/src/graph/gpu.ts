import type { GraphData } from './types';

/**
 * GPU-friendly position data for 50k+ nodes
 * Uses Float32Array for efficient WebGL buffer transfer
 */
export interface GraphPositionData {
  positions: Float32Array; // [x1,y1,z1, x2,y2,z2, ...]
  colors: Float32Array; // [r1,g1,b1, r2,g2,b2, ...]
  scales: Float32Array; // [s1, s2, ...]
  nodeIndexMap: Map<string, number>; // id -> array index
}

/**
 * Default color (neutral gray)
 */
const DEFAULT_COLOR: [number, number, number] = [0.5, 0.5, 0.5];

/**
 * Default scale
 */
const DEFAULT_SCALE = 1.0;

/**
 * Convert GraphData to GPU-friendly format
 */
export function graphToPositionData(graph: GraphData): GraphPositionData {
  const nodeCount = graph.nodes.size;

  const positions = new Float32Array(nodeCount * 3);
  const colors = new Float32Array(nodeCount * 3);
  const scales = new Float32Array(nodeCount);
  const nodeIndexMap = new Map<string, number>();

  let index = 0;
  for (const [id, node] of graph.nodes) {
    const i3 = index * 3;

    // Position
    positions[i3] = node.position[0];
    positions[i3 + 1] = node.position[1];
    positions[i3 + 2] = node.position[2];

    // Default color
    colors[i3] = DEFAULT_COLOR[0];
    colors[i3 + 1] = DEFAULT_COLOR[1];
    colors[i3 + 2] = DEFAULT_COLOR[2];

    // Default scale
    scales[index] = DEFAULT_SCALE;

    // Map ID to index
    nodeIndexMap.set(id, index);

    index++;
  }

  return { positions, colors, scales, nodeIndexMap };
}

/**
 * Get position of a node by ID from GPU data
 */
export function getNodePosition(
  data: GraphPositionData,
  nodeId: string
): [number, number, number] | null {
  const index = data.nodeIndexMap.get(nodeId);
  if (index === undefined) return null;

  const i3 = index * 3;
  return [data.positions[i3], data.positions[i3 + 1], data.positions[i3 + 2]];
}

/**
 * Set color for a specific node
 */
export function setNodeColor(
  data: GraphPositionData,
  nodeId: string,
  color: [number, number, number]
): boolean {
  const index = data.nodeIndexMap.get(nodeId);
  if (index === undefined) return false;

  const i3 = index * 3;
  data.colors[i3] = color[0];
  data.colors[i3 + 1] = color[1];
  data.colors[i3 + 2] = color[2];
  return true;
}

/**
 * Set scale for a specific node
 */
export function setNodeScale(data: GraphPositionData, nodeId: string, scale: number): boolean {
  const index = data.nodeIndexMap.get(nodeId);
  if (index === undefined) return false;

  data.scales[index] = scale;
  return true;
}

/**
 * Batch update colors from activation values
 * activations: Map of nodeId -> activation value (0-1)
 * colorFn: Function to convert activation to RGB
 */
export function updateColorsFromActivations(
  data: GraphPositionData,
  activations: Map<string, number>,
  colorFn: (activation: number) => [number, number, number]
): void {
  for (const [nodeId, activation] of activations) {
    const index = data.nodeIndexMap.get(nodeId);
    if (index === undefined) continue;

    const color = colorFn(activation);
    const i3 = index * 3;
    data.colors[i3] = color[0];
    data.colors[i3 + 1] = color[1];
    data.colors[i3 + 2] = color[2];
  }
}
