# The Graph: Ideaspace as Territory

## The Core Metaphor

HORUS presents ideaspace as **navigable territory**—a 3D hypergraph where:

- **Nodes** are concepts (SAE features)
- **Edges** are relationships (co-activation, semantic similarity)
- **Position** encodes meaning (UMAP projection)
- **Hierarchy** encodes abstraction (zoom reveals sub-concepts)

You don't query ideaspace. You _travel_ through it.

---

## Structure

### Nodes: Features as Concepts

Each node represents a feature extracted by a Sparse Autoencoder. Features are the "things the model knows"—concepts, tones, structures, patterns that activate in response to specific inputs.

Node properties:

- **Position:** 3D coordinates from UMAP projection of feature embeddings
- **Size:** Could encode importance, frequency, or current activation level
- **Color:** Encodes category, activation intensity, or user-defined meaning
- **Label:** Auto-generated explanation (from Neuronpedia) or user annotation

### Edges: Relationships

What do connections mean? Multiple interpretations, possibly layered:

1. **Co-activation:** Features that frequently fire together
2. **Semantic similarity:** Features with similar explanations/embeddings
3. **Causal influence:** From circuit tracing—feature A contributes to feature B
4. **User-defined:** Manually drawn connections for personal ontology

Edge properties:

- **Weight:** Strength of relationship
- **Direction:** For causal edges, shows flow of influence
- **Visibility:** Can be filtered by type or strength

### Hierarchy: Fractal Zoom

The critical innovation: **nodes contain nodes**.

Zoom into "sadness" and you find: melancholy, grief, disappointment, longing, ennui. Zoom into "melancholy" and you find more specific features. Zoom out and "sadness" clusters with other emotions into "affect."

This hierarchy is **not pre-computed**. It's generated on-demand via:

1. **Clustering algorithms** on feature embeddings
2. **LLM-assisted grouping** based on semantic queries
3. **User perspective** feeding back into the structure

The grouping is always **perspectival**—there's no single "true" hierarchy. HORUS asks: "How should I organize this for _you_, given _your_ current intent?"

---

## Navigation

### Movement Modes

**Orbit:** Rotate around a focal point. Good for examining a cluster from different angles.

**Fly:** Move freely through the space. WASD + mouse or touch gestures.

**Teleport:** Click a node or region to jump there instantly.

**Semantic jump:** Natural language query → system navigates to relevant region. "Take me to concepts about uncertainty."

### Zoom Semantics

Zoom is not just camera distance. It's **abstraction level**.

- **Zoom out:** Individual features collapse into clusters. You see the forest, not the trees.
- **Zoom in:** Clusters expand into constituent features. Details emerge.

This requires dynamic LOD (level of detail) rendering:

- Far: Show cluster centroids with aggregate labels
- Near: Show individual features
- Very near: Show feature details, activation history, explanations

### Semantic Axes

The UMAP projection is arbitrary—rotate it and meaning is preserved. But users need orientation.

Solution: **Define semantic axes** that give the space interpretable structure.

Options:

1. **Discovered axes:** PCA or similar on features, labeled by what varies along them
2. **User-defined axes:** "I want the x-axis to be concrete↔abstract"
3. **Query-defined axes:** "Organize by emotional valence on one axis, formality on another"

The axes don't change the underlying graph—they change the _projection_ you're viewing.

---

## Topology: Static vs. Dynamic

### Static Backbone

Some structure should persist:

- The UMAP projection of all features (canonical layout)
- The similarity/co-activation edges
- The basic clustering at each zoom level

This gives users a _consistent territory_ they can learn.

### Dynamic Overlays

But the graph should also respond to context:

- **Activation highlighting:** Which features are active _right now_ for the current text
- **Query filtering:** Show only features relevant to a semantic query
- **Steering effects:** Visualize how current steering settings affect the space

The hybrid: **stable backbone + dynamic highlighting**. The territory is consistent; what's illuminated depends on what you're doing.

---

## Open Questions

### How big is the graph?

Gemma-2-2B SAEs have ~16k-65k features per layer. Multiple layers = hundreds of thousands of features. Can we render this? Do we show all layers at once or let users switch?

### Which edges matter?

Co-activation edges could be dense (many features co-occur). Do we threshold? Show only top-k connections per node? Let users filter?

### How do we handle multiple layers?

SAE features are extracted per-layer. Early layers = low-level features. Later layers = abstract features. Do we:

- Show one layer at a time (user selects)
- Stack layers visually (3D depth = layer)
- Merge across layers (single unified space)

### How does the LLM-assisted hierarchy work?

When you zoom in and request "show me the sub-concepts of melancholy," what happens?

- Does the system query an LLM with feature descriptions?
- Does it use embedding similarity?
- How do we cache/reuse these groupings?

---

## The Territory as Interface

The graph is not a visualization of data. It's the **interface itself**.

- You don't use the graph to understand the model, then do something else. The graph IS where you work.
- Navigation IS exploration IS creation.
- The territory is the tool.

This is the paradigm shift from dashboards to instruments.

---

_Ideaspace stretches before you. Constellations of meaning. Paths between concepts. Where will you go?_
