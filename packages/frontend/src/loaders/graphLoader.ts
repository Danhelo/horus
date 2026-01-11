/**
 * Graph loading utilities with validation and progress reporting
 * @module loaders/graphLoader
 */
import type { GraphData, GraphNode, GraphEdge, GraphMetadata, EdgeType } from '@horus/shared';
import { graphJSONSchema, formatValidationErrors, type GraphJSONSchema } from './graphSchema';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export type GraphLoadErrorCode =
  | 'NETWORK'
  | 'PARSE'
  | 'VALIDATION'
  | 'EDGE_REF'
  | 'CANCELLED';

/**
 * Custom error class for graph loading failures
 */
export class GraphLoadError extends Error {
  constructor(
    message: string,
    public readonly code: GraphLoadErrorCode,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'GraphLoadError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphLoadError);
    }
  }

  static fromValidation(errors: { path: (string | number)[]; message: string }[]): GraphLoadError {
    const details = errors.map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    });
    return new GraphLoadError('Invalid graph data: schema validation failed', 'VALIDATION', details);
  }

  static fromNetwork(originalError: Error, url: string): GraphLoadError {
    return new GraphLoadError(
      `Failed to fetch graph from ${url}: ${originalError.message}`,
      'NETWORK',
      [originalError.message]
    );
  }

  static fromParse(originalError: Error): GraphLoadError {
    return new GraphLoadError('Failed to parse graph JSON', 'PARSE', [originalError.message]);
  }

  static cancelled(): GraphLoadError {
    return new GraphLoadError('Graph load was cancelled', 'CANCELLED');
  }
}

// ---------------------------------------------------------------------------
// Progress Types
// ---------------------------------------------------------------------------

export type ProgressPhase = 'downloading' | 'parsing' | 'converting';

export interface ProgressInfo {
  phase: ProgressPhase;
  percent: number;
  bytesLoaded: number;
  bytesTotal: number;
}

export type ProgressCallback = (progress: ProgressInfo) => void;

// ---------------------------------------------------------------------------
// Conversion Functions
// ---------------------------------------------------------------------------

/**
 * Convert validated JSON to internal GraphData structure
 */
function convertToGraphData(json: GraphJSONSchema): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const nodeIds = new Set<string>();
  const invalidEdges: { edgeId: string; nodeId: string; field: 'source' | 'target' }[] = [];

  // First pass: collect all node IDs and build node map
  for (const nodeJSON of json.nodes) {
    nodeIds.add(nodeJSON.id);
    nodes.set(nodeJSON.id, {
      id: nodeJSON.id,
      featureId: {
        modelId: nodeJSON.featureId.modelId,
        layer: nodeJSON.featureId.layer,
        index: nodeJSON.featureId.index,
      },
      position: nodeJSON.position,
      label: nodeJSON.label,
      category: nodeJSON.category,
    });
  }

  // Second pass: validate edges and build edge map
  for (const edgeJSON of json.edges) {
    if (!nodeIds.has(edgeJSON.source)) {
      invalidEdges.push({ edgeId: edgeJSON.id, nodeId: edgeJSON.source, field: 'source' });
      continue;
    }

    if (!nodeIds.has(edgeJSON.target)) {
      invalidEdges.push({ edgeId: edgeJSON.id, nodeId: edgeJSON.target, field: 'target' });
      continue;
    }

    edges.set(edgeJSON.id, {
      id: edgeJSON.id,
      source: edgeJSON.source,
      target: edgeJSON.target,
      weight: edgeJSON.weight,
      type: edgeJSON.type as EdgeType,
    });
  }

  // Warn about invalid edges
  if (invalidEdges.length > 0) {
    console.warn(
      `[graphLoader] Skipped ${invalidEdges.length} edges with invalid references:`,
      invalidEdges.slice(0, 5)
    );
  }

  const metadata: GraphMetadata = {
    modelId: json.metadata.modelId,
    layers: json.metadata.layers,
    nodeCount: nodes.size,
    edgeCount: edges.size,
    createdAt: new Date().toISOString(),
  };

  return { nodes, edges, metadata };
}

// ---------------------------------------------------------------------------
// Loader Functions
// ---------------------------------------------------------------------------

/**
 * Load graph from pre-parsed JSON object
 */
export function loadGraphFromJSON(json: unknown): GraphData {
  const parseResult = graphJSONSchema.safeParse(json);

  if (!parseResult.success) {
    throw GraphLoadError.fromValidation(parseResult.error.errors);
  }

  return convertToGraphData(parseResult.data);
}

/**
 * Load graph from URL via fetch
 */
export async function loadGraphFromURL(url: string, signal?: AbortSignal): Promise<GraphData> {
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw GraphLoadError.cancelled();
    }
    throw GraphLoadError.fromNetwork(error as Error, url);
  }

  if (!response.ok) {
    throw new GraphLoadError(`HTTP ${response.status}: ${response.statusText}`, 'NETWORK', [
      `Failed to fetch ${url}`,
    ]);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw GraphLoadError.fromParse(error as Error);
  }

  return loadGraphFromJSON(json);
}

/**
 * Load graph with progress reporting for large files
 */
export async function loadGraphWithProgress(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<GraphData> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw GraphLoadError.cancelled();
    }
    throw GraphLoadError.fromNetwork(error as Error, url);
  }

  if (!response.ok) {
    throw new GraphLoadError(`HTTP ${response.status}: ${response.statusText}`, 'NETWORK', [
      `Failed to fetch ${url}`,
    ]);
  }

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    const json = await response.json();
    return loadGraphFromJSON(json);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastProgressUpdate = 0;
  const PROGRESS_DEBOUNCE_MS = 50;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      const now = Date.now();
      if (onProgress && now - lastProgressUpdate >= PROGRESS_DEBOUNCE_MS) {
        lastProgressUpdate = now;
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
        onProgress({ phase: 'downloading', percent, bytesLoaded: loaded, bytesTotal: total });
      }
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw GraphLoadError.cancelled();
    }
    throw GraphLoadError.fromNetwork(error as Error, url);
  }

  onProgress?.({ phase: 'parsing', percent: 100, bytesLoaded: loaded, bytesTotal: total });

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  let json: unknown;
  try {
    const text = new TextDecoder().decode(combined);
    json = JSON.parse(text);
  } catch (error) {
    throw GraphLoadError.fromParse(error as Error);
  }

  onProgress?.({ phase: 'converting', percent: 100, bytesLoaded: loaded, bytesTotal: total });

  return loadGraphFromJSON(json);
}
