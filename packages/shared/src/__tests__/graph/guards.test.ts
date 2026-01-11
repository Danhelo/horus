import { describe, it, expect } from 'vitest';
import {
  isFeatureId,
  isPosition,
  isGraphNode,
  isGraphEdge,
  isEdgeType,
  isGraphMetadata,
  isGraphData,
} from '../../graph/guards';
import type { GraphNode, GraphEdge } from '../../graph/types';

describe('isFeatureId', () => {
  it('validates correct FeatureId', () => {
    expect(isFeatureId({ modelId: 'gemma-2-2b', layer: 12, index: 456 })).toBe(true);
  });

  it('validates zero values', () => {
    expect(isFeatureId({ modelId: 'x', layer: 0, index: 0 })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isFeatureId(null)).toBe(false);
    expect(isFeatureId(undefined)).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(isFeatureId({})).toBe(false);
    expect(isFeatureId({ modelId: 'x' })).toBe(false);
    expect(isFeatureId({ modelId: 'x', layer: 1 })).toBe(false);
  });

  it('rejects invalid types', () => {
    expect(isFeatureId({ modelId: 123, layer: 0, index: 0 })).toBe(false);
    expect(isFeatureId({ modelId: 'x', layer: '0', index: 0 })).toBe(false);
  });

  it('rejects negative values', () => {
    expect(isFeatureId({ modelId: 'x', layer: -1, index: 0 })).toBe(false);
    expect(isFeatureId({ modelId: 'x', layer: 0, index: -1 })).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(isFeatureId({ modelId: 'x', layer: 1.5, index: 0 })).toBe(false);
    expect(isFeatureId({ modelId: 'x', layer: 0, index: 1.5 })).toBe(false);
  });
});

describe('isPosition', () => {
  it('validates correct position', () => {
    expect(isPosition([0, 0, 0])).toBe(true);
    expect(isPosition([1.5, -2.3, 4.7])).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isPosition([1, 2])).toBe(false);
    expect(isPosition([1, 2, 3, 4])).toBe(false);
    expect(isPosition([])).toBe(false);
  });

  it('rejects non-array', () => {
    expect(isPosition({ x: 1, y: 2, z: 3 })).toBe(false);
    expect(isPosition('1,2,3')).toBe(false);
  });

  it('rejects non-number elements', () => {
    expect(isPosition(['a', 'b', 'c'])).toBe(false);
    expect(isPosition([1, '2', 3])).toBe(false);
  });

  it('rejects non-finite numbers', () => {
    expect(isPosition([1, NaN, 3])).toBe(false);
    expect(isPosition([1, Infinity, 3])).toBe(false);
    expect(isPosition([1, -Infinity, 3])).toBe(false);
  });
});

describe('isGraphNode', () => {
  const validNode: GraphNode = {
    id: 'gemma-2-2b:12:456',
    featureId: { modelId: 'gemma-2-2b', layer: 12, index: 456 },
    position: [1.0, 2.0, 3.0],
  };

  it('validates correct GraphNode', () => {
    expect(isGraphNode(validNode)).toBe(true);
  });

  it('validates GraphNode with optional fields', () => {
    expect(isGraphNode({ ...validNode, label: 'Test' })).toBe(true);
    expect(isGraphNode({ ...validNode, category: 'emotion' })).toBe(true);
    expect(isGraphNode({ ...validNode, label: 'Test', category: 'emotion' })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGraphNode(null)).toBe(false);
    expect(isGraphNode(undefined)).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isGraphNode({ ...validNode, id: '' })).toBe(false);
  });

  it('rejects invalid featureId', () => {
    expect(isGraphNode({ ...validNode, featureId: null })).toBe(false);
    expect(isGraphNode({ ...validNode, featureId: {} })).toBe(false);
  });

  it('rejects invalid position', () => {
    expect(isGraphNode({ ...validNode, position: [1, 2] })).toBe(false);
  });

  it('rejects invalid optional fields', () => {
    expect(isGraphNode({ ...validNode, label: 123 })).toBe(false);
    expect(isGraphNode({ ...validNode, category: 123 })).toBe(false);
  });
});

describe('isEdgeType', () => {
  it('validates valid edge types', () => {
    expect(isEdgeType('coactivation')).toBe(true);
    expect(isEdgeType('attention')).toBe(true);
    expect(isEdgeType('circuit')).toBe(true);
  });

  it('rejects invalid edge types', () => {
    expect(isEdgeType('unknown')).toBe(false);
    expect(isEdgeType('')).toBe(false);
    expect(isEdgeType(123)).toBe(false);
    expect(isEdgeType(null)).toBe(false);
  });
});

describe('isGraphEdge', () => {
  const validEdge: GraphEdge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    weight: 0.75,
    type: 'coactivation',
  };

  it('validates correct GraphEdge', () => {
    expect(isGraphEdge(validEdge)).toBe(true);
  });

  it('validates edge weights at boundaries', () => {
    expect(isGraphEdge({ ...validEdge, weight: 0 })).toBe(true);
    expect(isGraphEdge({ ...validEdge, weight: 1 })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGraphEdge(null)).toBe(false);
    expect(isGraphEdge(undefined)).toBe(false);
  });

  it('rejects invalid weight', () => {
    expect(isGraphEdge({ ...validEdge, weight: -0.1 })).toBe(false);
    expect(isGraphEdge({ ...validEdge, weight: 1.1 })).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(isGraphEdge({ ...validEdge, type: 'invalid' })).toBe(false);
  });

  it('rejects empty ids', () => {
    expect(isGraphEdge({ ...validEdge, id: '' })).toBe(false);
    expect(isGraphEdge({ ...validEdge, source: '' })).toBe(false);
    expect(isGraphEdge({ ...validEdge, target: '' })).toBe(false);
  });
});

describe('isGraphMetadata', () => {
  const validMetadata = {
    modelId: 'gemma-2-2b',
    layers: [0, 1, 2],
    nodeCount: 1000,
    edgeCount: 500,
    createdAt: '2025-01-10T00:00:00Z',
  };

  it('validates correct GraphMetadata', () => {
    expect(isGraphMetadata(validMetadata)).toBe(true);
  });

  it('validates empty layers array', () => {
    expect(isGraphMetadata({ ...validMetadata, layers: [] })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isGraphMetadata(null)).toBe(false);
    expect(isGraphMetadata(undefined)).toBe(false);
  });

  it('rejects invalid layers', () => {
    expect(isGraphMetadata({ ...validMetadata, layers: [1.5] })).toBe(false);
    expect(isGraphMetadata({ ...validMetadata, layers: ['a'] })).toBe(false);
  });
});

describe('isGraphData', () => {
  const validNode: GraphNode = {
    id: 'test:0:0',
    featureId: { modelId: 'test', layer: 0, index: 0 },
    position: [0, 0, 0],
  };

  const validEdge: GraphEdge = {
    id: 'edge-1',
    source: 'test:0:0',
    target: 'test:0:1',
    weight: 0.5,
    type: 'coactivation',
  };

  const validGraphData = {
    nodes: new Map([['test:0:0', validNode]]),
    edges: new Map([['edge-1', validEdge]]),
    metadata: {
      modelId: 'test',
      layers: [0],
      nodeCount: 1,
      edgeCount: 1,
      createdAt: '2025-01-10T00:00:00Z',
    },
  };

  it('validates correct GraphData', () => {
    expect(isGraphData(validGraphData)).toBe(true);
  });

  it('validates empty maps', () => {
    expect(isGraphData({
      nodes: new Map(),
      edges: new Map(),
      metadata: { ...validGraphData.metadata, nodeCount: 0, edgeCount: 0 },
    })).toBe(true);
  });

  it('rejects non-Map nodes/edges', () => {
    expect(isGraphData({ ...validGraphData, nodes: {} })).toBe(false);
    expect(isGraphData({ ...validGraphData, edges: [] })).toBe(false);
  });

  it('rejects invalid node in map', () => {
    const badNodes = new Map([['bad', { id: '' }]]);
    expect(isGraphData({ ...validGraphData, nodes: badNodes })).toBe(false);
  });

  it('rejects invalid edge in map', () => {
    const badEdges = new Map([['bad', { id: '', source: '', target: '', weight: 2, type: 'bad' }]]);
    expect(isGraphData({ ...validGraphData, edges: badEdges })).toBe(false);
  });
});
