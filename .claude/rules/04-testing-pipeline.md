# Testing + UMAP Pipeline

## Vitest Patterns

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('graphLoader', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads graph data', async () => {
    const result = await loadGraphFromJSON(mockJSON);
    expect(result.nodes.size).toBe(100);
  });
});
```

### Zustand Store Testing

```typescript
beforeEach(() => useAppStore.setState({ currentText: '', selectedNodeIds: new Set() }));
```

### Mocking

```typescript
// Three.js
vi.mock('three', () => ({ Vector3: vi.fn(() => ({ set: vi.fn() })) }));

// Fetch
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => mockData });

// MSW for Neuronpedia
import { setupServer } from 'msw/node';
const server = setupServer(
  http.get('https://www.neuronpedia.org/*', () => HttpResponse.json(mock))
);
```

### Hono Route Testing

```typescript
const res = await app.request('/api/features/gemma-2-2b/12/1622');
expect(res.status).toBe(200);
```

## UMAP Position Pipeline

```
scripts/compute_positions/
├── download_sae.py     # HuggingFace → decoder vectors
├── compute_umap.py     # UMAP + k-NN edges
├── fetch_labels.py     # Neuronpedia API → labels
├── export_layer.py     # → JSON for frontend
└── run_pipeline.py     # Orchestration
```

### UMAP Parameters

```python
UMAP_PARAMS = {
    'n_neighbors': 40,    # Higher for 16k points
    'min_dist': 0.02,     # Tight clusters
    'metric': 'cosine',   # Angle matters for normalized vectors
    'n_components': 3,
}
```

### Edge Computation

```python
k = 25                   # Neighbors per node
threshold = 0.25         # Min similarity for edge
# Result: ~12k edges for 16k nodes
```

### Output Schema (Critical)

```python
# Frontend expects layers as ARRAY
"metadata": { "layers": [12] }  # NOT "layer": 12
```

### Caching

```
cache/{model}/layer_{N}/
├── decoder_vectors.npy  # 16384 × 2304
├── positions.npy        # 16384 × 3
├── edges.npy
└── labels.json
```

### Timing (M4 Pro)

| Step          | Time          |
| ------------- | ------------- |
| UMAP          | ~8 min        |
| Edges         | ~2 min        |
| Labels (1000) | ~9 min        |
| **Total**     | ~20 min/layer |

### Anti-Patterns

- Don't use Euclidean distance (use cosine)
- Don't fetch all 16k labels upfront (rate limits)
- Don't compute similarity on raw activations (use decoder vectors)
