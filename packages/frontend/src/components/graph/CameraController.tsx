import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

import { useAppStore, useLargeDataStore } from '../../stores';

// Pre-allocated vectors to avoid GC pressure
const tempVec3 = new THREE.Vector3();
const startPos = new THREE.Vector3();
const startTarget = new THREE.Vector3();
const endPos = new THREE.Vector3();
const endTarget = new THREE.Vector3();

// Animation state (kept outside React to avoid re-renders)
let animationProgress = 0;
let isAnimating = false;
let animationDuration = 1000;

// Easing function: ease-out cubic
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Simple debounce utility
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// LocalStorage key for camera persistence
const CAMERA_STORAGE_KEY = 'horus-camera-state';

interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

function loadCameraFromStorage(): CameraState | null {
  try {
    const stored = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Basic validation
    if (
      Array.isArray(parsed.position) &&
      parsed.position.length === 3 &&
      Array.isArray(parsed.target) &&
      parsed.target.length === 3
    ) {
      return parsed as CameraState;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCameraToStorage(state: CameraState): void {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Camera controller with:
 * - Bidirectional sync between OrbitControls and Zustand store
 * - Smooth animated transitions (flyTo, focusOnNode)
 * - LocalStorage persistence
 * - Demand-based rendering invalidation
 */
export function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();
  const initializedRef = useRef(false);

  // Debounced sync to store (100ms)
  const syncToStore = useMemo(
    () =>
      debounce(() => {
        const controls = controlsRef.current;
        if (!controls || isAnimating) return;

        const position = camera.position.toArray() as [number, number, number];
        const target = controls.target.toArray() as [number, number, number];

        useAppStore.getState().setCameraState(position, target);

        // Also persist to localStorage
        saveCameraToStorage({ position, target });
      }, 100),
    [camera]
  );

  // Initialize camera from stored state on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const controls = controlsRef.current;
    if (!controls) return;

    // Try to load from localStorage first
    const stored = loadCameraFromStorage();
    if (stored) {
      camera.position.set(...stored.position);
      controls.target.set(...stored.target);
      useAppStore.getState().setCameraState(stored.position, stored.target);
    } else {
      // Use store defaults
      const { position, target } = useAppStore.getState();
      camera.position.set(...position);
      controls.target.set(...target);
    }

    controls.update();
    invalidate();
  }, [camera, invalidate]);

  // flyTo: animate camera to a new position/target
  const flyTo = useCallback(
    (
      targetPosition: [number, number, number],
      targetLookAt: [number, number, number],
      duration = 1000
    ) => {
      const controls = controlsRef.current;
      if (!controls) return;

      // Capture start state
      startPos.copy(camera.position);
      startTarget.copy(controls.target);

      // Set end state
      endPos.set(...targetPosition);
      endTarget.set(...targetLookAt);

      // Start animation
      animationProgress = 0;
      animationDuration = duration;
      isAnimating = true;
    },
    [camera]
  );

  // focusOnNode: calculate optimal camera position and animate to it
  const focusOnNode = useCallback(
    (nodeId: string, viewDistance = 10) => {
      const { nodeIndexMap, positions } = useLargeDataStore.getState();
      const nodeIndex = nodeIndexMap.get(nodeId);

      if (nodeIndex === undefined || !positions) {
        console.warn(`Node ${nodeId} not found`);
        return;
      }

      // Get node position
      const nodeX = positions[nodeIndex * 3];
      const nodeY = positions[nodeIndex * 3 + 1];
      const nodeZ = positions[nodeIndex * 3 + 2];

      // Calculate camera position (slightly above and in front)
      const cameraPosition: [number, number, number] = [
        nodeX,
        nodeY + viewDistance * 0.3,
        nodeZ + viewDistance,
      ];

      const targetLookAt: [number, number, number] = [nodeX, nodeY, nodeZ];

      flyTo(cameraPosition, targetLookAt);
    },
    [flyTo]
  );

  // focusOnRegion: frame a region in view
  const focusOnRegion = useCallback(
    (center: [number, number, number], radius: number) => {
      // Position camera at distance proportional to radius
      const viewDistance = radius * 2.5;
      const cameraPosition: [number, number, number] = [
        center[0],
        center[1] + viewDistance * 0.3,
        center[2] + viewDistance,
      ];

      flyTo(cameraPosition, center);
    },
    [flyTo]
  );

  // resetCamera: return to default position
  const resetCamera = useCallback(() => {
    const defaultPosition: [number, number, number] = [0, 20, 50];
    const defaultTarget: [number, number, number] = [0, 0, 0];
    flyTo(defaultPosition, defaultTarget);
  }, [flyTo]);

  // Expose camera actions on the store
  useEffect(() => {
    // Extend the store with camera actions at runtime
    // This is a pattern to avoid circular dependencies
    (useAppStore.getState() as unknown as Record<string, unknown>).focusOnNode = focusOnNode;
    (useAppStore.getState() as unknown as Record<string, unknown>).focusOnRegion = focusOnRegion;
    (useAppStore.getState() as unknown as Record<string, unknown>).resetCamera = resetCamera;
    (useAppStore.getState() as unknown as Record<string, unknown>).flyTo = flyTo;

    return () => {
      delete (useAppStore.getState() as unknown as Record<string, unknown>).focusOnNode;
      delete (useAppStore.getState() as unknown as Record<string, unknown>).focusOnRegion;
      delete (useAppStore.getState() as unknown as Record<string, unknown>).resetCamera;
      delete (useAppStore.getState() as unknown as Record<string, unknown>).flyTo;
    };
  }, [focusOnNode, focusOnRegion, resetCamera, flyTo]);

  // Animation and sync in useFrame
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isAnimating) {
      // Progress animation
      animationProgress += (delta * 1000) / animationDuration;

      if (animationProgress >= 1) {
        // Animation complete
        animationProgress = 1;
        isAnimating = false;

        // Set final positions exactly
        camera.position.copy(endPos);
        controls.target.copy(endTarget);
      } else {
        // Interpolate with easing
        const t = easeOutCubic(animationProgress);

        tempVec3.lerpVectors(startPos, endPos, t);
        camera.position.copy(tempVec3);

        tempVec3.lerpVectors(startTarget, endTarget, t);
        controls.target.copy(tempVec3);
      }

      controls.update();
      invalidate();

      // Sync final state to store
      if (!isAnimating) {
        syncToStore();
      }
    } else {
      // Not animating - sync camera state to store (debounced)
      syncToStore();
    }
  });

  // Handle OrbitControls change event
  const handleChange = useCallback(() => {
    if (!isAnimating) {
      invalidate();
    }
  }, [invalidate]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={200}
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
      enablePan
      panSpeed={0.8}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onChange={handleChange}
    />
  );
}
