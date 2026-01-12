import { useQuery } from '@tanstack/react-query';

import type { FeatureId } from '@horus/shared';

// Types for Neuronpedia feature data
export interface NeuronpediaFeature {
  modelId: string;
  layer: number;
  index: number;
  label?: string;
  description?: string;
  explanations?: Array<{
    description: string;
    score: number;
  }>;
  topLogits?: Array<{
    token: string;
    value: number;
  }>;
  cached?: boolean;
  cachedAt?: string;
}

// Backend API base URL (same origin in dev, configurable in prod)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetch feature details from the backend API (which proxies to Neuronpedia)
 */
async function fetchFeatureDetails(featureId: FeatureId): Promise<NeuronpediaFeature> {
  const { modelId, layer, index } = featureId;
  const url = `${API_BASE_URL}/api/features/${modelId}/${layer}/${index}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Feature not found');
    }
    if (response.status === 429) {
      throw new Error('Rate limited - please try again later');
    }
    throw new Error(`Failed to fetch feature: ${response.statusText}`);
  }

  return response.json();
}

interface UseFeatureDetailsOptions {
  /** Feature identifier */
  featureId: FeatureId | null | undefined;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * React Query hook for fetching Neuronpedia feature data
 *
 * Features:
 * - Caches data for 1 hour (staleTime)
 * - Keeps cached data for 24 hours (gcTime)
 * - Automatically retries on failure
 * - Returns loading/error states
 */
export function useFeatureDetails({ featureId, enabled = true }: UseFeatureDetailsOptions) {
  return useQuery({
    queryKey: ['feature', featureId?.modelId, featureId?.layer, featureId?.index],
    queryFn: () => fetchFeatureDetails(featureId!),
    enabled: enabled && !!featureId,
    staleTime: 1000 * 60 * 60, // 1 hour - features rarely change
    gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
