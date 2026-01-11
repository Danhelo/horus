import { useEffect, useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { useAppStore } from '../stores';

// Movement speed (units per second)
const MOVE_SPEED = 30;

// Key bindings
const KEY_BINDINGS = {
  moveForward: ['w', 'W', 'ArrowUp'],
  moveBackward: ['s', 'S', 'ArrowDown'],
  moveLeft: ['a', 'A', 'ArrowLeft'],
  moveRight: ['d', 'D', 'ArrowRight'],
  moveUp: ['q', 'Q'],
  moveDown: ['e', 'E'],
  resetCamera: ['r', 'R', 'Home'],
} as const;

// Pre-allocated vectors
const moveDirection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const cameraRight = new THREE.Vector3();

interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/**
 * Keyboard navigation hook for camera movement.
 * - WASD for horizontal movement
 * - Q/E for vertical movement
 * - R or Home to reset camera
 * - Arrow keys as alternative for WASD
 *
 * Disabled when typing in input fields.
 */
export function useKeyboardNavigation() {
  const { camera, invalidate } = useThree();
  const keyState = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });
  const isMoving = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const animationFrameRef = useRef<number | null>(null);

  // Check if user is typing in an input field
  const isTyping = useCallback(() => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      activeElement.getAttribute('contenteditable') === 'true'
    );
  }, []);

  // Get resetCamera function from store (injected by CameraController)
  const resetCamera = useCallback(() => {
    const store = useAppStore.getState() as unknown as Record<string, unknown>;
    if (typeof store.resetCamera === 'function') {
      (store.resetCamera as () => void)();
    }
  }, []);

  // Animation loop for smooth movement
  const animate = useCallback(() => {
    const now = performance.now();
    const delta = (now - lastTimeRef.current) / 1000; // Convert to seconds
    lastTimeRef.current = now;

    const { forward, backward, left, right, up, down } = keyState.current;
    const anyKeyPressed = forward || backward || left || right || up || down;

    if (!anyKeyPressed) {
      isMoving.current = false;
      return;
    }

    isMoving.current = true;

    // Calculate movement direction relative to camera
    moveDirection.set(0, 0, 0);

    // Get camera's forward direction (without Y component for horizontal movement)
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    // Get camera's right direction
    cameraRight.crossVectors(cameraDirection, camera.up).normalize();

    // Accumulate movement
    if (forward) moveDirection.add(cameraDirection);
    if (backward) moveDirection.sub(cameraDirection);
    if (right) moveDirection.add(cameraRight);
    if (left) moveDirection.sub(cameraRight);
    if (up) moveDirection.y += 1;
    if (down) moveDirection.y -= 1;

    // Normalize and apply speed
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
      moveDirection.multiplyScalar(MOVE_SPEED * delta);

      // Move camera
      camera.position.add(moveDirection);

      // Request re-render
      invalidate();
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [camera, invalidate]);

  // Start animation loop when movement starts
  const startMoving = useCallback(() => {
    if (!isMoving.current) {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  // Handle key down
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isTyping()) return;

      const key = event.key;

      // Check for reset
      if (KEY_BINDINGS.resetCamera.includes(key as 'r' | 'R' | 'Home')) {
        event.preventDefault();
        resetCamera();
        return;
      }

      // Check for movement keys
      let handled = false;

      if (KEY_BINDINGS.moveForward.includes(key as 'w')) {
        keyState.current.forward = true;
        handled = true;
      }
      if (KEY_BINDINGS.moveBackward.includes(key as 's')) {
        keyState.current.backward = true;
        handled = true;
      }
      if (KEY_BINDINGS.moveLeft.includes(key as 'a')) {
        keyState.current.left = true;
        handled = true;
      }
      if (KEY_BINDINGS.moveRight.includes(key as 'd')) {
        keyState.current.right = true;
        handled = true;
      }
      if (KEY_BINDINGS.moveUp.includes(key as 'q')) {
        keyState.current.up = true;
        handled = true;
      }
      if (KEY_BINDINGS.moveDown.includes(key as 'e')) {
        keyState.current.down = true;
        handled = true;
      }

      if (handled) {
        event.preventDefault();
        startMoving();
      }
    },
    [isTyping, resetCamera, startMoving]
  );

  // Handle key up
  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key;

      if (KEY_BINDINGS.moveForward.includes(key as 'w')) {
        keyState.current.forward = false;
      }
      if (KEY_BINDINGS.moveBackward.includes(key as 's')) {
        keyState.current.backward = false;
      }
      if (KEY_BINDINGS.moveLeft.includes(key as 'a')) {
        keyState.current.left = false;
      }
      if (KEY_BINDINGS.moveRight.includes(key as 'd')) {
        keyState.current.right = false;
      }
      if (KEY_BINDINGS.moveUp.includes(key as 'q')) {
        keyState.current.up = false;
      }
      if (KEY_BINDINGS.moveDown.includes(key as 'e')) {
        keyState.current.down = false;
      }
    },
    []
  );

  // Handle window blur (release all keys)
  const handleBlur = useCallback(() => {
    keyState.current = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
    };
    isMoving.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);
}
