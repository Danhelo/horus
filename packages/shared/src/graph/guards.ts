import type { FeatureId, GraphNode, GraphEdge, EdgeType, GraphData, GraphMetadata } from './types';

const VALID_EDGE_TYPES: EdgeType[] = ['coactivation', 'attention', 'circuit'];

/**
 * Type guard for FeatureId
 */
export function isFeatureId(value: unknown): value is FeatureId {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.modelId === 'string' &&
    typeof obj.layer === 'number' &&
    Number.isInteger(obj.layer) &&
    obj.layer >= 0 &&
    typeof obj.index === 'number' &&
    Number.isInteger(obj.index) &&
    obj.index >= 0
  );
}

/**
 * Type guard for position tuple
 */
export function isPosition(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

/**
 * Type guard for GraphNode
 */
export function isGraphNode(value: unknown): value is GraphNode {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    isFeatureId(obj.featureId) &&
    isPosition(obj.position) &&
    (obj.label === undefined || typeof obj.label === 'string') &&
    (obj.category === undefined || typeof obj.category === 'string')
  );
}

/**
 * Type guard for EdgeType
 */
export function isEdgeType(value: unknown): value is EdgeType {
  return typeof value === 'string' && VALID_EDGE_TYPES.includes(value as EdgeType);
}

/**
 * Type guard for GraphEdge
 */
export function isGraphEdge(value: unknown): value is GraphEdge {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.source === 'string' &&
    obj.source.length > 0 &&
    typeof obj.target === 'string' &&
    obj.target.length > 0 &&
    typeof obj.weight === 'number' &&
    obj.weight >= 0 &&
    obj.weight <= 1 &&
    isEdgeType(obj.type)
  );
}

/**
 * Type guard for GraphMetadata
 */
export function isGraphMetadata(value: unknown): value is GraphMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.modelId === 'string' &&
    Array.isArray(obj.layers) &&
    obj.layers.every((l) => typeof l === 'number' && Number.isInteger(l)) &&
    typeof obj.nodeCount === 'number' &&
    typeof obj.edgeCount === 'number' &&
    typeof obj.createdAt === 'string'
  );
}

/**
 * Type guard for GraphData
 */
export function isGraphData(value: unknown): value is GraphData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (!(obj.nodes instanceof Map) || !(obj.edges instanceof Map)) return false;

  for (const node of obj.nodes.values()) {
    if (!isGraphNode(node)) return false;
  }

  for (const edge of obj.edges.values()) {
    if (!isGraphEdge(edge)) return false;
  }

  return isGraphMetadata(obj.metadata);
}
