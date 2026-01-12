# HORUS Specifications

> "Paste any text. See its soul."

## Overview

HORUS is a creative instrument for navigating and sculpting in **ideaspace**—the latent feature space of language models.

**Architecture**: pnpm monorepo with `packages/{frontend, backend, shared}`

## How to Use Specs

1. **Before implementing**: Read the relevant spec(s)
2. **During implementation**: Check acceptance criteria
3. **After implementing**: Mark criteria complete
4. **When specs conflict with code**: The spec wins

## Phase 1: Static Viewer

**Goal**: Load a feature graph, navigate it, display activations
**Status**: Complete

| Spec                                              | Title              | Status   | Package          |
| ------------------------------------------------- | ------------------ | -------- | ---------------- |
| [GRAPH-001](phase-1/GRAPH-001-data-model.md)      | Graph Data Model   | Complete | shared           |
| [GRAPH-002](phase-1/GRAPH-002-loader.md)          | Graph Loader       | Complete | frontend         |
| [GRAPH-003](phase-1/GRAPH-003-renderer.md)        | Graph Renderer     | Complete | frontend         |
| [GRAPH-004](phase-1/GRAPH-004-camera.md)          | Camera Controls    | Complete | frontend         |
| [ACT-001](phase-1/ACT-001-display.md)             | Activation Display | Complete | frontend         |
| [API-001](phase-1/API-001-neuronpedia.md)         | Neuronpedia Client | Complete | backend          |
| [UMAP-001](phase-1/UMAP-001-feature-positions.md) | Feature Positions  | Complete | backend + Python |

> **Note**: Layer 12 computed with real UMAP positions (16,384 nodes, 12,599 edges, 1,000 labels). Remaining layers to be computed for full multi-layer support.

## Phase 2: Interactive Explorer

**Goal**: Add dials for steering, enable generation, show trajectories
**Status**: Complete

| Spec                                     | Title              | Status   | Package  |
| ---------------------------------------- | ------------------ | -------- | -------- |
| [MIX-001](phase-2/MIX-001-dial.md)       | Dial Component     | Complete | frontend |
| [MIX-002](phase-2/MIX-002-steering.md)   | Steering Vector    | Complete | shared   |
| [TRJ-001](phase-2/TRJ-001-trajectory.md) | Trajectory View    | Complete | frontend |
| [GEN-001](phase-2/GEN-001-generation.md) | Steered Generation | Complete | backend  |

## Phase 3: Dynamic Hierarchy + Live Neural Surgery

**Goal**: LLM-assisted semantic zoom, natural language queries, **live steering from graph interaction**
**Status**: Draft

### Live Neural Surgery (NEW)

Transform the graph from visualization to control surface. Click nodes to steer generation.

| Spec                                           | Title           | Status | Package           |
| ---------------------------------------------- | --------------- | ------ | ----------------- |
| [LIVE-000](phase-3/LIVE-000-master-plan.md)    | **Master Plan** | Draft  | -                 |
| [LIVE-001](phase-3/LIVE-001-click-to-steer.md) | Click-to-Steer  | Draft  | frontend          |
| [GRP-001](phase-3/GRP-001-steering-groups.md)  | Steering Groups | Draft  | frontend, backend |
| [CIR-001](phase-3/CIR-001-circuit-tracing.md)  | Circuit Tracing | Draft  | frontend, backend |
| [SUG-001](phase-3/SUG-001-llm-suggestions.md)  | LLM Suggestions | Draft  | frontend, backend |

### Semantic Navigation (Original)

| Spec                                          | Title           | Status | Package  |
| --------------------------------------------- | --------------- | ------ | -------- |
| [HIR-001](phase-3/HIR-001-semantic-zoom.md)   | Semantic Zoom   | Draft  | frontend |
| [QRY-001](phase-3/QRY-001-semantic-search.md) | Semantic Search | Draft  | backend  |

## Phase 4: Social Features

**Goal**: Save artifacts, share creations, build gallery
**Status**: Not Started

| Spec                                    | Title           | Status  | Package |
| --------------------------------------- | --------------- | ------- | ------- |
| [PER-001](phase-4/PER-001-artifacts.md) | Artifact System | Planned | backend |
| [SHR-001](phase-4/SHR-001-sharing.md)   | Shareable Links | Planned | backend |

## Cross-Cutting Concerns

| Spec                                     | Title                | Status |
| ---------------------------------------- | -------------------- | ------ |
| [STA-001](shared/STA-001-state.md)       | Zustand Architecture | Draft  |
| [UI-001](shared/UI-001-design.md)        | Design System        | Draft  |
| [PRF-001](shared/PRF-001-performance.md) | Performance Budget   | Draft  |

## Status Legend

| Symbol      | Meaning                     |
| ----------- | --------------------------- |
| Planned     | Not yet written             |
| Draft       | In progress                 |
| Ready       | Approved for implementation |
| In Progress | Being implemented           |
| Complete    | Implemented and verified    |

## Loopback Workflow

```
Study @specs/SPECS.md for specifications.
Study @.claude/rules for technical requirements.
Implement what is not implemented in specs/[path].
Create tests.
Run build and verify.
```

## References

- [ideas/](../ideas/) - Vision documents
- [.claude/rules/](../.claude/rules/) - Technical standards
