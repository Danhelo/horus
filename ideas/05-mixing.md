# Mixing: Dials, Traces, and Perspectival Grouping

## The Mixer as View

The mixer panel is not separate from the graph. It's a **different view of the same structure**.

Each dial corresponds to a trace through the graph—a subset of features grouped into a manipulable concept. When you turn a dial:

1. The trace highlights in the graph
2. The features along that trace amplify/attenuate
3. The text regenerates reflecting the change

Dial → trace → features → text. All connected.

---

## Anatomy of a Dial

### What a dial represents

A dial is a **weighted sum of features**—like Goodfire's "factors" from NMF clustering. It represents a higher-level concept that's more intuitive to manipulate than individual features.

Examples:

- "Formality" = 0.3×feature_2341 + 0.2×feature_892 + ...
- "Concreteness" = 0.4×feature_1029 + 0.25×feature_3421 + ...

The weights can come from:

- Automatic clustering (NMF, k-means on feature embeddings)
- LLM-assisted semantic grouping
- User-defined combinations

### Dial properties

- **Name/Label:** What concept this dial represents
- **Value:** Current strength (-1 to 1, or 0 to 1)
- **Trace:** The subgraph of features this dial affects (visualized on hover)
- **Polarity:** Some dials are bipolar (formal↔casual), others unipolar (more/less technical)

---

## Traces in the Graph

When you hover or activate a dial, its trace illuminates:

```
    [concept_A]──────[concept_B]
         │                │
    [feat_1] [feat_2]  [feat_3]
         │                │
    [subfeat_a]       [subfeat_b]
```

The trace shows **which nodes are affected** by this dial and **how strongly**. Edge thickness or node glow indicates weight.

This teaches users what the dial "means"—not through documentation, but through visualization.

---

## Perspectival Grouping

Here's the key insight: **there is no single correct grouping of features into dials.**

"Sadness" could be one dial. Or it could be decomposed into "melancholy", "grief", "disappointment." Or those could be further decomposed. Or "sadness" could be grouped with other emotions into "affect."

The grouping depends on:

1. **User's current intent:** Are they working at the emotional level or the specific-emotion level?
2. **Context of the text:** Different texts make different groupings useful
3. **Personal ontology:** Different users think about concepts differently

### LLM-Assisted Grouping

HORUS uses the LLM's recursive theory-of-mind to infer useful groupings:

**System:** "The user is working on a melancholic poem and just boosted 'nostalgia'. What groupings of features would be most useful to offer them next?"

**LLM:** "Given their focus, offer dials for 'temporal distance' (features about the past), 'sensory memory' (features about vivid recollection), and 'bittersweet' (features combining positive and negative affect)."

The dials that appear are **dynamic**—they change based on what you're doing.

### User Override

Users should also be able to:

- Create custom dials by selecting features
- Save dial configurations for reuse
- Share dial sets with others ("Here's my emotion dial pack")

---

## Multi-Dial Interaction

What happens when you turn multiple dials?

### Additive

Effects sum. Boost "formal" + boost "technical" = very formal and technical.

### Interactive

Some combinations are non-linear. "Playful" + "technical" might activate features neither dial alone would touch—something like "clever technical humor."

### Conflicting

Some dials fight. "Verbose" + "concise" might average to neutral, or might create tension/instability.

We need to visualize these interactions:

- Show overlap/conflict in traces
- Indicate when dial combinations are synergistic or antagonistic
- Maybe: suggest dial combinations that work well together

---

## The Mixing Workflow

### 1. Start with defaults

System offers a standard set of dials: formality, abstractness, emotional valence, complexity, etc.

### 2. Explore through mixing

Turn dials, see what changes. Build intuition for what each dial does in this context.

### 3. Request new dials

"I want a dial for 'cosmic scale'." System finds/creates a feature grouping that matches.

### 4. Refine and save

Adjust the dial definition (add/remove features). Save for future use.

### 5. Share and discover

Browse dials others have created. Import interesting ones.

---

## Advanced: Dial Automation

Beyond manual mixing, dials could be automated:

### Conditional dials

"If the text mentions a person, boost 'empathy'."

### Temporal dials

"Start with high 'tension', gradually decrease."

### Reactive dials

"Mirror the user's input formality level."

These become **feature-level programs**—not prompts, not fine-tuning, but dynamic steering rules.

---

## The Mixing Board Aesthetic

The mixer should feel like a **recording studio mixing board** or a **synthesizer control panel**:

- Physical metaphor: dials, faders, buttons
- Grouped into logical sections
- Visual feedback (VU meters, glow intensity)
- Satisfying interaction (smooth drag, subtle haptics if possible)

This is where the Egyptian aesthetic meets functional design. Gold-accented dials. Hieroglyphic labels. But fundamentally: an instrument.

---

## Open Questions

### How many dials?

Too few = limited expression. Too many = overwhelming. 8-12 visible at once, with ability to swap/customize?

### How do we name auto-generated dials?

Feature groups need labels. LLM-generated? User-assigned? Both?

### How do we handle dial "resolution"?

A dial could be very broad ("emotion") or very narrow ("specific type of wistfulness"). How do we let users zoom in/out on dial granularity?

### What's the dial ↔ graph relationship during navigation?

As you navigate to different parts of the graph, do the available dials change? Or are dials persistent and navigation-independent?

---

_Turn the dial. Watch the trace glow. Feel the text shift. This is direct manipulation of meaning._
