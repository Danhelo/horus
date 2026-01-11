# Frontend Patterns (R3F + Zustand)

## Critical R3F Rules

**NEVER setState in useFrame** - mutate refs directly:
```typescript
// BAD: useFrame(() => setPosition(...)) - 60fps re-renders!
// GOOD:
useFrame((_, delta) => {
  meshRef.current.position.x += delta * 60;
});
```

**Pre-allocate objects** - never create in useFrame:
```typescript
const tempVec = new THREE.Vector3();
const tempColor = new THREE.Color();
const tempObject = new THREE.Object3D();
```

## InstancedMesh (50k+ nodes)

```typescript
function NodeMesh({ count = 50000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const positions = useLargeDataStore.getState().nodePositions;
    for (let i = 0; i < count; i++) {
      tempObject.position.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
```

**After buffer updates**: Always set `needsUpdate = true` on instanceMatrix, instanceColor, or geometry.attributes.

**Avoid drei's `<Instances>`** for 50k+ - use raw InstancedMesh.

## Zustand Patterns

```typescript
// Separate stores by update frequency
interface AppStore { currentText: string; dialValues: Record<string,number>; }
interface LargeDataStore { nodePositions: Float32Array; } // Not in React tree
interface TransientStore { hoveredNodeId: string | null; } // High-frequency

// In useFrame - use getState(), never hooks
useFrame(() => {
  const { activations } = useLargeDataStore.getState();
});

// Selectors with shallow compare
const { pos, target } = useAppStore(s => ({ pos: s.camera.position, target: s.camera.target }), shallow);
```

## Graph Loading

```typescript
// Zod validation → Maps → Float32Arrays
const graphJSONSchema = z.object({
  metadata: z.object({ modelId: z.string(), layers: z.array(z.number()) }),
  nodes: z.array(z.object({
    id: z.string(),
    position: z.tuple([z.number(), z.number(), z.number()]),
  })),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), weight: z.number() })),
});
```

## Dial Component Essentials

- 270° arc, pointer capture for drag
- Keyboard: arrows ±0.05 (shift=±0.01), Home/End=min/max
- Double-click = reset to default
- Scroll wheel for fine adjustment
- On hover/drag → highlight trace in graph

## Trace Visualization

Update colors in useFrame via buffer mutation, not React state:
```typescript
useFrame(() => {
  const { activeTraces } = useTraceStore.getState();
  // Update mesh.instanceColor.array directly
  mesh.instanceColor.needsUpdate = true;
});
```

## Trajectory Animation

```typescript
interface TrajectoryPoint {
  tokenIndex: number;
  token: string;
  activations: Map<string, number>;
  position: [number, number, number]; // Weighted centroid of active features
}
```
- Playback: space=play/pause, arrows=step, Home/End=seek
- Position = weighted centroid of activating features

## Performance Checklist

- [ ] No setState in useFrame
- [ ] Pre-allocated temp objects
- [ ] needsUpdate flags set after buffer changes
- [ ] getState() not hooks in render loop
- [ ] Throttle trace updates to ~20fps
- [ ] Use Web Workers for heavy JSON parsing
