import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import type { Trajectory } from '@horus/shared';
import { interpolateTrajectoryPosition } from '../../utils';

// Pre-allocated objects for useFrame performance
const tempVec = new THREE.Vector3();

interface TrajectoryMarkerProps {
  /** The trajectory this marker is on */
  trajectory: Trajectory;
  /** Current playback position (0-1 normalized) */
  position: number;
  /** Marker color (defaults to gold) */
  color?: string;
  /** Base size of the marker sphere */
  size?: number;
  /** Enable glow pulse animation */
  enablePulse?: boolean;
}

/**
 * A glowing sphere marker that shows the current position along a trajectory.
 * Animates with a subtle pulse effect for visibility.
 */
export function TrajectoryMarker({
  trajectory,
  position,
  color = '#d4af37',
  size = 0.3,
  enablePulse = true,
}: TrajectoryMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();

  // Calculate current 3D position along the trajectory
  const currentPos = useMemo(() => {
    if (trajectory.points.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    const [x, y, z] = interpolateTrajectoryPosition(trajectory.points, position);
    return new THREE.Vector3(x, y, z);
  }, [trajectory.points, position]);

  // Material for the core sphere
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 1.0,
      }),
    [color]
  );

  // Material for the outer glow
  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
      }),
    [color]
  );

  // Sphere geometry
  const sphereGeometry = useMemo(
    () => new THREE.SphereGeometry(size, 16, 16),
    [size]
  );

  const glowGeometry = useMemo(
    () => new THREE.SphereGeometry(size * 2, 16, 16),
    [size]
  );

  // Animate pulse effect
  useFrame(({ clock }) => {
    if (!enablePulse) return;

    if (glowRef.current) {
      // Subtle breathing animation
      const pulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.15;
      glowRef.current.scale.setScalar(pulse);

      // Fade the glow opacity
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
      glowMat.opacity = 0.2 + Math.sin(clock.elapsedTime * 3) * 0.1;
    }

    if (meshRef.current) {
      // Subtle core pulse
      const corePulse = 1 + Math.sin(clock.elapsedTime * 3) * 0.05;
      meshRef.current.scale.setScalar(corePulse);
    }

    invalidate();
  });

  // Don't render if trajectory is empty
  if (trajectory.points.length === 0) {
    return null;
  }

  return (
    <group position={currentPos}>
      {/* Core sphere */}
      <mesh ref={meshRef} geometry={sphereGeometry} material={coreMaterial} />

      {/* Outer glow */}
      <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial} />
    </group>
  );
}

/**
 * Token label that follows the trajectory marker.
 * Shows the current token text near the marker.
 */
interface TrajectoryLabelProps {
  trajectory: Trajectory;
  position: number;
  showToken?: boolean;
}

export function TrajectoryLabel({
  trajectory,
  position,
  showToken = true,
}: TrajectoryLabelProps) {
  // TODO: Implement using drei's Text or Html component
  // For now, just return null - label rendering will be added
  // when drei dependencies are confirmed
  return null;
}

/**
 * Combined trajectory visualization with path, marker, and optional label.
 */
interface TrajectoryVisualizationProps {
  trajectory: Trajectory;
  position: number;
  color?: string;
  showPath?: boolean;
  showMarker?: boolean;
  showLabel?: boolean;
}

export function TrajectoryVisualization({
  trajectory,
  position,
  color = '#d4af37',
  showPath = true,
  showMarker = true,
  showLabel = false,
}: TrajectoryVisualizationProps) {
  // Import TrajectoryPath here to avoid circular imports
  // The actual path rendering is handled by TrajectoryPath component

  return (
    <group>
      {showMarker && (
        <TrajectoryMarker
          trajectory={trajectory}
          position={position}
          color={color}
        />
      )}
      {showLabel && (
        <TrajectoryLabel trajectory={trajectory} position={position} />
      )}
    </group>
  );
}
