import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { GraphData } from '@horus/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LargeDataStore {
  // GPU-ready typed arrays for 50k+ nodes
  positions: Float32Array | null;
  colors: Float32Array | null;
  scales: Float32Array | null;

  // Edge geometry (2 points * 3 coords per edge)
  edgePositions: Float32Array | null;
  edgeColors: Float32Array | null;
  edgeCount: number;

  // Map node IDs to array indices
  nodeIndexMap: Map<string, number>;

  // Node count for InstancedMesh
  nodeCount: number;

  // Edge visibility settings
  edgeWeightThreshold: number;
  edgesVisible: boolean;

  // Actions
  loadPositionData: (data: GraphData) => void;
  updateColors: (colors: Float32Array) => void;
  updateScales: (scales: Float32Array) => void;
  setEdgeWeightThreshold: (threshold: number) => void;
  setEdgesVisible: (visible: boolean) => void;
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLargeDataStore = create<LargeDataStore>()(
  subscribeWithSelector((set, get) => ({
    positions: null,
    colors: null,
    scales: null,
    edgePositions: null,
    edgeColors: null,
    edgeCount: 0,
    nodeIndexMap: new Map(),
    nodeCount: 0,
    edgeWeightThreshold: 0.1,
    edgesVisible: true,

    loadPositionData: (data) => {
      const nodeCount = data.nodes.size;
      const positions = new Float32Array(nodeCount * 3);
      const colors = new Float32Array(nodeCount * 3);
      const scales = new Float32Array(nodeCount);
      const nodeIndexMap = new Map<string, number>();

      // Build node index map and fill position/color arrays
      let index = 0;
      for (const [id, node] of data.nodes) {
        nodeIndexMap.set(id, index);

        // Position: x, y, z
        positions[index * 3] = node.position[0];
        positions[index * 3 + 1] = node.position[1];
        positions[index * 3 + 2] = node.position[2];

        // Default color: inactive (dark gray-blue)
        colors[index * 3] = 0.16;     // R
        colors[index * 3 + 1] = 0.16; // G
        colors[index * 3 + 2] = 0.23; // B

        // Default scale
        scales[index] = 1.0;

        index++;
      }

      // Build edge geometry
      const threshold = get().edgeWeightThreshold;
      const validEdges: Array<{ source: string; target: string; weight: number }> = [];

      for (const edge of data.edges.values()) {
        if (edge.weight >= threshold) {
          validEdges.push(edge);
        }
      }

      const edgeCount = validEdges.length;
      const edgePositions = new Float32Array(edgeCount * 6); // 2 points * 3 coords
      const edgeColors = new Float32Array(edgeCount * 6);    // 2 points * 3 colors

      for (let i = 0; i < edgeCount; i++) {
        const edge = validEdges[i];
        const sourceIdx = nodeIndexMap.get(edge.source);
        const targetIdx = nodeIndexMap.get(edge.target);

        if (sourceIdx === undefined || targetIdx === undefined) continue;

        const offset = i * 6;

        // Start point (source)
        edgePositions[offset] = positions[sourceIdx * 3];
        edgePositions[offset + 1] = positions[sourceIdx * 3 + 1];
        edgePositions[offset + 2] = positions[sourceIdx * 3 + 2];

        // End point (target)
        edgePositions[offset + 3] = positions[targetIdx * 3];
        edgePositions[offset + 4] = positions[targetIdx * 3 + 1];
        edgePositions[offset + 5] = positions[targetIdx * 3 + 2];

        // Edge color based on weight (white with varying intensity)
        const intensity = 0.2 + edge.weight * 0.5;
        edgeColors[offset] = edgeColors[offset + 3] = intensity;
        edgeColors[offset + 1] = edgeColors[offset + 4] = intensity;
        edgeColors[offset + 2] = edgeColors[offset + 5] = intensity;
      }

      set({
        positions,
        colors,
        scales,
        nodeIndexMap,
        nodeCount,
        edgePositions,
        edgeColors,
        edgeCount,
      });
    },

    updateColors: (colors) => {
      set({ colors });
    },

    updateScales: (scales) => {
      set({ scales });
    },

    setEdgeWeightThreshold: (threshold) => {
      set({ edgeWeightThreshold: threshold });
      // Note: To apply the new threshold, caller must reload graph data
    },

    setEdgesVisible: (visible) => {
      set({ edgesVisible: visible });
    },

    clear: () => {
      set({
        positions: null,
        colors: null,
        scales: null,
        edgePositions: null,
        edgeColors: null,
        nodeIndexMap: new Map(),
        nodeCount: 0,
        edgeCount: 0,
      });
    },
  }))
);
