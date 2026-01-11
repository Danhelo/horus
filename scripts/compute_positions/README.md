# UMAP Position Computation Pipeline

Computes 3D positions for SAE features using UMAP dimensionality reduction on decoder vectors.

## The Core Insight

**Position IS meaning.** The decoder vector of a feature encodes "what this feature writes to the residual stream." When two features have similar decoder vectors, they have similar effects on model behavior. UMAP preserves this - nearby nodes in 3D = semantically related concepts.

## Pipeline Steps

1. **download_sae.py** - Download SAE weights from HuggingFace, extract decoder vectors
2. **compute_umap.py** - Run UMAP (2304D → 3D), compute k-NN edges via cosine similarity
3. **fetch_labels.py** - Fetch semantic labels from Neuronpedia API (top 1000 per layer)
4. **export_layer.py** - Combine into JSON matching frontend GraphJSONSchema
5. **run_pipeline.py** - Orchestrate all steps with caching and resume support

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run full pipeline for a single layer
python run_pipeline.py --model gemma-2-2b --layers 12

# Or run individual steps
python download_sae.py --model gemma-2-2b --layer 12
python compute_umap.py --model gemma-2-2b --layer 12
python fetch_labels.py --model gemma-2-2b --layer 12 --top-k 1000
python export_layer.py --model gemma-2-2b --layer 12 --no-compress
```

## Output

- `output/{model}/layer-{N}.json` - Position data for frontend
- `output/{model}/manifest.json` - Model metadata and layer index
- `cache/{model}/layer_{N}/` - Intermediate cached files

## Layer 12 Results (Gemma-2-2B)

| Metric | Value |
|--------|-------|
| Features | 16,384 |
| Edges (k=25, threshold=0.25) | 12,599 |
| Labels fetched | 1,000 |
| UMAP time | ~8 min on M4 Pro |
| Output size | 5.75 MB (uncompressed) |

## Configuration

Edit `config.py` to adjust:
- UMAP parameters (n_neighbors, min_dist, metric)
- Edge computation (k neighbors, similarity threshold)
- Output format (compression, precision)

## Supported Models

| Model | Layers | Features/Layer | HuggingFace Repo |
|-------|--------|----------------|------------------|
| gemma-2-2b | 26 | 16,384 | google/gemma-scope-2b-pt-res |
| gemma-2-9b | 42 | 16,384 | google/gemma-scope-9b-pt-res |

## Environment Variables

```bash
# Required for label fetching
NEURONPEDIA_API_KEY=sk-np-...
```

## TODO

- [ ] Compute remaining 25 Gemma-2-2B layers
- [ ] Compute all 42 Gemma-2-9B layers
- [ ] Publish to GitHub Releases
- [ ] Add frontend ModelSelector component
- [ ] Add IndexedDB caching in frontend
