import type { FeatureId } from '@horus/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface BatchLabelResponse {
  labels: Array<{
    modelId: string;
    layer: number;
    index: number;
    label: string | null;
  }>;
}

/**
 * In-memory cache for loaded labels
 * Persists for the session to avoid re-fetching
 */
const labelCache = new Map<string, string | null>();

/**
 * Track in-flight requests to avoid duplicates
 */
const pendingRequests = new Map<string, Promise<string | null>>();

/**
 * Create a cache key from feature ID
 */
function makeCacheKey(featureId: FeatureId): string {
  return `${featureId.modelId}:${featureId.layer}:${featureId.index}`;
}

/**
 * Check if a label is already cached
 */
export function hasLabel(featureId: FeatureId): boolean {
  return labelCache.has(makeCacheKey(featureId));
}

/**
 * Get a cached label (returns undefined if not cached)
 */
export function getCachedLabel(featureId: FeatureId): string | null | undefined {
  return labelCache.get(makeCacheKey(featureId));
}

/**
 * Filter features that don't have cached labels
 */
export function getUnlabeledFeatures(featureIds: FeatureId[]): FeatureId[] {
  return featureIds.filter((id) => !hasLabel(id));
}

/**
 * Fetch labels for multiple features in a single batch request
 * Returns a Map of nodeId -> label
 */
export async function fetchBatchLabels(
  featureIds: FeatureId[]
): Promise<Map<string, string | null>> {
  if (featureIds.length === 0) {
    return new Map();
  }

  // Chunk into batches of 50 (API limit)
  const chunks: FeatureId[][] = [];
  for (let i = 0; i < featureIds.length; i += 50) {
    chunks.push(featureIds.slice(i, i + 50));
  }

  const results = new Map<string, string | null>();

  // Process chunks sequentially to respect rate limits
  for (const chunk of chunks) {
    const features = chunk.map((f) => ({
      modelId: f.modelId,
      layer: f.layer,
      index: f.index,
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/features/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      });

      if (!response.ok) {
        console.warn(`[LabelLoader] Batch request failed: ${response.status}`);
        continue;
      }

      const data: BatchLabelResponse = await response.json();

      for (const item of data.labels) {
        const key = makeCacheKey(item);
        labelCache.set(key, item.label);
        results.set(key, item.label);
      }
    } catch (error) {
      console.warn('[LabelLoader] Batch request error:', error);
    }
  }

  return results;
}

/**
 * Load labels for vicinity nodes on-demand
 * Only loads labels that aren't already cached
 */
export async function loadVicinityLabels(
  vicinityNodeIds: Map<string, number>,
  getFeatureId: (nodeId: string) => FeatureId | null
): Promise<Map<string, string | null>> {
  // Collect features that need loading
  const toLoad: FeatureId[] = [];
  const nodeIdToKey = new Map<string, string>();

  for (const nodeId of vicinityNodeIds.keys()) {
    const featureId = getFeatureId(nodeId);
    if (!featureId) continue;

    const key = makeCacheKey(featureId);
    nodeIdToKey.set(nodeId, key);

    // Skip if already cached
    if (labelCache.has(key)) continue;

    toLoad.push(featureId);
  }

  // Fetch uncached labels
  if (toLoad.length > 0) {
    await fetchBatchLabels(toLoad);
  }

  // Build result map: nodeId -> label
  const result = new Map<string, string | null>();
  for (const [nodeId, key] of nodeIdToKey) {
    const label = labelCache.get(key);
    if (label !== undefined) {
      result.set(nodeId, label);
    }
  }

  return result;
}

/**
 * Preload labels for a single node (for hover preview)
 */
export async function preloadLabel(featureId: FeatureId): Promise<string | null> {
  const key = makeCacheKey(featureId);

  // Return cached value
  if (labelCache.has(key)) {
    return labelCache.get(key) ?? null;
  }

  // Check for pending request
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Create new request
  const promise = fetchBatchLabels([featureId]).then((results) => {
    pendingRequests.delete(key);
    return results.get(key) ?? null;
  });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clear the label cache (for testing or memory management)
 */
export function clearLabelCache(): void {
  labelCache.clear();
}
