# STA-001: Zustand Architecture

| Field       | Value             |
| ----------- | ----------------- |
| **Spec ID** | STA-001           |
| **Phase**   | Shared            |
| **Status**  | Draft             |
| **Package** | `@horus/frontend` |

## Summary

Define the Zustand store architecture for HORUS. State is split by update frequency and purpose: transient state (60fps updates in render loop), app state (user interactions), and large data (graph data that shouldn't trigger re-renders). This architecture ensures smooth 60fps graph rendering while maintaining reactive UI updates.

## Requirements

### REQ-1: Store Separation

Split state into three stores by update frequency:

```typescript
// 1. TRANSIENT STORE - High-frequency, no React re-renders
// Updated in useFrame, read via getState()
interface TransientStore {
  hoveredNodeId: string | null;
  mousePosition: { x: number; y: number };
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  isDragging: boolean;
  frameTime: number;
}

// 2. APP STORE - User-driven state, triggers React re-renders
// Normal React subscription patterns
interface AppStore {
  // Text & Generation
  currentText: string;
  isGenerating: boolean;

  // Selection
  selectedNodeIds: Set<string>;

  // Mixer
  dials: Map<string, Dial>;
  steeringVector: SteeringVector | null;

  // UI
  panels: {
    mixer: { open: boolean; position: 'left' | 'right' };
    text: { open: boolean; position: 'bottom' };
    spectrogram: { open: boolean };
  };
  activeTrajectoryId: string | null;

  // Actions
  setText: (text: string) => void;
  setDialValue: (id: string, value: number) => void;
  selectNodes: (ids: string[]) => void;
  togglePanel: (panel: string) => void;
}

// 3. LARGE DATA STORE - Static/infrequent updates, never in render loop
// IndexedDB persistence, no subscriptions in components
interface LargeDataStore {
  // Graph data
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  nodePositions: Float32Array;
  nodeColors: Float32Array;

  // Trajectory data
  trajectories: Map<string, Trajectory>;

  // Hierarchy
  hierarchy: GraphHierarchy | null;

  // Actions
  loadGraph: (data: GraphData) => void;
  addTrajectory: (trajectory: Trajectory) => void;
  setHierarchy: (hierarchy: GraphHierarchy) => void;
}
```

**Acceptance Criteria:**

- [ ] Three stores created with distinct purposes
- [ ] TransientStore never triggers React re-renders
- [ ] AppStore uses proper React subscription
- [ ] LargeDataStore uses IndexedDB for persistence

### REQ-2: R3F Integration Patterns

Critical patterns for React Three Fiber performance:

```typescript
// NEVER do this in useFrame
useFrame(() => {
  // BAD - triggers 60 re-renders per second
  useAppStore.setState({ position: newPos });
});

// DO this instead
useFrame(() => {
  // GOOD - direct mutation via getState
  const { setHoveredNode } = useTransientStore.getState();
  setHoveredNode(nodeUnderMouse);

  // GOOD - direct ref mutation
  meshRef.current.position.copy(newPos);
});

// Subscribe without re-renders
useEffect(() => {
  return useLargeDataStore.subscribe(
    (state) => state.nodePositions,
    (positions) => {
      // Update mesh directly
      updateInstancedMesh(meshRef.current, positions);
    }
  );
}, []);
```

**Acceptance Criteria:**

- [ ] No setState calls in useFrame
- [ ] Large data accessed via getState() in useFrame
- [ ] Subscriptions used for non-React updates
- [ ] Documented patterns in .claude/rules

### REQ-3: Slice Pattern

Organize AppStore into slices for maintainability:

```typescript
// slices/textSlice.ts
export interface TextSlice {
  currentText: string;
  isGenerating: boolean;
  setText: (text: string) => void;
  startGeneration: () => void;
  stopGeneration: () => void;
}

export const createTextSlice: StateCreator<AppStore, [['zustand/immer', never]], [], TextSlice> = (
  set
) => ({
  currentText: '',
  isGenerating: false,
  setText: (text) =>
    set((state) => {
      state.currentText = text;
    }),
  startGeneration: () =>
    set((state) => {
      state.isGenerating = true;
    }),
  stopGeneration: () =>
    set((state) => {
      state.isGenerating = false;
    }),
});

// slices/mixerSlice.ts
export interface MixerSlice {
  dials: Map<string, Dial>;
  steeringVector: SteeringVector | null;
  setDialValue: (id: string, value: number) => void;
  recomputeSteering: () => void;
}

// Combine slices
export const useAppStore = create<AppStore>()(
  devtools(
    immer((...args) => ({
      ...createTextSlice(...args),
      ...createMixerSlice(...args),
      ...createSelectionSlice(...args),
      ...createUISlice(...args),
    })),
    { name: 'AppStore' }
  )
);
```

**Acceptance Criteria:**

- [ ] Each domain has its own slice file
- [ ] Slices composed into single store
- [ ] Types properly merged
- [ ] DevTools show slice actions

### REQ-4: Middleware Stack

```typescript
import { create } from 'zustand';
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    // Fine-grained subscriptions
    temporal(
      // Undo/redo
      devtools(
        // DevTools integration
        immer(
          // Immutable updates
          (set, get) => ({
            // ... state and actions
          })
        ),
        { name: 'HORUS', enabled: import.meta.env.DEV }
      ),
      {
        partialize: (state) => ({
          currentText: state.currentText,
          dials: state.dials,
          selectedNodeIds: state.selectedNodeIds,
        }),
        limit: 50,
      }
    )
  )
);
```

**Middleware Purposes:**
| Middleware | Purpose |
|------------|---------|
| immer | Mutable syntax for immutable updates |
| devtools | Redux DevTools integration |
| temporal (zundo) | Undo/redo history |
| subscribeWithSelector | Fine-grained subscriptions |
| persist | LocalStorage/IndexedDB persistence |

**Acceptance Criteria:**

- [ ] All middleware properly ordered
- [ ] DevTools enabled in development only
- [ ] Undo/redo works for relevant state
- [ ] Persistence for user preferences

### REQ-5: Selectors

```typescript
// selectors/graphSelectors.ts
import { shallow } from 'zustand/shallow';

// Atomic selector - single value, minimal re-renders
export const useSelectedCount = () => useAppStore((s) => s.selectedNodeIds.size);

// Derived selector - computed from multiple values
export const useActiveNodes = () =>
  useAppStore((s) => {
    const { selectedNodeIds } = s;
    const { nodes } = useLargeDataStore.getState();
    return Array.from(selectedNodeIds)
      .map((id) => nodes.get(id))
      .filter(Boolean);
  }, shallow);

// Parameterized selector factory
export const selectDialById = (id: string) => (state: AppStore) => state.dials.get(id);

export const useDialValue = (id: string) => useAppStore(selectDialById(id));
```

**Selector Rules:**

1. Use atomic selectors when possible (single primitive value)
2. Use `shallow` comparison for object/array selectors
3. Don't compute in selector if expensive - use useMemo
4. Parameterized selectors should be stable (no inline functions)

**Acceptance Criteria:**

- [ ] Selectors organized by domain
- [ ] Shallow comparison used appropriately
- [ ] No expensive computations in selectors
- [ ] Parameterized selectors documented

### REQ-6: Persistence Strategy

```typescript
// IndexedDB for large data
import { get, set, del } from 'idb-keyval';

const indexedDBStorage = {
  getItem: async (name: string) => {
    const value = await get(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await set(name, value);
  },
  removeItem: async (name: string) => {
    await del(name);
  },
};

export const useLargeDataStore = create<LargeDataStore>()(
  persist(
    (set) => ({
      /* ... */
    }),
    {
      name: 'horus-graph-data',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        // Only persist what's needed
        trajectories: state.trajectories,
      }),
    }
  )
);

// LocalStorage for preferences
export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      /* ... */
    }),
    {
      name: 'horus-preferences',
      partialize: (state) => ({
        panels: state.panels,
        // Don't persist transient state
      }),
    }
  )
);
```

**Acceptance Criteria:**

- [ ] Large data uses IndexedDB (5MB+ capable)
- [ ] Preferences use localStorage
- [ ] Partialize excludes transient state
- [ ] Hydration handled gracefully

### REQ-7: TypedArray Handling

Special handling for GPU data (Float32Array):

```typescript
// Float32Array can't be serialized directly to JSON
// Use a custom serializer

interface SerializedPositionData {
  __type: 'Float32Array';
  data: number[];
}

const customSerializer = {
  replacer: (key: string, value: unknown) => {
    if (value instanceof Float32Array) {
      return { __type: 'Float32Array', data: Array.from(value) };
    }
    if (value instanceof Map) {
      return { __type: 'Map', entries: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
      return { __type: 'Set', values: Array.from(value) };
    }
    return value;
  },
  reviver: (key: string, value: unknown) => {
    if (value && typeof value === 'object' && '__type' in value) {
      const typed = value as {
        __type: string;
        data?: number[];
        entries?: unknown[];
        values?: unknown[];
      };
      if (typed.__type === 'Float32Array' && typed.data) {
        return new Float32Array(typed.data);
      }
      if (typed.__type === 'Map' && typed.entries) {
        return new Map(typed.entries as [unknown, unknown][]);
      }
      if (typed.__type === 'Set' && typed.values) {
        return new Set(typed.values);
      }
    }
    return value;
  },
};
```

**Acceptance Criteria:**

- [ ] Float32Array serializes/deserializes correctly
- [ ] Map and Set handled
- [ ] DevTools displays typed data properly
- [ ] No data loss on persistence round-trip

## Technical Notes

- Store files in `packages/frontend/src/stores/`
- Slice files in `packages/frontend/src/stores/slices/`
- Selector files in `packages/frontend/src/stores/selectors/`
- Use `idb-keyval` for IndexedDB (simple key-value)
- DevTools: install Redux DevTools browser extension
- Test stores with Vitest, mock persistence

## Dependencies

- None (foundational infrastructure)

## Open Questions

1. Should we use a single mega-store or multiple smaller stores?
2. How to handle store hydration during SSR (if ever needed)?
3. Should dial values trigger steering recomputation via middleware?

## Changelog

| Date       | Changes       |
| ---------- | ------------- |
| 2025-01-10 | Initial draft |
