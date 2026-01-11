# Temporal: Text as Trajectory

## The Insight

A piece of text is not a static object. It's a **journey through ideaspace**.

Each token activates features. As you read (or as the model generates), you trace a path through the feature graph. "Melancholy" lights up, then "memory", then "distance", then "return."

Text is a trajectory. HORUS should show you the path.

---

## The Trajectory View

### What It Shows

A text of N tokens creates N activation snapshots. Each snapshot is a point in feature space. Connected, they form a path.

Visualizations:
1. **Animated trail:** Watch features light up sequentially as you "play" the text
2. **Static path:** A glowing line through the graph showing the route taken
3. **Heatmap overlay:** Nodes colored by how often they were visited
4. **Velocity field:** Arrows showing the "direction" of text at each point

### Scrubbing

Like a video timeline. Drag a scrubber across the text, watch the graph highlight position by position.

Or: click a node in the graph, highlight the moments in the text that activated it.

Bidirectional linking between text position and graph position.

---

## The Spectrogram

Inspired by audio spectrograms: time on one axis, features on another, intensity as color.

```
        Feature 1  ██░░░░██████░░░░░░
        Feature 2  ░░████░░░░░░██████
        Feature 3  ██████████░░░░░░░░
                   ─────────────────────→ Token position
```

This is a different view than the 3D graph—a flattened, analytical view. Useful for:
- Seeing which features dominate at which points
- Comparing two texts' spectrographic signatures
- Identifying repetitive patterns (features that cycle)

### Spectrogram + Graph Integration

The spectrogram could be an overlay or a separate panel. When you hover on a spectrogram cell, the corresponding node highlights in the graph. When you select a region of the spectrogram, you're selecting a subspace of features to steer.

---

## Generation as Movement

When the model generates text, you're watching it *move* through ideaspace in real-time.

The "cursor" traces a path as tokens emerge. You see the model's trajectory as it writes.

This creates opportunities:
- **Anticipation:** See where the model is heading before the words appear
- **Intervention:** If you don't like the direction, steer before it commits
- **Understanding:** "Oh, it went through 'formal' on its way to this conclusion"

### The Generation Frontier

At any moment during generation, there's a "frontier"—the current position plus the probable next positions (based on logits/sampling).

Could we visualize this? A cloud of likely next-steps, narrowing as the model commits? This might be too noisy, but worth exploring.

---

## Comparing Trajectories

Two texts about the same topic take different paths. What can we learn?

### Overlay View
Render both trajectories on the same graph. Color-coded. See where they diverge, where they converge.

### Alignment View
Attempt to align trajectories (like sequence alignment in bioinformatics). Where do they match? Where do they differ?

### Delta View
For each token position, show the difference vector between the two texts' activations. "At this point, Text A went toward 'technical' while Text B went toward 'poetic'."

---

## Temporal Steering

Steering doesn't have to be global. You could steer **at a specific time point**.

"For the first half of this text, boost 'concrete'. For the second half, boost 'abstract'."

This creates narrative arcs through feature space:
- Start grounded, end transcendent
- Start formal, gradually warm
- Start dense, end sparse

The text becomes a **composed trajectory**—you're not just shaping what features are present, but when they appear.

---

## The Text-Graph Duality

Every text has a trajectory (text → graph).
Every trajectory implies texts (graph → text).

In the limit:
- You could *draw* a trajectory on the graph and ask: "What text would take this path?"
- You could *sketch* a spectrogram pattern and generate text that matches it.

This inverts the usual direction. Instead of writing text and seeing its shape, you draw the shape and the text follows.

---

## Open Questions

### How do we aggregate across layers?
Features exist at each layer. A token's "activation" is really a stack of activations across layers. Do we:
- Show one layer's trajectory at a time?
- Composite across layers somehow?
- Let users toggle layers?

### How do we handle attention?
SAE features capture MLP activations, but attention is also part of the trajectory. Do we incorporate attention patterns? This might be a v2 concern.

### What's the right granularity?
Token-level might be too fine for some purposes. Sentence-level? Paragraph-level? User-adjustable?

### Does real-time trajectory visualization distract or enlighten?
Watching the path trace as you type might be mesmerizing or overwhelming. Need to test.

---

## The Temporal Primitive

Time is not a secondary dimension in HORUS. It's fundamental.

Ideas unfold. Meaning develops. The path matters as much as the destination.

HORUS should make the temporal structure of thought visible—and steerable.

---

*Watch the thought move. See where it's been. Guide where it goes.*
