import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import type { Trajectory } from '@horus/shared';

// Pre-allocated color for performance
const tempColor = new THREE.Color();

// Gold color constants
const GOLD_BRIGHT = new THREE.Color('#d4af37');
const GOLD_DIM = new THREE.Color('#6b5918');
const GOLD_FUTURE = new THREE.Color('#2a230e');

interface TrajectoryPathProps {
  /** The trajectory to render */
  trajectory: Trajectory;
  /** Current playback position (0-1 normalized) */
  currentPosition: number;
  /** Path color (defaults to gold) */
  color?: string;
  /** Line width in pixels */
  lineWidth?: number;
  /** Number of samples along the curve (higher = smoother) */
  curveSamples?: number;
}

/**
 * Renders a trajectory as a 3D path through ideaspace.
 * Uses CatmullRomCurve3 for smooth spline interpolation.
 * Past segments are brighter than future segments.
 */
export function TrajectoryPath({
  trajectory,
  currentPosition,
  color = '#d4af37',
  lineWidth = 2,
  curveSamples = 100,
}: TrajectoryPathProps) {
  const lineRef = useRef<THREE.Line>(null);
  const { invalidate } = useThree();

  // Build the spline curve from trajectory points
  const { curve, pointCount } = useMemo(() => {
    if (trajectory.points.length < 2) {
      return { curve: null, pointCount: trajectory.points.length };
    }

    const curvePoints = trajectory.points.map(
      (p) => new THREE.Vector3(p.position[0], p.position[1], p.position[2])
    );

    return {
      curve: new THREE.CatmullRomCurve3(curvePoints),
      pointCount: trajectory.points.length,
    };
  }, [trajectory.points]);

  // Create geometry from sampled curve points
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    if (!curve) {
      // Single point or no points - create minimal geometry
      const positions = new Float32Array(3);
      const colors = new Float32Array(3);

      if (trajectory.points.length === 1) {
        const p = trajectory.points[0].position;
        positions[0] = p[0];
        positions[1] = p[1];
        positions[2] = p[2];
      }

      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geo;
    }

    // Sample points along the curve
    const sampleCount = Math.max(curveSamples, pointCount * 5);
    const positions = new Float32Array(sampleCount * 3);
    const colors = new Float32Array(sampleCount * 3);

    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1);
      const point = curve.getPointAt(t);

      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Initialize with base color
      tempColor.set(color);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [curve, pointCount, curveSamples, color, trajectory.points]);

  // Update colors based on playback position
  useEffect(() => {
    if (!lineRef.current) return;

    const colorAttr = lineRef.current.geometry.attributes.color;
    if (!colorAttr) return;

    const colorArray = colorAttr.array as Float32Array;
    const sampleCount = colorArray.length / 3;

    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1);

      if (t < currentPosition) {
        // Past: bright gold
        tempColor.copy(GOLD_BRIGHT);
      } else if (Math.abs(t - currentPosition) < 0.02) {
        // Current: extra bright
        tempColor.setRGB(1.0, 0.84, 0.0);
      } else {
        // Future: dim gold
        tempColor.lerpColors(GOLD_DIM, GOLD_FUTURE, (t - currentPosition) * 2);
      }

      colorArray[i * 3] = tempColor.r;
      colorArray[i * 3 + 1] = tempColor.g;
      colorArray[i * 3 + 2] = tempColor.b;
    }

    colorAttr.needsUpdate = true;
    invalidate();
  }, [currentPosition, invalidate]);

  // Material for the line
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: lineWidth, // Note: linewidth only works on some systems
        transparent: true,
        opacity: 0.9,
      }),
    [lineWidth]
  );

  // Create a Three.js Line object
  const line = useMemo(() => {
    return new THREE.Line(geometry, material);
  }, [geometry, material]);

  // Update ref when line changes
  useEffect(() => {
    (lineRef as React.MutableRefObject<THREE.Line | null>).current = line;
  }, [line]);

  // Don't render if no points
  if (trajectory.points.length === 0) {
    return null;
  }

  return <primitive object={line} />;
}

/**
 * Multiple trajectory paths for comparison view.
 */
interface MultiTrajectoryPathsProps {
  trajectories: Trajectory[];
  positions: Map<string, number>; // trajectoryId -> position
  syncedPlayback?: boolean;
}

const TRAJECTORY_COLORS = [
  '#d4af37', // Gold (primary)
  '#00bfff', // Electric blue
  '#ff6b6b', // Coral
  '#20b2aa', // Teal
  '#9b59b6', // Purple
  '#ffa500', // Orange
];

export function MultiTrajectoryPaths({
  trajectories,
  positions,
  syncedPlayback = false,
}: MultiTrajectoryPathsProps) {
  // Get the first trajectory's position for synced playback
  const syncedPosition = syncedPlayback && trajectories.length > 0
    ? positions.get(trajectories[0].id) ?? 0
    : 0;

  return (
    <>
      {trajectories.map((trajectory, index) => (
        <TrajectoryPath
          key={trajectory.id}
          trajectory={trajectory}
          currentPosition={
            syncedPlayback ? syncedPosition : (positions.get(trajectory.id) ?? 0)
          }
          color={TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length]}
        />
      ))}
    </>
  );
}
