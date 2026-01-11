/**
 * Feature identifier within a model
 */
export interface FeatureId {
  modelId: string;    // e.g., 'gemma-2-2b'
  layer: number;      // 0-25 for Gemma-2-2B
  index: number;      // Feature index within layer
}

/**
 * A node in the feature graph representing a single SAE feature
 */
export interface GraphNode {
  id: string;                           // Format: `${modelId}:${layer}:${index}`
  featureId: FeatureId;
  position: [number, number, number];   // UMAP coordinates [x, y, z]
  label?: string;                       // Human-readable label
  category?: string;                    // Semantic category
}

/**
 * Edge types representing different relationships between features
 */
export type EdgeType = 'coactivation' | 'attention' | 'circuit';

/**
 * A directional edge connecting two nodes
 */
export interface GraphEdge {
  id: string;
  source: string;     // Source node ID
  target: string;     // Target node ID
  weight: number;     // 0-1, connection strength
  type: EdgeType;
}

/**
 * Metadata about the graph
 */
export interface GraphMetadata {
  modelId: string;
  layers: number[];       // Which layers are included
  nodeCount: number;
  edgeCount: number;
  createdAt: string;      // ISO timestamp
}

/**
 * Complete graph container with nodes, edges, and metadata
 */
export interface GraphData {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  metadata: GraphMetadata;
}

/**
 * Generate a node ID from feature identifiers
 */
export function createNodeId(modelId: string, layer: number, index: number): string {
  return `${modelId}:${layer}:${index}`;
}

/**
 * Parse a node ID back into feature identifiers
 */
export function parseNodeId(id: string): FeatureId | null {
  const parts = id.split(':');
  if (parts.length < 3) return null;

  const layer = parseInt(parts[parts.length - 2], 10);
  const index = parseInt(parts[parts.length - 1], 10);
  const modelId = parts.slice(0, -2).join(':');

  if (isNaN(layer) || isNaN(index)) return null;

  return { modelId, layer, index };
}
