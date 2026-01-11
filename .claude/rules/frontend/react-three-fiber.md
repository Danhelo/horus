# React Three Fiber Best Practices

## Critical Performance Rules

### Never setState in useFrame

```typescript
// BAD - causes 60fps re-renders
useFrame(() => {
  setPosition({ x: Math.sin(Date.now()) }); // React re-render every frame!
});

// GOOD - mutate directly via refs
useFrame(() => {
  if (meshRef.current) {
    meshRef.current.position.x = Math.sin(Date.now());
  }
});
```

### Use Delta Time for Frame-Rate Independence

```typescript
// BAD - different speeds on different machines
useFrame(() => {
  mesh.current.position.x += 0.1;
});

// GOOD - consistent speed regardless of FPS
useFrame((state, delta) => {
  mesh.current.position.x += delta * 60; // 60 units per second
});
```

### Use Refs, Not State for Transient Updates

```typescript
// Pre-allocate outside component or in useMemo - NEVER in useFrame
const tempVec = new THREE.Vector3();
const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();
const tempObject = new THREE.Object3D();

useFrame(() => {
  // Reuse objects to avoid garbage collection
  tempVec.set(x, y, z);
  meshRef.current.position.copy(tempVec);
});
```

---

## InstancedMesh for 50k+ Nodes

### Basic Pattern with Dynamic Updates

```typescript
function NodeMesh({ count = 50000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Pre-allocate reusable objects ONCE
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Initial setup - runs once
  useLayoutEffect(() => {
    if (!meshRef.current) return;

    const positions = useGraphStore.getState().nodePositions;
    for (let i = 0; i < count; i++) {
      tempObject.position.set(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count]);

  // Dynamic updates in render loop
  useFrame(() => {
    const { activations, isDirty } = useGraphStore.getState();
    if (!meshRef.current || !isDirty) return;

    // Only update what changed
    for (let i = 0; i < count; i++) {
      const activation = activations[i] ?? 0;
      tempColor.setHSL(0.1, 0.8, 0.3 + activation * 0.5);
      meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
```

### Critical: needsUpdate Flags

```typescript
// After updating positions/transforms
meshRef.current.instanceMatrix.needsUpdate = true;

// After updating colors
meshRef.current.instanceColor!.needsUpdate = true;

// After updating custom attributes
meshRef.current.geometry.attributes.customAttr.needsUpdate = true;

// Recompute bounding for correct frustum culling
meshRef.current.computeBoundingBox();
meshRef.current.computeBoundingSphere();
```

### Avoid drei's <Instances> for 50k+ Objects

```typescript
// BAD - drei Instances has CPU overhead, causes FPS drops at scale
import { Instances, Instance } from '@react-three/drei';
<Instances>
  {nodes.map((n) => <Instance key={n.id} position={n.pos} />)}
</Instances>

// GOOD - Use raw InstancedMesh with useRef for 50k+ objects
<instancedMesh ref={meshRef} args={[geometry, material, 50000]} />
```

---

## Enhanced InstancedMesh2 (Frustum Culling + BVH)

For scenes with 50k+ instances, consider `@three.ez/instanced-mesh`:

```typescript
import { InstancedMesh2 } from '@three.ez/instanced-mesh';

function EnhancedNodeMesh({ count = 50000 }) {
  const meshRef = useRef<InstancedMesh2>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    // Add instances with Object3D-like API
    meshRef.current.addInstances(count, (obj, index) => {
      obj.position.set(
        Math.random() * 100 - 50,
        Math.random() * 100 - 50,
        Math.random() * 100 - 50
      );
    });

    // Enable BVH for fast raycasting/culling (for mostly static instances)
    meshRef.current.computeBVH({ margin: 0 });
  }, [count]);

  // Use primitive to inject Three.js object directly
  const mesh = useMemo(() => {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial();
    return new InstancedMesh2(geometry, material, {
      capacity: count,
      createEntities: true, // Enable Object3D-like instances
    });
  }, [count]);

  return <primitive object={mesh} ref={meshRef} />;
}
```

### InstancedMesh2 Key Features

```typescript
// Per-instance visibility
mesh.setVisibilityAt(index, false);
mesh.instances[0].visible = false;

// Per-instance opacity (enable sorting + disable depthWrite)
mesh.sortObjects = true;
mesh.setOpacityAt(index, 0.5);

// LOD per instance
mesh.addLOD(geometryMid, material, 50);  // Switch at 50 units
mesh.addLOD(geometryLow, material, 200); // Switch at 200 units

// Raycast optimization (only check visible instances)
mesh.raycastOnlyFrustum = true;
```

---

## Custom Instanced Attributes (Per-Instance Data)

### Using InstancedBufferAttribute

```typescript
function NodesWithCustomData({ count = 50000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    // Create custom per-instance attribute
    const activations = new Float32Array(count);
    const glowIntensity = new Float32Array(count);

    // Initialize with data
    for (let i = 0; i < count; i++) {
      activations[i] = Math.random();
      glowIntensity[i] = Math.random();
    }

    const geometry = meshRef.current.geometry;
    geometry.setAttribute(
      'aActivation',
      new THREE.InstancedBufferAttribute(activations, 1)
    );
    geometry.setAttribute(
      'aGlow',
      new THREE.InstancedBufferAttribute(glowIntensity, 1)
    );
  }, [count]);

  // Update custom attributes in render loop
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const activationAttr = mesh.geometry.attributes.aActivation;
    const newData = useGraphStore.getState().activations;

    // Direct array copy is faster than loop
    (activationAttr.array as Float32Array).set(newData);
    activationAttr.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </instancedMesh>
  );
}
```

### Custom Shader for Per-Instance Attributes

```glsl
// Vertex Shader
attribute float aActivation;
attribute float aGlow;

varying float vActivation;
varying float vGlow;

void main() {
  vActivation = aActivation;
  vGlow = aGlow;

  // Use instanceMatrix for position (automatically provided)
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}

// Fragment Shader
varying float vActivation;
varying float vGlow;

uniform float uTime;

void main() {
  vec3 baseColor = vec3(0.9, 0.7, 0.2); // Gold
  vec3 glowColor = mix(baseColor, vec3(1.0), vGlow * sin(uTime) * 0.5);
  float alpha = 0.5 + vActivation * 0.5;

  gl_FragColor = vec4(glowColor * vActivation, alpha);
}
```

---

## Per-Instance Uniforms (three-instanced-uniforms-mesh)

For materials that need per-instance uniform values:

```typescript
import { InstancedUniformsMesh } from 'three-instanced-uniforms-mesh';

function NodesWithUniforms({ count = 50000 }) {
  const meshRef = useRef<InstancedUniformsMesh>(null);

  const mesh = useMemo(() => {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      metalness: 0.5,
      roughness: 0.5,
    });
    return new InstancedUniformsMesh(geometry, material, count);
  }, [count]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    // Set per-instance uniforms (automatically upgrades shader)
    for (let i = 0; i < count; i++) {
      meshRef.current.setUniformAt('metalness', i, Math.random());
      meshRef.current.setUniformAt('roughness', i, Math.random());
      meshRef.current.setUniformAt('emissive', i, new THREE.Color(0xffd700));
    }
  }, [count]);

  return <primitive object={mesh} ref={meshRef} />;
}
```

---

## Edge Rendering for 100k+ Edges

### Single BufferGeometry LineSegments (Best Performance)

```typescript
function EdgeLines({ edges }: { edges: Edge[] }) {
  const linesRef = useRef<THREE.LineSegments>(null);

  // Pre-compute all edge positions into a single buffer
  const geometry = useMemo(() => {
    const positions = new Float32Array(edges.length * 6); // 2 points * 3 coords
    const colors = new Float32Array(edges.length * 6);    // 2 points * 3 colors

    edges.forEach((edge, i) => {
      const offset = i * 6;
      // Start point
      positions[offset] = edge.source.x;
      positions[offset + 1] = edge.source.y;
      positions[offset + 2] = edge.source.z;
      // End point
      positions[offset + 3] = edge.target.x;
      positions[offset + 4] = edge.target.y;
      positions[offset + 5] = edge.target.z;

      // Colors (can vary per vertex)
      const color = new THREE.Color(0x444444);
      colors[offset] = colors[offset + 3] = color.r;
      colors[offset + 1] = colors[offset + 4] = color.g;
      colors[offset + 2] = colors[offset + 5] = color.b;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [edges]);

  // Dynamic updates
  useFrame(() => {
    if (!linesRef.current) return;

    const { edgeActivations } = useGraphStore.getState();
    const colors = linesRef.current.geometry.attributes.color;
    const colorArray = colors.array as Float32Array;

    for (let i = 0; i < edges.length; i++) {
      const activation = edgeActivations[i] ?? 0;
      const color = new THREE.Color().setHSL(0.1, 0.8, 0.2 + activation * 0.6);
      const offset = i * 6;
      colorArray[offset] = colorArray[offset + 3] = color.r;
      colorArray[offset + 1] = colorArray[offset + 4] = color.g;
      colorArray[offset + 2] = colorArray[offset + 5] = color.b;
    }
    colors.needsUpdate = true;
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.6} />
    </lineSegments>
  );
}
```

### Fat Lines (Line2) for Visibility

```typescript
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry';

// Note: Line2 has performance limits around 10k lines
// For 100k+ edges, use basic LineSegments or GPU-based approaches
```

---

## Raycasting with InstancedMesh (Node Picking)

### Basic Raycasting

```typescript
function GraphWithPicking({ count = 50000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (event.instanceId !== undefined) {
      const nodeId = event.instanceId;
      useGraphStore.getState().selectNode(nodeId);
    }
  }, []);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (event.instanceId !== undefined) {
      useGraphStore.getState().setHoveredNode(event.instanceId);
    }
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
    >
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
```

### Optimized Raycasting with BVH

```typescript
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Extend Three.js prototypes (do once at app init)
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

function OptimizedNodeMesh({ count = 50000 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;

    // Compute BVH for the base geometry
    meshRef.current.geometry.computeBoundsTree();

    return () => {
      meshRef.current?.geometry.disposeBoundsTree();
    };
  }, []);

  // For first-hit optimization (fastest)
  const raycaster = useMemo(() => {
    const rc = new THREE.Raycaster();
    rc.firstHitOnly = true;
    return rc;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
```

---

## Level of Detail (LOD) Strategies

### drei's Detailed Component

```typescript
import { Detailed } from '@react-three/drei';

// Children ordered high-to-low quality
// Distances: first child at 0-10, second at 10-20, third at 20+
<Detailed distances={[0, 10, 20]}>
  <HighDetailMesh />   {/* 32 segments sphere */}
  <MediumDetailMesh /> {/* 16 segments sphere */}
  <LowDetailMesh />    {/* 8 segments sphere, or billboard */}
</Detailed>
```

### Custom LOD for Instanced Meshes

```typescript
function LODNodeMesh({ nodes }: { nodes: Node[] }) {
  const highRef = useRef<THREE.InstancedMesh>(null);
  const lowRef = useRef<THREE.InstancedMesh>(null);

  const tempObject = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ camera }) => {
    if (!highRef.current || !lowRef.current) return;

    const LOD_DISTANCE = 50;
    let highCount = 0;
    let lowCount = 0;

    nodes.forEach((node, i) => {
      const distance = camera.position.distanceTo(
        new THREE.Vector3(node.x, node.y, node.z)
      );

      tempObject.position.set(node.x, node.y, node.z);
      tempObject.updateMatrix();

      if (distance < LOD_DISTANCE) {
        highRef.current!.setMatrixAt(highCount++, tempObject.matrix);
      } else {
        lowRef.current!.setMatrixAt(lowCount++, tempObject.matrix);
      }
    });

    highRef.current.count = highCount;
    lowRef.current.count = lowCount;
    highRef.current.instanceMatrix.needsUpdate = true;
    lowRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={highRef} args={[undefined, undefined, nodes.length]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={lowRef} args={[undefined, undefined, nodes.length]}>
        <sphereGeometry args={[0.1, 4, 4]} />
        <meshBasicMaterial />
      </instancedMesh>
    </>
  );
}
```

---

## Frustum Culling

### Automatic (Default Behavior)

Three.js frustum culls meshes automatically. For InstancedMesh, the bounding sphere encompasses ALL instances, so:

```typescript
// Recompute bounds after position changes
meshRef.current.computeBoundingBox();
meshRef.current.computeBoundingSphere();
```

### Per-Instance Frustum Culling (InstancedMesh2)

```typescript
import { InstancedMesh2 } from '@three.ez/instanced-mesh';

const mesh = new InstancedMesh2(geometry, material, {
  capacity: 50000,
  // Per-instance culling enabled by default
});

// For mostly static scenes, add BVH for O(log n) culling
mesh.computeBVH({ margin: 0 });
```

---

## GPU-Based Updates (Frame Buffer Objects)

For truly massive datasets (1M+ particles), move computation to GPU:

```typescript
import { useFBO } from '@react-three/drei';

function GPUParticles({ count = 1000000 }) {
  const size = Math.ceil(Math.sqrt(count));
  const pointsRef = useRef<THREE.Points>(null);

  // Off-screen render target for simulation
  const renderTarget = useFBO(size, size, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });

  // Simulation scene (renders positions to texture)
  const { scene: simScene, camera: simCamera } = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Fullscreen quad with simulation shader
    const simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPositions: { value: null },
        uTime: { value: 0 },
      },
      vertexShader: simVertexShader,
      fragmentShader: simFragmentShader,
    });

    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      simMaterial
    );
    scene.add(quad);

    return { scene, camera };
  }, []);

  useFrame(({ gl, clock }) => {
    // Run simulation pass
    gl.setRenderTarget(renderTarget);
    (simScene.children[0] as THREE.Mesh).material.uniforms.uTime.value = clock.elapsedTime;
    gl.render(simScene, simCamera);
    gl.setRenderTarget(null);

    // Pass computed positions to particles
    if (pointsRef.current) {
      (pointsRef.current.material as THREE.ShaderMaterial).uniforms.uPositions.value =
        renderTarget.texture;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={new Float32Array(count * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        uniforms={{
          uPositions: { value: null },
          uTime: { value: 0 },
        }}
        vertexShader={renderVertexShader}
        fragmentShader={renderFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
```

---

## Memory Management for TypedArrays

### Object Pooling Pattern

```typescript
// Create typed arrays once, reuse them
const POOL = {
  positions: new Float32Array(50000 * 3),
  colors: new Float32Array(50000 * 3),
  matrices: new Float32Array(50000 * 16),
};

// Never create new Float32Arrays in useFrame
useFrame(() => {
  // Use pooled arrays
  const positions = POOL.positions;
  // ...modify in place
});
```

### Efficient Array Updates

```typescript
// BAD - creates garbage
const newPositions = new Float32Array(nodes.map(n => [n.x, n.y, n.z]).flat());

// GOOD - update in place
const positions = existingPositions;
for (let i = 0; i < nodes.length; i++) {
  positions[i * 3] = nodes[i].x;
  positions[i * 3 + 1] = nodes[i].y;
  positions[i * 3 + 2] = nodes[i].z;
}

// BEST - use TypedArray.set() for bulk copies
const sourceArray = new Float32Array(newData);
existingPositions.set(sourceArray);
```

---

## Canvas Configuration for Performance

```typescript
<Canvas
  gl={{
    powerPreference: 'high-performance',
    alpha: false,      // Disable if not needed
    antialias: false,  // Disable for performance
    stencil: false,    // Disable if not using stencil buffer
    depth: true,       // Usually needed
  }}
  dpr={Math.min(window.devicePixelRatio, 1.5)} // Limit DPR
  frameloop="demand" // Or 'always' for constant animation
>
```

### Dynamic DPR Adjustment

```typescript
import { PerformanceMonitor } from '@react-three/drei';

function AdaptiveCanvas({ children }) {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas dpr={dpr}>
      <PerformanceMonitor
        bounds={() => [30, 60]}
        flipflops={3}
        onDecline={() => setDpr(Math.max(0.5, dpr * 0.8))}
        onIncline={() => setDpr(Math.min(2, dpr * 1.1))}
      >
        {children}
      </PerformanceMonitor>
    </Canvas>
  );
}
```

---

## Performance Monitoring

```typescript
import { Perf } from 'r3f-perf';

<Canvas>
  {import.meta.env.DEV && (
    <Perf position="top-left" />
  )}
</Canvas>
```

### Pause Rendering When Tab Hidden

```typescript
function RenderControl() {
  const setFrameloop = useThree((state) => state.setFrameloop);

  useEffect(() => {
    const handleVisibility = () => {
      setFrameloop(document.hidden ? 'never' : 'always');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [setFrameloop]);

  return null;
}
```

---

## Zustand Integration

```typescript
// Subscribe to store without re-renders
useEffect(() => {
  return useGraphStore.subscribe(
    (state) => state.activations,
    (activations) => {
      // Update mesh directly
      updateMeshColors(meshRef.current, activations);
    }
  );
}, []);

// In useFrame, use getState() - never useStore() hook
useFrame(() => {
  const { camera } = useGraphStore.getState();
  // Use values without triggering React
});
```

---

## Anti-Patterns to Avoid

1. **Creating objects in useFrame** - pre-allocate vectors, matrices, colors
2. **Using setState in render loop** - mutate refs directly
3. **Deep component trees in Canvas** - keep 3D tree shallow
4. **Uncontrolled re-renders** - use React.memo, useMemo
5. **Blocking main thread** - use Web Workers for heavy computation
6. **Using drei Instances for 50k+ objects** - use raw InstancedMesh
7. **Creating new TypedArrays every frame** - use object pooling
8. **Ignoring needsUpdate flags** - always set after buffer modifications
9. **Not recomputing bounding spheres** - causes incorrect frustum culling

---

## File Structure

```
components/graph/
├── GraphCanvas.tsx       # Main Canvas wrapper
├── NodeMesh.tsx          # Instanced node rendering
├── EdgeLines.tsx         # Line geometry for edges
├── CameraController.tsx  # Camera state sync
├── GlowEffect.tsx        # Post-processing
└── index.ts
```

---

## Dependencies for Large-Scale Rendering

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.x",
    "@react-three/drei": "^9.x",
    "three": "^0.160.x",
    "three-mesh-bvh": "^0.7.x"
  },
  "optionalDependencies": {
    "@three.ez/instanced-mesh": "^0.x",
    "three-instanced-uniforms-mesh": "^1.x",
    "r3f-perf": "^7.x"
  }
}
```
