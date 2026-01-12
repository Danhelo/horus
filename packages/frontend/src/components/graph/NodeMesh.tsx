import { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import { useLargeDataStore, useAppStore } from '../../stores';
import { activationToColor } from './colors';
import { getVicinity } from '../../utils/vicinityGraph';

// Pre-allocated objects to avoid GC pressure in useFrame
const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();
const tempScale = new THREE.Vector3();
const tempPosition = new THREE.Vector3();
const identityQuaternion = new THREE.Quaternion();

// Maximum capacity for the instanced mesh
const MAX_NODE_COUNT = 100000;

// Breathing animation parameters
const BREATHING_CONFIG = {
  baseFrequency: 1.0,      // Base oscillation frequency (Hz)
  frequencyScale: 0.5,     // Additional frequency based on activation
  maxAmplitude: 0.08,      // Maximum scale change (8%)
  minAmplitude: 0.02,      // Minimum visible pulse
} as const;

// LOD geometry configurations
const LOD_GEOMETRY_CONFIG = {
  near: { radius: 0.15, widthSegments: 12, heightSegments: 12 },
  medium: { radius: 0.15, widthSegments: 6, heightSegments: 6 },
  far: { radius: 0.15, widthSegments: 3, heightSegments: 3 },
} as const;

/**
 * Renders graph nodes using InstancedMesh for efficient rendering of 50k+ nodes.
 * Follows R3F best practices: refs for updates, getState() in useFrame, no setState.
 * Supports LOD (Level of Detail) geometry switching based on camera distance.
 */
export function NodeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialInitializedRef = useRef(false);
  const { invalidate } = useThree();

  // Get node count to determine actual instance count
  const nodeCount = useLargeDataStore((state) => state.nodeCount);

  // Get current LOD level
  const lod = useAppStore((state) => state.lod);

  // Subscribe to position changes without causing re-renders
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.positions,
      (positions) => {
        if (!meshRef.current || !positions) return;

        const count = useLargeDataStore.getState().nodeCount;
        for (let i = 0; i < count; i++) {
          tempMatrix.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          meshRef.current.setMatrixAt(i, tempMatrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
        invalidate();
      }
    );
  }, [invalidate]);

  // Subscribe to color changes without causing re-renders
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.colors,
      (colors) => {
        if (!meshRef.current || !colors) return;

        const count = useLargeDataStore.getState().nodeCount;
        const { selectedNodeIds } = useAppStore.getState();
        const { nodeIndexMap } = useLargeDataStore.getState();

        for (let i = 0; i < count; i++) {
          // Check if this node is selected (need reverse lookup)
          let isSelected = false;
          for (const [nodeId, index] of nodeIndexMap) {
            if (index === i && selectedNodeIds.has(nodeId)) {
              isSelected = true;
              break;
            }
          }

          if (isSelected) {
            activationToColor(0, true, false, tempColor);
          } else {
            tempColor.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
          }
          meshRef.current.setColorAt(i, tempColor);
        }
        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
        invalidate();
      }
    );
  }, [invalidate]);

  // Subscribe to selection changes to update node colors
  useEffect(() => {
    return useAppStore.subscribe(
      (state) => state.selectedNodeIds,
      (selectedNodeIds) => {
        if (!meshRef.current) return;

        const { colors, nodeIndexMap } = useLargeDataStore.getState();
        const { vicinityNodeIds } = useAppStore.getState();
        if (!colors) return;

        // Update colors for all nodes based on selection and vicinity state
        for (const [nodeId, index] of nodeIndexMap) {
          const isSelected = selectedNodeIds.has(nodeId);
          const vicinityDepth = vicinityNodeIds.get(nodeId);

          if (isSelected) {
            activationToColor(0, true, false, tempColor);
          } else if (vicinityDepth !== undefined) {
            // Vicinity nodes get golden glow based on depth
            activationToColor(0, false, false, tempColor, vicinityDepth);
          } else {
            // Read original color from buffer (not modified by selection)
            tempColor.setRGB(
              colors[index * 3],
              colors[index * 3 + 1],
              colors[index * 3 + 2]
            );
          }
          meshRef.current.setColorAt(index, tempColor);
        }

        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
        invalidate();
      }
    );
  }, [invalidate]);

  // Subscribe to vicinity changes to update neighbor colors (golden ripple)
  useEffect(() => {
    return useAppStore.subscribe(
      (state) => state.vicinityNodeIds,
      (vicinityNodeIds) => {
        if (!meshRef.current) return;

        const { colors, nodeIndexMap } = useLargeDataStore.getState();
        const { selectedNodeIds } = useAppStore.getState();
        if (!colors) return;

        // Update colors for all nodes based on vicinity
        for (const [nodeId, index] of nodeIndexMap) {
          const isSelected = selectedNodeIds.has(nodeId);
          const vicinityDepth = vicinityNodeIds.get(nodeId);

          if (isSelected) {
            activationToColor(0, true, false, tempColor);
          } else if (vicinityDepth !== undefined) {
            // Vicinity nodes get golden glow based on depth
            activationToColor(0, false, false, tempColor, vicinityDepth);
          } else {
            // Read original color from buffer
            tempColor.setRGB(
              colors[index * 3],
              colors[index * 3 + 1],
              colors[index * 3 + 2]
            );
          }
          meshRef.current.setColorAt(index, tempColor);
        }

        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
        invalidate();
      }
    );
  }, [invalidate]);

  // Initialize mesh with current data - use useLayoutEffect to run before paint
  useLayoutEffect(() => {
    if (!meshRef.current) return;

    const { positions, colors, nodeCount } = useLargeDataStore.getState();
    if (!positions || !colors || nodeCount === 0) return;

    // Set positions
    for (let i = 0; i < nodeCount; i++) {
      tempMatrix.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      meshRef.current.setMatrixAt(i, tempMatrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Set colors - this creates the instanceColor buffer
    for (let i = 0; i < nodeCount; i++) {
      tempColor.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      meshRef.current.setColorAt(i, tempColor);
    }

    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Force material to recompile now that instanceColor exists
    if (!materialInitializedRef.current && meshRef.current.material) {
      const material = meshRef.current.material as THREE.Material;
      material.needsUpdate = true;
      materialInitializedRef.current = true;
    }

    meshRef.current.computeBoundingSphere();
    invalidate();
  }, [nodeCount, invalidate]);

  // Handle hover - store in app store for UI feedback
  // Disabled when pointer is locked (FPS mode) to prevent constant hover triggers
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Skip hover in FPS mode - pointer is locked to center
    if (useAppStore.getState().isPointerLocked) return;

    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId === undefined) return;

    const { nodeIndexMap } = useLargeDataStore.getState();
    let hoveredNodeId: string | null = null;
    for (const [nodeId, index] of nodeIndexMap) {
      if (index === instanceId) {
        hoveredNodeId = nodeId;
        break;
      }
    }

    if (hoveredNodeId) {
      useAppStore.getState().setHoveredNode(hoveredNodeId);
      document.body.style.cursor = 'pointer';

      if (meshRef.current) {
        const { selectedNodeIds } = useAppStore.getState();
        activationToColor(0, selectedNodeIds.has(hoveredNodeId), true, tempColor);
        meshRef.current.setColorAt(instanceId, tempColor);
        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
        invalidate();
      }
    }
  }, [invalidate]);

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Skip in FPS mode
    if (useAppStore.getState().isPointerLocked) return;

    e.stopPropagation();
    const instanceId = e.instanceId;

    document.body.style.cursor = 'auto';

    const hoveredNodeId = useAppStore.getState().hoveredNodeId;
    useAppStore.getState().setHoveredNode(null);

    if (instanceId !== undefined && meshRef.current && hoveredNodeId) {
      const { colors, nodeIndexMap } = useLargeDataStore.getState();
      const { selectedNodeIds, vicinityNodeIds } = useAppStore.getState();

      const nodeIndex = nodeIndexMap.get(hoveredNodeId);
      if (nodeIndex !== undefined && colors) {
        const isSelected = selectedNodeIds.has(hoveredNodeId);
        const vicinityDepth = vicinityNodeIds.get(hoveredNodeId);

        if (isSelected) {
          activationToColor(0, true, false, tempColor);
        } else if (vicinityDepth !== undefined) {
          // Restore vicinity color (golden glow)
          activationToColor(0, false, false, tempColor, vicinityDepth);
        } else {
          tempColor.setRGB(
            colors[nodeIndex * 3],
            colors[nodeIndex * 3 + 1],
            colors[nodeIndex * 3 + 2]
          );
        }
        meshRef.current.setColorAt(instanceId, tempColor);
        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
        invalidate();
      }
    }
  }, [invalidate]);

  // Handle click - select node and focus camera on it
  // Disabled in FPS mode - use orbit mode for node selection
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    // Skip click in FPS mode - navigation takes priority
    if (useAppStore.getState().isPointerLocked) return;

    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId === undefined) return;

    const { nodeIndexMap } = useLargeDataStore.getState();

    let clickedNodeId: string | null = null;
    for (const [nodeId, index] of nodeIndexMap) {
      if (index === instanceId) {
        clickedNodeId = nodeId;
        break;
      }
    }

    if (clickedNodeId) {
      const { selectedNodeIds, adjacencyList } = useAppStore.getState();
      const isAlreadySelected = selectedNodeIds.has(clickedNodeId);

      if (e.shiftKey && !isAlreadySelected) {
        // Multi-select with shift key - add to selection without changing vicinity
        useAppStore.getState().selectNodes([...selectedNodeIds, clickedNodeId]);
      } else if (isAlreadySelected) {
        // Deselect if already selected - clear vicinity
        useAppStore.getState().clearVicinity();
        useAppStore
          .getState()
          .selectNodes([...selectedNodeIds].filter((id) => id !== clickedNodeId));
      } else {
        // Single select + compute vicinity + focus camera
        useAppStore.getState().selectNodes([clickedNodeId]);

        // Compute vicinity (depth 2 = neighbors of neighbors) using precomputed adjacency
        // Edges represent k-NN based on cosine similarity of decoder vectors
        const vicinity = getVicinity(clickedNodeId, adjacencyList, 2);
        useAppStore.getState().setVicinity(vicinity);

        // Focus camera on node (action injected by CameraController)
        const store = useAppStore.getState() as unknown as Record<string, unknown>;
        if (typeof store.focusOnNode === 'function') {
          (store.focusOnNode as (nodeId: string) => void)(clickedNodeId);
        }
      }
    }
  }, []);

  // Breathing animation - nodes pulse based on activation intensity
  // Falls back to gentle global breathing when no activations exist
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const { breathingEnabled } = useAppStore.getState();
    if (!breathingEnabled) return;

    const { positions, nodeCount } = useLargeDataStore.getState();
    if (!positions || nodeCount === 0) return;

    const { activations } = useAppStore.getState();
    const time = clock.elapsedTime;
    let hasUpdates = false;

    if (activations.size === 0) {
      // FALLBACK: Gentle global breathing for ALL nodes when no activations
      // Very subtle pulse so the graph feels alive
      const globalBreath = 1.0 + 0.015 * Math.sin(time * 0.4 * Math.PI * 2);

      for (let i = 0; i < nodeCount; i++) {
        tempPosition.set(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2]
        );
        tempScale.setScalar(globalBreath);
        tempMatrix.compose(tempPosition, identityQuaternion, tempScale);
        meshRef.current.setMatrixAt(i, tempMatrix);
      }
      hasUpdates = true;
    } else {
      // Activation-based breathing: nodes with activations pulse more intensely
      const { nodeIndexMap } = useLargeDataStore.getState();

      for (const [nodeId, activation] of activations) {
        const index = nodeIndexMap.get(nodeId);
        if (index === undefined) continue;

        // Calculate breathing scale
        // Higher activation = faster and larger pulse
        const normalizedActivation = Math.min(activation / 10, 1); // Normalize to 0-1
        const frequency = BREATHING_CONFIG.baseFrequency + normalizedActivation * BREATHING_CONFIG.frequencyScale;
        const amplitude = BREATHING_CONFIG.minAmplitude + normalizedActivation * (BREATHING_CONFIG.maxAmplitude - BREATHING_CONFIG.minAmplitude);

        // Smooth sine wave oscillation
        const breathScale = 1.0 + amplitude * Math.sin(time * frequency * Math.PI * 2);

        // Get position and apply scale
        tempPosition.set(
          positions[index * 3],
          positions[index * 3 + 1],
          positions[index * 3 + 2]
        );
        tempScale.setScalar(breathScale);
        tempMatrix.compose(tempPosition, identityQuaternion, tempScale);

        meshRef.current.setMatrixAt(index, tempMatrix);
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      invalidate();
    }
  });

  if (nodeCount === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.min(nodeCount, MAX_NODE_COUNT)]}
      frustumCulled={false}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry
        args={[
          LOD_GEOMETRY_CONFIG[lod].radius,
          LOD_GEOMETRY_CONFIG[lod].widthSegments,
          LOD_GEOMETRY_CONFIG[lod].heightSegments,
        ]}
      />
      <meshBasicMaterial transparent opacity={0.95} />
    </instancedMesh>
  );
}
