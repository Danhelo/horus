import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import { useAppStore, type LODLevel } from '../../stores';

// LOD distance thresholds with hysteresis to prevent flickering
const LOD_THRESHOLDS = {
  // When moving outward (zooming out)
  nearToMedium: 25,
  mediumToFar: 55,
  // When moving inward (zooming in)
  farToMedium: 50,
  mediumToNear: 20,
} as const;

/**
 * Headless component that monitors camera distance and updates LOD state.
 * Uses hysteresis (different thresholds for zooming in vs out) to prevent
 * flickering at LOD boundaries.
 */
export function LODController() {
  const setLod = useAppStore((s) => s.setLod);
  const lodRef = useRef<LODLevel>('medium');

  useFrame(({ camera }) => {
    // Distance from camera to origin (graph center)
    const distance = camera.position.length();

    let newLod: LODLevel;

    // Apply hysteresis based on current LOD level
    if (lodRef.current === 'near') {
      // Currently near - only switch to medium at higher threshold
      newLod = distance > LOD_THRESHOLDS.nearToMedium ? 'medium' : 'near';
    } else if (lodRef.current === 'medium') {
      // Currently medium - use different thresholds for in/out
      if (distance < LOD_THRESHOLDS.mediumToNear) {
        newLod = 'near';
      } else if (distance > LOD_THRESHOLDS.mediumToFar) {
        newLod = 'far';
      } else {
        newLod = 'medium';
      }
    } else {
      // Currently far - only switch to medium at lower threshold
      newLod = distance < LOD_THRESHOLDS.farToMedium ? 'medium' : 'far';
    }

    // Only update store if LOD actually changed
    if (newLod !== lodRef.current) {
      lodRef.current = newLod;
      setLod(newLod);
    }
  });

  // Headless component - no visual output
  return null;
}
