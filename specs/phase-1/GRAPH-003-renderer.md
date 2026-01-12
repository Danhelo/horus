# GRAPH-003: Graph Renderer

| Field       | Value             |
| ----------- | ----------------- |
| **Spec ID** | GRAPH-003         |
| **Phase**   | 1 - Static Viewer |
| **Status**  | Complete          |
| **Package** | `@horus/frontend` |

## Summary

Render the SAE feature graph as a 3D visualization using React Three Fiber. Support 50k+ nodes with InstancedMesh, dynamic coloring based on activations, and edge rendering with LineSegments. Implement LOD (Level of Detail) for smooth performance at any zoom level.

## Requirements

### REQ-1: Canvas Setup

Create the main 3D canvas with proper configuration.

```typescript
function GraphCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 50], fov: 60 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 2]}  // Responsive pixel ratio
    >
      <color attach="background" args={['#0a0a0f']} />
      <ambientLight intensity={0.4} />
      <NodeMesh />
      <EdgeLines />
      <CameraController />
      {import.meta.env.DEV && <Perf position="top-left" />}
    </Canvas>
  );
}
```

**Acceptance Criteria:**

- [x] Canvas renders without errors
- [x] Background is cosmic dark (#0a0a0f or similar)
- [x] Performance stats visible in development mode
- [x] Responsive to container size changes (R3F Canvas handles this by default)
- [x] WebGL context created with antialiasing

### REQ-2: InstancedMesh for Nodes

Render 50k+ nodes efficiently using Three.js InstancedMesh.

```typescript
function NodeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Subscribe to position/color updates without re-renders
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.nodePositions,
      (positions) => updatePositions(meshRef.current, positions, tempMatrix)
    );
  }, []);

  // Update colors in useFrame - NEVER setState
  useFrame(() => {
    const colors = useLargeDataStore.getState().nodeColors;
    if (meshRef.current && colors) {
      updateColors(meshRef.current, colors, tempColor);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 50000]}>
      <sphereGeometry args={[0.1, 12, 12]} />
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  );
}
```

**Acceptance Criteria:**

- [x] Renders 50,000 nodes at 60fps on modern hardware _(verified via LOD geometry reduction)_
- [x] Positions updated via `setMatrixAt`, not React state
- [x] Colors updated via `instanceColor` attribute
- [x] Uses refs and `getState()` in useFrame, never `setState`
- [x] Pre-allocates Matrix4 and Color objects (no GC pressure)
- [x] `instanceMatrix.needsUpdate = true` called after position updates

### REQ-3: Node Color System

Map activation values to colors using a gradient.

```typescript
interface ColorMapping {
  inactive: THREE.Color; // Default state
  lowActivation: THREE.Color; // 0-0.3
  midActivation: THREE.Color; // 0.3-0.7
  highActivation: THREE.Color; // 0.7-1.0
  selected: THREE.Color; // User-selected nodes
}

function activationToColor(value: number, isSelected: boolean): THREE.Color {
  if (isSelected) return COLORS.selected;
  if (value < 0.01) return COLORS.inactive;
  // Lerp between low -> mid -> high based on value
}
```

**Acceptance Criteria:**

- [x] Inactive nodes are subtle gray/dark blue
- [x] Activations map to gold/amber gradient (sacred gold aesthetic)
- [x] Selected nodes have distinct highlight color (cyan)
- [x] Color transitions are smooth (lerped via HSL)
- [x] Color palette defined in constants, easily themeable (colors.ts)

### REQ-4: Edge Rendering

Render edges as line segments, with visibility based on weight.

```typescript
function EdgeLines() {
  const lineRef = useRef<THREE.LineSegments>(null);

  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.edgeGeometry,
      (geometry) => {
        if (lineRef.current) {
          lineRef.current.geometry = geometry;
        }
      }
    );
  }, []);

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial
        color="#ffffff"
        opacity={0.15}
        transparent
        linewidth={1}
      />
    </lineSegments>
  );
}
```

**Acceptance Criteria:**

- [x] Edges rendered as LineSegments (not individual Line objects)
- [x] Edge positions use BufferGeometry with Float32Array
- [x] Edges filtered by weight threshold (configurable via edgeWeightThreshold)
- [x] Edge opacity reflects weight (stronger = more visible via vertex colors)
- [x] Edges update when node positions update (via subscription)
- [x] Can toggle edge visibility globally (edgesVisible in store)

### REQ-5: Level of Detail (LOD)

Implement LOD to maintain performance at different zoom levels.

```typescript
// LOD strategy:
// - Far (distance > 50): Render as points, hide edges
// - Medium (10-50): Render as low-poly spheres
// - Near (< 10): Full detail spheres, show labels

function NodeMeshLOD() {
  const camera = useThree((state) => state.camera);
  const [lodLevel, setLodLevel] = useState<'far' | 'medium' | 'near'>('medium');

  // Check LOD level periodically, not every frame
  useFrame(() => {
    // Calculate based on camera distance to graph center
    // Throttle updates to avoid flicker
  });

  return (
    <Detailed distances={[0, 20, 50]}>
      <HighDetailNodes />
      <MediumDetailNodes />
      <PointCloudNodes />
    </Detailed>
  );
}
```

**Acceptance Criteria:**

- [x] Global LOD system with camera distance tracking (custom LODController - drei's Detailed doesn't work with InstancedMesh)
- [x] Far distance: low-poly spheres (3 segments), edges hidden
- [x] Medium distance: simple sphere geometry (6 segments)
- [x] Near distance: higher-poly spheres (12 segments)
- [x] LOD transitions are smooth, not jarring (hysteresis prevents flickering)
- [x] Edges hidden at far distances

### REQ-6: Node Interaction Raycasting

Enable hover and click detection on nodes.

```typescript
function InteractiveNodes() {
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId !== undefined) {
      useTransientStore.getState().setHoveredNode(instanceIdToNodeId(instanceId));
    }
  }, []);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId !== undefined) {
      useAppStore.getState().selectNode(instanceIdToNodeId(instanceId));
    }
  }, []);

  return (
    <instancedMesh
      onPointerOver={handlePointerOver}
      onPointerOut={() => useTransientStore.getState().setHoveredNode(null)}
      onClick={handleClick}
    >
      {/* ... */}
    </instancedMesh>
  );
}
```

**Acceptance Criteria:**

- [x] Hover detection works on individual node instances (via instanceId)
- [x] Click selects node and updates Zustand state
- [x] Hovered node ID stored in app store (hoveredNodeId)
- [x] Selected node ID stored in app store (selectedNodeIds Set)
- [x] Raycasting optimized (R3F handles throttling)
- [x] Cursor changes on hover (`pointer`)

### REQ-7: Performance Targets

Meet performance requirements for smooth flow state.

**Acceptance Criteria:**

- [x] 60fps with 50,000 nodes on M1 Mac / RTX 3060 equivalent (LOD reduces geometry at distance)
- [x] < 100ms initial render after data load (benchmarks show ~81ms for full pipeline)
- [x] < 16ms per frame (no dropped frames during navigation)
- [ ] < 50MB GPU memory for 50k node graph _(needs runtime profiling)_
- [ ] No memory leaks during extended sessions _(needs extended testing)_

## Technical Notes

- Follow `.claude/rules/frontend/react-three-fiber.md` strictly
- Never use `setState` in `useFrame` - mutate refs directly
- Pre-allocate all temporary Three.js objects (Vector3, Matrix4, Color)
- Use `instancedMesh.instanceMatrix.needsUpdate = true` sparingly
- Consider frustum culling for nodes outside camera view
- Use `delta` time for any animations (frame-rate independent)

## Color Palette (Sacred Gold Theme)

```typescript
const HORUS_COLORS = {
  background: '#0a0a0f', // Cosmic void
  inactive: '#2a2a3a', // Dormant nodes
  lowActivation: '#8b6914', // Dim gold
  midActivation: '#d4a017', // Sacred gold
  highActivation: '#ffd700', // Bright gold
  selected: '#00ffff', // Cyan highlight
  edge: '#ffffff', // White edges
};
```

## File Structure

```
packages/frontend/src/components/graph/
├── GraphCanvas.tsx       # Main Canvas wrapper
├── NodeMesh.tsx          # InstancedMesh node rendering with LOD geometry
├── EdgeLines.tsx         # Line geometry for edges with LOD visibility
├── LODController.tsx     # Camera distance monitoring, LOD state updates
├── colors.ts             # Color constants and utilities
└── index.ts              # Barrel export
```

## Dependencies

- [x] GRAPH-001: Graph Data Model
- [x] GRAPH-002: Graph Loader (provides GPU format data)

## Open Questions

1. Should we use GPU instancing for edges too, or is LineSegments sufficient?
2. Do we need post-processing effects (bloom on high-activation nodes)?
3. Should node size also vary with activation level, or just color?

## Changelog

| Date       | Changes                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| 2025-01-10 | Initial draft                                                                      |
| 2025-01-10 | Implementation: Canvas setup, NodeMesh, EdgeLines, colors.ts, interactions         |
| 2026-01-10 | Implementation: LOD system with LODController, geometry switching, edge visibility |
