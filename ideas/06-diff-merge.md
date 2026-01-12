# Diff/Merge: Comparing and Blending Ideaspaces

## The Concept

Every text has a feature fingerprint—a pattern of activations across ideaspace.

What if you could **compare** two fingerprints? See where they overlap, where they diverge?

What if you could **merge** them? Create something that lives in the space between two ideas?

---

## Diff: Seeing Divergence

### What gets compared?

1. **Two texts:** "How does my draft compare to this reference?"
2. **Two versions:** "How did my text change after this edit?"
3. **Two generations:** "Why did these two outputs from the same prompt differ?"
4. **Two mixes:** "What's the difference between my dial settings and yours?"

### Visualization: The Dual Graph

Render the same graph twice, side by side or overlaid:

- **Side by side:** Two graphs, same layout, different highlights
- **Overlay:** One graph, two colors (red vs blue), showing both fingerprints

Divergence is visible as:

- Nodes lit in one but not the other
- Intensity differences in shared nodes
- Path differences in trajectory view

### Visualization: The Delta Map

Instead of showing both fingerprints, show the **difference**:

- Nodes colored by: (Fingerprint A activation) - (Fingerprint B activation)
- Blue = A stronger here, Red = B stronger here, White = equal
- This immediately highlights what's distinctive about each

### Quantitative Diff

Beyond visualization:

- **Similarity score:** Cosine similarity of overall fingerprints
- **Top divergent features:** "These 10 features differ most"
- **Semantic summary:** LLM-generated description of the difference ("Text A is more formal and abstract; Text B is more concrete and emotional")

---

## Merge: Blending Ideaspaces

### The Operation

Given two feature fingerprints, create a blend:

- **Linear interpolation:** 50% A + 50% B
- **Weighted blend:** 70% A + 30% B (user-controlled slider)
- **Selective merge:** Take features X, Y, Z from A; features P, Q, R from B

Then generate text from the merged fingerprint.

### What Merge Creates

This is different from "rewrite text A in the style of text B" (a prompt-based task).

Merge operates at the **feature level**:

- It's more precise (specific features, not vibes)
- It's more predictable (you can see what's being combined)
- It can create combinations that prompts can't easily express

Example: Merge a technical paper's fingerprint with a poem's fingerprint. The result isn't "a poem about the paper's topic"—it's something weirder. Text that activates both technical-precision features AND lyrical-imagery features simultaneously. A novel hybrid.

### The Merge Slider

UI element: a slider between two endpoints (A and B).

As you drag from A toward B:

- The graph highlights shift continuously
- The text regenerates reflecting the blend
- You can stop anywhere along the spectrum

This is **continuous exploration** of the space between two ideas.

---

## Applications

### Style Transfer (Feature-Level)

Traditional style transfer: "Rewrite this in Shakespeare's style."

Feature-level style transfer: Take the content features from text A, the style features from text B, merge.

More controllable because you can see and adjust exactly which features are being transplanted.

### Idea Synthesis

You have two essays with different perspectives on a topic. Merge them to generate a synthesis that incorporates both viewpoints at the feature level—not just summarizing, but creating something that _thinks in both ways simultaneously_.

### Version Comparison

Track how a document evolves over edits. Each version has a fingerprint. Diff shows what changed. Merge could create intermediate versions or "what if" alternatives.

### Collaborative Blending

Alice and Bob each create a mix (dial settings). Merge their mixes. The result reflects both their perspectives—a collaborative creation neither could have made alone.

---

## Merge Conflicts

Sometimes features conflict:

- Text A activates "formal"; Text B activates "casual"
- Linear blend might produce incoherence

Handling strategies:

1. **Average and accept instability:** Let the blend be weird. Sometimes that's the point.
2. **Conflict detection:** Warn users when blending antagonistic features
3. **Resolution UI:** Show conflicting features, let user decide (keep A, keep B, compromise)

---

## The Merge Trajectory

An advanced view: instead of a single merge point, define a **path** from A to B.

Generate text at multiple points along the path. See how the output evolves as you transition from one ideaspace position to another.

This could create:

- A "morph" video of text transforming
- A narrative arc from one concept to another
- A gradient exploration of the space between ideas

---

## Diff/Merge as Versioning

This suggests a feature: **ideaspace version control**.

- Every significant state (text + dial settings + graph position) is a commit
- Diff between commits to see what changed
- Merge branches of exploration
- Branch from any point to try alternatives

Git for ideaspace.

---

## Open Questions

### How do we handle texts of different lengths?

Merging a tweet's fingerprint with an essay's fingerprint—do we normalize? Aggregate differently?

### What's the granularity of merge?

Global (whole fingerprint) vs local (specific features) vs temporal (merge at certain positions in the trajectory)?

### Can you merge more than two?

Three-way merge? N-way blend? UI complexity increases, but could enable interesting combinations.

### What does "conflict" really mean?

Some feature combinations that seem conflicting might actually be interesting. How do we distinguish productive tension from incoherence?

---

_Two ideas. Two fingerprints. One space between them. What lives there? Let's find out._
