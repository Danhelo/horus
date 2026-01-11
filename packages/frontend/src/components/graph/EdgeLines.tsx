import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useLargeDataStore, useAppStore } from '../../stores';

/**
 * Renders graph edges as efficient LineSegments.
 * Uses BufferGeometry with Float32Arrays for performance with 100k+ edges.
 * Edges fade smoothly based on camera distance instead of hard LOD cutoff.
 */
export function EdgeLines() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const { invalidate } = useThree();

  // Get edge visibility state
  const edgesVisible = useLargeDataStore((state) => state.edgesVisible);
  const edgeCount = useLargeDataStore((state) => state.edgeCount);

  // Get fade settings from store
  const edgeFadeStart = useAppStore((state) => state.edgeFadeStart);
  const edgeFadeEnd = useAppStore((state) => state.edgeFadeEnd);

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

  // Update edge opacity based on camera distance
  useFrame(({ camera }) => {
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
      material.opacity = opacity;
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

  // Hide edges only if explicitly disabled or no edges exist
  // Opacity fading is handled in useFrame for smooth transitions
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
