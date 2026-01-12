<div align="center">

# 𓂀 HORUS

**Paste any text. See its soul.**

_A frontier creative instrument for navigating and sculpting in ideaspace—the latent feature space of language models._

[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-black.svg)](https://docs.pmnd.rs/react-three-fiber)

</div>

---

## The Vision

Language models don't think in words. They think in **features**—patterns of activation that represent concepts, tones, structures, relationships. Thanks to Sparse Autoencoders (SAEs) and interpretability research, we can now extract and manipulate these features directly.

HORUS makes this tangible:

| Component          | Description                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| **The Graph**      | A 3D hypergraph where nodes are features and position encodes meaning. Navigate ideaspace like territory. |
| **The Mixer**      | Dials that control feature strengths. Turn up "nostalgia." Turn down "formality." Watch text transform.   |
| **The Trajectory** | See text as a path through feature space. Watch ideas light up in sequence.                               |
| **The Flow**       | No boundary between reading and writing. Observe, intervene, observe. Continuous creative feedback loop.  |

---

## What Makes This Different

### Features Are The True Primitives

Inside language models, there are no words—there are _features_. These are the "things the model knows": concepts, tones, structures, patterns. SAEs let us extract them. Circuit tracing shows how they connect. HORUS lets you work with them directly.

**Features are the native language of models. It's time to speak it.**

### The Interface Matches The Substrate

Image models think in spatial patches. Language models think in sequential feature activations. HORUS provides a _traversable space_ of features—a graph you can navigate, a territory you can explore, paths you can trace and steer.

### Flow Dissolves The Read/Write Boundary

The magic isn't in "analyzing text" or "generating text" as separate modes. It's in the _fluid transition_ between them. Paste text, see its feature fingerprint light up. Drag a node, steering the model. New text flows. The fingerprint shifts.

This is not turn-taking. It's a **continuous feedback loop**.

---

## Neural Surgery: The Primitive

HORUS introduces the concept of **neural surgery**—precise, intentional, consequential manipulation of a living system. The surgical toolkit includes:

| Operation             | Gesture             | Effect                                      |
| --------------------- | ------------------- | ------------------------------------------- |
| **Illuminate**        | Hover, select       | Visual emphasis, information surfacing      |
| **Amplify/Attenuate** | Dial, slider        | Feature strength changes, generation shifts |
| **Navigate**          | Pan, zoom, rotate   | Different features enter/exit view          |
| **Zoom (Semantic)**   | Scroll, pinch       | Hierarchy expands/collapses                 |
| **Pin**               | Click to lock       | Constraint on steering                      |
| **Trace**             | Scrub timeline      | Temporal structure revealed                 |
| **Blend**             | Drag between states | Smooth transitions, morphing                |
| **Snapshot**          | Save button         | State preserved for later                   |
| **Diff**              | Compare snapshots   | Divergence visualized                       |

The power is in combination: **ILLUMINATE + AMPLIFY** = "What happens if I boost what's already active?"

---

## The Feeling We're Designing For

When someone uses HORUS, they should feel:

- **"I made something I couldn't have made before."**
- **"I saw my own ideas in a new way."**
- **"I didn't know I could make an LLM do that."**

The emotional residue is _gnosis_—the sense of having glimpsed something true about how minds process meaning.

---

## Technical Stack

```
packages/
├── frontend/    # React + Vite + React Three Fiber + Zustand
├── backend/     # Hono + Drizzle + SQLite
└── shared/      # Types, utils, contracts
```

### Core Technologies

- **Frontend**: React 18, Vite, React Three Fiber (R3F), Zustand, TanStack Query
- **Backend**: Hono, Drizzle ORM, better-sqlite3
- **3D Rendering**: Three.js with InstancedMesh (50k+ nodes at 60fps)
- **API Integration**: Neuronpedia (SAE features, steering, circuit tracing)
- **Target Model**: Gemma-2-2B (best SAE coverage, good latency)

### Performance Targets

| Operation                      | Target  | Maximum |
| ------------------------------ | ------- | ------- |
| Graph highlight updates        | < 100ms | 200ms   |
| Text generation start          | < 300ms | 500ms   |
| Steering adjustment perception | < 500ms | 1s      |
| Graph navigation (50k nodes)   | 60fps   | 30fps   |

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Quick Start

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Type check
pnpm typecheck
```

### Environment Variables

Create `.env` files in each package:

```bash
# packages/backend/.env
NEURONPEDIA_API_KEY=your_key_here
DATABASE_URL=./data/app.db
```

---

## Roadmap

### Phase 1: Static Viewer

Load graph, navigate, display activations. The canvas where ideaspace becomes visible.

### Phase 2: Interactive Explorer

Dials, steering, generation. Turn the knobs, watch the text transform.

### Phase 3: Dynamic Hierarchy

LLM-assisted zoom, semantic queries. Ask the graph to reorganize itself around your intent.

### Phase 4: Social Features

Save, share, collaborate. Thought fingerprints as shareable artifacts.

---

## Aesthetics

HORUS is named for the Egyptian god with the all-seeing eye. The aesthetic follows:

- **Dark cosmic void** as base
- **Sacred gold** for activations and accents
- **Organic motion**—the graph breathes
- **Ancient temple meets futuristic instrument**

Not a dashboard. Not Figma. A **planetarium for ideaspace**.

---

## The Long Game

HORUS v1 is a creative instrument for artists—a way to see and sculpt in ideaspace.

But the substrate is more general:

- **Feature-level apps.** Programs that run on features, not prompts.
- **Meta-LLM orchestration.** LLMs that modify other LLMs' features.
- **Multimodal triggers.** Features that respond to sound, gesture, biosignals.

We start with the Eye. Where it leads, we follow.

---

## The North Star

**Emergence.**

Did people use HORUS in ways we didn't design? Did the tool become more than the sum of its features? Did it enable creativity that prompting couldn't?

If yes, we succeeded.

---

<div align="center">

_The eye opens. The hidden becomes visible._

_Neural surgery as creative act._

**𓂀**

</div>
