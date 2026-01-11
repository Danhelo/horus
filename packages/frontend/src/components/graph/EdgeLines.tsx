import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { useLargeDataStore, useAppStore } from '../../stores';

/**
 * Renders graph edges as efficient LineSegments.
 * Uses BufferGeometry with Float32Arrays for performance with 100k+ edges.
 */
export function EdgeLines() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  // Get edge visibility state and LOD
  const edgesVisible = useLargeDataStore((state) => state.edgesVisible);
  const edgeCount = useLargeDataStore((state) => state.edgeCount);
  const lod = useAppStore((state) => state.lod);

  // Create material once
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
          geometryRef.current.setAttribute(
            'position',
            new THREE.BufferAttribute(edgePositions, 3)
          );
        }

        geometryRef.current.computeBoundingSphere();
      }
    );
  }, []);

  // Subscribe to edge color changes
  useEffect(() => {
    return useLargeDataStore.subscribe(
      (state) => state.edgeColors,
      (edgeColors) => {
        if (!geometryRef.current || !edgeColors) return;

        const colorAttr = geometryRef.current.attributes.color;
        if (colorAttr) {
          (colorAttr.array as Float32Array).set(edgeColors);
          colorAttr.needsUpdate = true;
        } else {
          geometryRef.current.setAttribute(
            'color',
            new THREE.BufferAttribute(edgeColors, 3)
          );
        }
      }
    );
  }, []);

  // Initialize geometry with current data
  useEffect(() => {
    if (!geometryRef.current) return;

    const { edgePositions, edgeColors } = useLargeDataStore.getState();
    if (edgePositions && edgeColors) {
      geometryRef.current.setAttribute(
        'position',
        new THREE.BufferAttribute(edgePositions, 3)
      );
      geometryRef.current.setAttribute(
        'color',
        new THREE.BufferAttribute(edgeColors, 3)
      );
      geometryRef.current.computeBoundingSphere();
    }
  }, []);

  // Hide edges when zoomed out far (LOD 'far') for clarity and performance
  if (!edgesVisible || edgeCount === 0 || lod === 'far') {
    return null;
  }

  return (
    <lineSegments ref={lineRef} frustumCulled={false}>
      <bufferGeometry ref={geometryRef} />
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}
