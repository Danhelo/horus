# PRF-001: Performance Budget

| Field | Value |
|-------|-------|
| **Spec ID** | PRF-001 |
| **Phase** | Shared |
| **Status** | Draft |
| **Package** | All |

## Summary

Define performance targets and constraints for HORUS. Performance is not an afterthought - it's a design constraint. Flow states require sub-second feedback. The graph must render smoothly with 50k+ nodes. Steering must feel immediate. These targets inform every implementation decision.

## Requirements

### REQ-1: Core Latency Targets

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| Graph render (60fps) | < 16ms | 33ms | Frame budget |
| Graph navigation | < 16ms | 16ms | Camera movement |
| Node hover response | < 50ms | 100ms | Highlight on hover |
| Text -> activation | < 200ms | 300ms | See fingerprint after paste |
| Dial -> text start | < 300ms | 500ms | First token after dial change |
| Dial -> trace highlight | < 50ms | 100ms | Show affected nodes |
| Zoom -> hierarchy load | < 150ms | 200ms | Expand/collapse clusters |
| Search -> results | < 300ms | 500ms | Semantic search |
| Export fingerprint | < 500ms | 1s | Static image |
| Export trajectory GIF | < 3s | 5s | Animated export |

**Acceptance Criteria:**
- [ ] Metrics instrumented and measurable
- [ ] Performance dashboard in development
- [ ] Alerts for regressions
- [ ] Targets documented in each spec

### REQ-2: Graph Rendering Performance

Target: 50,000 nodes, 100,000 edges at 60fps

**Strategies:**

```typescript
// 1. Instanced Meshes for nodes
// Single draw call for all nodes of same geometry
const nodeInstancedMesh = new THREE.InstancedMesh(
  sphereGeometry,
  nodeMaterial,
  50000
);

// 2. Level of Detail (LOD)
// Reduce geometry detail at distance
const nodeLOD = new THREE.LOD();
nodeLOD.addLevel(highDetailMesh, 0);    // < 10 units
nodeLOD.addLevel(medDetailMesh, 10);    // 10-30 units
nodeLOD.addLevel(lowDetailMesh, 30);    // > 30 units

// 3. Frustum Culling
// Built into Three.js, ensure it's not disabled
mesh.frustumCulled = true;

// 4. Edge Rendering
// Use LineSegments with BufferGeometry
const edgeGeometry = new THREE.BufferGeometry();
edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
const edges = new THREE.LineSegments(edgeGeometry, lineMaterial);

// 5. Occlusion Culling (advanced)
// Skip rendering nodes behind other nodes
// Consider Three.js occlusion plugin or custom BVH
```

**Memory Budget:**
| Asset | Budget |
|-------|--------|
| Node positions | 600KB (50k * 3 * 4 bytes) |
| Node colors | 600KB (50k * 3 * 4 bytes) |
| Edge indices | 400KB (100k * 2 * 2 bytes) |
| Textures | 10MB max |
| Total GPU | 50MB target |

**Acceptance Criteria:**
- [ ] 60fps maintained with 50k nodes visible
- [ ] GPU memory under 50MB
- [ ] No frame drops during navigation
- [ ] r3f-perf shows stable performance

### REQ-3: Network Performance

**API Call Budgets:**

| Endpoint | Size Budget | Frequency |
|----------|-------------|-----------|
| Get activations | 50KB | Per text change (debounced) |
| Steer/generate | 10KB + stream | Per dial change (debounced) |
| Feature lookup | 5KB | On hover (cached) |
| Hierarchy expand | 20KB | On zoom (cached) |
| Search | 10KB | On query |

**Caching Strategy:**

```typescript
// LRU Cache for features
const featureCache = new LRUCache<string, Feature>({
  max: 1000,           // 1000 features
  ttl: 1000 * 60 * 60, // 1 hour TTL
});

// IndexedDB for graph data
// Persists across sessions
const graphCache = {
  nodes: IDBKeyval,    // Full node set
  hierarchy: IDBKeyval, // Computed hierarchy
  positions: IDBKeyval, // UMAP positions
};

// Debounce API calls
const debouncedActivation = debounce(getActivations, 200);
const debouncedGenerate = debounce(generateSteered, 300);
```

**Acceptance Criteria:**
- [ ] Feature requests cached (1hr TTL)
- [ ] Graph data persisted in IndexedDB
- [ ] API calls debounced appropriately
- [ ] Loading states for network operations

### REQ-4: Bundle Size

| Package | Budget | Notes |
|---------|--------|-------|
| Initial JS | 150KB gzip | First meaningful paint |
| Three.js | 100KB gzip | Core 3D library |
| React + deps | 50KB gzip | Framework |
| Total initial | 300KB gzip | First load |
| Lazy loaded | 200KB gzip | After interaction |
| Total | 500KB gzip | Full app |

**Code Splitting Strategy:**

```typescript
// Lazy load heavy components
const GraphCanvas = lazy(() => import('./components/GraphCanvas'));
const Spectrogram = lazy(() => import('./components/Spectrogram'));
const MixerPanel = lazy(() => import('./components/MixerPanel'));

// Tree-shake Three.js
import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
// Don't: import * as THREE from 'three';

// Lazy load large data
const loadGraphData = async () => {
  const data = await import('./data/graph-gemma-2b.json');
  return processGraphData(data);
};
```

**Acceptance Criteria:**
- [ ] Initial bundle < 300KB gzip
- [ ] Heavy components lazy loaded
- [ ] Three.js tree-shaken
- [ ] Bundle analyzer in CI

### REQ-5: Startup Performance

| Milestone | Target | Maximum |
|-----------|--------|---------|
| First paint | < 500ms | 1s |
| First contentful paint | < 1s | 2s |
| Graph visible | < 2s | 3s |
| Interactive | < 3s | 5s |

**Startup Sequence:**

```typescript
// 1. Show loading UI immediately
// 2. Load core bundle (React, basic UI)
// 3. Show skeleton graph (placeholder nodes)
// 4. Load graph data (async)
// 5. Initialize Three.js scene
// 6. Render first frame
// 7. Enable interactions

async function initializeApp() {
  // Phase 1: Skeleton (< 500ms)
  renderLoadingUI();

  // Phase 2: Core (< 1s)
  const [graphData] = await Promise.all([
    loadGraphData(),
    preloadFonts(),
  ]);

  // Phase 3: Scene (< 2s)
  const scene = initializeScene();
  populateGraph(scene, graphData);

  // Phase 4: Interaction (< 3s)
  enableControls();
  hideLoadingUI();
}
```

**Acceptance Criteria:**
- [ ] Loading indicator appears < 500ms
- [ ] Graph skeleton visible < 1s
- [ ] Full graph rendered < 2s
- [ ] Web Vitals metrics tracked

### REQ-6: Memory Management

| Metric | Budget |
|--------|--------|
| JS Heap | 100MB typical, 200MB max |
| GPU Memory | 50MB typical, 100MB max |
| DOM Nodes | 1000 max |

**Memory Strategies:**

```typescript
// 1. Dispose Three.js objects
useEffect(() => {
  return () => {
    geometry.dispose();
    material.dispose();
    texture.dispose();
  };
}, []);

// 2. Object pooling for trajectories
const trajectoryPool = new ObjectPool<TrajectoryPoint>(
  () => ({ tokenIndex: 0, token: '', activations: new Map(), position: [0, 0, 0] }),
  1000
);

// 3. WeakMap for node metadata
const nodeMetadata = new WeakMap<GraphNode, NodeMetadata>();

// 4. Virtualize long lists
// Don't render 50k items in React
// Use react-virtual or similar
```

**Acceptance Criteria:**
- [ ] No memory leaks over extended sessions
- [ ] Three.js resources properly disposed
- [ ] Heap snapshots show stable memory
- [ ] Long lists virtualized

### REQ-7: Monitoring & Profiling

```typescript
// Performance marks for key operations
performance.mark('activation-start');
await getActivations(text);
performance.mark('activation-end');
performance.measure('activation', 'activation-start', 'activation-end');

// Frame time monitoring
import { Perf } from 'r3f-perf';
<Canvas>
  {import.meta.env.DEV && <Perf position="top-left" />}
</Canvas>

// API timing
const measureAPI = async (name: string, fn: () => Promise<unknown>) => {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    analytics.timing('api', name, duration);
  }
};
```

**Development Tools:**
- r3f-perf for Three.js metrics
- React DevTools Profiler
- Chrome Performance tab
- Lighthouse CI in pipeline

**Acceptance Criteria:**
- [ ] Performance metrics logged
- [ ] r3f-perf enabled in dev
- [ ] Lighthouse CI checks in PR
- [ ] Performance regression alerts

### REQ-8: Mobile Considerations

HORUS is primarily desktop, but viewing exported artifacts should work on mobile.

| Context | Support Level |
|---------|---------------|
| Desktop creation | Full |
| Mobile creation | Not supported |
| Mobile viewing | Static artifacts only |
| Tablet | Best effort |

**Mobile Optimizations for Viewing:**
- Static fingerprint images (no WebGL)
- Simplified trajectory animations (CSS)
- Touch-friendly share UI
- Reduced data transfer

**Acceptance Criteria:**
- [ ] Exported artifacts viewable on mobile
- [ ] Share pages responsive
- [ ] Desktop detection with redirect/warning
- [ ] Graceful degradation for unsupported features

## Technical Notes

- Use Web Workers for heavy computation (hierarchy, trajectory analysis)
- Consider WebGPU for SAE projection (future)
- Implement request cancellation (AbortController)
- Use streaming for generation (SSE)
- Precompute what you can at build time

**Performance Testing:**
```bash
# Lighthouse CI
pnpm lighthouse

# Bundle analysis
pnpm build && pnpm analyze

# Memory profiling
# Use Chrome DevTools Memory tab

# Frame profiling
# Use Chrome DevTools Performance tab with 6x slowdown
```

## Dependencies

- [STA-001](./STA-001-state.md) - Store architecture affects re-render performance
- [GRAPH-003](../phase-1/GRAPH-003-renderer.md) - Graph rendering implementation

## Open Questions

1. What's the minimum viable node count we could ship with?
2. Can we do client-side SAE projection with WebGPU?
3. Should we offer a "lite" mode for lower-end hardware?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
