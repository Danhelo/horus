import { describe, it, expect, beforeEach } from 'vitest';
import { useLargeDataStore } from '../../stores/largeDataStore';
import type { GraphData } from '@horus/shared';

describe('largeDataStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useLargeDataStore.setState({
      positions: null,
      colors: null,
      scales: null,
      edgePositions: null,
      edgeColors: null,
      nodeIndexMap: new Map(),
      nodeCount: 0,
      edgeCount: 0,
      edgeWeightThreshold: 0.1,
      edgesVisible: true,
    });
  });

  describe('loadPositionData', () => {
    it('creates Float32Array for positions', () => {
      const graphData = createMockGraphData(10, 5);
      useLargeDataStore.getState().loadPositionData(graphData);

      const { positions, nodeCount } = useLargeDataStore.getState();

      expect(positions).toBeInstanceOf(Float32Array);
      expect(positions?.length).toBe(30); // 10 nodes * 3 coords
      expect(nodeCount).toBe(10);
    });

    it('creates Float32Array for colors with default values', () => {
      const graphData = createMockGraphData(10, 5);
      useLargeDataStore.getState().loadPositionData(graphData);

      const { colors } = useLargeDataStore.getState();

      expect(colors).toBeInstanceOf(Float32Array);
      expect(colors?.length).toBe(30); // 10 nodes * 3 RGB

      // Check default inactive color (approximately 0.16, 0.16, 0.23)
      expect(colors?.[0]).toBeCloseTo(0.16, 1);
      expect(colors?.[1]).toBeCloseTo(0.16, 1);
      expect(colors?.[2]).toBeCloseTo(0.23, 1);
    });

    it('creates Float32Array for scales with default value of 1.0', () => {
      const graphData = createMockGraphData(10, 5);
      useLargeDataStore.getState().loadPositionData(graphData);

      const { scales } = useLargeDataStore.getState();

      expect(scales).toBeInstanceOf(Float32Array);
      expect(scales?.length).toBe(10); // 10 nodes
      expect(scales?.[0]).toBe(1.0);
      expect(scales?.[9]).toBe(1.0);
    });

    it('creates nodeIndexMap mapping IDs to indices', () => {
      const graphData = createMockGraphData(10, 5);
      useLargeDataStore.getState().loadPositionData(graphData);

      const { nodeIndexMap } = useLargeDataStore.getState();

      expect(nodeIndexMap.size).toBe(10);
      expect(nodeIndexMap.has('node-0')).toBe(true);
      expect(nodeIndexMap.get('node-0')).toBe(0);
      expect(nodeIndexMap.get('node-9')).toBe(9);
    });

    it('stores node positions correctly', () => {
      const graphData = createMockGraphData(3, 0);
      // Set specific positions
      const nodes = Array.from(graphData.nodes.values());
      nodes[0].position = [1.0, 2.0, 3.0];
      nodes[1].position = [4.0, 5.0, 6.0];
      nodes[2].position = [7.0, 8.0, 9.0];

      useLargeDataStore.getState().loadPositionData(graphData);

      const { positions } = useLargeDataStore.getState();

      expect(positions?.[0]).toBe(1.0);
      expect(positions?.[1]).toBe(2.0);
      expect(positions?.[2]).toBe(3.0);
      expect(positions?.[3]).toBe(4.0);
      expect(positions?.[4]).toBe(5.0);
      expect(positions?.[5]).toBe(6.0);
    });

    it('filters edges by weight threshold', () => {
      const graphData = createMockGraphData(5, 10);
      // Set weights: 5 above threshold, 5 below
      const edges = Array.from(graphData.edges.values());
      edges.forEach((edge, i) => {
        edge.weight = i < 5 ? 0.5 : 0.05; // threshold is 0.1
      });

      useLargeDataStore.getState().loadPositionData(graphData);

      const { edgeCount } = useLargeDataStore.getState();

      expect(edgeCount).toBe(5); // Only edges with weight >= 0.1
    });

    it('creates edge positions for valid edges', () => {
      const graphData = createMockGraphData(3, 2);
      const edges = Array.from(graphData.edges.values());
      edges[0].source = 'node-0';
      edges[0].target = 'node-1';
      edges[0].weight = 0.5;
      edges[1].source = 'node-1';
      edges[1].target = 'node-2';
      edges[1].weight = 0.5;

      useLargeDataStore.getState().loadPositionData(graphData);

      const { edgePositions, edgeCount } = useLargeDataStore.getState();

      expect(edgeCount).toBe(2);
      expect(edgePositions).toBeInstanceOf(Float32Array);
      expect(edgePositions?.length).toBe(12); // 2 edges * 2 points * 3 coords
    });

    it('creates edge colors based on weight', () => {
      const graphData = createMockGraphData(2, 1);
      const edge = Array.from(graphData.edges.values())[0];
      edge.source = 'node-0';
      edge.target = 'node-1';
      edge.weight = 1.0; // Max weight

      useLargeDataStore.getState().loadPositionData(graphData);

      const { edgeColors } = useLargeDataStore.getState();

      expect(edgeColors).toBeInstanceOf(Float32Array);
      // Intensity should be 0.2 + 1.0 * 0.5 = 0.7
      expect(edgeColors?.[0]).toBeCloseTo(0.7, 1);
    });

    it('handles empty nodes gracefully', () => {
      const graphData: GraphData = {
        nodes: new Map(),
        edges: new Map(),
        metadata: {
          modelId: 'test',
          layers: [0],
          nodeCount: 0,
          edgeCount: 0,
          createdAt: new Date().toISOString(),
        },
      };

      useLargeDataStore.getState().loadPositionData(graphData);

      const { nodeCount, edgeCount, positions } = useLargeDataStore.getState();

      expect(nodeCount).toBe(0);
      expect(edgeCount).toBe(0);
      expect(positions?.length).toBe(0);
    });

    it('handles edges with missing nodes (skips them)', () => {
      const graphData = createMockGraphData(2, 2);
      const edges = Array.from(graphData.edges.values());
      edges[0].source = 'node-0';
      edges[0].target = 'node-1';
      edges[0].weight = 0.5;
      edges[1].source = 'node-0';
      edges[1].target = 'non-existent'; // Invalid target
      edges[1].weight = 0.5;

      useLargeDataStore.getState().loadPositionData(graphData);

      const { edgeCount } = useLargeDataStore.getState();

      expect(edgeCount).toBe(1); // Only valid edge counted
    });

    it('correctly handles write index when edges are skipped', () => {
      // This tests the bug fix for the edge loop index issue
      const graphData = createMockGraphData(3, 3);
      const edges = Array.from(graphData.edges.values());
      // First edge: valid
      edges[0].source = 'node-0';
      edges[0].target = 'node-1';
      edges[0].weight = 0.5;
      // Second edge: invalid (will be skipped)
      edges[1].source = 'node-0';
      edges[1].target = 'invalid';
      edges[1].weight = 0.5;
      // Third edge: valid
      edges[2].source = 'node-1';
      edges[2].target = 'node-2';
      edges[2].weight = 0.5;

      useLargeDataStore.getState().loadPositionData(graphData);

      const { edgeCount, edgePositions, edgeColors } = useLargeDataStore.getState();

      expect(edgeCount).toBe(2);
      // Arrays should be trimmed to actual size
      expect(edgePositions?.length).toBe(12); // 2 valid edges * 6 values
      expect(edgeColors?.length).toBe(12);
    });
  });

  describe('updateColors', () => {
    it('replaces color array in store', () => {
      const graphData = createMockGraphData(5, 0);
      useLargeDataStore.getState().loadPositionData(graphData);

      const newColors = new Float32Array(15);
      newColors.fill(0.8);

      useLargeDataStore.getState().updateColors(newColors);

      const { colors } = useLargeDataStore.getState();

      expect(colors).toBe(newColors);
      expect(colors?.[0]).toBeCloseTo(0.8);
    });
  });

  describe('updateScales', () => {
    it('replaces scale array in store', () => {
      const graphData = createMockGraphData(5, 0);
      useLargeDataStore.getState().loadPositionData(graphData);

      const newScales = new Float32Array(5);
      newScales.fill(2.0);

      useLargeDataStore.getState().updateScales(newScales);

      const { scales } = useLargeDataStore.getState();

      expect(scales).toBe(newScales);
      expect(scales?.[0]).toBe(2.0);
    });
  });

  describe('setEdgeWeightThreshold', () => {
    it('updates threshold state', () => {
      useLargeDataStore.getState().setEdgeWeightThreshold(0.5);

      const { edgeWeightThreshold } = useLargeDataStore.getState();

      expect(edgeWeightThreshold).toBe(0.5);
    });
  });

  describe('setEdgesVisible', () => {
    it('updates visibility state', () => {
      expect(useLargeDataStore.getState().edgesVisible).toBe(true);

      useLargeDataStore.getState().setEdgesVisible(false);

      expect(useLargeDataStore.getState().edgesVisible).toBe(false);
    });
  });

  describe('clear', () => {
    it('resets all data to initial state', () => {
      const graphData = createMockGraphData(10, 5);
      useLargeDataStore.getState().loadPositionData(graphData);

      useLargeDataStore.getState().clear();

      const state = useLargeDataStore.getState();

      expect(state.positions).toBeNull();
      expect(state.colors).toBeNull();
      expect(state.scales).toBeNull();
      expect(state.edgePositions).toBeNull();
      expect(state.edgeColors).toBeNull();
      expect(state.nodeIndexMap.size).toBe(0);
      expect(state.nodeCount).toBe(0);
      expect(state.edgeCount).toBe(0);
    });
  });
});

// Helper function to create mock graph data
function createMockGraphData(nodeCount: number, edgeCount: number): GraphData {
  const nodes = new Map();
  const edges = new Map();

  for (let i = 0; i < nodeCount; i++) {
    nodes.set(`node-${i}`, {
      id: `node-${i}`,
      featureId: { modelId: 'test', layer: 0, index: i },
      position: [Math.random() * 100, Math.random() * 100, Math.random() * 100] as [
        number,
        number,
        number,
      ],
    });
  }

  for (let i = 0; i < edgeCount; i++) {
    const sourceIdx = i % nodeCount;
    const targetIdx = (i + 1) % nodeCount;
    edges.set(`edge-${i}`, {
      id: `edge-${i}`,
      source: `node-${sourceIdx}`,
      target: `node-${targetIdx}`,
      weight: 0.5,
      type: 'coactivation' as const,
    });
  }

  return {
    nodes,
    edges,
    metadata: {
      modelId: 'test',
      layers: [0],
      nodeCount,
      edgeCount,
      createdAt: new Date().toISOString(),
    },
  };
}
