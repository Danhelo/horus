import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

import type { GraphNode, GraphEdge, GraphData } from '@horus/shared';

import { createGraphLoadingSlice } from './slices/graphLoadingSlice';
import type { GraphLoadingSlice } from './slices/graphLoadingSlice';

// ---------------------------------------------------------------------------
// Slice Types
// ---------------------------------------------------------------------------

interface GraphSlice {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  setGraphData: (data: GraphData) => void;
  clearGraph: () => void;
}

interface UISlice {
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  panelsOpen: Record<string, boolean>;
  selectNodes: (ids: string[]) => void;
  clearSelection: () => void;
  setHoveredNode: (id: string | null) => void;
  togglePanel: (panelId: string) => void;
}

interface CameraSlice {
  position: [number, number, number];
  target: [number, number, number];
  setCameraState: (position: [number, number, number], target: [number, number, number]) => void;
  // Note: focusOnNode, focusOnRegion, resetCamera, flyTo are injected at runtime by CameraController
}

interface ActivationSlice {
  // Per-node activation values (nodeId -> activation value)
  activations: Map<string, number>;
  setActivations: (activations: Map<string, number>) => void;
  clearActivations: () => void;
}

export type LODLevel = 'near' | 'medium' | 'far';

interface LODSlice {
  lod: LODLevel;
  setLod: (lod: LODLevel) => void;
}

// Combined store type
export type AppStore = GraphSlice & UISlice & CameraSlice & LODSlice & ActivationSlice & GraphLoadingSlice;

// ---------------------------------------------------------------------------
// Slice Creators
// ---------------------------------------------------------------------------

const createGraphSlice: StateCreator<AppStore, [], [], GraphSlice> = (set) => ({
  nodes: new Map(),
  edges: new Map(),
  setGraphData: (data) =>
    set({
      nodes: data.nodes,
      edges: data.edges,
    }),
  clearGraph: () =>
    set({
      nodes: new Map(),
      edges: new Map(),
    }),
});

const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  selectedNodeIds: new Set(),
  hoveredNodeId: null,
  panelsOpen: {
    mixer: true,
    details: false,
    trajectory: false,
  },
  selectNodes: (ids) =>
    set({
      selectedNodeIds: new Set(ids),
    }),
  clearSelection: () =>
    set({
      selectedNodeIds: new Set(),
    }),
  setHoveredNode: (id) =>
    set({
      hoveredNodeId: id,
    }),
  togglePanel: (panelId) =>
    set((state) => ({
      panelsOpen: {
        ...state.panelsOpen,
        [panelId]: !state.panelsOpen[panelId],
      },
    })),
});

const createCameraSlice: StateCreator<AppStore, [], [], CameraSlice> = (set) => ({
  position: [0, 0, 50] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  setCameraState: (position, target) =>
    set({
      position,
      target,
    }),
});

const createLODSlice: StateCreator<AppStore, [], [], LODSlice> = (set) => ({
  lod: 'medium' as LODLevel,
  setLod: (lod) => set({ lod }),
});

const createActivationSlice: StateCreator<AppStore, [], [], ActivationSlice> = (set) => ({
  activations: new Map(),
  setActivations: (activations) => set({ activations }),
  clearActivations: () => set({ activations: new Map() }),
});

// ---------------------------------------------------------------------------
// Combined Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppStore>()(
  subscribeWithSelector(
    devtools(
      (...args) => ({
        ...createGraphSlice(...args),
        ...createUISlice(...args),
        ...createCameraSlice(...args),
        ...createLODSlice(...args),
        ...createActivationSlice(...args),
        ...createGraphLoadingSlice(...args),
      }),
      {
        name: 'AppStore',
        enabled: import.meta.env.DEV,
        serialize: {
          replacer: (_key: string, value: unknown) => {
            if (value instanceof Map) {
              return { __type: 'Map', entries: [...value] };
            }
            if (value instanceof Set) {
              return { __type: 'Set', values: [...value] };
            }
            return value;
          },
        },
      }
    )
  )
);
