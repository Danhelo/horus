import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Perf } from 'r3f-perf';

import {
  NodeMesh,
  EdgeLines,
  LODController,
  CameraController,
  KeyboardController,
  TrajectoryPath,
  TrajectoryMarker,
} from './graph';
import { useAppStore } from '../stores';

/**
 * Active trajectory renderer component.
 * Renders the trajectory path and marker when a trajectory is active.
 */
function ActiveTrajectory() {
  const activeTrajectoryId = useAppStore((state) => state.activeTrajectoryId);
  const trajectories = useAppStore((state) => state.trajectories);
  const playbackPosition = useAppStore((state) => state.playbackPosition);

  // Get active trajectory
  const activeTrajectory = activeTrajectoryId
    ? trajectories.get(activeTrajectoryId)
    : null;

  if (!activeTrajectory || activeTrajectory.points.length === 0) {
    return null;
  }

  return (
    <group>
      <TrajectoryPath
        trajectory={activeTrajectory}
        currentPosition={playbackPosition}
      />
      <TrajectoryMarker
        trajectory={activeTrajectory}
        position={playbackPosition}
      />
    </group>
  );
}

export function GraphCanvas() {
  return (
    <Canvas
      camera={{
        position: [0, 0, 50],
        fov: 60,
        near: 0.1,
        far: 1000,
      }}
      dpr={[1, 2]}
      frameloop="demand"
      gl={{
        antialias: true,
        alpha: false,
      }}
    >
      {/* Performance monitor in dev mode */}
      {import.meta.env.DEV && <Perf position="top-left" />}

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.6} />

      {/* Camera controls with sync & animations */}
      <CameraController />

      {/* Keyboard navigation (WASD + Q/E) */}
      <KeyboardController />

      {/* Scene background */}
      <color attach="background" args={['#0a0a0f']} />

      {/* LOD Controller - monitors camera distance */}
      <LODController />

      {/* Graph content */}
      <Suspense fallback={null}>
        <EdgeLines />
        <NodeMesh />
        <ActiveTrajectory />
      </Suspense>
    </Canvas>
  );
}
