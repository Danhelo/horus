import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

import { useLargeDataStore, useAppStore } from '../../stores';
import { activationToColor } from './colors';

// Pre-allocated objects to avoid GC pressure in useFrame
const tempMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();

// Maximum capacity for the instanced mesh
const MAX_NODE_COUNT = 100000;

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
  const { invalidate } = useThree();

  // Get node count to determine actual instance count
  const nodeCount = useLargeDataStore((state) => state.nodeCount);

  // Get current LOD level
  const lod = useAppStore((state) => state.lod);

  // Geometry and material are now JSX children - React handles LOD swaps automatically

  // Subscribe to position changes without causing re-renders
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.positions,
      (positions) => {
        if (!meshRef.current || !positions) return;

        const count = useLargeDataStore.getState().nodeCount;
        for (let i = 0; i < count; i++) {
          tempMatrix.setPosition(
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2]
          );
          meshRef.current.setMatrixAt(i, tempMatrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.computeBoundingSphere();
        invalidate(); // Request a re-render
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
        for (let i = 0; i < count; i++) {
          tempColor.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
          meshRef.current.setColorAt(i, tempColor);
        }
        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
        invalidate();
      }
    );
  }, [invalidate]);

  // Initialize mesh with current data
  useEffect(() => {
    if (!meshRef.current) return;

    const { positions, colors, nodeCount } = useLargeDataStore.getState();
    if (!positions || !colors || nodeCount === 0) return;

    // Set positions
    for (let i = 0; i < nodeCount; i++) {
      tempMatrix.setPosition(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
      meshRef.current.setMatrixAt(i, tempMatrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Set colors
    for (let i = 0; i < nodeCount; i++) {
      tempColor.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      meshRef.current.setColorAt(i, tempColor);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    meshRef.current.computeBoundingSphere();
    invalidate();
  }, [nodeCount, invalidate]);

  // Handle hover - store in app store for UI feedback
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId === undefined) return;

    const { nodeIndexMap } = useLargeDataStore.getState();
    // Reverse lookup: find nodeId from instanceId
    let hoveredNodeId: string | null = null;
    for (const [nodeId, index] of nodeIndexMap) {
      if (index === instanceId) {
        hoveredNodeId = nodeId;
        break;
      }
    }

    if (hoveredNodeId) {
      useAppStore.getState().setHoveredNode(hoveredNodeId);

      // Update cursor
      document.body.style.cursor = 'pointer';

      // Highlight the hovered node
      if (meshRef.current) {
        const { selectedNodeIds } = useAppStore.getState();
        activationToColor(
          0, // We'll use hover color regardless of activation
          selectedNodeIds.has(hoveredNodeId),
          true, // isHovered
          tempColor
        );
        meshRef.current.setColorAt(instanceId, tempColor);
        if (meshRef.current.instanceColor) {
          meshRef.current.instanceColor.needsUpdate = true;
        }
      }
    }
  }, []);

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const instanceId = e.instanceId;

    // Reset cursor
    document.body.style.cursor = 'auto';

    const hoveredNodeId = useAppStore.getState().hoveredNodeId;
    useAppStore.getState().setHoveredNode(null);

    // Restore original color for the previously hovered node
    if (instanceId !== undefined && meshRef.current && hoveredNodeId) {
      const { colors, nodeIndexMap } = useLargeDataStore.getState();
      const { selectedNodeIds } = useAppStore.getState();

      // Find the index for this node
      const nodeIndex = nodeIndexMap.get(hoveredNodeId);
      if (nodeIndex !== undefined && colors) {
        const isSelected = selectedNodeIds.has(hoveredNodeId);
        if (isSelected) {
          activationToColor(0, true, false, tempColor);
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
      }
    }
  }, []);

  // Handle click - select node and focus camera on it
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const instanceId = e.instanceId;
    if (instanceId === undefined) return;

    const { nodeIndexMap } = useLargeDataStore.getState();

    // Reverse lookup: find nodeId from instanceId
    let clickedNodeId: string | null = null;
    for (const [nodeId, index] of nodeIndexMap) {
      if (index === instanceId) {
        clickedNodeId = nodeId;
        break;
      }
    }

    if (clickedNodeId) {
      const { selectedNodeIds } = useAppStore.getState();
      const isAlreadySelected = selectedNodeIds.has(clickedNodeId);

      // Multi-select with shift key
      if (e.shiftKey && !isAlreadySelected) {
        useAppStore.getState().selectNodes([...selectedNodeIds, clickedNodeId]);
      } else if (isAlreadySelected) {
        // Deselect if already selected
        useAppStore
          .getState()
          .selectNodes([...selectedNodeIds].filter((id) => id !== clickedNodeId));
      } else {
        // Single select + focus camera on the node
        useAppStore.getState().selectNodes([clickedNodeId]);

        // Open the details panel if not already open
        if (!useAppStore.getState().panelsOpen.details) {
          useAppStore.getState().togglePanel('details');
        }

        // Focus camera on node (action injected by CameraController)
        const store = useAppStore.getState() as unknown as Record<string, unknown>;
        if (typeof store.focusOnNode === 'function') {
          (store.focusOnNode as (nodeId: string) => void)(clickedNodeId);
        }
      }
    }
  }, []);

  // Optional animation frame updates (breathing effect, etc.)
  useFrame((_state, _delta) => {
    if (!meshRef.current) return;
    // Placeholder for future animations
    // Could add subtle pulsing, rotation, etc.
  });

  // Don't render if no nodes
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
      <meshBasicMaterial vertexColors transparent opacity={0.95} />
    </instancedMesh>
  );
}
