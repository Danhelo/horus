# Technical Foundation: Building HORUS

## The Stack Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Three.js   │  │   Mixer     │  │   Text Panel    │  │
│  │  3D Graph   │  │   Panel     │  │   + Spectrogram │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    State Management                      │
│      (Graph state, dial values, text, activations)      │
├─────────────────────────────────────────────────────────┤
│                      API Layer                           │
├──────────────────────┬──────────────────────────────────┤
│   Neuronpedia API    │       LLM Inference API          │
│  - Feature lookup    │    - Text generation             │
│  - SAE projection    │    - Steering                    │
│  - Circuit graphs    │    - Semantic queries            │
│  - UMAP coordinates  │                                  │
└──────────────────────┴──────────────────────────────────┘
```

---

## Core Dependencies

### Neuronpedia
The backbone. Provides:
- **SAE feature data:** 50M+ features across multiple models
- **Activation API:** Run text through model, get feature activations
- **Steering API:** Clamp/boost features, generate steered output
- **UMAP embeddings:** Pre-computed 2D/3D projections of feature space
- **Circuit tracing:** Attribution graphs showing feature connections

Neuronpedia is open source and has a public API. We can self-host for performance if needed.

### Target Model: Gemma-2-2B-it
Why Gemma-2-2B:
- Best SAE coverage on Neuronpedia
- Small enough for reasonable latency
- Instruction-tuned for good generation
- Open weights, can self-host

Fallback: Llama-3.2-1B (even smaller, if latency is critical)

---

## Technical Challenges

### 1. Real-Time Activation Projection

**The problem:** Every text change needs to:
1. Run inference through the model
2. Extract activations at target layer(s)
3. Project through SAE encoder
4. Update graph visualization

This is expensive. Naive implementation = seconds of latency.

**Solutions:**
- **Debounce:** Don't recompute on every keystroke. Wait for pause.
- **Incremental:** Only recompute for changed tokens (if model supports KV caching)
- **Approximate:** Use smaller proxy model for fast feedback, full model for final
- **Client-side SAE:** WebGPU to run SAE projection in browser (ambitious)
- **Streaming:** Start showing partial results before full computation

**Target:** < 300ms from text change to graph update visible.

### 2. Graph Rendering at Scale

**The problem:** Tens of thousands of nodes + edges. Can't render all of them.

**Solutions:**
- **Frustum culling:** Only render what's in view
- **LOD (Level of Detail):** Far nodes = simple shapes, near nodes = full detail
- **Clustering:** At zoom-out levels, show cluster centroids not individual nodes
- **WebGPU instancing:** Batch-render similar nodes
- **Progressive loading:** Load detail as user navigates

**Target:** Smooth 60fps navigation with 50k+ nodes in the data structure.

### 3. Real-Time Steering

**The problem:** Steering requires inference with modified activations. This is as expensive as generation.

**Solutions:**
- **Speculative execution:** Pre-compute likely steering outcomes
- **Quantized models:** Use INT4/INT8 quantization for faster inference
- **Streaming generation:** Show tokens as they generate, don't wait for full completion
- **Smaller steering model:** Use smaller model for steering exploration, larger for final output

**Target:** < 500ms from dial change to text starting to update.

### 4. Dynamic Hierarchy Generation

**The problem:** When user zooms into a node, we need to compute/retrieve sub-features. This can't all be pre-computed.

**Solutions:**
- **Caching:** Once computed, cache hierarchy results
- **LLM-assisted grouping:** Fast LLM call to suggest groupings
- **Pre-compute common zooms:** Top-level hierarchy can be pre-computed
- **Lazy loading:** Fetch sub-hierarchy only when user zooms to that level

**Target:** < 200ms to expand a node's children.

---

## Data Architecture

### Feature Data (Static, Pre-loaded)
```javascript
{
  features: [
    {
      id: "gemma-2-2b-layer12-feat3421",
      position: [x, y, z],  // UMAP coordinates
      label: "nostalgic memory recall",
      category: "emotion",
      layer: 12
    },
    // ... 50k+ features
  ],
  edges: [
    { source: "feat3421", target: "feat892", weight: 0.73, type: "coactivation" },
    // ... millions of edges (filtered/thresholded)
  ]
}
```

### Session State (Dynamic)
```javascript
{
  text: "The current text being worked on...",
  activations: {
    "feat3421": 0.85,
    "feat892": 0.32,
    // sparse: only active features
  },
  dials: {
    "formality": { value: 0.6, features: [...] },
    "abstractness": { value: -0.2, features: [...] }
  },
  camera: { position: [x, y, z], target: [x, y, z], zoom: 1.5 },
  snapshots: [ /* saved states */ ],
  trajectory: [ /* token-by-token activations */ ]
}
```

### Derived State
```javascript
{
  activeNodes: Set([...]),  // nodes to highlight
  visibleNodes: Set([...]), // nodes in view (frustum culled)
  clusterMembership: Map(), // which cluster each node belongs to at current zoom
  dialTraces: Map()         // which nodes each dial affects
}
```

---

## API Design

### Neuronpedia Calls

**Get activations for text:**
```
POST /api/activations
{ model: "gemma-2-2b", text: "...", layers: [12, 13, 14] }
→ { activations: { layer12: { feat_id: strength, ... }, ... } }
```

**Generate with steering:**
```
POST /api/generate
{
  model: "gemma-2-2b-it",
  prompt: "...",
  steering: { feat3421: +0.5, feat892: -0.3 },
  max_tokens: 100
}
→ { text: "...", activations: [...] }  // streaming
```

**Get feature info:**
```
GET /api/features/{feature_id}
→ { label, description, top_activations, related_features, ... }
```

### Internal API (if we add a backend)

**Save session:**
```
POST /api/sessions
{ user_id, state }
→ { session_id }
```

**Share artifact:**
```
POST /api/artifacts
{ type: "fingerprint" | "trajectory" | "diff", data, visibility: "public" | "unlisted" }
→ { artifact_id, share_url }
```

---

## Frontend Architecture

### Three.js / React Three Fiber
The 3D graph is the core UI.

Components:
- `<GraphCanvas />` - main Three.js canvas
- `<NodeMesh />` - instanced mesh for all nodes
- `<EdgeLines />` - line geometry for edges
- `<GlowEffects />` - post-processing for activation glow
- `<CameraController />` - orbit, fly, zoom controls

### Mixer Panel
React components, could use a UI library (Radix, shadcn).

Components:
- `<Dial />` - individual dial with drag interaction
- `<DialGroup />` - collection of related dials
- `<MixerPanel />` - full mixer UI

### Text Panel
- `<TextEditor />` - contenteditable or textarea with highlighting
- `<Spectrogram />` - canvas-based spectrogram view
- `<Timeline />` - scrubber for trajectory

### State Management
Zustand or Jotai for lightweight reactive state. Need to handle:
- Frequent updates (activations changing on keystroke)
- Computed derivations (visible nodes, dial traces)
- Undo/redo history (snapshots)

---

## Performance Budget

| Operation | Target Latency |
|-----------|----------------|
| Graph render (60fps) | < 16ms |
| Text → activation | < 300ms |
| Dial → text update | < 500ms |
| Zoom → hierarchy load | < 200ms |
| Navigation | < 16ms (no network) |
| Export fingerprint | < 1s |
| Export trajectory GIF | < 5s |

---

## Phased Build

### Phase 1: Static Viewer
- Load pre-computed graph
- Basic navigation (orbit, zoom)
- Paste text, show activation highlights
- No steering, no generation

### Phase 2: Interactive Explorer
- Dial controls (pre-defined dials)
- Steering via Neuronpedia API
- Text generation with steering
- Spectrogram view

### Phase 3: Dynamic Hierarchy
- LLM-assisted zoom/hierarchy
- Semantic queries ("take me to...")
- Custom dial creation

### Phase 4: Social Features
- Save/share artifacts
- Gallery
- Profiles

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Neuronpedia API rate limits | Self-host Neuronpedia, cache aggressively |
| Latency kills flow | Aggressive optimization, speculative execution, manage expectations |
| Graph too complex to navigate | Strong defaults, guided onboarding, presets |
| Feature labels are meaningless | Curate high-quality labels, let users contribute |
| WebGL compatibility issues | Fallback 2D view, progressive enhancement |

---

## Open Technical Questions

1. **Multi-layer visualization:** How do we show features from multiple layers? Tabs? 3D depth? Merged space?

2. **Attention vs. SAE features:** SAEs capture MLP activations. Should we also visualize attention patterns?

3. **Local vs. cloud inference:** Can we do meaningful steering with client-side compute? Or always need server?

4. **Mobile experience:** Is there a meaningful mobile experience? Or desktop-only?

5. **Collaboration:** Real-time multi-user sessions? Complex but interesting.

---

*The infrastructure is ready. Neuronpedia + open models + WebGL. We just need to build the instrument.*
