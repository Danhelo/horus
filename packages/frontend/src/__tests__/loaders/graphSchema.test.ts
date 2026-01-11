import { describe, it, expect } from 'vitest';
import {
  graphJSONSchema,
  featureIdSchema,
  graphNodeJSONSchema,
  graphEdgeJSONSchema,
  positionSchema,
  formatValidationErrors,
} from '../../loaders/graphSchema';

describe('graphSchema', () => {
  describe('positionSchema', () => {
    it('accepts valid position tuple', () => {
      const result = positionSchema.safeParse([1, 2, 3]);
      expect(result.success).toBe(true);
    });

    it('accepts negative coordinates', () => {
      const result = positionSchema.safeParse([-1.5, 0, 100.5]);
      expect(result.success).toBe(true);
    });

    it('rejects array with wrong length', () => {
      const result = positionSchema.safeParse([1, 2]);
      expect(result.success).toBe(false);
    });

    it('rejects non-finite numbers', () => {
      const result = positionSchema.safeParse([Infinity, 0, 0]);
      expect(result.success).toBe(false);
    });
  });

  describe('featureIdSchema', () => {
    it('accepts valid feature ID', () => {
      const result = featureIdSchema.safeParse({
        modelId: 'gemma-2-2b',
        layer: 12,
        index: 1622,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty modelId', () => {
      const result = featureIdSchema.safeParse({
        modelId: '',
        layer: 12,
        index: 1622,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative layer', () => {
      const result = featureIdSchema.safeParse({
        modelId: 'gemma-2-2b',
        layer: -1,
        index: 1622,
      });
      expect(result.success).toBe(false);
    });

    it('rejects layer > 100', () => {
      const result = featureIdSchema.safeParse({
        modelId: 'gemma-2-2b',
        layer: 101,
        index: 1622,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer layer', () => {
      const result = featureIdSchema.safeParse({
        modelId: 'gemma-2-2b',
        layer: 12.5,
        index: 1622,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('graphNodeJSONSchema', () => {
    it('accepts valid node', () => {
      const result = graphNodeJSONSchema.safeParse({
        id: 'gemma-2-2b:12:1622',
        featureId: { modelId: 'gemma-2-2b', layer: 12, index: 1622 },
        position: [1, 2, 3],
      });
      expect(result.success).toBe(true);
    });

    it('accepts node with optional fields', () => {
      const result = graphNodeJSONSchema.safeParse({
        id: 'gemma-2-2b:12:1622',
        featureId: { modelId: 'gemma-2-2b', layer: 12, index: 1622 },
        position: [1, 2, 3],
        label: 'nostalgia',
        category: 'emotion',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe('nostalgia');
        expect(result.data.category).toBe('emotion');
      }
    });

    it('rejects node with empty id', () => {
      const result = graphNodeJSONSchema.safeParse({
        id: '',
        featureId: { modelId: 'gemma-2-2b', layer: 12, index: 1622 },
        position: [1, 2, 3],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('graphEdgeJSONSchema', () => {
    it('accepts valid edge', () => {
      const result = graphEdgeJSONSchema.safeParse({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        weight: 0.5,
        type: 'coactivation',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all edge types', () => {
      const types = ['coactivation', 'attention', 'circuit'] as const;
      for (const type of types) {
        const result = graphEdgeJSONSchema.safeParse({
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          weight: 0.5,
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects weight > 1', () => {
      const result = graphEdgeJSONSchema.safeParse({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        weight: 1.5,
        type: 'coactivation',
      });
      expect(result.success).toBe(false);
    });

    it('rejects weight < 0', () => {
      const result = graphEdgeJSONSchema.safeParse({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        weight: -0.1,
        type: 'coactivation',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid edge type', () => {
      const result = graphEdgeJSONSchema.safeParse({
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        weight: 0.5,
        type: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('graphJSONSchema', () => {
    const validGraph = {
      metadata: {
        modelId: 'gemma-2-2b',
        layers: [12],
      },
      nodes: [
        {
          id: 'node-1',
          featureId: { modelId: 'gemma-2-2b', layer: 12, index: 0 },
          position: [0, 0, 0],
        },
      ],
      edges: [],
    };

    it('accepts valid graph', () => {
      const result = graphJSONSchema.safeParse(validGraph);
      expect(result.success).toBe(true);
    });

    it('accepts graph with edges', () => {
      const result = graphJSONSchema.safeParse({
        ...validGraph,
        nodes: [
          ...validGraph.nodes,
          {
            id: 'node-2',
            featureId: { modelId: 'gemma-2-2b', layer: 12, index: 1 },
            position: [1, 1, 1],
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            weight: 0.5,
            type: 'coactivation',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects graph with no nodes', () => {
      const result = graphJSONSchema.safeParse({
        ...validGraph,
        nodes: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects graph with empty layers', () => {
      const result = graphJSONSchema.safeParse({
        ...validGraph,
        metadata: { ...validGraph.metadata, layers: [] },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('formats errors with paths', () => {
      // Create a Zod error by triggering validation failure
      const result = graphJSONSchema.safeParse({
        metadata: { modelId: 'test', layers: [] }, // layers must have at least 1
        nodes: [],  // must have at least 1 node
        edges: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatValidationErrors(result.error.errors);
        // Should contain errors for nodes and layers
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted.some((msg) => msg.includes('layers') || msg.includes('nodes'))).toBe(true);
      }
    });

    it('formats errors without paths', () => {
      // Create a simple validation error for a primitive
      const simpleSchema = positionSchema;
      const result = simpleSchema.safeParse([1, 2]); // Should fail (needs 3 elements)
      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatValidationErrors(result.error.errors);
        expect(formatted.length).toBeGreaterThan(0);
      }
    });
  });
});
