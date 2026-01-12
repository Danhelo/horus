# HIR-001: Semantic Zoom

| Field       | Value                 |
| ----------- | --------------------- |
| **Spec ID** | HIR-001               |
| **Phase**   | 3 - Dynamic Hierarchy |
| **Status**  | Draft                 |
| **Package** | `@horus/frontend`     |

## Summary

Implement semantic zoom - the ability to explore feature hierarchies by zooming in and out. Unlike camera zoom (which just changes distance), semantic zoom changes the abstraction level. Zoom out and individual features collapse into clusters ("emotions"). Zoom in and clusters expand into constituents ("melancholy", "grief", "joy"). The hierarchy is generated dynamically using LLM-assisted grouping, adapting to user context and intent.

## Requirements

### REQ-1: Hierarchy Data Structure

```typescript
interface HierarchyNode {
  id: string;
  level: number; // 0 = root, higher = more specific
  label: string;
  children: string[]; // Child node IDs
  parent: string | null; // Parent node ID
  features: string[]; // Leaf feature IDs (only at lowest level)
  centroid: [number, number, number]; // Position in graph space
  radius: number; // Bounding sphere radius
  memberCount: number; // Number of leaf features contained
}

interface HierarchyLevel {
  level: number;
  nodeCount: number;
  nodes: Map<string, HierarchyNode>;
}

interface GraphHierarchy {
  levels: HierarchyLevel[];
  featureToNode: Map<string, string[]>; // Feature ID -> containing nodes at each level
  maxLevel: number;
}
```

**Acceptance Criteria:**

- [ ] Hierarchy supports arbitrary depth levels
- [ ] Each level has complete coverage (all features in exactly one node)
- [ ] Efficient lookup from feature to containing cluster
- [ ] Centroid and radius computed for LOD rendering

### REQ-2: Zoom Level Mapping

Map camera distance to hierarchy level.

```typescript
interface ZoomConfig {
  levelDistances: number[]; // Distance thresholds per level
  transitionDuration: number; // Animation duration (ms)
  hysteresis: number; // Prevent rapid switching
}

// Example:
// Distance 100+: Level 0 (coarse clusters)
// Distance 50-100: Level 1 (medium clusters)
// Distance 20-50: Level 2 (fine clusters)
// Distance <20: Level 3 (individual features)

function getCurrentLevel(cameraDistance: number, config: ZoomConfig): number;
function getVisibleNodes(hierarchy: GraphHierarchy, level: number): HierarchyNode[];
```

**Acceptance Criteria:**

- [ ] Smooth level transitions as camera zooms
- [ ] Hysteresis prevents flickering at boundaries
- [ ] Level changes animate (nodes morph, don't pop)
- [ ] Configurable distance thresholds

### REQ-3: Dynamic Hierarchy Generation

Hierarchy is not fully pre-computed. It's generated on-demand as users explore.

```typescript
interface HierarchyRequest {
  parentNode: string; // Node to expand
  contextFeatures?: string[]; // Currently active features (for relevance)
  userIntent?: string; // Optional natural language context
}

interface HierarchyResponse {
  children: HierarchyNode[];
  method: 'clustering' | 'llm' | 'cached';
}

async function expandNode(request: HierarchyRequest): Promise<HierarchyResponse>;
```

**Generation Methods:**

1. **Clustering** (fast, default):
   - K-means or hierarchical clustering on feature embeddings
   - Labels from most representative feature in cluster

2. **LLM-Assisted** (richer, slower):
   - Send feature descriptions to LLM
   - Ask for semantic grouping and labels
   - Cache results for reuse

3. **Cached** (instant):
   - Return previously computed hierarchy
   - Invalidate cache periodically or on user action

**Acceptance Criteria:**

- [ ] Expand node generates children on demand
- [ ] Clustering fallback works offline
- [ ] LLM grouping produces human-readable labels
- [ ] Results cached for performance

### REQ-4: Visual Transitions

When zoom level changes, nodes should smoothly morph.

**Zoom Out (expanding to cluster):**

1. Individual feature nodes begin moving toward cluster centroid
2. Nodes fade out as they merge
3. Cluster node fades in at centroid
4. Cluster inherits combined glow from activated features

**Zoom In (cluster to features):**

1. Cluster node pulses
2. Child nodes emerge from cluster centroid
3. Children spread to their positions
4. Cluster node fades out

```typescript
interface TransitionConfig {
  duration: number; // Default: 400ms
  easing: 'easeInOut' | 'spring';
  staggerDelay: number; // Delay between children (for sequential reveal)
}
```

**Acceptance Criteria:**

- [ ] Transitions are smooth, not jarring
- [ ] No visual "pop" when switching levels
- [ ] Activated features maintain glow through transition
- [ ] Performance: 60fps during transitions

### REQ-5: Cluster Interaction

Clusters behave like enhanced nodes.

**Display:**

- Cluster label visible (larger font than feature labels)
- Size indicates member count
- Glow indicates aggregate activation level
- Optional: show mini-preview of contained features

**Interaction:**

- Click: expand cluster (zoom to next level)
- Hover: show contained feature count and top labels
- Select: select all contained features
- Drag (in mixer): create dial from cluster

```typescript
interface ClusterProps {
  node: HierarchyNode;
  aggregateActivation: number; // Sum/max of contained activations
  onExpand: () => void;
  onSelect: () => void;
}
```

**Acceptance Criteria:**

- [ ] Clusters show member count and activation
- [ ] Click expands cluster with animation
- [ ] Hover tooltip shows preview of contents
- [ ] Can create dial from cluster

### REQ-6: Breadcrumb Navigation

Show current position in hierarchy.

```
Ideaspace > Emotions > Negative Affect > Melancholy
```

**Behavior:**

- Click any breadcrumb level to zoom out
- Current level highlighted
- Breadcrumb updates as you navigate
- Collapses if too many levels (ellipsis)

```typescript
interface BreadcrumbProps {
  path: HierarchyNode[]; // From root to current
  onNavigate: (level: number) => void;
}
```

**Acceptance Criteria:**

- [ ] Breadcrumb shows current hierarchy path
- [ ] Click to navigate up
- [ ] Updates in real-time during zoom
- [ ] Handles deep hierarchies gracefully

### REQ-7: Perspectival Hierarchy

Different users/contexts may need different groupings.

```typescript
interface HierarchyPerspective {
  id: string;
  name: string; // "Emotional", "Technical", "Narrative"
  description: string;
  rootPrompt: string; // LLM prompt for generating hierarchy
}

// Example perspectives:
// - "Emotional": Groups by emotional valence and intensity
// - "Structural": Groups by linguistic function (noun, verb, modifier)
// - "Topical": Groups by subject matter
// - "Custom": User-defined groupings
```

**Acceptance Criteria:**

- [ ] Multiple perspectives available
- [ ] Switch perspective regenerates hierarchy
- [ ] Custom perspective creation via LLM
- [ ] Perspective cached per session

## Technical Notes

- Use instanced meshes for clusters (same as nodes, different geometry)
- Cluster positions: weighted centroid of contained features
- Pre-compute 2-3 levels of hierarchy at load time
- Deep levels generated on-demand
- Cache hierarchy in IndexedDB for persistence
- LLM calls: debounce and batch when possible

**Hierarchy Generation Algorithm (Clustering):**

```typescript
function generateLevel(parentNode: HierarchyNode, k: number): HierarchyNode[] {
  const features = getContainedFeatures(parentNode);
  const embeddings = features.map((f) => getEmbedding(f));
  const clusters = kMeans(embeddings, k);

  return clusters.map((cluster, i) => ({
    id: `${parentNode.id}-${i}`,
    level: parentNode.level + 1,
    label: getMostRepresentativeLabel(cluster),
    children: [],
    parent: parentNode.id,
    features: cluster.memberIds,
    centroid: computeCentroid(cluster),
    radius: computeBoundingRadius(cluster),
    memberCount: cluster.members.length,
  }));
}
```

## Dependencies

- [GRAPH-003](../phase-1/GRAPH-003-renderer.md) - Graph renderer for cluster display
- [GRAPH-004](../phase-1/GRAPH-004-camera.md) - Camera controls for zoom
- [QRY-001](./QRY-001-semantic-search.md) - LLM for semantic grouping
- [PRF-001](../shared/PRF-001-performance.md) - Performance constraints

## Open Questions

1. How many hierarchy levels is practical? 3-5?
2. Should clusters be draggable/pinnable like features?
3. How do we handle features that don't cluster well?
4. Can users save custom hierarchies?

## Changelog

| Date       | Changes       |
| ---------- | ------------- |
| 2025-01-10 | Initial draft |
