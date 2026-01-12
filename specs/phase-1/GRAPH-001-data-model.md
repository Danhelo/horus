# GRAPH-001: Graph Data Model

| Field       | Value             |
| ----------- | ----------------- |
| **Spec ID** | GRAPH-001         |
| **Phase**   | 1 - Static Viewer |
| **Status**  | Complete          |
| **Package** | `@horus/shared`   |

## Summary

Define the data structures for representing SAE feature graphs, including nodes (features), edges (relationships), and position data for 3D visualization.

## Requirements

### REQ-1: Node Structure

```typescript
interface GraphNode {
  id: string; // Unique identifier
  featureId: {
    modelId: string; // e.g., 'gemma-2-2b'
    layer: number; // 0-25 for Gemma-2-2B
    index: number; // Feature index within layer
  };
  position: [number, number, number]; // UMAP coordinates
  label?: string; // Human-readable label
  category?: string; // Semantic category
}
```

**Acceptance Criteria:**

- [x] Node interface defined in `@horus/shared`
- [x] Type guards for runtime validation
- [x] Unit tests for type validation

### REQ-2: Edge Structure

```typescript
interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  weight: number; // 0-1, connection strength
  type: 'coactivation' | 'attention' | 'circuit';
}
```

**Acceptance Criteria:**

- [x] Edge interface defined
- [x] Edges are directional (source -> target)

### REQ-3: Graph Container

```typescript
interface GraphData {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  metadata: {
    modelId: string;
    layers: number[];
    nodeCount: number;
    edgeCount: number;
    createdAt: string;
  };
}
```

**Acceptance Criteria:**

- [x] Graph container holds both nodes and edges
- [x] Metadata includes model information
- [x] Efficient lookup by ID (Map, not Array)

### REQ-4: Position Data for GPU

For 50k+ nodes, positions should be in GPU-friendly format:

```typescript
interface GraphPositionData {
  positions: Float32Array; // [x1,y1,z1, x2,y2,z2, ...]
  colors: Float32Array; // [r1,g1,b1, r2,g2,b2, ...]
  scales: Float32Array; // [s1, s2, ...]
  nodeIndexMap: Map<string, number>; // id -> array index
}
```

**Acceptance Criteria:**

- [x] TypedArrays for efficient memory/GPU transfer
- [x] Index map for looking up node positions by ID
- [x] Utility functions to convert between Graph and GPU formats

## Technical Notes

- Use `Float32Array` for GPU data (Three.js compatibility)
- Node IDs should be `${modelId}:${layer}:${index}` format
- UMAP coordinates are pre-computed, not calculated at runtime
- Consider chunked loading for large graphs (50k+ nodes)

## Dependencies

- None (foundational data structures)

## Open Questions

1. Should edges be pre-filtered by weight threshold?
2. Include attention edges or only SAE coactivation?

## Changelog

| Date       | Changes                                               |
| ---------- | ----------------------------------------------------- |
| 2025-01-10 | Initial draft                                         |
| 2025-01-10 | Implementation complete - all acceptance criteria met |
