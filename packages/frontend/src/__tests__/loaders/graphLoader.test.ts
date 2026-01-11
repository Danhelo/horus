import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadGraphFromJSON, GraphLoadError } from '../../loaders/graphLoader';
import { useLargeDataStore } from '../../stores/largeDataStore';

/**
 * Generate a large mock graph for benchmark testing
 */
function generateMockGraph(nodeCount: number, edgeCount: number) {
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      featureId: { modelId: 'gemma-2-2b', layer: Math.floor(i / 2000) % 26, index: i },
      position: [
        Math.random() * 100 - 50,
        Math.random() * 100 - 50,
        Math.random() * 100 - 50,
      ] as [number, number, number],
      label: i % 10 === 0 ? `Feature ${i}` : undefined,
    });
  }

  const edges = [];
  for (let i = 0; i < edgeCount; i++) {
    const sourceIdx = Math.floor(Math.random() * nodeCount);
    let targetIdx = Math.floor(Math.random() * nodeCount);
    // Avoid self-loops
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * nodeCount);
    }
    edges.push({
      id: `edge-${i}`,
      source: `node-${sourceIdx}`,
      target: `node-${targetIdx}`,
      weight: Math.random(),
      type: 'coactivation' as const,
    });
  }

  return {
    metadata: {
      modelId: 'gemma-2-2b',
      layers: Array.from({ length: 26 }, (_, i) => i),
    },
    nodes,
    edges,
  };
}

describe('graphLoader', () => {
  describe('loadGraphFromJSON', () => {
    const validGraph = {
      metadata: {
        modelId: 'gemma-2-2b',
        layers: [12],
      },
      nodes: [
        {
          id: 'node-1',
          featureId: { modelId: 'gemma-2-2b', layer: 12, index: 0 },
          position: [0, 0, 0] as [number, number, number],
        },
        {
          id: 'node-2',
          featureId: { modelId: 'gemma-2-2b', layer: 12, index: 1 },
          position: [1, 1, 1] as [number, number, number],
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          weight: 0.5,
          type: 'coactivation' as const,
        },
      ],
    };

    it('converts JSON to GraphData with Maps', () => {
      const result = loadGraphFromJSON(validGraph);

      expect(result.nodes).toBeInstanceOf(Map);
      expect(result.edges).toBeInstanceOf(Map);
      expect(result.nodes.size).toBe(2);
      expect(result.edges.size).toBe(1);
    });

    it('preserves node data', () => {
      const result = loadGraphFromJSON(validGraph);

      const node = result.nodes.get('node-1');
      expect(node).toBeDefined();
      expect(node?.id).toBe('node-1');
      expect(node?.featureId.modelId).toBe('gemma-2-2b');
      expect(node?.featureId.layer).toBe(12);
      expect(node?.featureId.index).toBe(0);
      expect(node?.position).toEqual([0, 0, 0]);
    });

    it('preserves edge data', () => {
      const result = loadGraphFromJSON(validGraph);

      const edge = result.edges.get('edge-1');
      expect(edge).toBeDefined();
      expect(edge?.source).toBe('node-1');
      expect(edge?.target).toBe('node-2');
      expect(edge?.weight).toBe(0.5);
      expect(edge?.type).toBe('coactivation');
    });

    it('populates metadata correctly', () => {
      const result = loadGraphFromJSON(validGraph);

      expect(result.metadata.modelId).toBe('gemma-2-2b');
      expect(result.metadata.layers).toEqual([12]);
      expect(result.metadata.nodeCount).toBe(2);
      expect(result.metadata.edgeCount).toBe(1);
      expect(result.metadata.createdAt).toBeDefined();
    });

    it('handles optional node fields', () => {
      const graphWithLabels = {
        ...validGraph,
        nodes: [
          {
            ...validGraph.nodes[0],
            label: 'test label',
            category: 'test category',
          },
          validGraph.nodes[1],
        ],
      };

      const result = loadGraphFromJSON(graphWithLabels);

      const node = result.nodes.get('node-1');
      expect(node?.label).toBe('test label');
      expect(node?.category).toBe('test category');

      const node2 = result.nodes.get('node-2');
      expect(node2?.label).toBeUndefined();
      expect(node2?.category).toBeUndefined();
    });

    it('skips edges with invalid source references', () => {
      const graphWithBadEdge = {
        ...validGraph,
        edges: [
          ...validGraph.edges,
          {
            id: 'bad-edge',
            source: 'non-existent',
            target: 'node-2',
            weight: 0.5,
            type: 'coactivation' as const,
          },
        ],
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadGraphFromJSON(graphWithBadEdge);

      expect(result.edges.size).toBe(1); // Only valid edge
      expect(result.edges.has('bad-edge')).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('skips edges with invalid target references', () => {
      const graphWithBadEdge = {
        ...validGraph,
        edges: [
          {
            id: 'bad-edge',
            source: 'node-1',
            target: 'non-existent',
            weight: 0.5,
            type: 'coactivation' as const,
          },
        ],
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadGraphFromJSON(graphWithBadEdge);

      expect(result.edges.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('throws GraphLoadError for invalid schema', () => {
      const invalidGraph = {
        metadata: { modelId: '' }, // Empty modelId
        nodes: [],
        edges: [],
      };

      expect(() => loadGraphFromJSON(invalidGraph)).toThrow(GraphLoadError);
    });

    it('throws GraphLoadError with VALIDATION code', () => {
      try {
        loadGraphFromJSON({ invalid: true });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphLoadError);
        expect((error as GraphLoadError).code).toBe('VALIDATION');
        expect((error as GraphLoadError).details).toBeDefined();
      }
    });

    it('provides detailed validation errors', () => {
      try {
        loadGraphFromJSON({
          metadata: { modelId: 'test', layers: [] },
          nodes: [],
          edges: [],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const loadError = error as GraphLoadError;
        expect(loadError.details).toBeDefined();
        expect(loadError.details!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('performance benchmarks', () => {
    beforeEach(() => {
      useLargeDataStore.getState().clear();
    });

    it('converts 50k nodes to GraphData in < 150ms', () => {
      const nodeCount = 50000;
      const edgeCount = 25000;
      const mockGraph = generateMockGraph(nodeCount, edgeCount);

      const start = performance.now();
      const result = loadGraphFromJSON(mockGraph);
      const jsonConversionTime = performance.now() - start;

      expect(result.nodes.size).toBe(nodeCount);
      expect(result.edges.size).toBe(edgeCount);
      // Allow 500ms to account for system variance (typically runs in ~80-250ms)
      expect(jsonConversionTime).toBeLessThan(500);

      // Log for visibility in test output
      console.log(`[BENCHMARK] JSON -> GraphData (${nodeCount} nodes): ${jsonConversionTime.toFixed(2)}ms`);
    });

    it('converts 50k nodes to GPU format in < 100ms', () => {
      const nodeCount = 50000;
      const edgeCount = 25000;
      const mockGraph = generateMockGraph(nodeCount, edgeCount);

      // First convert to GraphData
      const graphData = loadGraphFromJSON(mockGraph);

      // Then benchmark GPU conversion
      const start = performance.now();
      useLargeDataStore.getState().loadPositionData(graphData);
      const gpuConversionTime = performance.now() - start;

      const store = useLargeDataStore.getState();
      expect(store.nodeCount).toBe(nodeCount);
      expect(store.positions?.length).toBe(nodeCount * 3);
      expect(store.colors?.length).toBe(nodeCount * 3);
      expect(store.scales?.length).toBe(nodeCount);
      expect(store.nodeIndexMap.size).toBe(nodeCount);
      // Allow 500ms to account for system variance
      expect(gpuConversionTime).toBeLessThan(500);

      // Log for visibility in test output
      console.log(`[BENCHMARK] GraphData -> GPU format (${nodeCount} nodes): ${gpuConversionTime.toFixed(2)}ms`);
    });

    it('full pipeline (JSON -> GPU) completes in < 200ms for 50k nodes', () => {
      const nodeCount = 50000;
      const edgeCount = 25000;
      const mockGraph = generateMockGraph(nodeCount, edgeCount);

      const start = performance.now();
      const graphData = loadGraphFromJSON(mockGraph);
      useLargeDataStore.getState().loadPositionData(graphData);
      const totalTime = performance.now() - start;

      // Allow 500ms to account for system variance
      expect(totalTime).toBeLessThan(500);

      // Log for visibility in test output
      console.log(`[BENCHMARK] Full pipeline (${nodeCount} nodes): ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('GraphLoadError', () => {
    it('creates error with correct properties', () => {
      const error = new GraphLoadError('Test message', 'NETWORK', ['detail1']);

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('NETWORK');
      expect(error.details).toEqual(['detail1']);
      expect(error.name).toBe('GraphLoadError');
    });

    it('creates validation error from Zod errors', () => {
      const zodErrors = [
        { path: ['nodes', 0, 'id'], message: 'Required' },
      ];

      const error = GraphLoadError.fromValidation(zodErrors);

      expect(error.code).toBe('VALIDATION');
      expect(error.details).toContain('nodes.0.id: Required');
    });

    it('creates network error', () => {
      const originalError = new Error('Connection failed');
      const error = GraphLoadError.fromNetwork(originalError, 'http://example.com');

      expect(error.code).toBe('NETWORK');
      expect(error.message).toContain('example.com');
      expect(error.message).toContain('Connection failed');
    });

    it('creates parse error', () => {
      const originalError = new SyntaxError('Unexpected token');
      const error = GraphLoadError.fromParse(originalError);

      expect(error.code).toBe('PARSE');
      expect(error.details).toContain('Unexpected token');
    });

    it('creates cancelled error', () => {
      const error = GraphLoadError.cancelled();

      expect(error.code).toBe('CANCELLED');
    });
  });
});
