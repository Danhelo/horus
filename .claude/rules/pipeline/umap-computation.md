# UMAP Position Computation Pipeline

## Core Insight

**Position IS meaning.** The decoder vector of an SAE feature encodes "what this feature writes to the residual stream." When two features have similar decoder vectors, they have similar effects on model behavior. UMAP preserves this - nearby nodes in 3D = semantically related concepts.

This is NOT just visualization. It's **navigable meaning space**.

---

## Pipeline Architecture

```
scripts/compute_positions/
├── download_sae.py     # HuggingFace → decoder vectors
├── compute_umap.py     # UMAP + k-NN edges
├── fetch_labels.py     # Neuronpedia API → semantic labels
├── export_layer.py     # Combine → JSON for frontend
├── run_pipeline.py     # Orchestration with caching
└── config.py           # Model configs, UMAP params
```

---

## Optimized UMAP Parameters

```python
UMAP_PARAMS = {
    'n_neighbors': 40,      # Balance local/global for 16k points
    'min_dist': 0.02,       # Tight clusters, clear semantic neighborhoods
    'metric': 'cosine',     # Decoder vectors are normalized; angle matters
    'n_components': 3,      # 3D for depth perception
    'spread': 1.0,          # Default spread
    'random_state': 42,     # Reproducibility
}
```

**Why these values?**
- `n_neighbors=40`: Higher than default (15) because we have 16k densely connected features
- `min_dist=0.02`: Lower than default (0.1) for tighter semantic clusters
- `metric='cosine'`: L2-normalized vectors → cosine similarity = meaningful distance

---

## Edge Computation

```python
# k-NN with cosine similarity
k = 25                  # Neighbors per node
threshold = 0.25        # Minimum similarity to create edge
```

**Results for layer 12:**
- 16,384 features × k=25 = 409,600 potential edges
- After threshold + deduplication = ~12,599 edges
- Edge density: ~0.77 edges per node (sparse, meaningful connections)

---

## Label Fetching Strategy

**Hybrid approach:**
1. Pre-fetch top 1000 labels per layer during pipeline run
2. Lazy-load remaining labels on hover/click in frontend

**Neuronpedia API patterns:**
```python
# Async client with rate limiting
async with aiohttp.ClientSession() as session:
    semaphore = asyncio.Semaphore(10)  # Max 10 concurrent

# Fetch with timeout and retry
async def fetch_feature(index):
    async with semaphore:
        async with session.get(url, timeout=30) as resp:
            return await resp.json()
```

**API quirk:** Neuronpedia returns `explanations` as array, use `explanations[0].description` for primary label.

---

## Output Schema Critical Detail

**Frontend expects `metadata.layers` as ARRAY, not single number:**

```python
# WRONG
"metadata": { "layer": 12 }

# CORRECT
"metadata": { "layers": [12] }
```

This matches the Zod schema in `graphSchema.ts`.

---

## File Sizes

| Compression | Layer 12 (16k nodes, 12k edges) |
|-------------|----------------------------------|
| Uncompressed | 5.75 MB |
| Gzipped | ~500 KB |

---

## Computation Times (M4 Pro)

| Step | Time |
|------|------|
| Download SAE weights | ~30 sec |
| UMAP computation | ~8 min |
| Edge computation | ~2 min |
| Label fetching (1000) | ~9 min |
| Export | ~1 sec |
| **Total** | ~20 min per layer |

---

## Caching Strategy

```
cache/{model}/layer_{N}/
├── decoder_vectors.npy    # 16384 × 2304 float32
├── positions.npy          # 16384 × 3 float32
├── edges.npy              # Variable length
└── labels.json            # {index: description}
```

Pipeline checks for cached files and skips completed steps. Use `--force` to recompute.

---

## Extending to New Models

Add to `config.py`:

```python
MODELS = {
    'gemma-2-2b': ModelConfig(
        model_id='gemma-2-2b',
        display_name='Gemma 2 2B',
        num_layers=26,
        features_per_layer=16384,
        d_model=2304,
        huggingface_repo='google/gemma-scope-2b-pt-res',
        sae_width='16k',
        neuronpedia_model_id='gemma-2-2b',
        neuronpedia_source_set='gemmascope-res-16k',
    ),
    # Add new model here
}
```

---

## Frontend Integration

1. Copy output to `packages/frontend/public/data/`
2. Update `App.tsx` to load the new file
3. Labels appear in node data but frontend needs UI to display them (TODO)

---

## Anti-Patterns

1. **Don't compute similarity on raw activations** - Use decoder vectors (they encode meaning)
2. **Don't use Euclidean distance** - Cosine similarity for normalized vectors
3. **Don't fetch all labels upfront** - 16k API calls = rate limits + slow
4. **Don't store positions in SQLite for MVP** - Static JSON files are simpler
