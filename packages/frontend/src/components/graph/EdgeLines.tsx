import { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useLargeDataStore, useAppStore } from '../../stores';
import { makeEdgeKey } from '../../stores/largeDataStore';
import { HORUS_COLORS } from './colors';

// Gold color for vicinity pulse
const GOLD_COLOR = new THREE.Color(HORUS_COLORS.vicinityDepth1);

/**
 * Renders graph edges as efficient LineSegments.
 * Uses BufferGeometry with Float32Arrays for performance with 100k+ edges.
 * Edges fade smoothly based on camera distance instead of hard LOD cutoff.
 * Vicinity edges pulse gold when a node is selected.
 */
export function EdgeLines() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const { invalidate } = useThree();

  // CRITICAL: Store a COPY of original colors that never gets mutated
  // Without this, useFrame mutations corrupt the source and reset fails
  const originalColorsRef = useRef<Float32Array | null>(null);

  // Track vicinity edges for animation
  const vicinityEdgeIndicesRef = useRef<Set<number>>(new Set());
  const pulseStartTimeRef = useRef<number>(0);
  const isPulsingRef = useRef<boolean>(false);

  // Generation counter to invalidate stale animations when selection changes rapidly
  const animationGenRef = useRef<number>(0);

  // Get edge visibility state
  const edgesVisible = useLargeDataStore((state) => state.edgesVisible);
  const edgeCount = useLargeDataStore((state) => state.edgeCount);

  // Get fade settings from store (subscribed for reactivity, accessed via getState in useFrame)
  const _edgeFadeStart = useAppStore((state) => state.edgeFadeStart);
  const _edgeFadeEnd = useAppStore((state) => state.edgeFadeEnd);

  // Create material once - opacity will be updated in useFrame
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  // Update edge opacity and animate vicinity pulse
  useFrame(({ camera, clock }) => {
    if (!material) return;

    const distance = camera.position.length();
    const fadeStart = useAppStore.getState().edgeFadeStart;
    const fadeEnd = useAppStore.getState().edgeFadeEnd;

    // Calculate opacity: full at fadeStart, fades to minimum at fadeEnd
    let opacity: number;
    if (distance <= fadeStart) {
      opacity = 0.6;
    } else if (distance >= fadeEnd) {
      opacity = 0.05; // Never fully invisible
    } else {
      const t = (distance - fadeStart) / (fadeEnd - fadeStart);
      opacity = 0.6 * (1 - t) + 0.05 * t;
    }

    // Only update if changed significantly (avoid unnecessary invalidate)
    if (Math.abs(material.opacity - opacity) > 0.01) {
      // eslint-disable-next-line react-hooks/immutability -- Three.js material mutation in useFrame is correct R3F pattern
      material.opacity = opacity;
      invalidate();
    }

    // Animate vicinity edge pulse - STATIC GOLD (no animation for debugging)
    // Just set edges to solid gold when pulsing, no sine wave
    if (isPulsingRef.current && geometryRef.current && vicinityEdgeIndicesRef.current.size > 0) {
      const colorAttr = geometryRef.current.attributes.color;
      if (!colorAttr) return;

      const colors = colorAttr.array as Float32Array;

      // Set vicinity edges to solid gold (no pulse animation)
      for (const edgeIdx of vicinityEdgeIndicesRef.current) {
        const offset = edgeIdx * 6; // 2 points * 3 colors per edge

        for (let p = 0; p < 2; p++) {
          const pointOffset = offset + p * 3;
          colors[pointOffset] = GOLD_COLOR.r;
          colors[pointOffset + 1] = GOLD_COLOR.g;
          colors[pointOffset + 2] = GOLD_COLOR.b;
        }
      }

      colorAttr.needsUpdate = true;
      invalidate();
    }
  });

  // Subscribe to edge position changes
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.edgePositions,
      (edgePositions) => {
        if (!geometryRef.current || !edgePositions) return;

        const positionAttr = geometryRef.current.attributes.position;
        if (positionAttr) {
          (positionAttr.array as Float32Array).set(edgePositions);
          positionAttr.needsUpdate = true;
        } else {
          geometryRef.current.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
        }

        geometryRef.current.computeBoundingSphere();
      }
    );
  }, []);

  // Subscribe to edge color changes (when new graph data loads)
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.edgeColors,
      (edgeColors) => {
        if (!geometryRef.current || !edgeColors) return;

        // Update our preserved original colors reference
        originalColorsRef.current = new Float32Array(edgeColors);

        // Use a copy for the geometry so mutations don't affect our reference
        const colorsCopy = new Float32Array(edgeColors);
        geometryRef.current.setAttribute(
          'color',
          new THREE.BufferAttribute(colorsCopy, 3)
        );
      }
    );
  }, []);

  // Initialize geometry with current data - re-run when edgeCount changes
  useLayoutEffect(() => {
    if (!geometryRef.current) return;

    const { edgePositions, edgeColors } = useLargeDataStore.getState();
    if (edgePositions && edgeColors && edgePositions.length > 0) {
      // CRITICAL: Store a COPY of original colors before they can be mutated
      // This is the source of truth for reset operations
      originalColorsRef.current = new Float32Array(edgeColors);

      geometryRef.current.setAttribute(
        'position',
        new THREE.BufferAttribute(edgePositions, 3)
      );
      // Use a copy for the geometry so mutations don't affect our reference
      geometryRef.current.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array(edgeColors), 3)
      );
      geometryRef.current.computeBoundingSphere();

      // Force material to recognize vertex colors
      if (material) {
        material.needsUpdate = true;
      }
      invalidate();
    }
  }, [edgeCount, invalidate, material]);

  // Subscribe to selection changes to immediately stop animation and reset colors
  // This fires BEFORE vicinityNodeIds updates, ensuring no stale gold edges
  useEffect(() => {
    return useAppStore.subscribe(
      (state) => state.selectedNodeIds,
      () => {
        // Increment generation to invalidate any pending animation starts
        animationGenRef.current++;

        // IMMEDIATELY stop current animation when selection changes
        isPulsingRef.current = false;
        vicinityEdgeIndicesRef.current.clear();

        // Reset ALL edge colors to ORIGINAL (unmutated) colors
        if (geometryRef.current && originalColorsRef.current) {
          // Create a fresh copy from our preserved original
          const colorsCopy = new Float32Array(originalColorsRef.current);
          geometryRef.current.setAttribute(
            'color',
            new THREE.BufferAttribute(colorsCopy, 3)
          );
        }

        invalidate();
      }
    );
  }, [invalidate]);

  // Subscribe to vicinity changes to animate edge pulses
  // Uses setTimeout(50ms) to ensure reset is visible before new animation starts
  useEffect(() => {
    return useAppStore.subscribe(
      (state) => state.vicinityNodeIds,
      (vicinityNodeIds) => {
        // 1. Capture current generation for this animation attempt
        const currentGen = ++animationGenRef.current;

        // 2. IMMEDIATELY stop current animation (prevents useFrame from overwriting reset)
        isPulsingRef.current = false;

        // 3. Clear previous vicinity edge set
        vicinityEdgeIndicesRef.current.clear();

        // 4. Reset ALL edge colors to ORIGINAL (unmutated) colors
        if (geometryRef.current && originalColorsRef.current) {
          const colorsCopy = new Float32Array(originalColorsRef.current);
          geometryRef.current.setAttribute(
            'color',
            new THREE.BufferAttribute(colorsCopy, 3)
          );
        }

        // 5. Force render of reset state
        invalidate();

        // 6. If no vicinity, we're done (deselection case)
        const { selectedNodeIds } = useAppStore.getState();
        if (vicinityNodeIds.size === 0 || selectedNodeIds.size === 0) {
          return;
        }

        // 7. DEFER new animation by 50ms (~3 frames) to ensure reset is visible
        // Also check generation to abort if selection changed during delay
        setTimeout(() => {
          // Abort if a newer animation was started (selection changed)
          if (animationGenRef.current !== currentGen) {
            return;
          }

          // Re-check that geometry is still ready
          if (!geometryRef.current?.attributes?.color) return;

          const { selectedNodeIds: currentSelected, adjacencyList } = useAppStore.getState();
          const { edgeIndexMap } = useLargeDataStore.getState();

          // Re-check vicinity hasn't changed during the delay
          const currentVicinity = useAppStore.getState().vicinityNodeIds;
          if (currentVicinity.size === 0 || currentSelected.size === 0) return;

          // Build set of all relevant nodes (selected + vicinity)
          const relevantNodes = new Set([...currentSelected, ...currentVicinity.keys()]);

          // Find edges that connect relevant nodes using adjacency list
          for (const nodeId of relevantNodes) {
            const neighbors = adjacencyList.get(nodeId);
            if (!neighbors) continue;

            for (const neighborId of neighbors) {
              // Only include edges where both endpoints are relevant
              if (relevantNodes.has(neighborId)) {
                const edgeKey = makeEdgeKey(nodeId, neighborId);
                const edgeIdx = edgeIndexMap.get(edgeKey);
                if (edgeIdx !== undefined) {
                  vicinityEdgeIndicesRef.current.add(edgeIdx);
                }
              }
            }
          }

          // Start pulsing if we found edges
          if (vicinityEdgeIndicesRef.current.size > 0) {
            isPulsingRef.current = true;
            invalidate();
          }
        }, 50); // 50ms delay ensures reset is visible before animation starts
      }
    );
  }, [invalidate]);

  // Hide edges only if explicitly disabled or no edges exist
  if (!edgesVisible || edgeCount === 0) {
    return null;
  }

  return (
    <lineSegments ref={lineRef} frustumCulled={false}>
      <bufferGeometry ref={geometryRef} />
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}
