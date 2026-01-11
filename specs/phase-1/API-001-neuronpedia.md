# API-001: Neuronpedia Client

| Field | Value |
|-------|-------|
| **Spec ID** | API-001 |
| **Phase** | 1 - Static Viewer |
| **Status** | Complete |
| **Package** | `@horus/backend` |

## Summary

Backend service that proxies Neuronpedia API calls, hiding the API key from the client and providing caching for feature data.

## Requirements

### REQ-1: API Key Protection

The Neuronpedia API key must never be exposed to the frontend.

**Acceptance Criteria:**
- [x] API key stored in server environment only
- [x] All Neuronpedia calls proxied through backend
- [x] No API key in client-side code or network requests

### REQ-2: Feature Fetching Endpoint

```
GET /api/features/:model/:layer/:index
```

Returns feature details from Neuronpedia with caching.

**Response:**
```json
{
  "modelId": "gemma-2-2b",
  "layer": 12,
  "index": 1622,
  "label": "nostalgic memory recall",
  "description": "Activates on text about...",
  "topLogits": [{ "token": "memory", "value": 0.95 }],
  "cached": true,
  "cachedAt": "2025-01-10T...",
  "stale": false
}
```

**Acceptance Criteria:**
- [x] Endpoint returns feature data
- [x] Response includes cache status
- [x] 404 for non-existent features

### REQ-3: Feature Caching

Features are mostly static - cache aggressively.

**Acceptance Criteria:**
- [x] Cache features in SQLite for 24+ hours
- [x] Return cached data if available
- [x] Background refresh for stale cache (stale-while-revalidate after 12h)
- [x] Cache hit rate logged (via periodic logging + `/api/features/stats` endpoint)

### REQ-4: Activation Endpoint

```
POST /api/activations
{ "text": "The cat sat on the mat", "model": "gemma-2-2b", "layers": [12, 13, 14] }
```

Returns which features activate for the given text.

**Acceptance Criteria:**
- [x] Proxies to Neuronpedia `/api/activation/new`
- [x] Returns top-k activating features per layer
- [x] Rate limited (20 req/min default)

### REQ-5: Search Endpoint

```
POST /api/features/search
{ "query": "emotions", "limit": 20 }
```

**Acceptance Criteria:**
- [x] Proxies to Neuronpedia `/api/search-all`
- [x] Returns matching features
- [x] Results cached briefly (5 min)

### REQ-6: Error Handling

**Acceptance Criteria:**
- [x] 429 from Neuronpedia returns clear error to client
- [x] 503 (GPUs busy) triggers retry suggestion
- [x] Network failures return 502

### REQ-7: Rate Limiting

**Acceptance Criteria:**
- [x] Client-facing rate limits (100 req/min general, 20 req/min proxy)
- [x] Respect Neuronpedia rate limits
- [x] Return `Retry-After` header on 429

## Technical Notes

- See `.claude/rules/api/neuronpedia.md` for API details
- Gemma-2-2B has 26 layers (0-25)
- Source ID format: `{layer}-gemmascope-res-16k`
- Use exponential backoff on upstream failures

## Dependencies

- [GRAPH-001](GRAPH-001-data-model.md) - Feature data types

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
