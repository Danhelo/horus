# LIVE-000: Live Neural Surgery Master Plan

| Field | Value |
|-------|-------|
| **Spec ID** | LIVE-000 |
| **Phase** | 3 - Dynamic Hierarchy |
| **Status** | Draft |
| **Type** | Master Plan |

## Vision

Transform the HORUS feature graph from a **visualization** into a **control surface** for neural surgery. Users click/adjust nodes to directly steer Gemma-2-2B generation in real-time, with semantic zoom allowing granularity control via "steering groups."

> *"The text and graph are two views of the same thing. Change one, the other updates. There's no 'submit' button. There's just... the state, and how you're shaping it."*

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERACTION                               │
│  Click Node │ Adjust Dial │ Search Concept │ Zoom In/Out │ Ask "Why?"   │
└──────┬──────┴──────┬──────┴───────┬────────┴──────┬──────┴──────┬───────┘
       │             │              │               │             │
       ▼             ▼              ▼               ▼             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STEERING LAYER                                   │
│                                                                          │
│  activeFeatures    steeringVector    semanticGroups    spatialClusters  │
│  Map<id,strength>  {features:[]}     Map<concept,ids>  LOD-based        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼ (debounced 2-3s)
┌─────────────────────────────────────────────────────────────────────────┐
│                         GENERATION LAYER                                 │
│                                                                          │
│  POST /api/generation/generate                                           │
│  { prompt, features: [{layer, index, strength}], stream: true }         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼ (SSE stream)
┌─────────────────────────────────────────────────────────────────────────┐
│                         FEEDBACK LAYER                                   │
│                                                                          │
│  Token Stream → Text Panel    Activations → Graph Highlights             │
│  LLM Suggestions → New Groups    Circuit Trace → Attribution Panel       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Specs Overview

| Spec | Title | Purpose |
|------|-------|---------|
| **LIVE-000** | Master Plan | This document - architecture overview |
| **[LIVE-001](LIVE-001-click-to-steer.md)** | Click-to-Steer | Core interaction: click node → steer generation |
| **[GRP-001](GRP-001-steering-groups.md)** | Steering Groups | Cluster features into manipulable concepts |
| **[CIR-001](CIR-001-circuit-tracing.md)** | Circuit Tracing | "Why did this generate?" attribution discovery |
| **[SUG-001](SUG-001-llm-suggestions.md)** | LLM Suggestions | Context-aware group recommendations |

---

## Core Concepts

### 1. Active Features

Features the user has selected for steering, with their strengths.

```typescript
interface ActiveFeature {
  featureId: string;      // e.g., "gemma-2-2b/12/2341"
  layer: number;
  index: number;
  strength: number;       // -10 to +10 (0 = no effect)
  source: 'click' | 'dial' | 'group' | 'circuit';
}

// Store
activeFeatures: Map<featureId, ActiveFeature>
```

### 2. Steering Groups

Collections of features that act as a single control.

```typescript
interface SteeringGroup {
  id: string;
  label: string;
  features: Map<featureId, weight>;  // Constituent features + weights
  position: [x, y, z];               // Centroid in graph
  radius: number;                     // Visual size
  source: 'spatial' | 'semantic' | 'circuit' | 'precomputed' | 'user';
  strength: number;                   // Current group strength (like a dial)
}
```

### 3. Generation Status

Track the steering → generation pipeline state.

```typescript
type GenerationStatus =
  | { state: 'idle'; quota: { remaining: number; resetAt: number } }
  | { state: 'pending'; changesQueued: number; generatesIn: number }
  | { state: 'generating'; tokensReceived: number; startedAt: number }
  | { state: 'limited'; resetAt: number };
```

---

## Rate Limit Strategy

**Constraint:** Neuronpedia allows 100 steers/hour (~1 per 36 seconds average).

**Approach: Debounced Auto-Generate**

1. User makes changes (click, dial, group adjust)
2. Changes batch locally (no API call yet)
3. After 2-3s of no changes, trigger generation
4. Show "Pending... generating in 2s" countdown
5. Display quota: "87/100 steers remaining"
6. When rate limited: disable steering, show reset countdown

```
User clicks node →
  activeFeatures updates instantly →
  Graph highlights immediately →
  Debounce timer starts (2s) →
  Timer expires →
  Compute steering vector →
  POST to Neuronpedia →
  Stream tokens back →
  Update text + trajectory →
  Highlight contributing features
```

---

## Semantic Zoom Levels

| Zoom Level | Distance | View | Interaction |
|------------|----------|------|-------------|
| **Far** | > 100 | ~20 mega-clusters | Click = steer whole domain |
| **Medium** | 30-100 | ~200 groups | Click = steer concept |
| **Near** | < 30 | Individual nodes | Click = steer single feature |

**Transition behavior:**
- Smooth morphing between levels (300ms animation)
- Clusters expand/collapse as camera moves
- Labels appear/disappear based on screen space

---

## Three-Tier Grouping System

### Tier 1: Precomputed Groups (~50)

Ship with curated groups for common concepts:
- Emotion: joy, sadness, anger, fear, surprise
- Style: formal, casual, technical, poetic
- Domain: science, art, politics, personal
- Structure: concise, verbose, narrative, analytical

**Generated during build** via batch Neuronpedia search.

### Tier 2: Search-Based Groups (User Explicit)

User types "playfulness" → system creates group from search results.

**Flow:**
1. Cmd+K opens search bar
2. User enters concept
3. `/api/search-all` returns top features
4. Group rendered as super-node in graph
5. User can adjust group strength

### Tier 3: LLM-Suggested Groups (Context-Aware)

System observes user actions → suggests relevant groups.

**Flow:**
1. User boosts "nostalgia" dial
2. After 5s, system sends context to LLM
3. LLM suggests: "temporal_distance", "sensory_memory", "bittersweet"
4. Suggestions appear in mixer panel
5. Click to create/activate group

**Rate limit:** Max 1 suggestion per 30s, cached for similar contexts.

---

## Circuit Tracing Integration

### Discovery Mode

User asks "Why did this word appear?" → system shows attribution.

**Flow:**
1. User selects output token/phrase
2. POST to `/api/circuits/trace`
3. Attribution graph returned
4. Display as 2D visualization (or overlay on 3D graph)
5. Click attribution node → highlight in main graph

### Circuit → Steering Group

"This circuit produces formal tone" → "Create dial from circuit"

Converts attribution graph into a steering group for direct manipulation.

---

## Implementation Phases

### Phase A: Connect Steering to Generation (Foundation)

**Goal:** Make existing dials actually generate text.

- Connect `steeringSlice` computed vector → generation endpoint
- Add `generationStatus` to appStore
- Create `useSteeringGeneration` hook with debouncing
- Add GenerationStatus UI component
- Handle rate limit headers from backend

**Verification:** Turn dial → wait 2s → see text change.

### Phase B: Click-to-Steer (Core Interaction)

**Goal:** Click any node to add it to steering.

- Add `activeFeatures: Map` to appStore
- Modify NodeMesh click handler
- Create QuickSteeringPanel component
- Connect activeFeatures to steering vector
- Visual feedback: active nodes glow cyan

**Verification:** Click node → see it highlighted → text steered.

### Phase C: Spatial Clustering (Zoom-Based Groups)

**Goal:** Zooming out shows steering groups.

- Create `spatialClustering.ts` utility
- Add `clusterLevel` to LOD state
- Create `ClusterMesh.tsx` for rendering groups
- Smooth transition animations

**Verification:** Zoom out → see clusters → click cluster → steer multiple features.

### Phase D: Semantic Groups (Three-Tier)

**Goal:** Full semantic grouping system.

- **D1:** Generate precomputed groups during build
- **D2:** Search bar (Cmd+K) for user-created groups
- **D3:** LLM suggestions with rate limiting

**Verification:** Search "playfulness" → group appears → text becomes playful.

### Phase E: Circuit Tracing (Discovery)

**Goal:** See why text was generated.

- Backend: `/api/circuits/trace` with retry logic
- CircuitPanel component
- "Create group from circuit" action

**Verification:** Generate text → click "Why?" → see attribution.

### Phase F: Live Annotation (Streaming Highlights)

**Goal:** Features light up as text generates.

- Post-generation: fetch activations for full text
- Scrubbing timeline highlights features

**Verification:** Generate → scrub timeline → see features that caused each token.

---

## File Summary

### Frontend

| File | Action | Purpose |
|------|--------|---------|
| `stores/appStore.ts` | Modify | Add activeFeatures, generationStatus, clusterLevel |
| `hooks/useSteeringGeneration.ts` | Create | Connect steering → generation with debounce |
| `hooks/useSuggestions.ts` | Create | LLM group suggestions |
| `components/graph/NodeMesh.tsx` | Modify | Click adds to activeFeatures |
| `components/graph/ClusterMesh.tsx` | Create | Render steering groups |
| `components/ui/GenerationStatus.tsx` | Create | Show generation state + quota |
| `components/ui/QuickSteeringPanel.tsx` | Create | Per-node steering controls |
| `components/ui/SearchBar.tsx` | Create | Semantic group creation (Cmd+K) |
| `components/ui/SuggestedGroups.tsx` | Create | LLM suggestion chips |
| `components/panels/CircuitPanel.tsx` | Create | Attribution graph view |
| `utils/spatialClustering.ts` | Create | Zoom-based clustering |
| `services/semanticGrouping.ts` | Create | All three grouping approaches |

### Backend

| File | Action | Purpose |
|------|--------|---------|
| `routes/features.ts` | Modify | Add `/search-to-group` endpoint |
| `routes/suggestions.ts` | Create | `/suggest-groups` with LLM |
| `routes/circuits.ts` | Create | Circuit tracing proxy |
| `services/llm.ts` | Create | LLM client for suggestions |

### Scripts

| File | Action | Purpose |
|------|--------|---------|
| `scripts/generate_groups.py` | Create | Precompute ~50 steering groups |
| `public/groups/precomputed.json` | Create | Cached precomputed groups |

---

## Success Criteria

1. **Dial turns → text changes** within 3 seconds
2. **Click node → steering adjusts** with visual feedback
3. **Zoom out → see clusters** that act as group controls
4. **Search concept → create dial** for that concept
5. **Ask "why" → see circuit** showing attribution
6. **Flow feels continuous** - no jarring mode switches

---

## Technical Constraints

| Constraint | Mitigation |
|------------|------------|
| 100 steers/hour | Debounce 2-3s, show quota, batch changes |
| ~2-5s latency | Show pending state, stream tokens |
| Graph 503s | Retry with backoff, cache aggressively |
| 50k nodes | Use existing InstancedMesh, cluster on zoom-out |
| Activation fetches | Batch after generation, not per-token |

---

## Open Questions

1. **Multi-model steering:** Could we steer two models and compare outputs?
2. **Steering persistence:** Save steering configurations as shareable "presets"?
3. **Collaborative steering:** Multiple users adjusting same session?
4. **Voice steering:** "Make it more playful" → LLM translates to features?
5. **Undo granularity:** Undo individual clicks vs. undo to last generation?

---

## References

- [ideas/01-the-primitive.md](../../ideas/01-the-primitive.md) - Neural surgery as atomic interaction
- [ideas/03-flow.md](../../ideas/03-flow.md) - The dissolution of read/write boundaries
- [ideas/05-mixing.md](../../ideas/05-mixing.md) - Dials, traces, perspectival grouping
- [.claude/rules/03-neuronpedia.md](../../.claude/rules/03-neuronpedia.md) - API reference

---

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-11 | Initial draft |
