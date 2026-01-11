# Neuronpedia API Integration

## API Overview

- **Base URL**: `https://www.neuronpedia.org`
- **Auth**: `x-api-key` header (obtain at neuronpedia.org/account)
- **Rate Limits**: 100 steers/hour, general limits available on request

---

## Gemma-2-2B Configuration

```typescript
const GEMMA_CONFIG = {
  modelId: 'gemma-2-2b',
  layers: 26,                    // 0-25
  featuresPerLayer: 16384,       // 16k SAE width
  contextSize: 1024,
  getSourceId: (layer: number) => `${layer}-gemmascope-res-16k`,
  sourceSetName: 'gemmascope-res-16k',
};
```

---

## Key Endpoints

### Features

```
GET /api/feature/{modelId}/{layer}/{index}
```

Returns feature details, explanations, top activations.

**Response:**
```typescript
interface FeatureResponse {
  modelId: string;
  layer: number;
  index: number;
  explanations?: Array<{
    description: string;
    score: number;
  }>;
  topLogits?: Array<{
    token: string;
    value: number;
  }>;
  activations?: Array<{
    text: string;
    tokens: string[];
    values: number[];
  }>;
}
```

---

### Activations

**Get activations for custom text:**
```
POST /api/activation/new
```

**Request:**
```typescript
interface ActivationRequest {
  feature: {
    modelId: string;
    source: string;              // e.g., "12-gemmascope-res-16k"
    index: number;
  };
  customText: string | string[]; // Max 1024 tokens, or max 4 strings x 256 tokens
}
```

**Response:**
```typescript
interface ActivationResponse {
  tokens: string[];
  activations: {
    layer: number;
    index: number;
    values: number[];            // Per-token activation values
    maxValue: number;
    maxValueIndex: number;
    dfaValues?: number[];        // Direct feature attribution
    dfaTargetIndex?: number;
    dfaMaxValue?: number;
  };
  error?: string;
}
```

**Get all features for a source/SAE:**
```
POST /api/activation/source
```
Parameters: `modelId`, `source`, `customText`

---

### Search

**Top features for entire text:**
```
POST /api/search-all
```

**Request:**
```typescript
interface SearchAllRequest {
  modelId: string;
  sourceSet: string;             // e.g., "gemmascope-res-16k"
  text: string | string[];
  selectedLayers?: number[];     // Empty = all layers
  sortIndexes?: number[];        // Token indices to prioritize
  ignoreBos?: boolean;           // Default: true
  densityThreshold?: number;     // 0-1 or -1 for none
  numResults?: number;           // 1-100, default 50
}
```

**Response:**
```typescript
interface SearchAllResponse {
  tokens: string[];
  result: Array<{
    modelId: string;
    layer: number;
    index: number;
    values: number[];
    maxValue: number;
    maxValueIndex: number;
  }>;
}
```

**Top-K features per token:**
```
POST /api/search-topk-by-token
```

**Request:**
```typescript
interface TopKByTokenRequest {
  modelId: string;               // Max 50 chars
  source: string;                // Max 50 chars
  text: string;                  // Max 1000 chars
  numResults?: number;           // 1-20, default 10
  ignoreBos?: boolean;           // Default: true
  densityThreshold?: number;     // 0-1, default 0.01
}
```

**Semantic search (by explanation text):**
```
POST /api/explanation/search-all
POST /api/explanation/search-model
POST /api/explanation/search
```
Parameters: `query` (min 3 chars), `offset` for pagination. Max 20 results.

---

### Steering

**Text completion with steering:**
```
POST /api/steer
```

**Request:**
```typescript
interface SteerRequest {
  prompt: string;
  modelId: string;               // e.g., "gemma-2-2b"
  features: Array<{
    modelId: string;
    layer: string;               // e.g., "20-gemmascope-res-16k"
    index: number;
    strength: number;            // Typically -10 to 10
  }>;
  temperature?: number;          // e.g., 0.2
  n_tokens?: number;             // Tokens to generate
  freq_penalty?: number;         // e.g., 1.0
  seed?: number;                 // For reproducibility
  strength_multiplier?: number;  // Multiplies all strengths
  steer_method?: 'SIMPLE_ADDITIVE' | 'ORTHOGONAL_DECOMP';
}
```

**Response:**
```typescript
interface SteerResponse {
  defaultOutput: {
    text: string;
    logprobs: number[];
  };
  steeredOutput: {
    text: string;
    logprobs: number[];
  };
}
```

**Chat with steering:**
```
POST /api/steer-chat
```
Additional params: `defaultChatMessages`, `steeredChatMessages`, `steer_special_tokens`

**Rate Limit:** 100 steers per hour per user

---

### Attribution Graphs

**Generate graph:**
```
POST /api/graph/generate
```

**Request:**
```typescript
interface GraphGenerateRequest {
  prompt: string;                // Max 10k chars, capped at 64 tokens
  modelId: string;               // Currently "gemma-2-2b"
  slug: string;                  // Unique identifier (lowercase, alphanumeric)
  sourceSetName?: string;
  maxNLogits?: number;           // 5-15, default 10
  desiredLogitProb?: number;     // 0.6-0.99, default 0.95
  nodeThreshold?: number;        // 0.5-1, default 0.8
  edgeThreshold?: number;        // 0.8-1, default 0.85
  maxFeatureNodes?: number;      // 3000-10000, default 5000
}
```

**Response:**
```typescript
interface GraphGenerateResponse {
  message: string;
  s3url: string;
  url: string;
  numNodes: number;
  numLinks: number;
}
```

**Other graph endpoints:**
```
GET  /api/graph/{modelId}/{slug}     - Get metadata
POST /api/graph/delete               - Delete (owner only)
GET  /api/graph/list                 - List user's graphs
POST /api/graph/subgraph/save        - Save subgraph
```

---

### Vectors (Custom Steering)

```
POST /api/vector/new
POST /api/vector/get
POST /api/vector/list-owned
POST /api/vector/delete
```

Create custom steering vectors beyond individual features.

---

## Type Definitions

```typescript
interface Feature {
  modelId: string;
  layer: number;
  index: number;
  label?: string;
  description?: string;
  explanations?: Array<{
    description: string;
    score: number;
  }>;
  topLogits?: Array<{ token: string; value: number }>;
}

interface ActivationResult {
  tokens: string[];
  activations: Array<{
    layer: number;
    features: Array<{ index: number; activation: number }>;
  }>;
}
```

---

## Client Implementation

```typescript
import { LRUCache } from 'lru-cache';

class NeuronpediaClient {
  private baseUrl = 'https://www.neuronpedia.org';
  private apiKey: string;
  private cache = new LRUCache<string, Feature>({ max: 1000, ttl: 3600000 });

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getFeature(model: string, layer: number, index: number): Promise<Feature> {
    const source = `${layer}-gemmascope-res-16k`;
    const cacheKey = `${model}:${source}:${index}`;

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const feature = await this.request<Feature>(
      'GET',
      `/api/feature/${model}/${source}/${index}`
    );
    this.cache.set(cacheKey, feature);
    return feature;
  }

  async getActivations(text: string, model: string, layers: number[]) {
    return this.request<SearchAllResponse>('POST', '/api/search-all', {
      modelId: model,
      sourceSet: 'gemmascope-res-16k',
      text,
      selectedLayers: layers,
      numResults: 50,
    });
  }

  async steer(prompt: string, features: SteerFeature[], options?: Partial<SteerRequest>) {
    return this.request<SteerResponse>('POST', '/api/steer', {
      modelId: 'gemma-2-2b',
      prompt,
      features,
      temperature: 0.7,
      n_tokens: 100,
      steer_method: 'SIMPLE_ADDITIVE',
      ...options,
    });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  private async handleError(response: Response): Promise<never> {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new NeuronpediaError('RATE_LIMITED', 'Rate limited', retryAfter);
    }
    if (response.status === 401) {
      throw new NeuronpediaError('UNAUTHORIZED', 'Invalid API key');
    }
    if (response.status === 404) {
      throw new NeuronpediaError('NOT_FOUND', 'Feature not found');
    }
    if (response.status === 503) {
      throw new NeuronpediaError('SERVICE_UNAVAILABLE', 'GPUs busy - retry');
    }
    throw new NeuronpediaError('SERVER_ERROR', `API error: ${response.status}`);
  }
}

class NeuronpediaError extends Error {
  constructor(
    public code: NeuronpediaErrorCode,
    message: string,
    public retryAfter?: string | null
  ) {
    super(message);
  }
}

type NeuronpediaErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE';
```

---

## Caching Strategy

| Data Type | TTL | Storage | Reason |
|-----------|-----|---------|--------|
| Features | 1+ hours | LRU + SQLite | Mostly static |
| Explanations | 1+ hours | LRU + SQLite | Rarely change |
| Activations | 5 min | LRU by text hash | Text-dependent |
| Search results | Don't cache | - | Always fresh |
| Graphs | Long-lived | SQLite | User-generated |

---

## Rate Limiting & Backoff

```typescript
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof NeuronpediaError) {
        if (error.code === 'RATE_LIMITED' || error.code === 'SERVICE_UNAVAILABLE') {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          lastError = error;
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError;
}
```

---

## Debouncing Pattern

```typescript
function useDebouncedActivations(delayMs = 200) {
  const [text, setText] = useState('');
  const [activations, setActivations] = useState<ActivationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivations = useMemo(
    () => debounce(async (input: string) => {
      if (input.length < 2) {
        setActivations(null);
        return;
      }

      setIsLoading(true);
      try {
        const result = await client.getActivations(input, 'gemma-2-2b', []);
        setActivations(result);
      } catch (error) {
        console.error('Activation fetch failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, delayMs),
    []
  );

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    fetchActivations(newText);
  }, [fetchActivations]);

  return { text, setText: handleTextChange, activations, isLoading };
}
```

---

## Limits Summary

| Resource | Limit |
|----------|-------|
| Single text input | 1024 tokens max |
| Array text input | 4 strings, 256 tokens each |
| Search results | 100 max (paginated) |
| Graph prompt | 64 tokens max |
| TopK per token | 20 max |
| Steers per hour | 100 |

---

## Bulk Data Access

For large-scale analysis, use S3 exports instead of API:

```
https://neuronpedia-datasets.s3.us-east-1.amazonaws.com/index.html?prefix=v1/
```

Contains 4+ TB of activations, explanations, and metadata.

---

## Common Gotchas

1. **Source ID format**: Must match exactly (e.g., `12-gemmascope-res-16k`)
2. **Feature index is string**: API returns index as string in some responses
3. **TopK search is per-source**: Can't search all layers at once
4. **Graph 503**: GPUs may be busy; implement retry logic
5. **Explanation export deprecated**: Use S3 bucket for bulk data
