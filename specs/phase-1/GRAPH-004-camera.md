# GRAPH-004: Camera Controls

| Field       | Value             |
| ----------- | ----------------- |
| **Spec ID** | GRAPH-004         |
| **Phase**   | 1 - Static Viewer |
| **Status**  | Complete          |
| **Package** | `@horus/frontend` |

## Summary

Implement camera controls for navigating the 3D feature graph using drei's OrbitControls. Sync camera state bidirectionally with Zustand store for persistence and programmatic control. Enable smooth animated transitions when focusing on specific nodes or regions.

## Requirements

### REQ-1: OrbitControls Setup

Configure drei's OrbitControls with appropriate settings for graph navigation.

```typescript
import { OrbitControls } from '@react-three/drei';

function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={200}
      enablePan
      panSpeed={0.8}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}
```

**Acceptance Criteria:**

- [x] OrbitControls from drei integrated into Canvas
- [x] Damping enabled for smooth deceleration
- [x] Min/max distance prevents getting too close or too far
- [x] Pan, rotate, and zoom all functional
- [x] Mouse button mappings feel natural (left=rotate, right=pan, scroll=zoom)
- [x] Touch gestures work on mobile (pinch zoom, two-finger pan)

### REQ-2: Camera State Sync to Zustand

Bidirectional sync between camera and Zustand store.

```typescript
interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

interface CameraSlice {
  camera: CameraState;
  setCameraPosition: (position: [number, number, number]) => void;
  setCameraTarget: (target: [number, number, number]) => void;
  setCameraState: (state: Partial<CameraState>) => void;
}
```

**Camera -> Store Sync:**

```typescript
function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Debounced sync to store (avoid excessive updates)
  const syncToStore = useMemo(
    () =>
      debounce(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        useAppStore.getState().setCameraState({
          position: controls.object.position.toArray() as [number, number, number],
          target: controls.target.toArray() as [number, number, number],
        });
      }, 100),
    []
  );

  useFrame(() => {
    syncToStore();
  });
}
```

**Acceptance Criteria:**

- [x] Camera position syncs to store on movement
- [x] Camera target (lookAt) syncs to store
- [x] Sync is debounced (max 10 updates/sec)
- [x] Store updates don't cause camera jitter
- [x] Initial camera position loads from store on mount

### REQ-3: Programmatic Camera Control

Enable programmatic camera movement via store actions.

```typescript
interface CameraActions {
  focusOnNode: (nodeId: string) => void;
  focusOnRegion: (center: [number, number, number], radius: number) => void;
  resetCamera: () => void;
  flyTo: (
    position: [number, number, number],
    target: [number, number, number],
    duration?: number
  ) => void;
}
```

**Acceptance Criteria:**

- [x] `focusOnNode(id)` moves camera to view specific node
- [x] `focusOnRegion(center, radius)` frames a region in view
- [x] `resetCamera()` returns to default position/orientation
- [x] All movements are animated (not instant jumps)
- [x] Programmatic control integrates with OrbitControls (no fighting)

### REQ-4: Smooth Animated Transitions

Implement smooth camera animations for focus operations.

```typescript
function useCameraAnimation() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);

  const flyTo = useCallback(
    (
      targetPosition: [number, number, number],
      targetLookAt: [number, number, number],
      duration = 1000
    ) => {
      // Use GSAP or manual lerp in useFrame
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const endPos = new THREE.Vector3(...targetPosition);
      const endTarget = new THREE.Vector3(...targetLookAt);

      // Animate over duration using easing
    },
    [camera, controls]
  );

  return { flyTo };
}
```

**Acceptance Criteria:**

- [x] Transitions use easing (ease-out or cubic)
- [x] Default duration is ~1 second (configurable)
- [x] Animation can be interrupted by user input
- [x] No jarring jumps or stuttering during animation
- [x] Uses delta time for frame-rate independence

### REQ-5: Focus on Node

Calculate optimal camera position to focus on a specific node.

```typescript
function calculateFocusPosition(
  nodePosition: [number, number, number],
  viewDistance: number = 10
): { position: [number, number, number]; target: [number, number, number] } {
  // Position camera at viewDistance from node
  // Maintain current viewing angle or use default
  const target = nodePosition;
  const position = [
    nodePosition[0],
    nodePosition[1] + viewDistance * 0.3, // Slightly above
    nodePosition[2] + viewDistance, // In front
  ];

  return { position, target };
}
```

**Acceptance Criteria:**

- [x] Clicking "focus" on a node animates camera to it
- [x] Node is centered in view after animation
- [x] Camera distance appropriate to see node detail
- [x] Works with single-click on node (per user preference)
- [x] Maintains reasonable viewing angle (not inside graph)

### REQ-6: Keyboard Navigation

Support keyboard shortcuts for camera movement.

```typescript
const KEYBOARD_CONTROLS = {
  w: 'moveForward',
  s: 'moveBackward',
  a: 'moveLeft',
  d: 'moveRight',
  q: 'moveUp',
  e: 'moveDown',
  r: 'resetCamera',
  Home: 'resetCamera',
};
```

**Acceptance Criteria:**

- [x] WASD keys for directional movement
- [x] Q/E for vertical movement
- [x] R or Home key resets camera
- [x] Keyboard movement is smooth (not stepwise)
- [x] Keyboard controls disabled when typing in input fields
- [x] Movement speed is reasonable (not too fast/slow)

### REQ-7: View Persistence

Persist camera view across sessions.

**Acceptance Criteria:**

- [x] Camera state saved to localStorage on change (debounced)
- [x] Camera state restored on page load
- [x] Can opt to start at default view instead of persisted
- [x] Handles invalid/corrupt persisted state gracefully

## Technical Notes

- Use drei's `OrbitControls` as the foundation
- Never use `setState` in useFrame for camera state - use refs
- Debounce store syncs to avoid performance issues
- For animations, consider GSAP or a simple lerp with `useFrame`
- Camera frustum affects what's visible - coordinate with LOD system
- Test on both desktop and mobile devices

## Camera Defaults

```typescript
const DEFAULT_CAMERA = {
  position: [0, 20, 50] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  fov: 60,
  near: 0.1,
  far: 1000,
};

const CAMERA_LIMITS = {
  minDistance: 5,
  maxDistance: 200,
  minPolarAngle: 0.1, // Prevent looking straight down
  maxPolarAngle: Math.PI - 0.1, // Prevent looking straight up
};
```

## File Structure

```
packages/frontend/src/
├── components/graph/
│   ├── CameraController.tsx    # OrbitControls + sync
│   └── useCameraAnimation.ts   # Animation hooks
├── stores/slices/
│   └── cameraSlice.ts          # Camera state slice
└── hooks/
    └── useKeyboardNavigation.ts # Keyboard controls
```

## Dependencies

- [x] GRAPH-001: Graph Data Model (node positions for focus)
- [x] GRAPH-002: Graph Loader (graph must be loaded to navigate)

## Open Questions

1. Should we support multiple saved camera bookmarks?
2. Do we need a minimap showing current camera position in the graph?
3. Should semantic zoom (Phase 3) affect camera behavior?

## Changelog

| Date       | Changes       |
| ---------- | ------------- |
| 2025-01-10 | Initial draft |
