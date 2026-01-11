import { describe, it, expect } from 'vitest';
import type { GraphData, GraphNode } from '../../graph/types';
import {
  graphToPositionData,
  getNodePosition,
  setNodeColor,
  setNodeScale,
  updateColorsFromActivations,
} from '../../graph/gpu';

function createTestGraph(nodeCount: number): GraphData {
  const nodes = new Map<string, GraphNode>();

  for (let i = 0; i < nodeCount; i++) {
    const id = `test:0:${i}`;
    nodes.set(id, {
      id,
      featureId: { modelId: 'test', layer: 0, index: i },
      position: [i * 1.0, i * 2.0, i * 3.0],
    });
  }

  return {
    nodes,
    edges: new Map(),
    metadata: {
      modelId: 'test',
      layers: [0],
      nodeCount,
      edgeCount: 0,
      createdAt: new Date().toISOString(),
    },
  };
}

describe('graphToPositionData', () => {
  it('converts graph to GPU format', () => {
    const graph = createTestGraph(3);
    const data = graphToPositionData(graph);

    expect(data.positions).toBeInstanceOf(Float32Array);
    expect(data.colors).toBeInstanceOf(Float32Array);
    expect(data.scales).toBeInstanceOf(Float32Array);
    expect(data.positions.length).toBe(9); // 3 nodes * 3 components
    expect(data.colors.length).toBe(9);
    expect(data.scales.length).toBe(3);
    expect(data.nodeIndexMap.size).toBe(3);
  });

  it('preserves node positions', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    // First node at index 0: position [0, 0, 0]
    expect(data.positions[0]).toBe(0);
    expect(data.positions[1]).toBe(0);
    expect(data.positions[2]).toBe(0);

    // Second node at index 1: position [1, 2, 3]
    expect(data.positions[3]).toBe(1);
    expect(data.positions[4]).toBe(2);
    expect(data.positions[5]).toBe(3);
  });

  it('sets default colors to gray', () => {
    const graph = createTestGraph(1);
    const data = graphToPositionData(graph);

    expect(data.colors[0]).toBe(0.5);
    expect(data.colors[1]).toBe(0.5);
    expect(data.colors[2]).toBe(0.5);
  });

  it('sets default scale to 1', () => {
    const graph = createTestGraph(1);
    const data = graphToPositionData(graph);

    expect(data.scales[0]).toBe(1);
  });

  it('handles empty graph', () => {
    const graph = createTestGraph(0);
    const data = graphToPositionData(graph);

    expect(data.positions.length).toBe(0);
    expect(data.colors.length).toBe(0);
    expect(data.scales.length).toBe(0);
    expect(data.nodeIndexMap.size).toBe(0);
  });

  it('maps node IDs to correct indices', () => {
    const graph = createTestGraph(3);
    const data = graphToPositionData(graph);

    expect(data.nodeIndexMap.get('test:0:0')).toBe(0);
    expect(data.nodeIndexMap.get('test:0:1')).toBe(1);
    expect(data.nodeIndexMap.get('test:0:2')).toBe(2);
  });
});

describe('getNodePosition', () => {
  it('returns position for existing node', () => {
    const graph = createTestGraph(3);
    const data = graphToPositionData(graph);

    const pos = getNodePosition(data, 'test:0:1');
    expect(pos).toEqual([1, 2, 3]);
  });

  it('returns null for non-existent node', () => {
    const graph = createTestGraph(3);
    const data = graphToPositionData(graph);

    expect(getNodePosition(data, 'unknown')).toBeNull();
  });

  it('returns correct position for first node', () => {
    const graph = createTestGraph(3);
    const data = graphToPositionData(graph);

    const pos = getNodePosition(data, 'test:0:0');
    expect(pos).toEqual([0, 0, 0]);
  });
});

describe('setNodeColor', () => {
  it('sets color for existing node', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    const result = setNodeColor(data, 'test:0:0', [1, 0, 0]);
    expect(result).toBe(true);
    expect(data.colors[0]).toBe(1);
    expect(data.colors[1]).toBe(0);
    expect(data.colors[2]).toBe(0);
  });

  it('returns false for non-existent node', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    expect(setNodeColor(data, 'unknown', [1, 0, 0])).toBe(false);
  });

  it('does not modify other nodes', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    setNodeColor(data, 'test:0:0', [1, 0, 0]);

    // Second node should still be default gray
    expect(data.colors[3]).toBe(0.5);
    expect(data.colors[4]).toBe(0.5);
    expect(data.colors[5]).toBe(0.5);
  });
});

describe('setNodeScale', () => {
  it('sets scale for existing node', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    const result = setNodeScale(data, 'test:0:1', 2.5);
    expect(result).toBe(true);
    expect(data.scales[1]).toBe(2.5);
  });

  it('returns false for non-existent node', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    expect(setNodeScale(data, 'unknown', 2.5)).toBe(false);
  });

  it('does not modify other nodes', () => {
    const graph = createTestGraph(2);
    const data = graphToPositionData(graph);

    setNodeScale(data, 'test:0:1', 2.5);

    // First node should still be default scale
    expect(data.scales[0]).toBe(1);
  });
});

describe('updateColorsFromActivations', () => {
  it('batch updates colors from activation values', () => {
    const graph = createTestGraph(3);
    const data = graphToPositionData(graph);

    const activations = new Map([
      ['test:0:0', 0.0],
      ['test:0:2', 1.0],
    ]);

    // Simple grayscale color function
    const colorFn = (a: number): [number, number, number] => [a, a, a];

    updateColorsFromActivations(data, activations, colorFn);

    // Node 0: activation 0.0 -> black
    expect(data.colors[0]).toBe(0);
    expect(data.colors[1]).toBe(0);
    expect(data.colors[2]).toBe(0);

    // Node 1: unchanged (default gray)
    expect(data.colors[3]).toBe(0.5);
    expect(data.colors[4]).toBe(0.5);
    expect(data.colors[5]).toBe(0.5);

    // Node 2: activation 1.0 -> white
    expect(data.colors[6]).toBe(1);
    expect(data.colors[7]).toBe(1);
    expect(data.colors[8]).toBe(1);
  });

  it('ignores unknown node IDs', () => {
    const graph = createTestGraph(1);
    const data = graphToPositionData(graph);

    const activations = new Map([['unknown', 1.0]]);
    const colorFn = (a: number): [number, number, number] => [a, a, a];

    // Should not throw
    updateColorsFromActivations(data, activations, colorFn);

    // Original node unchanged
    expect(data.colors[0]).toBe(0.5);
  });

  it('works with custom color function', () => {
    const graph = createTestGraph(1);
    const data = graphToPositionData(graph);

    const activations = new Map([['test:0:0', 0.5]]);
    // Red channel only
    const colorFn = (a: number): [number, number, number] => [a, 0, 0];

    updateColorsFromActivations(data, activations, colorFn);

    expect(data.colors[0]).toBe(0.5);
    expect(data.colors[1]).toBe(0);
    expect(data.colors[2]).toBe(0);
  });
});
