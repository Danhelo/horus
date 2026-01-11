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
**Status**: In Progress (UMAP pipeline blocking)

| Spec | Title | Status | Package |
|------|-------|--------|---------|
| [GRAPH-001](phase-1/GRAPH-001-data-model.md) | Graph Data Model | Complete | shared |
| [GRAPH-002](phase-1/GRAPH-002-loader.md) | Graph Loader | Complete | frontend |
| [GRAPH-003](phase-1/GRAPH-003-renderer.md) | Graph Renderer | Complete | frontend |
| [GRAPH-004](phase-1/GRAPH-004-camera.md) | Camera Controls | Complete | frontend |
| [ACT-001](phase-1/ACT-001-display.md) | Activation Display | Complete | frontend |
| [API-001](phase-1/API-001-neuronpedia.md) | Neuronpedia Client | Complete | backend |
| [UMAP-001](phase-1/UMAP-001-feature-positions.md) | **Feature Positions** | **Draft (BLOCKER)** | backend + Python |

> **CRITICAL**: UMAP-001 is blocking Phase 2. Currently using filler data at `packages/frontend/public/data/graph-filler-500.json`. Real positions require computing UMAP from SAE decoder vectors.

## Phase 2: Interactive Explorer

**Goal**: Add dials for steering, enable generation, show trajectories
**Status**: Not Started

| Spec | Title | Status | Package |
|------|-------|--------|---------|
| [MIX-001](phase-2/MIX-001-dial.md) | Dial Component | Draft | frontend |
| [MIX-002](phase-2/MIX-002-steering.md) | Steering Vector | Draft | shared |
| [TRJ-001](phase-2/TRJ-001-trajectory.md) | Trajectory View | Draft | frontend |
| [GEN-001](phase-2/GEN-001-generation.md) | Steered Generation | Draft | backend |

## Phase 3: Dynamic Hierarchy

**Goal**: LLM-assisted semantic zoom, natural language queries
**Status**: Not Started

| Spec | Title | Status | Package |
|------|-------|--------|---------|
| [HIR-001](phase-3/HIR-001-semantic-zoom.md) | Semantic Zoom | Draft | frontend |
| [QRY-001](phase-3/QRY-001-semantic-search.md) | Semantic Search | Draft | backend |

## Phase 4: Social Features

**Goal**: Save artifacts, share creations, build gallery
**Status**: Not Started

| Spec | Title | Status | Package |
|------|-------|--------|---------|
| [PER-001](phase-4/PER-001-artifacts.md) | Artifact System | Planned | backend |
| [SHR-001](phase-4/SHR-001-sharing.md) | Shareable Links | Planned | backend |

## Cross-Cutting Concerns

| Spec | Title | Status |
|------|-------|--------|
| [STA-001](shared/STA-001-state.md) | Zustand Architecture | Draft |
| [UI-001](shared/UI-001-design.md) | Design System | Draft |
| [PRF-001](shared/PRF-001-performance.md) | Performance Budget | Draft |

## Status Legend

| Symbol | Meaning |
|--------|---------|
| Planned | Not yet written |
| Draft | In progress |
| Ready | Approved for implementation |
| In Progress | Being implemented |
| Complete | Implemented and verified |

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
