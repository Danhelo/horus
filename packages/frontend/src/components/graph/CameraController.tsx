import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useAppStore, useLargeDataStore } from '../../stores';

// Pre-allocated vectors to avoid GC pressure
const tempVec3 = new THREE.Vector3();
const startPos = new THREE.Vector3();
const endPos = new THREE.Vector3();
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
 * FPS-style camera controller with:
 * - Click to lock pointer (FPS mode)
 * - Mouse look (pitch/yaw) when locked
 * - WASD movement, Q/E for up/down
 * - Scroll wheel for base speed
 * - Shift=sprint (3x), Ctrl=slow (0.3x)
 * - Smooth animated transitions (flyTo)
 * - LocalStorage persistence
 */
export function CameraController() {
  const { camera, gl, invalidate } = useThree();
  const initializedRef = useRef(false);
  const canvasRef = useRef(gl.domElement);

  // Get settings from store
  const isPointerLocked = useAppStore((state) => state.isPointerLocked);
  const setPointerLocked = useAppStore((state) => state.setPointerLocked);
  const movementSpeed = useAppStore((state) => state.movementSpeed);
  const setMovementSpeed = useAppStore((state) => state.setMovementSpeed);

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

  // Initialize camera from stored state on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Load settings from storage
    useAppStore.getState().loadSettingsFromStorage();

    // Load camera position and orientation
    const stored = loadCameraFromStorage();
    if (stored) {
      camera.position.set(...stored.position);
      yaw = stored.yaw;
      pitch = stored.pitch;
    } else {
      // Default position looking at origin
      camera.position.set(0, 0, 50);
      yaw = 0;
      pitch = 0;
    }

    // Apply rotation
    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    invalidate();
  }, [camera, invalidate]);

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

  // Mouse move handler for FPS look
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

  // Canvas click to lock pointer
  const handleCanvasClick = useCallback(() => {
    if (!useAppStore.getState().isPointerLocked) {
      canvasRef.current.requestPointerLock();
    }
  }, []);

  // Scroll wheel for speed adjustment
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -5 : 5;
      const currentSpeed = useAppStore.getState().movementSpeed;
      setMovementSpeed(currentSpeed + delta);
    },
    [setMovementSpeed]
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
        // Reset camera
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
  }, []);

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    document.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
      document.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    handlePointerLockChange,
    handlePointerLockError,
    handleMouseMove,
    handleCanvasClick,
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

  // resetCamera: return to default position
  const resetCamera = useCallback(() => {
    const defaultPosition: [number, number, number] = [0, 20, 50];
    const defaultTarget: [number, number, number] = [0, 0, 0];
    flyTo(defaultPosition, defaultTarget);
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
        const cameraDir = camera.getWorldDirection(new THREE.Vector3());
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
