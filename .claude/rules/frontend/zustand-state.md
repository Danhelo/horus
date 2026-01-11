# Zustand State Management

## Critical Rule: Never setState in useFrame

```typescript
// BAD - triggers React re-renders at 60fps
useFrame(() => {
  useStore.setState({ position: new Vector3() }); // Performance disaster!
});

// GOOD - mutate via getState() or refs
useFrame(() => {
  const { position } = useStore.getState();
  meshRef.current.position.copy(position);
});
```

## Store Structure for HORUS

```typescript
// Separate stores for different update frequencies

// Main app store - React-rendered state
interface AppStore {
  currentText: string;
  dialValues: Record<string, number>;
  selectedNodeIds: Set<string>;
  camera: { position: [number, number, number]; target: [number, number, number] };
  panelsOpen: Record<string, boolean>;

  setCurrentText: (text: string) => void;
  setDialValue: (id: string, value: number) => void;
  selectNodes: (ids: string[]) => void;
}

// Large data store - not in React tree
interface LargeDataStore {
  nodePositions: Float32Array;  // 50k+ nodes
  nodeColors: Float32Array;
  trajectoryData: TrajectoryPoint[];

  loadGraphData: (data: GraphData) => void;
}

// Transient store - high-frequency updates
interface TransientStore {
  hoveredNodeId: string | null;
  mousePosition: { x: number; y: number };
  isDragging: boolean;
}
```

## Slices Pattern

```typescript
// slices/graphSlice.ts
import { StateCreator } from 'zustand';

export interface GraphSlice {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  setNodes: (nodes: Map<string, GraphNode>) => void;
}

export const createGraphSlice: StateCreator<
  AppStore,
  [['zustand/immer', never]],
  [],
  GraphSlice
> = (set) => ({
  nodes: new Map(),
  edges: new Map(),
  setNodes: (nodes) => set((state) => { state.nodes = nodes; }),
});
```

## Combining Slices with Middleware

```typescript
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    temporal(
      devtools(
        immer((...args) => ({
          ...createGraphSlice(...args),
          ...createUISlice(...args),
          ...createMixerSlice(...args),
        })),
        { name: 'AppStore', enabled: import.meta.env.DEV }
      ),
      {
        partialize: (state) => ({
          dialValues: state.dialValues,
          selectedNodeIds: state.selectedNodeIds,
        }),
        limit: 50,
      }
    )
  )
);
```

## R3F Integration

```typescript
// Subscribe without re-renders
function GraphMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    // Direct subscription to store
    return useLargeDataStore.subscribe(
      (state) => state.nodePositions,
      (positions) => {
        if (meshRef.current) {
          updateMeshPositions(meshRef.current, positions);
        }
      }
    );
  }, []);

  // Use getState() in useFrame
  useFrame(() => {
    const activations = useAppStore.getState().activations;
    if (activations) {
      updateNodeColors(meshRef.current, activations);
    }
  });

  return <instancedMesh ref={meshRef} args={[null, null, 50000]} />;
}
```

## Selectors

```typescript
import { shallow } from 'zustand/shallow';

// Atomic selector - single value
const nodeCount = useAppStore((s) => s.nodes.size);

// Object selector - use shallow comparison
const { position, target } = useAppStore(
  (s) => ({ position: s.camera.position, target: s.camera.target }),
  shallow
);

// Parameterized selector
const selectNodeById = (id: string) => (state: AppStore) => state.nodes.get(id);
const node = useAppStore(selectNodeById('node-123'));
```

## Undo/Redo with Zundo

```typescript
// Access temporal controls
const { undo, redo, pastStates, futureStates } = useAppStore.temporal.getState();

// Subscribe to undo state
const canUndo = useAppStore.temporal((s) => s.pastStates.length > 0);
const canRedo = useAppStore.temporal((s) => s.futureStates.length > 0);

// Pause during batch operations
const { pause, resume } = useAppStore.temporal.getState();
pause();
// ... multiple updates
resume();
```

## Persistence

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// IndexedDB for large data
const indexedDBStorage = {
  getItem: async (name) => await get(name) ?? null,
  setItem: async (name, value) => await set(name, value),
  removeItem: async (name) => await del(name),
};

export const useLargeDataStore = create<LargeDataStore>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'horus-graph-data',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
```

## DevTools

```typescript
import { devtools } from 'zustand/middleware';

// Name actions for debugging
setDialValue: (id, value) => set(
  (state) => { state.dialValues[id] = value; },
  false,
  { type: 'mixer/setDialValue', payload: { id, value } }
),

// Serialize Maps/Sets for DevTools
devtools(store, {
  name: 'AppStore',
  serialize: {
    replacer: (key, value) => {
      if (value instanceof Map) return { __type: 'Map', entries: [...value] };
      if (value instanceof Set) return { __type: 'Set', values: [...value] };
      return value;
    },
  },
})
```

## File Structure

```
stores/
├── index.ts              # Barrel export
├── appStore.ts           # Main combined store
├── largeDataStore.ts     # Heavy data (50k+ nodes)
├── transientStore.ts     # High-frequency updates
├── slices/
│   ├── graphSlice.ts
│   ├── mixerSlice.ts
│   ├── uiSlice.ts
│   └── cameraSlice.ts
├── selectors/
│   ├── graphSelectors.ts
│   └── mixerSelectors.ts
└── types.ts              # Store type definitions
```

## Performance Tips

1. **Split stores by update frequency** - don't mix transient with persistent
2. **Use subscribeWithSelector** - fine-grained subscriptions
3. **Shallow compare objects** - avoid unnecessary re-renders
4. **getState() in useFrame** - never setState in render loop
5. **IndexedDB for large data** - localStorage has 5MB limit
6. **Debounce persistence** - don't write on every change
