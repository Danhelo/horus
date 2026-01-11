import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useAppStore, useLargeDataStore } from '../../stores';

// Pre-allocated vectors to avoid GC pressure
const tempVec3 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const PI_2 = Math.PI / 2;

// Animation state (kept outside React to avoid re-renders)
let animationProgress = 0;
let isAnimating = false;
let animationDuration = 1000;
let animStartPos = new THREE.Vector3();
let animEndPos = new THREE.Vector3();

// FPS state (outside React for performance)
let yaw = 0;
let pitch = 0;

// Movement state
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  shift: false,
  ctrl: false,
};

// Drag state for trackpad/mouse navigation
const dragState = {
  active: false,
  lastX: 0,
  lastY: 0,
  button: -1,
};

// Cached graph bounds
let cachedBounds: THREE.Box3 | null = null;
let cachedBoundsNodeCount = 0;

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
  yaw: number;
  pitch: number;
}

function loadCameraFromStorage(): CameraState | null {
  try {
    const stored = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      Array.isArray(parsed.position) &&
      parsed.position.length === 3 &&
      typeof parsed.yaw === 'number' &&
      typeof parsed.pitch === 'number'
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
 * Compute bounding box from node positions
 */
function computeGraphBounds(positions: Float32Array | null): THREE.Box3 {
  if (!positions || positions.length === 0) {
    return new THREE.Box3(
      new THREE.Vector3(-10, -10, -10),
      new THREE.Vector3(10, 10, 10)
    );
  }

  const box = new THREE.Box3();
  const nodeCount = positions.length / 3;

  for (let i = 0; i < nodeCount; i++) {
    tempVec3.set(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2]
    );
    box.expandByPoint(tempVec3);
  }

  return box;
}

/**
 * Calculate optimal camera position to frame the graph
 */
function computeOptimalCameraPosition(bounds: THREE.Box3): {
  position: THREE.Vector3;
  target: THREE.Vector3;
} {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z);

  // Camera distance based on extent (with minimum)
  const distance = Math.max(maxExtent * 2, 5);

  // Position camera above and back from center
  const position = new THREE.Vector3(
    center.x,
    center.y + distance * 0.3,
    center.z + distance
  );

  return { position, target: center };
}

/**
 * FPS-style camera controller with:
 * - Dynamic spawn position based on graph bounds
 * - Click to lock pointer (FPS mode)
 * - Mouse look (pitch/yaw) when locked
 * - Drag to orbit when not locked (trackpad friendly)
 * - WASD movement, Q/E for up/down
 * - Scroll wheel for zoom
 * - Shift=sprint (3x), Ctrl=slow (0.3x)
 * - Smooth animated transitions (flyTo)
 * - LocalStorage persistence
 */
export function CameraController() {
  const { camera, gl, invalidate } = useThree();
  const initializedRef = useRef(false);
  const hasFramedGraphRef = useRef(false);
  const canvasRef = useRef(gl.domElement);

  // Get settings from store
  const isPointerLocked = useAppStore((state) => state.isPointerLocked);
  const setPointerLocked = useAppStore((state) => state.setPointerLocked);
  const movementSpeed = useAppStore((state) => state.movementSpeed);

  // Subscribe to node count to detect when graph loads
  const nodeCount = useLargeDataStore((state) => state.nodeCount);

  // Debounced sync to store (100ms)
  const syncToStore = useMemo(
    () =>
      debounce(() => {
        if (isAnimating) return;

        const position = camera.position.toArray() as [number, number, number];
        // Compute target from camera direction
        const target = camera.position
          .clone()
          .add(camera.getWorldDirection(tempVec3).multiplyScalar(10))
          .toArray() as [number, number, number];

        useAppStore.getState().setCameraState(position, target);

        // Persist to localStorage
        saveCameraToStorage({ position, yaw, pitch });
      }, 100),
    [camera]
  );

  // Initialize camera on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Load settings from storage
    useAppStore.getState().loadSettingsFromStorage();

    // Start with a temporary position (will be updated when graph loads)
    const stored = loadCameraFromStorage();
    if (stored) {
      camera.position.set(...stored.position);
      yaw = stored.yaw;
      pitch = stored.pitch;
    } else {
      // Temporary default until graph loads
      camera.position.set(0, 5, 15);
      yaw = 0;
      pitch = 0;
    }

    // Apply rotation
    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    invalidate();
  }, [camera, invalidate]);

  // Frame graph when data loads
  useEffect(() => {
    if (nodeCount === 0 || hasFramedGraphRef.current) return;

    const { positions } = useLargeDataStore.getState();
    if (!positions || positions.length === 0) return;

    // Compute bounds and optimal position
    cachedBounds = computeGraphBounds(positions);
    cachedBoundsNodeCount = nodeCount;
    const { position, target } = computeOptimalCameraPosition(cachedBounds);

    // Check if we have a stored position that's reasonable
    const stored = loadCameraFromStorage();
    if (stored) {
      // Verify stored position is within reasonable range of graph
      const storedPos = new THREE.Vector3(...stored.position);
      const center = cachedBounds.getCenter(new THREE.Vector3());
      const size = cachedBounds.getSize(new THREE.Vector3());
      const maxExtent = Math.max(size.x, size.y, size.z);

      // If stored position is within 10x the graph extent, use it
      if (storedPos.distanceTo(center) < maxExtent * 10) {
        hasFramedGraphRef.current = true;
        return;
      }
    }

    // Set camera to frame the graph
    camera.position.copy(position);

    // Calculate yaw/pitch to look at target
    tempVec3.copy(target).sub(position).normalize();
    yaw = Math.atan2(-tempVec3.x, -tempVec3.z);
    pitch = Math.asin(tempVec3.y);

    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    hasFramedGraphRef.current = true;
    syncToStore();
    invalidate();
  }, [nodeCount, camera, invalidate, syncToStore]);

  // Pointer lock event handlers
  const handlePointerLockChange = useCallback(() => {
    const locked = document.pointerLockElement === canvasRef.current;
    setPointerLocked(locked);
    invalidate();
  }, [setPointerLocked, invalidate]);

  const handlePointerLockError = useCallback(() => {
    console.warn('Pointer lock error');
    setPointerLocked(false);
  }, [setPointerLocked]);

  // Mouse move handler for FPS look (when pointer locked)
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!useAppStore.getState().isPointerLocked) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      // Sensitivity (lower = slower rotation)
      const sensitivity = 0.002;

      yaw -= movementX * sensitivity;
      pitch -= movementY * sensitivity;

      // Clamp pitch to prevent flipping
      pitch = Math.max(-PI_2, Math.min(PI_2, pitch));

      // Apply rotation
      euler.set(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      invalidate();
    },
    [camera, invalidate]
  );

  // Pointer down - start drag or request pointer lock
  const handlePointerDown = useCallback((event: PointerEvent) => {
    const isLocked = useAppStore.getState().isPointerLocked;

    if (event.button === 0 && !isLocked) {
      // Left click - start drag for orbit
      dragState.active = true;
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      dragState.button = event.button;
    }
  }, []);

  // Pointer move - handle drag for orbit (when not pointer locked)
  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const isLocked = useAppStore.getState().isPointerLocked;
      if (isLocked) return; // FPS mode handles this via mousemove

      if (dragState.active) {
        const dx = event.clientX - dragState.lastX;
        const dy = event.clientY - dragState.lastY;

        // Orbit sensitivity
        const sensitivity = 0.005;

        yaw -= dx * sensitivity;
        pitch -= dy * sensitivity;
        pitch = Math.max(-PI_2, Math.min(PI_2, pitch));

        euler.set(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        dragState.lastX = event.clientX;
        dragState.lastY = event.clientY;

        invalidate();
        syncToStore();
      }
    },
    [camera, invalidate, syncToStore]
  );

  // Pointer up - end drag
  const handlePointerUp = useCallback(() => {
    dragState.active = false;
  }, []);

  // Double-click to enter FPS mode
  const handleDoubleClick = useCallback(() => {
    if (!useAppStore.getState().isPointerLocked) {
      canvasRef.current.requestPointerLock();
    }
  }, []);

  // Scroll wheel for zoom
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();

      // Zoom: move camera forward/backward along view direction
      // Normalize delta for different input devices (mouse vs trackpad)
      const delta = event.deltaY;
      const zoomSpeed = event.deltaMode === 1 ? 0.5 : 0.01; // Line vs pixel mode

      const direction = camera.getWorldDirection(tempVec3);
      camera.position.addScaledVector(direction, -delta * zoomSpeed);

      invalidate();
      syncToStore();
    },
    [camera, invalidate, syncToStore]
  );

  // Key handlers
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't capture if typing in an input
    const activeElement = document.activeElement;
    if (
      activeElement?.tagName.toLowerCase() === 'input' ||
      activeElement?.tagName.toLowerCase() === 'textarea' ||
      activeElement?.getAttribute('contenteditable') === 'true'
    ) {
      return;
    }

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        moveState.forward = true;
        event.preventDefault();
        break;
      case 'KeyS':
      case 'ArrowDown':
        moveState.backward = true;
        event.preventDefault();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        moveState.left = true;
        event.preventDefault();
        break;
      case 'KeyD':
      case 'ArrowRight':
        moveState.right = true;
        event.preventDefault();
        break;
      case 'KeyQ':
        moveState.down = true;
        event.preventDefault();
        break;
      case 'KeyE':
        moveState.up = true;
        event.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        moveState.shift = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        moveState.ctrl = true;
        break;
      case 'KeyR':
      case 'Home':
        event.preventDefault();
        // Reset camera to frame graph
        const store = useAppStore.getState() as unknown as Record<string, unknown>;
        if (typeof store.resetCamera === 'function') {
          (store.resetCamera as () => void)();
        }
        break;
      case 'Escape':
        // Let browser handle pointer lock exit
        break;
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        moveState.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        moveState.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        moveState.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        moveState.right = false;
        break;
      case 'KeyQ':
        moveState.down = false;
        break;
      case 'KeyE':
        moveState.up = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        moveState.shift = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        moveState.ctrl = false;
        break;
    }
  }, []);

  // Handle blur (release all keys)
  const handleBlur = useCallback(() => {
    moveState.forward = false;
    moveState.backward = false;
    moveState.left = false;
    moveState.right = false;
    moveState.up = false;
    moveState.down = false;
    moveState.shift = false;
    moveState.ctrl = false;
    dragState.active = false;
  }, []);

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    handlePointerLockChange,
    handlePointerLockError,
    handleMouseMove,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    handleBlur,
  ]);

  // flyTo: animate camera to a new position
  const flyTo = useCallback(
    (
      targetPosition: [number, number, number],
      targetLookAt: [number, number, number],
      duration = 1000
    ) => {
      // Exit pointer lock during animation
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }

      // Capture start state
      animStartPos.copy(camera.position);
      animEndPos.set(...targetPosition);

      // Calculate target yaw/pitch from targetLookAt
      tempVec3.set(...targetLookAt).sub(animEndPos).normalize();
      const targetYaw = Math.atan2(-tempVec3.x, -tempVec3.z);
      const targetPitch = Math.asin(tempVec3.y);

      // Store animation targets
      (window as unknown as Record<string, number>).__animTargetYaw = targetYaw;
      (window as unknown as Record<string, number>).__animTargetPitch = targetPitch;
      (window as unknown as Record<string, number>).__animStartYaw = yaw;
      (window as unknown as Record<string, number>).__animStartPitch = pitch;

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

      const nodeX = positions[nodeIndex * 3];
      const nodeY = positions[nodeIndex * 3 + 1];
      const nodeZ = positions[nodeIndex * 3 + 2];

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

  // resetCamera: return to optimal position for current graph
  const resetCamera = useCallback(() => {
    const { positions } = useLargeDataStore.getState();

    // Recompute bounds if needed
    if (!cachedBounds || cachedBoundsNodeCount !== useLargeDataStore.getState().nodeCount) {
      cachedBounds = computeGraphBounds(positions);
      cachedBoundsNodeCount = useLargeDataStore.getState().nodeCount;
    }

    const { position, target } = computeOptimalCameraPosition(cachedBounds);

    flyTo(
      position.toArray() as [number, number, number],
      target.toArray() as [number, number, number]
    );
  }, [flyTo]);

  // Expose camera actions on the store
  useEffect(() => {
    const store = useAppStore.getState() as unknown as Record<string, unknown>;
    store.focusOnNode = focusOnNode;
    store.focusOnRegion = focusOnRegion;
    store.resetCamera = resetCamera;
    store.flyTo = flyTo;

    return () => {
      delete store.focusOnNode;
      delete store.focusOnRegion;
      delete store.resetCamera;
      delete store.flyTo;
    };
  }, [focusOnNode, focusOnRegion, resetCamera, flyTo]);

  // Main update loop
  useFrame((_, delta) => {
    let needsInvalidate = false;

    if (isAnimating) {
      // Progress animation
      animationProgress += (delta * 1000) / animationDuration;

      if (animationProgress >= 1) {
        // Animation complete
        animationProgress = 1;
        isAnimating = false;

        camera.position.copy(animEndPos);

        // Set final yaw/pitch
        const w = window as unknown as Record<string, number>;
        yaw = w.__animTargetYaw ?? yaw;
        pitch = w.__animTargetPitch ?? pitch;
      } else {
        // Interpolate with easing
        const t = easeOutCubic(animationProgress);

        tempVec3.lerpVectors(animStartPos, animEndPos, t);
        camera.position.copy(tempVec3);

        // Interpolate yaw/pitch
        const w = window as unknown as Record<string, number>;
        const startYaw = w.__animStartYaw ?? yaw;
        const startPitch = w.__animStartPitch ?? pitch;
        const targetYaw = w.__animTargetYaw ?? yaw;
        const targetPitch = w.__animTargetPitch ?? pitch;

        yaw = startYaw + (targetYaw - startYaw) * t;
        pitch = startPitch + (targetPitch - startPitch) * t;
      }

      // Apply rotation
      euler.set(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      needsInvalidate = true;

      if (!isAnimating) {
        syncToStore();
      }
    } else {
      // Not animating - handle movement
      const { forward, backward, left, right, up, down, shift, ctrl } = moveState;
      const anyMovement = forward || backward || left || right || up || down;

      if (anyMovement) {
        const baseSpeed = useAppStore.getState().movementSpeed;
        const speedMultiplier = shift ? 3 : ctrl ? 0.3 : 1;
        const speed = baseSpeed * speedMultiplier * delta;

        // Calculate movement direction
        tempVec3.set(0, 0, 0);

        // Get camera forward/right vectors
        const cameraDir = camera.getWorldDirection(tempVec3_2);
        const cameraRight = new THREE.Vector3()
          .crossVectors(cameraDir, camera.up)
          .normalize();

        if (forward) tempVec3.add(cameraDir);
        if (backward) tempVec3.sub(cameraDir);
        if (right) tempVec3.add(cameraRight);
        if (left) tempVec3.sub(cameraRight);
        if (up) tempVec3.y += 1;
        if (down) tempVec3.y -= 1;

        if (tempVec3.lengthSq() > 0) {
          tempVec3.normalize().multiplyScalar(speed);
          camera.position.add(tempVec3);
          needsInvalidate = true;
        }

        syncToStore();
      }
    }

    if (needsInvalidate) {
      invalidate();
    }
  });

  // No DOM element to render - this is a controller component
  return null;
}
