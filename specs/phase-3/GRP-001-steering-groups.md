# GRP-001: Steering Groups

| Field | Value |
|-------|-------|
| **Spec ID** | GRP-001 |
| **Phase** | 3 - Dynamic Hierarchy |
| **Status** | Draft |
| **Package** | `@horus/frontend`, `@horus/backend` |

## Summary

Steering groups are collections of features that act as a single control. Instead of manipulating individual features, users can adjust a "playfulness" group or a "formal tone" group. Groups provide semantic granularity control and enable zoom-based interaction where zooming out clusters features into manipulable groups.

Three types of groups work together:
1. **Precomputed** - Ship with ~50 curated groups
2. **Search-based** - User creates via semantic search
3. **LLM-suggested** - System recommends based on context

## Requirements

### REQ-1: Steering Group Data Model

```typescript
interface SteeringGroup {
  id: string;                              // UUID or semantic slug
  label: string;                           // Display name
  description?: string;                    // Tooltip explanation

  features: Map<string, number>;           // featureId → weight (0-1)

  // Spatial representation
  position: [number, number, number];      // Centroid in UMAP space
  radius: number;                          // Visual size based on spread

  // Metadata
  source: 'precomputed' | 'search' | 'circuit' | 'llm' | 'user';
  createdAt: number;
  category?: string;                       // emotion, style, domain, etc.

  // Current state
  strength: number;                        // Like a dial: -10 to +10
  isActive: boolean;                       // Contributing to steering
}

interface SteeringGroupsSlice {
  groups: Map<string, SteeringGroup>;

  // Actions
  addGroup: (group: SteeringGroup) => void;
  removeGroup: (groupId: string) => void;
  setGroupStrength: (groupId: string, strength: number) => void;
  toggleGroup: (groupId: string) => void;

  // Bulk operations
  loadPrecomputedGroups: () => Promise<void>;

  // Selectors
  getActiveGroups: () => SteeringGroup[];
  getGroupsByCategory: (category: string) => SteeringGroup[];
}
```

**Acceptance Criteria:**
- [ ] Groups store feature weights for proportional steering
- [ ] Position/radius enable 3D visualization
- [ ] Source tracking for UI differentiation
- [ ] Strength acts like a dial multiplier

### REQ-2: Precomputed Groups (~50)

Ship with curated groups covering common steering needs.

**Categories:**

| Category | Example Groups |
|----------|----------------|
| **Emotion** | joy, sadness, anger, fear, surprise, disgust, nostalgia, hope |
| **Style** | formal, casual, technical, poetic, humorous, serious |
| **Domain** | science, art, politics, personal, business, academic |
| **Structure** | concise, verbose, narrative, analytical, list-based |
| **Tone** | confident, uncertain, warm, cold, enthusiastic, neutral |
| **Complexity** | simple, complex, jargon-heavy, accessible |

**Generation Script:**

```python
# scripts/generate_groups.py
import asyncio
from neuronpedia import NeuronpediaClient

CONCEPTS = [
    ("joy", "emotion"),
    ("sadness", "emotion"),
    ("formal", "style"),
    # ... ~50 total
]

async def generate_group(client, concept, category):
    # Search for top features
    results = await client.search_all(
        model_id="gemma-2-2b",
        source_set="gemmascope-res-16k",
        text=concept,
        num_results=50
    )

    # Compute centroid from feature positions
    positions = [get_umap_position(f) for f in results]
    centroid = np.mean(positions, axis=0)
    radius = np.std(np.linalg.norm(positions - centroid, axis=1))

    return {
        "id": f"precomputed-{concept}",
        "label": concept.title(),
        "category": category,
        "features": {f.id: f.activation for f in results},
        "position": centroid.tolist(),
        "radius": float(radius),
        "source": "precomputed"
    }
```

**Output:** `public/groups/precomputed.json`

**Acceptance Criteria:**
- [ ] ~50 groups covering emotion, style, domain, structure
- [ ] Each group has 30-50 features with weights
- [ ] Positions computed from UMAP coordinates
- [ ] Loads on app initialization

### REQ-3: Search-Based Group Creation

User creates groups via semantic search (Cmd+K).

```typescript
// packages/frontend/src/services/semanticGrouping.ts

interface SearchGroupRequest {
  query: string;
  topK?: number;           // Default: 50
  minActivation?: number;  // Default: 0.1
}

async function createGroupFromSearch(
  request: SearchGroupRequest
): Promise<SteeringGroup> {
  // Call backend
  const response = await fetch('/api/features/search-to-group', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  return response.json();
}

// Backend endpoint
// POST /api/features/search-to-group
app.post('/search-to-group', async (c) => {
  const { query, topK = 50 } = await c.req.json();

  // Search Neuronpedia
  const results = await neuronpedia.searchAll({
    modelId: 'gemma-2-2b',
    sourceSet: 'gemmascope-res-16k',
    text: query,
    numResults: topK,
  });

  // Compute group properties
  const features = new Map();
  const positions = [];

  for (const result of results) {
    features.set(result.featureId, result.activation);
    positions.push(await getFeaturePosition(result.featureId));
  }

  const centroid = computeCentroid(positions);
  const radius = computeRadius(positions, centroid);

  return c.json({
    id: `search-${Date.now()}`,
    label: query,
    features: Object.fromEntries(features),
    position: centroid,
    radius,
    source: 'search',
    createdAt: Date.now(),
  });
});
```

**UI Flow:**
1. User presses Cmd+K
2. Search bar appears with placeholder "Create steering group for..."
3. User types concept (e.g., "playfulness")
4. Loading state while searching
5. Group created and rendered in graph
6. Group appears in mixer panel

**Acceptance Criteria:**
- [ ] Cmd+K opens search modal
- [ ] Search returns group within 2s
- [ ] Group renders at correct position in graph
- [ ] Group appears in mixer panel as adjustable control

### REQ-4: Spatial Clustering (Zoom-Based)

When camera zooms out, nearby features cluster into groups.

```typescript
// packages/frontend/src/utils/spatialClustering.ts

interface ClusterConfig {
  zoomLevel: 'near' | 'medium' | 'far';
  minClusterSize: number;        // Minimum features to form cluster
  maxClusters: number;           // Maximum clusters per level
}

function computeSpatialClusters(
  positions: Float32Array,
  edges: Map<string, string[]>,
  config: ClusterConfig
): SteeringGroup[] {
  const k = config.zoomLevel === 'far' ? 20 :
            config.zoomLevel === 'medium' ? 100 : 0;

  if (k === 0) return [];  // No clustering at near zoom

  // K-means clustering on UMAP positions
  const clusters = kMeans(positions, k);

  // Convert to SteeringGroup format
  return clusters.map((cluster, i) => ({
    id: `spatial-${config.zoomLevel}-${i}`,
    label: `Region ${i + 1}`,  // TODO: LLM-generated labels
    features: new Map(
      cluster.members.map(idx => [
        getNodeIdFromIndex(idx),
        1.0 / cluster.members.length,  // Equal weight
      ])
    ),
    position: cluster.centroid,
    radius: cluster.radius,
    source: 'spatial',
    strength: 0,
    isActive: false,
  }));
}
```

**Zoom Level Mapping:**

| Camera Distance | Cluster Count | Interaction |
|-----------------|---------------|-------------|
| < 30 | 0 (individual nodes) | Click single feature |
| 30-100 | ~100-200 | Click medium groups |
| > 100 | ~20 | Click large regions |

**Acceptance Criteria:**
- [ ] Clusters compute based on camera distance
- [ ] Smooth transition animation between levels (300ms)
- [ ] Clicking cluster steers all constituent features
- [ ] Cluster labels generated (initially "Region N", later LLM)

### REQ-5: Group Visualization (ClusterMesh)

Render groups as distinct visual elements.

```typescript
// packages/frontend/src/components/graph/ClusterMesh.tsx

interface ClusterMeshProps {
  groups: SteeringGroup[];
  onGroupClick: (groupId: string) => void;
  onGroupHover: (groupId: string | null) => void;
}

function ClusterMesh({ groups, onGroupClick, onGroupHover }: ClusterMeshProps) {
  return (
    <group>
      {groups.map(group => (
        <group key={group.id} position={group.position}>
          {/* Outer sphere (boundary) */}
          <mesh
            onClick={() => onGroupClick(group.id)}
            onPointerOver={() => onGroupHover(group.id)}
            onPointerOut={() => onGroupHover(null)}
          >
            <sphereGeometry args={[group.radius, 32, 32]} />
            <meshBasicMaterial
              color={getGroupColor(group)}
              transparent
              opacity={0.15}
              side={THREE.BackSide}
            />
          </mesh>

          {/* Label */}
          <Html center>
            <div className="group-label">
              {group.label}
              {group.isActive && (
                <span className="strength">
                  {group.strength > 0 ? '+' : ''}{group.strength}
                </span>
              )}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
```

**Visual Design:**
- Semi-transparent sphere showing group boundary
- Label floating at centroid
- Active groups: brighter, pulsing boundary
- Hover: boundary becomes more opaque
- Color coding by source or category

**Acceptance Criteria:**
- [ ] Groups render as translucent spheres
- [ ] Labels visible and readable
- [ ] Click/hover interactions work
- [ ] Performance acceptable with 200 groups

### REQ-6: Group Controls in Mixer

Groups appear as dials in the mixer panel.

```typescript
// In MixerPanel.tsx
function MixerPanel() {
  const groups = useAppStore(s => s.groups);
  const activeGroups = useAppStore(s => s.getActiveGroups());

  return (
    <div className="mixer-panel">
      {/* Precomputed groups by category */}
      {['emotion', 'style', 'domain'].map(category => (
        <GroupCategory key={category} category={category}>
          {groups.filter(g => g.category === category).map(group => (
            <GroupDial
              key={group.id}
              group={group}
              onStrengthChange={(s) => setGroupStrength(group.id, s)}
              onToggle={() => toggleGroup(group.id)}
            />
          ))}
        </GroupCategory>
      ))}

      {/* User-created groups */}
      <GroupCategory category="Custom">
        {groups.filter(g => g.source === 'search' || g.source === 'user').map(...)}
      </GroupCategory>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Groups organized by category
- [ ] Each group has dial-like control
- [ ] Strength adjustable -10 to +10
- [ ] Visual indicator when group is active
- [ ] "Remove" option for user-created groups

## Technical Notes

### Group → Steering Vector Conversion

When group is active, its features contribute to steering:

```typescript
function groupToSteeringFeatures(group: SteeringGroup): SteeringFeature[] {
  return Array.from(group.features.entries()).map(([featureId, weight]) => ({
    featureId,
    ...parseFeatureId(featureId),
    // Feature strength = group strength × feature weight
    strength: group.strength * weight,
  }));
}

function mergeAllSteering(
  activeFeatures: Map<string, ActiveFeature>,
  dialVector: SteeringVector,
  activeGroups: SteeringGroup[]
): SteeringVector {
  const merged = new Map<string, number>();

  // Add dial features
  // ... (from LIVE-001)

  // Add group features
  for (const group of activeGroups) {
    if (!group.isActive) continue;
    for (const feature of groupToSteeringFeatures(group)) {
      const existing = merged.get(feature.featureId) || 0;
      merged.set(feature.featureId, existing + feature.strength);
    }
  }

  // Clamp, sort, return top 100
  // ...
}
```

### Caching Strategy

- Precomputed groups: Load once, cache in memory
- Search groups: Cache in localStorage by query
- Spatial clusters: Recompute on zoom change, cache per level

## Dependencies

- [LIVE-001](LIVE-001-click-to-steer.md) - Active features merging
- [MIX-001](../phase-2/MIX-001-dial.md) - Dial component patterns
- [HIR-001](HIR-001-semantic-zoom.md) - Semantic zoom integration
- [API-001](../phase-1/API-001-neuronpedia.md) - Search API

## Open Questions

1. How to generate meaningful labels for spatial clusters?
2. Should groups be saveable/shareable across sessions?
3. Maximum number of active groups simultaneously?
4. How to visualize group overlap in the graph?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-11 | Initial draft |
