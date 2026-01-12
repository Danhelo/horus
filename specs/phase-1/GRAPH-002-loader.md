# GRAPH-002: Graph Loader

| Field       | Value             |
| ----------- | ----------------- |
| **Spec ID** | GRAPH-002         |
| **Phase**   | 1 - Static Viewer |
| **Status**  | Complete          |
| **Package** | `@horus/frontend` |

## Summary

Load graph data from JSON files and convert it to the internal GraphData structure and GPU-optimized formats. Handle large datasets (50k+ nodes) efficiently with streaming and chunked processing.

## Requirements

### REQ-1: JSON File Loading

Load graph data from static JSON files or API responses.

```typescript
interface GraphJSONSchema {
  metadata: {
    modelId: string;
    layers: number[];
    version: string;
  };
  nodes: Array<{
    id: string;
    featureId: { modelId: string; layer: number; index: number };
    position: [number, number, number];
    label?: string;
    category?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    weight: number;
    type: 'coactivation' | 'attention' | 'circuit';
  }>;
}
```

**Acceptance Criteria:**

- [x] `loadGraphFromJSON(json: GraphJSONSchema): GraphData` function implemented
- [x] Validates JSON schema with Zod before parsing
- [x] Throws descriptive errors for invalid data
- [x] Handles missing optional fields gracefully

### REQ-2: Map-Based Conversion

Convert JSON arrays to Map-based GraphData structure for O(1) lookups.

```typescript
function convertToGraphData(json: GraphJSONSchema): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const node of json.nodes) {
    nodes.set(node.id, node);
  }

  for (const edge of json.edges) {
    edges.set(edge.id, edge);
  }

  return {
    nodes,
    edges,
    metadata: { ...json.metadata, nodeCount: nodes.size, edgeCount: edges.size },
  };
}
```

**Acceptance Criteria:**

- [x] Converts node array to `Map<string, GraphNode>`
- [x] Converts edge array to `Map<string, GraphEdge>`
- [x] Populates metadata with computed nodeCount and edgeCount
- [x] Validates edge source/target IDs exist in nodes Map

### REQ-3: GPU Format Conversion

Convert GraphData to GPU-friendly TypedArrays for Three.js InstancedMesh.

```typescript
function convertToGPUFormat(data: GraphData): GraphPositionData {
  const count = data.nodes.size;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const nodeIndexMap = new Map<string, number>();

  let i = 0;
  for (const [id, node] of data.nodes) {
    nodeIndexMap.set(id, i);
    positions[i * 3] = node.position[0];
    positions[i * 3 + 1] = node.position[1];
    positions[i * 3 + 2] = node.position[2];
    // Default colors (will be updated by activation display)
    colors[i * 3] = 0.3; // R
    colors[i * 3 + 1] = 0.3; // G
    colors[i * 3 + 2] = 0.4; // B
    scales[i] = 1.0;
    i++;
  }

  return { positions, colors, scales, nodeIndexMap };
}
```

**Acceptance Criteria:**

- [x] Creates `Float32Array` for positions (count _ 3) _(via largeDataStore.loadPositionData)\*
- [x] Creates `Float32Array` for colors (count _ 3) _(via largeDataStore.loadPositionData)\*
- [x] Creates `Float32Array` for scales (count) _(via largeDataStore.loadPositionData)_
- [x] Builds `nodeIndexMap` for id -> array index lookup _(via largeDataStore.loadPositionData)_
- [x] Performance: converts 50k nodes in < 150ms _(benchmark test added - ~80-100ms JSON→GraphData, ~5ms GPU conversion)_

### REQ-4: Chunked Loading for Large Files

For files > 5MB, use streaming/chunked processing to avoid blocking the main thread.

```typescript
async function loadLargeGraph(url: string): Promise<GraphData> {
  // Either:
  // 1. Use streaming JSON parser
  // 2. Load in Web Worker
  // 3. Progressive loading with chunks
}
```

**Acceptance Criteria:**

- [x] Files > 5MB are processed without blocking UI _(streaming fetch with ReadableStream)_
- [x] Loading progress is reportable (0-100%) _(loadGraphWithProgress with ProgressCallback)_
- [x] Can cancel in-flight loads _(AbortController pattern in graphLoadingSlice)_
- [x] Memory usage stays reasonable during load _(chunked reading)_

### REQ-5: Loading State Management

Integrate with Zustand store for loading state.

```typescript
interface GraphLoadingState {
  isLoading: boolean;
  progress: number; // 0-100
  error: string | null;
  loadGraph: (source: string | GraphJSONSchema) => Promise<void>;
  cancelLoad: () => void;
}
```

**Acceptance Criteria:**

- [x] `isLoading` reflects current load state
- [x] `progress` updates during chunked loading
- [x] `error` captures and exposes load failures
- [x] `loadGraph` accepts URL string or pre-parsed JSON _(loadGraphFromURL, loadGraphFromJSON)_
- [x] `cancelLoad` aborts in-progress loads cleanly

### REQ-6: Error Handling

Graceful handling of various failure modes.

**Acceptance Criteria:**

- [x] Network errors produce user-friendly messages _(GraphLoadError with NETWORK code)_
- [x] Invalid JSON produces schema validation errors _(Zod validation with formatValidationErrors)_
- [x] Missing required fields are reported with field path _(Zod error path formatting)_
- [x] Partial data (some valid nodes) can optionally be loaded _(invalid edges skipped with warning)_
- [x] Error state clears on retry _(clearError action in slice)_

## Technical Notes

- Use Zod for runtime schema validation
- Consider `oboe.js` or similar for streaming JSON parsing
- For Web Worker approach, use `comlink` for ergonomic API
- Store raw GraphData in Zustand, GPU format in LargeDataStore
- Debounce progress updates to avoid excessive re-renders

## File Structure

```
packages/frontend/src/
├── loaders/
│   ├── graphLoader.ts       # Main loader functions
│   ├── graphSchema.ts       # Zod schemas
│   ├── gpuConverter.ts      # TypedArray conversion
│   └── graphLoader.worker.ts # Optional Web Worker
├── stores/
│   └── slices/graphSlice.ts  # Loading state slice
```

## Dependencies

- [x] GRAPH-001: Graph Data Model (types must be defined first)

## Open Questions

1. Should we support loading from IndexedDB cache?
2. For very large graphs (100k+ nodes), should we implement spatial chunking?
3. Should edge data be loaded lazily (nodes first, edges on demand)?

## Changelog

| Date       | Changes                                                                |
| ---------- | ---------------------------------------------------------------------- |
| 2025-01-10 | Initial draft                                                          |
| 2025-01-10 | Implementation complete - loaders module and graphLoadingSlice created |
| 2025-01-10 | Performance benchmarks added - all criteria complete                   |
