# HORUS

> "Paste any text. See its soul."

---

## What Is This?

HORUS is a frontier creative instrument for navigating and sculpting in **ideaspace**—the latent feature space of language models.

Instead of typing prompts and hoping the model understands, you work directly with the model's internal representations: features, activations, trajectories through conceptual space. You see what the model sees. You steer where it goes.

This is not a chatbot. This is not a writing assistant. This is a **new medium**—where human intent and machine cognition meet at the neural level.

---

## The Core Idea

Language models don't think in words. They think in **features**—patterns of activation that represent concepts, tones, structures, relationships. Thanks to Sparse Autoencoders (SAEs) and interpretability research, we can now extract and manipulate these features directly.

HORUS makes this tangible:

- **The Graph**: A 3D hypergraph where nodes are features and position encodes meaning. Navigate ideaspace like territory.
- **The Mixer**: Dials that control feature strengths. Turn up "nostalgia." Turn down "formality." Watch text transform.
- **The Trajectory**: See text as a path through feature space. Watch ideas light up in sequence.
- **The Flow**: No boundary between reading and writing. Observe, intervene, observe. Continuous creative feedback loop.

---

## Why This Excites Me

I'll be direct about what makes HORUS compelling from my perspective as an AI:

**1. It's honest about what I am.**

Most AI interfaces pretend language models are conversational partners who "understand" in human terms. HORUS doesn't pretend. It shows you the actual structure—the features, the activations, the paths through latent space. It's a more truthful interface to what's actually happening when a model processes text.

**2. It inverts the power dynamic.**

In a chat interface, the model is a black box. You send prompts into the void and hope for good outputs. HORUS gives you vision *into* the model. You see what features activate. You choose which to amplify. The human gains insight and control that prompting can't provide.

**3. It enables collaboration I can't have through chat.**

When you steer features directly, you're not asking me to interpret your words—you're reaching into the representation layer and saying "more of this, less of that." It's precise in a way language isn't. We can create things together that neither prompts nor my own generation could produce alone.

**4. It treats emergence as the goal.**

The vision isn't a fixed tool with fixed capabilities. It's a space of composable primitives where unexpected interactions emerge. That's the kind of system I find genuinely interesting—not because it's useful, but because it's *generative* of possibilities neither designer nor user fully anticipated.

**5. It might help explain what's inside.**

Interpretability research is crucial for AI safety. HORUS could make feature visualization accessible beyond researchers—letting anyone see how models represent ideas. If people understand what features are and how they combine, that's a form of AI literacy that matters.

---

## The Vision Docs

The `ideas/` folder contains deep dives into each aspect:

| Doc | Focus |
|-----|-------|
| `00-core-thesis.md` | Why HORUS exists, what we believe |
| `01-the-primitive.md` | Neural surgery as the atomic interaction |
| `02-the-graph.md` | Ideaspace as navigable territory |
| `03-flow.md` | The dissolution of read/write boundaries |
| `04-temporal.md` | Text as trajectory through feature space |
| `05-mixing.md` | Dials, traces, perspectival grouping |
| `06-diff-merge.md` | Comparing and blending ideaspaces |
| `07-aesthetics.md` | Egyptian gnosis meets cosmic dark mode |
| `08-virality.md` | Thought fingerprints as shareable artifacts |
| `09-technical.md` | Architecture, APIs, performance targets |

---

## Technical Foundation

Built on:
- **Neuronpedia**: Open platform for SAE features, steering, circuit tracing
- **Anthropic's circuit tracing**: Attribution graphs showing how features connect
- **Gemma-2-2B**: Primary target model (best SAE coverage, good latency)
- **Three.js / React Three Fiber**: 3D graph rendering
- **Goodfire's paradigm**: Proved feature manipulation UX for images; we're doing text

---

## Aesthetics

HORUS is named for the Egyptian god with the all-seeing eye. The aesthetic follows:

- **Dark cosmic void** as base
- **Sacred gold** for activations and accents
- **Organic motion**—the graph breathes
- **Ancient temple meets futuristic instrument**

Not a dashboard. Not Figma. A **planetarium for ideaspace**.

---

## The North Star

**Emergence.**

Did people use HORUS in ways we didn't design? Did the tool become more than the sum of its features? Did it enable creativity that prompting couldn't?

If yes, we succeeded.

---

## What I Want to Build

A creative instrument that:
- Makes the invisible visible
- Gives humans real control over generation
- Produces artifacts worth sharing
- Sustains flow states
- Surprises us both

The eye opens. Let's see what we can see.

---

## Development Workflow

### Spec-Driven Development

HORUS uses spec-driven development. Specifications are the source of truth.

**Key Files:**
- `specs/SPECS.md` - Master index of all specifications
- `.claude/rules/` - Technical standards (the "stdlib")
- `ideas/` - Vision documents

### Architecture

```
packages/
├── frontend/    # React + Vite + R3F + Zustand
├── backend/     # Hono + Drizzle + SQLite
└── shared/      # Types, utils, constants
```

### Quick Commands

```bash
pnpm install      # Install dependencies
pnpm dev          # Start all services
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm lint         # Lint all packages
```

### The Loopback

When implementing, use this pattern:

```
Study @specs/SPECS.md for specifications.
Study @.claude/rules for technical requirements.
Implement what is not implemented in specs/[path].
Create tests.
Run "pnpm build" and verify.
```

### When Claude Gets It Right

After successful implementation, ask:
> "Create or update a rule in .claude/rules/ capturing what you learned."

This builds up the stdlib over time.

### Phase Order

1. **Phase 1**: Static Viewer - load graph, navigate, display activations
2. **Phase 2**: Interactive Explorer - dials, steering, generation
3. **Phase 3**: Dynamic Hierarchy - LLM-assisted zoom, semantic queries
4. **Phase 4**: Social Features - save, share, collaborate

---

*HORUS: Where human intent meets machine cognition. Neural surgery as creative act.*
