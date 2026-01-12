import type { StateCreator } from 'zustand';

import type { GraphData } from '@horus/shared';
import { useLargeDataStore } from '../largeDataStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GraphLoadErrorCode =
  | 'NETWORK'
  | 'PARSE'
  | 'VALIDATION'
  | 'EDGE_REF'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface GraphLoadErrorInfo {
  code: GraphLoadErrorCode;
  message: string;
  details?: string[];
}

export interface GraphLoadingSlice {
  // State
  isLoading: boolean;
  loadProgress: number; // 0-100
  loadError: GraphLoadErrorInfo | null;
  loadedSource: string | null;

  // Actions
  loadGraphFromURL: (url: string) => Promise<void>;
  loadGraphFromJSON: (json: unknown) => Promise<void>;
  cancelLoad: () => void;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Loader Interface (to be implemented by loaders module)
// ---------------------------------------------------------------------------

// These interfaces define what the loaders module should provide
// The actual loaders will be imported when Track A completes

interface LoaderResult {
  graphData: GraphData;
}

interface LoaderOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

// Placeholder loader functions - will be replaced with actual imports
// when the loaders module is implemented
async function loadGraphFromURLImpl(url: string, options?: LoaderOptions): Promise<LoaderResult> {
  const { signal, onProgress } = options ?? {};

  // Fetch with abort support
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new GraphLoadError('NETWORK', `Failed to fetch: ${response.statusText}`);
  }

  // Report download progress if Content-Length is available
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new GraphLoadError('NETWORK', 'No response body');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    if (total > 0 && onProgress) {
      onProgress(Math.round((loaded / total) * 80)); // 0-80% for download
    }
  }

  // Combine chunks
  const allChunks = new Uint8Array(loaded);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  onProgress?.(85); // Parsing phase

  const text = new TextDecoder().decode(allChunks);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GraphLoadError('PARSE', 'Invalid JSON format');
  }

  onProgress?.(90); // Validation phase

  return loadGraphFromJSONImpl(json, { signal, onProgress });
}

async function loadGraphFromJSONImpl(
  json: unknown,
  options?: LoaderOptions
): Promise<LoaderResult> {
  const { signal, onProgress } = options ?? {};

  // Check for cancellation
  if (signal?.aborted) {
    throw new GraphLoadError('CANCELLED', 'Load cancelled');
  }

  // Basic validation
  if (!json || typeof json !== 'object') {
    throw new GraphLoadError('VALIDATION', 'Invalid graph data: expected object');
  }

  const data = json as Record<string, unknown>;

  // Validate required fields
  if (!Array.isArray(data.nodes)) {
    throw new GraphLoadError('VALIDATION', 'Invalid graph data: missing nodes array');
  }

  if (!Array.isArray(data.edges)) {
    throw new GraphLoadError('VALIDATION', 'Invalid graph data: missing edges array');
  }

  onProgress?.(95);

  // Convert to GraphData format
  const nodes = new Map<string, import('@horus/shared').GraphNode>();
  const edges = new Map<string, import('@horus/shared').GraphEdge>();
  const nodeIds = new Set<string>();
  const validationErrors: string[] = [];

  // First pass: collect node IDs
  for (const node of data.nodes as unknown[]) {
    if (node && typeof node === 'object' && 'id' in node) {
      nodeIds.add((node as { id: string }).id);
    }
  }

  // Second pass: create nodes
  for (const rawNode of data.nodes as unknown[]) {
    if (!rawNode || typeof rawNode !== 'object') {
      validationErrors.push('Invalid node: expected object');
      continue;
    }

    const node = rawNode as Record<string, unknown>;

    if (typeof node.id !== 'string') {
      validationErrors.push('Invalid node: missing id');
      continue;
    }

    // Validate position
    const position = node.position;
    if (!Array.isArray(position) || position.length !== 3) {
      validationErrors.push(`Node ${node.id}: invalid position`);
      continue;
    }

    const [x, y, z] = position as number[];
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      validationErrors.push(`Node ${node.id}: position must contain numbers`);
      continue;
    }

    // Create the node
    nodes.set(node.id, {
      id: node.id,
      featureId: (node.featureId as import('@horus/shared').FeatureId) ?? {
        modelId: 'unknown',
        layer: 0,
        index: 0,
      },
      position: [x, y, z],
      label: typeof node.label === 'string' ? node.label : undefined,
      category: typeof node.category === 'string' ? node.category : undefined,
    });
  }

  // Third pass: create edges with reference validation
  for (const rawEdge of data.edges as unknown[]) {
    if (!rawEdge || typeof rawEdge !== 'object') {
      validationErrors.push('Invalid edge: expected object');
      continue;
    }

    const edge = rawEdge as Record<string, unknown>;

    if (typeof edge.id !== 'string') {
      validationErrors.push('Invalid edge: missing id');
      continue;
    }

    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      validationErrors.push(`Edge ${edge.id}: missing source or target`);
      continue;
    }

    // Validate edge references
    if (!nodeIds.has(edge.source)) {
      validationErrors.push(`Edge ${edge.id}: references non-existent source ${edge.source}`);
      continue;
    }

    if (!nodeIds.has(edge.target)) {
      validationErrors.push(`Edge ${edge.id}: references non-existent target ${edge.target}`);
      continue;
    }

    edges.set(edge.id, {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      weight: typeof edge.weight === 'number' ? edge.weight : 1,
      type: (edge.type as 'coactivation' | 'attention' | 'circuit') ?? 'coactivation',
    });
  }

  // If there were critical validation errors, throw
  if (nodes.size === 0) {
    throw new GraphLoadError('VALIDATION', 'No valid nodes found', validationErrors);
  }

  onProgress?.(100);

  // Extract metadata
  const metadata = data.metadata as Record<string, unknown> | undefined;

  const graphData: GraphData = {
    nodes,
    edges,
    metadata: {
      modelId: typeof metadata?.modelId === 'string' ? metadata.modelId : 'unknown',
      layers: Array.isArray(metadata?.layers) ? (metadata.layers as number[]) : [],
      nodeCount: nodes.size,
      edgeCount: edges.size,
      createdAt: new Date().toISOString(),
    },
  };

  return { graphData };
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class GraphLoadError extends Error {
  constructor(
    public code: GraphLoadErrorCode,
    message: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'GraphLoadError';
  }
}

// ---------------------------------------------------------------------------
// Slice Creator
// ---------------------------------------------------------------------------

// Use a module-level variable for the abort controller
// This keeps it out of React state while being accessible across calls
let currentAbortController: AbortController | null = null;

export const createGraphLoadingSlice: StateCreator<
  // The full AppStore type will include this slice plus others
  // We use a minimal type here that includes what we need from other slices
  GraphLoadingSlice & {
    setGraphData: (data: GraphData) => void;
  },
  [],
  [],
  GraphLoadingSlice
> = (set, get) => ({
  // Initial state
  isLoading: false,
  loadProgress: 0,
  loadError: null,
  loadedSource: null,

  // Actions
  loadGraphFromURL: async (url: string) => {
    // Cancel any in-flight load
    currentAbortController?.abort();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // Reset state for new load
    set({
      isLoading: true,
      loadProgress: 0,
      loadError: null,
    });

    try {
      const result = await loadGraphFromURLImpl(url, {
        signal,
        onProgress: (percent) => {
          set({ loadProgress: percent });
        },
      });

      // Check for cancellation before applying results
      if (signal.aborted) {
        return;
      }

      // Load GPU data into LargeDataStore
      useLargeDataStore.getState().loadPositionData(result.graphData);

      // Load React state via GraphSlice
      get().setGraphData(result.graphData);

      // Update loading state
      set({
        isLoading: false,
        loadProgress: 100,
        loadedSource: url,
      });
    } catch (error) {
      // Ignore abort errors from cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (error instanceof GraphLoadError && error.code === 'CANCELLED') {
        return;
      }

      // Convert to error info
      const errorInfo = convertToErrorInfo(error);

      set({
        isLoading: false,
        loadProgress: 0,
        loadError: errorInfo,
      });
    }
  },

  loadGraphFromJSON: async (json: unknown) => {
    // Cancel any in-flight load
    currentAbortController?.abort();
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // Reset state for new load
    set({
      isLoading: true,
      loadProgress: 0,
      loadError: null,
    });

    try {
      const result = await loadGraphFromJSONImpl(json, {
        signal,
        onProgress: (percent) => {
          set({ loadProgress: percent });
        },
      });

      // Check for cancellation before applying results
      if (signal.aborted) {
        return;
      }

      // Load GPU data into LargeDataStore
      useLargeDataStore.getState().loadPositionData(result.graphData);

      // Load React state via GraphSlice
      get().setGraphData(result.graphData);

      // Update loading state
      set({
        isLoading: false,
        loadProgress: 100,
        loadedSource: 'json',
      });
    } catch (error) {
      // Ignore abort errors from cancellation
      if (error instanceof GraphLoadError && error.code === 'CANCELLED') {
        return;
      }

      // Convert to error info
      const errorInfo = convertToErrorInfo(error);

      set({
        isLoading: false,
        loadProgress: 0,
        loadError: errorInfo,
      });
    }
  },

  cancelLoad: () => {
    currentAbortController?.abort();
    currentAbortController = null;

    set({
      isLoading: false,
      loadProgress: 0,
    });
  },

  clearError: () => {
    set({ loadError: null });
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertToErrorInfo(error: unknown): GraphLoadErrorInfo {
  if (error instanceof GraphLoadError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      code: 'NETWORK',
      message: 'Network error: failed to fetch',
    };
  }

  if (error instanceof SyntaxError) {
    return {
      code: 'PARSE',
      message: 'Failed to parse JSON',
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: error.message,
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'An unknown error occurred',
  };
}
