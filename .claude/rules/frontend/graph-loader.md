# Graph Loader Patterns

## Overview

The graph loader transforms JSON data into the internal GraphData structure and GPU-ready TypedArrays for Three.js rendering.

---

## Data Flow

```
JSON File/API → Zod Validation → GraphData (Maps) → GPU Format (Float32Arrays)
                                      ↓                      ↓
                               Zustand AppStore      LargeDataStore
```

---

## JSON Schema (Zod)

```typescript
import { z } from 'zod';

const featureIdSchema = z.object({
  modelId: z.string(),
  layer: z.number().int().min(0).max(25),
  index: z.number().int().min(0),
});

const graphNodeSchema = z.object({
  id: z.string(),
  featureId: featureIdSchema,
  position: z.tuple([z.number(), z.number(), z.number()]),
  label: z.string().optional(),
  category: z.string().optional(),
});

const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  weight: z.number().min(0).max(1),
  type: z.enum(['coactivation', 'attention', 'circuit']),
});

export const graphJSONSchema = z.object({
  metadata: z.object({
    modelId: z.string(),
    layers: z.array(z.number()),
    version: z.string().optional(),
  }),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphJSONSchema = z.infer<typeof graphJSONSchema>;
```

---

## Loading Functions

### Load and Validate

```typescript
import { graphJSONSchema, type GraphJSONSchema } from './graphSchema';
import type { GraphData, GraphNode, GraphEdge } from '@horus/shared';

export async function loadGraphFromURL(url: string): Promise<GraphData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch graph: ${response.statusText}`);
  }

  const json = await response.json();
  return loadGraphFromJSON(json);
}

export function loadGraphFromJSON(json: unknown): GraphData {
  // Validate schema
  const parsed = graphJSONSchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Invalid graph schema:\n${errors.join('\n')}`);
  }

  return convertToGraphData(parsed.data);
}
```

### Convert to GraphData

```typescript
function convertToGraphData(json: GraphJSONSchema): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const nodeIds = new Set<string>();

  // First pass: collect all node IDs
  for (const node of json.nodes) {
    nodeIds.add(node.id);
  }

  // Second pass: create node map
  for (const node of json.nodes) {
    nodes.set(node.id, {
      id: node.id,
      featureId: node.featureId,
      position: node.position,
      label: node.label,
      category: node.category,
    });
  }

  // Third pass: create edge map (validate references)
  for (const edge of json.edges) {
    if (!nodeIds.has(edge.source)) {
      console.warn(`Edge ${edge.id} references non-existent source: ${edge.source}`);
      continue;
    }
    if (!nodeIds.has(edge.target)) {
      console.warn(`Edge ${edge.id} references non-existent target: ${edge.target}`);
      continue;
    }

    edges.set(edge.id, {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      type: edge.type,
    });
  }

  return {
    nodes,
    edges,
    metadata: {
      modelId: json.metadata.modelId,
      layers: json.metadata.layers,
      nodeCount: nodes.size,
      edgeCount: edges.size,
      createdAt: new Date().toISOString(),
    },
  };
}
```

---

## GPU Format Conversion

### Position Data

```typescript
import type { GraphData, GraphPositionData } from '@horus/shared';

export function convertToGPUFormat(data: GraphData): GraphPositionData {
  const count = data.nodes.size;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const nodeIndexMap = new Map<string, number>();

  let i = 0;
  for (const [id, node] of data.nodes) {
    nodeIndexMap.set(id, i);

    // Position
    positions[i * 3] = node.position[0];
    positions[i * 3 + 1] = node.position[1];
    positions[i * 3 + 2] = node.position[2];

    // Default color (dim gray-blue)
    colors[i * 3] = 0.16;     // R
    colors[i * 3 + 1] = 0.16; // G
    colors[i * 3 + 2] = 0.22; // B

    // Default scale
    scales[i] = 1.0;

    i++;
  }

  return { positions, colors, scales, nodeIndexMap };
}
```

### Edge Geometry

```typescript
export function convertEdgesToGeometry(
  data: GraphData,
  nodeIndexMap: Map<string, number>,
  positions: Float32Array
): Float32Array {
  const edgePositions = new Float32Array(data.edges.size * 6); // 2 points * 3 coords

  let i = 0;
  for (const edge of data.edges.values()) {
    const sourceIdx = nodeIndexMap.get(edge.source);
    const targetIdx = nodeIndexMap.get(edge.target);

    if (sourceIdx === undefined || targetIdx === undefined) continue;

    // Start point
    edgePositions[i * 6] = positions[sourceIdx * 3];
    edgePositions[i * 6 + 1] = positions[sourceIdx * 3 + 1];
    edgePositions[i * 6 + 2] = positions[sourceIdx * 3 + 2];

    // End point
    edgePositions[i * 6 + 3] = positions[targetIdx * 3];
    edgePositions[i * 6 + 4] = positions[targetIdx * 3 + 1];
    edgePositions[i * 6 + 5] = positions[targetIdx * 3 + 2];

    i++;
  }

  return edgePositions;
}
```

---

## Chunked Loading (Large Files)

For files > 5MB, use streaming to avoid blocking the main thread.

### Web Worker Approach

```typescript
// graphLoader.worker.ts
import { loadGraphFromJSON, convertToGPUFormat } from './graphLoader';

self.onmessage = async (event: MessageEvent<{ json: unknown }>) => {
  try {
    const graphData = loadGraphFromJSON(event.data.json);
    const gpuData = convertToGPUFormat(graphData);

    // Transfer ownership of TypedArrays
    self.postMessage(
      { success: true, graphData, gpuData },
      [gpuData.positions.buffer, gpuData.colors.buffer, gpuData.scales.buffer]
    );
  } catch (error) {
    self.postMessage({ success: false, error: (error as Error).message });
  }
};
```

```typescript
// Using the worker
export function loadGraphInWorker(json: unknown): Promise<GraphLoadResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./graphLoader.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data.success) {
        resolve(event.data);
      } else {
        reject(new Error(event.data.error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };

    worker.postMessage({ json });
  });
}
```

### Progress Reporting

```typescript
export async function loadGraphWithProgress(
  url: string,
  onProgress: (percent: number) => void
): Promise<GraphData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    if (total > 0) {
      onProgress(Math.round((loaded / total) * 100));
    }
  }

  const allChunks = new Uint8Array(loaded);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  const text = new TextDecoder().decode(allChunks);
  const json = JSON.parse(text);

  return loadGraphFromJSON(json);
}
```

---

## Store Integration

```typescript
// stores/slices/graphSlice.ts
import { StateCreator } from 'zustand';
import { loadGraphFromURL, convertToGPUFormat } from '../loaders/graphLoader';
import { useLargeDataStore } from '../largeDataStore';

export interface GraphSlice {
  isLoading: boolean;
  loadProgress: number;
  loadError: string | null;
  loadGraph: (source: string) => Promise<void>;
  cancelLoad: () => void;
}

export const createGraphSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  GraphSlice
> = (set, get) => {
  let abortController: AbortController | null = null;

  return {
    isLoading: false,
    loadProgress: 0,
    loadError: null,

    loadGraph: async (source: string) => {
      // Cancel any in-flight load
      abortController?.abort();
      abortController = new AbortController();

      set((state) => {
        state.isLoading = true;
        state.loadProgress = 0;
        state.loadError = null;
      });

      try {
        const graphData = await loadGraphWithProgress(
          source,
          (percent) => {
            set((state) => { state.loadProgress = percent; });
          }
        );

        // Convert to GPU format
        const gpuData = convertToGPUFormat(graphData);

        // Update large data store (doesn't trigger React re-renders)
        useLargeDataStore.setState({
          nodes: graphData.nodes,
          edges: graphData.edges,
          nodePositions: gpuData.positions,
          nodeColors: gpuData.colors,
          nodeScales: gpuData.scales,
          nodeIndexMap: gpuData.nodeIndexMap,
        });

        set((state) => {
          state.isLoading = false;
          state.loadProgress = 100;
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        set((state) => {
          state.isLoading = false;
          state.loadError = (error as Error).message;
        });
      }
    },

    cancelLoad: () => {
      abortController?.abort();
      set((state) => {
        state.isLoading = false;
        state.loadProgress = 0;
      });
    },
  };
};
```

---

## Activation Updates

```typescript
// Updating colors based on activations (called from useFrame or subscription)
export function updateNodeColors(
  colors: Float32Array,
  activations: Map<string, number>,
  nodeIndexMap: Map<string, number>
): void {
  // Pre-compute color values
  const inactiveR = 0.16, inactiveG = 0.16, inactiveB = 0.22;

  for (const [nodeId, activation] of activations) {
    const idx = nodeIndexMap.get(nodeId);
    if (idx === undefined) continue;

    if (activation < 0.01) {
      // Inactive
      colors[idx * 3] = inactiveR;
      colors[idx * 3 + 1] = inactiveG;
      colors[idx * 3 + 2] = inactiveB;
    } else {
      // Gold gradient based on activation (HSL to RGB)
      const lightness = 0.3 + Math.min(activation / 5, 0.4);
      // Simplified gold: increase R and G with activation
      colors[idx * 3] = 0.9 * lightness + 0.1;      // R
      colors[idx * 3 + 1] = 0.7 * lightness + 0.1;  // G
      colors[idx * 3 + 2] = 0.1 * lightness + 0.05; // B
    }
  }
}
```

---

## File Structure

```
packages/frontend/src/
├── loaders/
│   ├── graphLoader.ts           # Main loader functions
│   ├── graphSchema.ts           # Zod validation schemas
│   ├── gpuConverter.ts          # TypedArray conversion
│   ├── graphLoader.worker.ts    # Web Worker for large files
│   └── index.ts                 # Barrel export
├── stores/
│   ├── slices/
│   │   └── graphSlice.ts        # Loading state slice
│   └── largeDataStore.ts        # GPU data store
└── __tests__/
    └── loaders/
        └── graphLoader.test.ts
```

---

## Performance Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| JSON parse (10MB) | < 200ms | 500ms |
| Map conversion (50k nodes) | < 50ms | 100ms |
| GPU format conversion (50k) | < 50ms | 100ms |
| Total load (50k nodes) | < 500ms | 1s |

---

## Error Handling

```typescript
export class GraphLoadError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK' | 'PARSE' | 'VALIDATION' | 'CONVERSION',
    public details?: unknown
  ) {
    super(message);
    this.name = 'GraphLoadError';
  }
}

// Usage
try {
  await loadGraph(url);
} catch (error) {
  if (error instanceof GraphLoadError) {
    switch (error.code) {
      case 'NETWORK':
        showToast('Failed to load graph. Check your connection.');
        break;
      case 'VALIDATION':
        showToast('Invalid graph file format.');
        break;
      default:
        showToast('Failed to load graph.');
    }
  }
}
```
