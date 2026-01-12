# Neuronpedia API + SAE Concepts

## Gemma-2-2B Config

```typescript
const GEMMA = {
  modelId: 'gemma-2-2b',
  layers: 26, // 0-25
  featuresPerLayer: 16384, // 16k SAE
  getSourceId: (layer: number) => `${layer}-gemmascope-res-16k`,
};
```

## Key Endpoints

| Endpoint                                | Method | Purpose                               |
| --------------------------------------- | ------ | ------------------------------------- |
| `/api/feature/{model}/{source}/{index}` | GET    | Feature details + explanations        |
| `/api/search-all`                       | POST   | Top features for text (all layers)    |
| `/api/search-topk-by-token`             | POST   | Top-K features per token              |
| `/api/steer`                            | POST   | Generate with steering (100/hr limit) |
| `/api/activation/new`                   | POST   | Activations for custom text           |
| `/api/graph/generate`                   | POST   | Attribution graph (may 503)           |

## Steer Request

```typescript
{
  modelId: 'gemma-2-2b',
  prompt: string,
  features: [{ modelId: string, layer: '12-gemmascope-res-16k', index: number, strength: number }],
  temperature?: 0.7, n_tokens?: 100, steer_method?: 'SIMPLE_ADDITIVE'
}
```

**Strength guide**: 0=none, 1-2=noticeable, 3-5=strong, 5-10=dominant, >10=incoherent

## Search Request

```typescript
{ modelId: 'gemma-2-2b', sourceSet: 'gemmascope-res-16k', text: string, numResults?: 50 }
```

## Limits

| Resource       | Limit        |
| -------------- | ------------ |
| Text input     | 1024 tokens  |
| Array input    | 4×256 tokens |
| TopK per token | 20           |
| Steers/hour    | 100          |

## Caching

| Data                  | TTL         | Storage          |
| --------------------- | ----------- | ---------------- |
| Features/Explanations | 1hr+        | LRU + SQLite     |
| Activations           | 5min        | LRU by text hash |
| Search results        | Don't cache | -                |

## Gotchas

1. Source ID format exact: `12-gemmascope-res-16k`
2. Feature index may be string in responses
3. Graph endpoint may 503 (GPUs busy) - retry with backoff
4. Use `explanations[0].description` for primary label

## SAE Concepts

**Feature** = learned direction in activation space representing a concept

```typescript
interface Feature {
  modelId: string;
  layer: number;
  index: number;
  label?: string;
}
```

**Activation** = how strongly feature fires (typically 0-10, sparse)

```typescript
interface FeatureActivation {
  featureId: string;
  activation: number;
}
```

**Steering** = modify behavior by adding decoder vectors

```
activation_steered = activation_original + Σ(strength × decoder)
```

**Trajectory** = path through feature space, token by token

- Position = weighted centroid of active features
- Visualize as 3D path + timeline

**UMAP Positioning**

- Decoder vectors → cosine similarity → UMAP 3D
- Nearby nodes = semantically related
- Position IS meaning
