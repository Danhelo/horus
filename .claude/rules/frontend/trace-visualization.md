# Trace Visualization Patterns

## Overview

Traces highlight subsets of nodes/edges in the graph when dials are hovered or adjusted. This creates visual feedback showing which features a dial affects - the "fingerprint" of a semantic concept in ideaspace.

---

## Data Structure

```typescript
interface TraceHighlight {
  dialId: string;
  nodeIds: string[];          // Nodes in this trace
  weights: Map<string, number>; // Node ID -> weight (0-1)
  color: string;               // Trace color (for multi-trace)
  intensity: number;           // Current highlight intensity (0-1)
}

interface TraceStore {
  activeTraces: Map<string, TraceHighlight>;

  // Actions
  setTraceHighlight: (dialId: string, nodeIds: string[], weights: Map<string, number>) => void;
  setTraceIntensity: (dialId: string, intensity: number) => void;
  clearTrace: (dialId: string) => void;
  clearAllTraces: () => void;
}
```

---

## Efficient Color Buffer Updates

For 50k+ nodes, update colors via the InstancedMesh color buffer directly:

```typescript
// Pre-allocate color computation buffers ONCE
const tempColor = new THREE.Color();
const INACTIVE_COLOR = new THREE.Color(0.16, 0.16, 0.22);  // Dark blue-gray
const GOLD_HUE = 0.12;  // Gold in HSL

function updateTraceHighlights(
  meshRef: React.RefObject<THREE.InstancedMesh>,
  nodeIndexMap: Map<string, number>,
  activeTraces: Map<string, TraceHighlight>,
  baseActivations: Map<string, number>  // Current activation values
) {
  const mesh = meshRef.current;
  if (!mesh || !mesh.instanceColor) return;

  const colorArray = mesh.instanceColor.array as Float32Array;
  const nodeCount = nodeIndexMap.size;

  // Build combined highlight map (multiple traces can overlap)
  const combinedHighlight = new Map<string, { intensity: number; color: string }>();

  for (const trace of activeTraces.values()) {
    if (trace.intensity === 0) continue;

    for (const nodeId of trace.nodeIds) {
      const weight = trace.weights.get(nodeId) ?? 1.0;
      const effectiveIntensity = trace.intensity * weight;

      const existing = combinedHighlight.get(nodeId);
      if (!existing || effectiveIntensity > existing.intensity) {
        combinedHighlight.set(nodeId, {
          intensity: effectiveIntensity,
          color: trace.color,
        });
      }
    }
  }

  // Update all node colors in one pass
  for (const [nodeId, idx] of nodeIndexMap) {
    const highlight = combinedHighlight.get(nodeId);
    const baseActivation = baseActivations.get(nodeId) ?? 0;

    if (highlight && highlight.intensity > 0.01) {
      // Highlighted: blend base color toward trace color
      const traceColor = new THREE.Color(highlight.color);
      tempColor.lerpColors(
        getActivationColor(baseActivation),
        traceColor,
        highlight.intensity * 0.7  // Don't fully override base
      );
    } else {
      // Not highlighted: use base activation color
      tempColor.copy(getActivationColor(baseActivation));
    }

    const offset = idx * 3;
    colorArray[offset] = tempColor.r;
    colorArray[offset + 1] = tempColor.g;
    colorArray[offset + 2] = tempColor.b;
  }

  mesh.instanceColor.needsUpdate = true;
}

function getActivationColor(activation: number): THREE.Color {
  if (activation < 0.01) {
    return INACTIVE_COLOR;
  }
  // Gold gradient based on activation
  const lightness = 0.3 + Math.min(activation / 5, 0.4);
  return tempColor.setHSL(GOLD_HUE, 0.8, lightness);
}
```

---

## Integration with useFrame

**Critical**: Don't trigger React re-renders. Use refs and direct mutation:

```typescript
function NodeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_INTERVAL = 50;  // Update at ~20fps, not 60

  useFrame(() => {
    const now = performance.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;

    // Get state without React subscription
    const { activeTraces } = useTraceStore.getState();
    const { activations, nodeIndexMap } = useLargeDataStore.getState();

    // Only update if traces changed (track via timestamp or hash)
    if (tracesChanged(activeTraces)) {
      updateTraceHighlights(meshRef, nodeIndexMap, activeTraces, activations);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NODE_COUNT]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
```

---

## Smooth Trace Transitions

Animate trace intensity for smooth fade in/out:

```typescript
// In trace store
setTraceIntensity: (dialId, targetIntensity) => {
  const trace = get().activeTraces.get(dialId);
  if (!trace) return;

  // Animate over 150ms
  const startIntensity = trace.intensity;
  const startTime = performance.now();
  const duration = 150;

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);

    const newIntensity = startIntensity + (targetIntensity - startIntensity) * eased;

    set(state => ({
      activeTraces: new Map(state.activeTraces).set(dialId, {
        ...trace,
        intensity: newIntensity,
      }),
    }));

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
```

---

## Edge Highlighting

Highlight edges between trace nodes:

```typescript
function updateEdgeHighlights(
  linesRef: React.RefObject<THREE.LineSegments>,
  edges: Map<string, GraphEdge>,
  highlightedNodes: Set<string>,
  intensity: number
) {
  const lines = linesRef.current;
  if (!lines) return;

  const colorAttr = lines.geometry.attributes.color;
  const colorArray = colorAttr.array as Float32Array;

  let edgeIndex = 0;
  for (const edge of edges.values()) {
    const isHighlighted =
      highlightedNodes.has(edge.source) && highlightedNodes.has(edge.target);

    const color = isHighlighted
      ? new THREE.Color(0xd4af37).multiplyScalar(0.3 + intensity * 0.7)
      : new THREE.Color(0x2a2a2a);

    // Both endpoints of edge get same color
    const offset = edgeIndex * 6;
    colorArray[offset] = colorArray[offset + 3] = color.r;
    colorArray[offset + 1] = colorArray[offset + 4] = color.g;
    colorArray[offset + 2] = colorArray[offset + 5] = color.b;

    edgeIndex++;
  }

  colorAttr.needsUpdate = true;
}
```

---

## Multi-Trace Colors

When multiple dials are active, use distinct colors:

```typescript
const TRACE_COLORS = [
  '#d4af37',  // Gold (primary)
  '#00bfff',  // Electric blue
  '#ff6b6b',  // Coral
  '#20b2aa',  // Teal
  '#9b59b6',  // Purple
  '#ffa500',  // Orange
];

function getTraceColor(dialIndex: number): string {
  return TRACE_COLORS[dialIndex % TRACE_COLORS.length];
}
```

---

## Glow Effect for Highlighted Nodes

Add glow shader for trace-highlighted nodes:

```glsl
// Fragment shader for nodes
varying float vHighlightIntensity;
varying vec3 vHighlightColor;

void main() {
  vec3 baseColor = vec3(0.16, 0.16, 0.22);

  // Add glow based on highlight
  vec3 glowColor = vHighlightColor * vHighlightIntensity;
  vec3 finalColor = baseColor + glowColor;

  // Soft edge glow
  float dist = length(gl_PointCoord - vec2(0.5));
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  alpha += vHighlightIntensity * 0.5 * (1.0 - smoothstep(0.0, 0.5, dist));

  gl_FragColor = vec4(finalColor, alpha);
}
```

---

## Scale Modulation

Slightly scale up highlighted nodes:

```typescript
function updateTraceScales(
  meshRef: React.RefObject<THREE.InstancedMesh>,
  nodeIndexMap: Map<string, number>,
  highlightedNodes: Map<string, number>  // Node ID -> intensity
) {
  const mesh = meshRef.current;
  if (!mesh) return;

  const tempObject = new THREE.Object3D();

  for (const [nodeId, idx] of nodeIndexMap) {
    mesh.getMatrixAt(idx, tempObject.matrix);
    tempObject.matrix.decompose(
      tempObject.position,
      tempObject.quaternion,
      tempObject.scale
    );

    const highlight = highlightedNodes.get(nodeId) ?? 0;
    const scale = 1.0 + highlight * 0.3;  // Up to 30% larger

    tempObject.scale.setScalar(scale);
    tempObject.updateMatrix();
    mesh.setMatrixAt(idx, tempObject.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
}
```

---

## Performance Optimizations

### 1. Dirty Flag Pattern

Only update when traces actually change:

```typescript
const traceVersionRef = useRef(0);

useFrame(() => {
  const currentVersion = useTraceStore.getState().version;
  if (currentVersion === traceVersionRef.current) return;
  traceVersionRef.current = currentVersion;

  // Perform update...
});
```

### 2. Batch Updates

Coalesce rapid trace changes:

```typescript
const pendingUpdates = useRef<Map<string, TraceHighlight>>(new Map());
const updateScheduled = useRef(false);

function scheduleTraceUpdate(dialId: string, trace: TraceHighlight) {
  pendingUpdates.current.set(dialId, trace);

  if (!updateScheduled.current) {
    updateScheduled.current = true;
    requestAnimationFrame(() => {
      // Apply all pending updates at once
      for (const [id, t] of pendingUpdates.current) {
        applyTrace(id, t);
      }
      pendingUpdates.current.clear();
      updateScheduled.current = false;
    });
  }
}
```

### 3. Spatial Indexing for Large Traces

For traces with 1000+ nodes, use spatial indexing to cull off-screen updates:

```typescript
// Skip updating nodes outside frustum
const frustum = new THREE.Frustum();
frustum.setFromProjectionMatrix(
  camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse)
);

for (const nodeId of trace.nodeIds) {
  const position = nodePositions.get(nodeId);
  if (!frustum.containsPoint(position)) continue;  // Skip off-screen

  // Update this node...
}
```

---

## Testing Traces

```typescript
describe('Trace visualization', () => {
  it('highlights correct nodes for dial hover', () => {
    const { setTraceHighlight } = useTraceStore.getState();

    setTraceHighlight('formality', ['node-1', 'node-2', 'node-3'], new Map([
      ['node-1', 1.0],
      ['node-2', 0.5],
      ['node-3', 0.3],
    ]));

    const { activeTraces } = useTraceStore.getState();
    expect(activeTraces.get('formality')?.nodeIds).toHaveLength(3);
  });

  it('clears trace on dial unhover', () => {
    const { clearTrace, activeTraces } = useTraceStore.getState();

    clearTrace('formality');

    expect(activeTraces.has('formality')).toBe(false);
  });
});
```
