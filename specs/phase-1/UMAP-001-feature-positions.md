# UMAP-001: Feature Position Pipeline

| Field | Value |
|-------|-------|
| **Spec ID** | UMAP-001 |
| **Phase** | 1 - Static Viewer (CRITICAL BLOCKER) |
| **Status** | Complete |
| **Package** | `@horus/backend` + Python scripts |

## Summary

Compute 3D UMAP positions for SAE features using decoder vectors. This is the foundation of the entire HORUS visualization - without positions, there is no ideaspace graph. Currently using filler data; real positions are **blocking** for Phase 2.

**CRITICAL**: This spec must be completed before Phase 2 can deliver meaningful results.

## Current State

- **Filler data**: `packages/frontend/public/data/graph-filler-500.json` (500 fake nodes with synthetic clustering)
- **Real data**: NOT YET COMPUTED
- **Blocker**: Phase 2 dials/steering require real feature positions to show meaningful traces

## Requirements

### REQ-1: SAE Weight Download

Download decoder vectors from HuggingFace for target model.

**Source**: `google/gemma-scope-2b-pt-res`
- 26 layers (0-25)
- 16,384 features per layer (16k SAE)
- 2,304 dimensions per decoder vector
- Total: 26 × 16,384 × 2,304 = ~1GB per layer

```python
# HuggingFace structure
layer_12/width_16k/average_l0_82/
├── cfg.json
├── sae_weights.safetensors  # Contains W_dec (decoder matrix)
└── sparsity.safetensors
```

**Acceptance Criteria:**
- [x] Script downloads SAE weights for specified layer(s)
- [x] Extracts decoder matrix `W_dec` (16384 × 2304)
- [x] L2-normalizes decoder vectors before UMAP
- [x] Handles HuggingFace auth if needed

### REQ-2: UMAP Computation

Compute 3D embeddings using optimized UMAP parameters.

```python
from umap import UMAP

umap_model = UMAP(
    n_neighbors=40,
    min_dist=0.02,
    metric='cosine',
    n_components=3,
    spread=1.0,
    repulsion_strength=1.5,
    random_state=42  # Reproducibility
)

positions_3d = umap_model.fit_transform(decoder_vectors)
```

**Hyperparameters Rationale:**
| Parameter | Value | Why |
|-----------|-------|-----|
| n_neighbors | 40 | Balance local/global structure for 16k points |
| min_dist | 0.02 | Tight clusters, clear semantic neighborhoods |
| metric | cosine | Decoder vectors are normalized; angle matters |
| n_components | 3 | 3D visualization for depth perception |
| random_state | 42 | Reproducible results |

**Acceptance Criteria:**
- [x] Computes 3D positions for 16,384 features in < 2 minutes (RAPIDS GPU) or < 10 minutes (CPU)
- [x] Positions are normalized to reasonable range (e.g., -50 to +50)
- [x] Semantic clusters emerge (visual inspection)
- [x] Seed is fixed for reproducibility

### REQ-3: Edge Computation

Compute top-K similar features for each feature using cosine similarity.

```python
from sklearn.metrics.pairwise import cosine_similarity

# For each feature, find top-K most similar
similarity_matrix = cosine_similarity(decoder_vectors)
top_k = 25

edges = []
for i in range(num_features):
    similarities = similarity_matrix[i]
    top_indices = np.argsort(similarities)[-top_k-1:-1][::-1]  # Exclude self
    for j in top_indices:
        if similarities[j] > 0.25:  # Threshold
            edges.append({
                'source': i,
                'target': j,
                'weight': float(similarities[j])
            })
```

**Acceptance Criteria:**
- [x] Top-K neighbors computed for each feature
- [x] Edges filtered by minimum similarity threshold (0.25)
- [x] Bidirectional edges deduplicated (a→b = b→a)
- [x] Edge count reasonable (~12k for 16k features with k=25, threshold=0.25)

### REQ-4: Output Format

Export to JSON matching GraphJSONSchema.

```typescript
interface PositionOutput {
  metadata: {
    modelId: string;
    layer: number;
    sourceId: string;           // e.g., "12-gemmascope-res-16k"
    featureCount: number;
    edgeCount: number;
    umapParams: {
      n_neighbors: number;
      min_dist: number;
      metric: string;
      seed: number;
    };
    computedAt: string;         // ISO timestamp
    version: string;            // Pipeline version
  };
  nodes: Array<{
    id: string;                 // "gemma-2-2b:12:{index}"
    featureId: { modelId: string; layer: number; index: number };
    position: [number, number, number];
    // Labels populated later from Neuronpedia explanations
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    weight: number;
    type: 'coactivation';
  }>;
}
```

**Acceptance Criteria:**
- [x] Output validates against GraphJSONSchema (Zod)
- [x] File size reasonable (~500KB gzipped, 5.75MB uncompressed for 16k features)
- [x] Can be loaded by existing graphLoader

### REQ-5: Backend Caching

Cache computed positions in SQLite for instant retrieval.

```typescript
// db/schema/positions.ts
export const featurePositions = sqliteTable('feature_positions', {
  id: text('id').primaryKey(),         // "gemma-2-2b:12-gemmascope-res-16k"
  modelId: text('model_id').notNull(),
  sourceId: text('source_id').notNull(),
  layer: integer('layer').notNull(),
  positions: blob('positions'),         // Float32Array as binary
  metadata: text('metadata', { mode: 'json' }),
  computedAt: integer('computed_at', { mode: 'timestamp' }),
});
```

**API Endpoint:**
```typescript
GET /api/positions/:modelId/:sourceId
// Returns gzipped Float32Array + metadata
// Cache-Control: public, max-age=31536000 (1 year)
```

**Acceptance Criteria:**
- [ ] Positions stored efficiently (binary blob, not JSON) - **DEFERRED: using static JSON files**
- [ ] API returns gzipped response - **DEFERRED: using static files**
- [ ] Cache headers set for long-term caching - **DEFERRED**
- [ ] Frontend caches in IndexedDB after first fetch - **DEFERRED**

> **Note**: Backend caching deferred. Currently serving static JSON from `/public/data/`. Will implement SQLite caching when multi-model/layer support added.

### REQ-6: Label Enrichment

Fetch feature explanations from Neuronpedia and merge with positions.

```typescript
// For each feature, fetch label
const enrichNode = async (node) => {
  const feature = await neuronpediaService.getFeature(
    node.featureId.modelId,
    node.featureId.layer,
    node.featureId.index
  );
  return {
    ...node,
    label: feature.explanations?.[0]?.description || `Feature ${node.featureId.index}`,
    category: inferCategory(feature),  // From top tokens/logits
  };
};
```

**Acceptance Criteria:**
- [x] Labels fetched from Neuronpedia (cached)
- [x] Fallback to "Feature {index}" if no explanation
- [ ] Category inferred from feature characteristics - **DEFERRED**
- [x] Enrichment can run incrementally (not blocking initial load)

## Technical Notes

### Python Dependencies

```
umap-learn>=0.5.4
scikit-learn>=1.3.0
numpy>=1.24.0
safetensors>=0.4.0
huggingface_hub>=0.20.0
```

For GPU acceleration (10-100x faster):
```
cuml>=24.02  # RAPIDS
```

### Computation Time Estimates

| Hardware | 16k features | 65k features |
|----------|--------------|--------------|
| CPU (M1) | ~8 min | ~45 min |
| CPU (x86) | ~15 min | ~90 min |
| GPU (RAPIDS) | ~30 sec | ~3 min |

### Storage Estimates

| Layer Count | File Size (gzip) | Memory |
|-------------|------------------|--------|
| 1 layer | ~2 MB | ~200 KB positions |
| 26 layers | ~50 MB | ~5 MB positions |

### Pipeline Script Location

```
horus/
├── scripts/
│   └── compute-positions/
│       ├── requirements.txt
│       ├── compute_umap.py      # Main script
│       ├── download_sae.py      # HuggingFace download
│       └── export_json.py       # Format conversion
```

## Dependencies

- [GRAPH-001](./GRAPH-001-data-model.md) - Output format
- [GRAPH-002](./GRAPH-002-loader.md) - Loader consumes output
- [API-001](./API-001-neuronpedia.md) - Label enrichment

## Open Questions

1. Should we compute positions for all 26 layers or start with a subset (12, 18, 20)?
2. Pre-compute edge similarity or compute on-demand?
3. Store full decoder vectors for runtime similarity queries?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-11 | **COMPLETE**: Pipeline implemented, layer 12 computed with 1000 labels |
| 2025-01-10 | Initial draft with filler data workaround |

## Implementation Notes

**Actual Results (Layer 12):**
- 16,384 nodes
- 12,599 edges (k=25, threshold=0.25)
- 1,000 labels from Neuronpedia
- ~8 min UMAP on M4 Pro
- 5.75 MB uncompressed, ~500KB gzipped

**Pipeline Location:** `scripts/compute_positions/`

**Key Files:**
- `download_sae.py` - HuggingFace weight download
- `compute_umap.py` - UMAP + edge computation
- `fetch_labels.py` - Neuronpedia API labels
- `export_layer.py` - JSON export
- `run_pipeline.py` - Orchestration
