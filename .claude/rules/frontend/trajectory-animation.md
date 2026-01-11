# Trajectory Animation Patterns

## Overview

Trajectories visualize text as a path through ideaspace. Each token activates features, and the trajectory shows this journey token-by-token. Users can play/pause, scrub, and see text come alive as concepts light up in sequence.

---

## Data Flow

```
Text Input → Neuronpedia Activations → Trajectory Points → 3D Path + Timeline
```

```typescript
interface TrajectoryPoint {
  tokenIndex: number;
  token: string;
  activations: Map<string, number>;  // featureId -> activation
  position: [number, number, number]; // Weighted centroid
  timestamp?: number;                 // For real-time generation
}

interface Trajectory {
  id: string;
  text: string;
  points: TrajectoryPoint[];
  color: string;
  metadata: {
    modelId: string;
    createdAt: string;
  };
}
```

---

## Position Computation

Compute trajectory position as weighted centroid of active features:

```typescript
function computeCentroid(
  activations: Map<string, number>,
  nodePositions: Map<string, [number, number, number]>,
  threshold = 0.1
): [number, number, number] {
  let sumX = 0, sumY = 0, sumZ = 0;
  let totalWeight = 0;

  for (const [featureId, activation] of activations) {
    if (activation < threshold) continue;

    const pos = nodePositions.get(featureId);
    if (!pos) continue;

    sumX += pos[0] * activation;
    sumY += pos[1] * activation;
    sumZ += pos[2] * activation;
    totalWeight += activation;
  }

  if (totalWeight === 0) {
    return [0, 0, 0];
  }

  return [
    sumX / totalWeight,
    sumY / totalWeight,
    sumZ / totalWeight,
  ];
}
```

---

## Playback State Machine

```typescript
type PlaybackState = 'idle' | 'playing' | 'paused' | 'seeking';

interface TrajectoryPlayback {
  state: PlaybackState;
  position: number;         // 0-1 normalized
  tokenIndex: number;       // Current discrete token
  speed: number;            // Tokens per second
  direction: 1 | -1;        // Forward or reverse

  // Actions
  play: () => void;
  pause: () => void;
  seek: (position: number) => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

const createTrajectoryPlayback = (trajectory: Trajectory): TrajectoryPlayback => {
  let state: PlaybackState = 'idle';
  let position = 0;
  let speed = 2;  // 2 tokens per second
  let animationFrame: number | null = null;
  let lastTime = 0;

  const animate = (currentTime: number) => {
    if (state !== 'playing') return;

    const delta = (currentTime - lastTime) / 1000;  // seconds
    lastTime = currentTime;

    const tokensAdvanced = delta * speed;
    const positionDelta = tokensAdvanced / trajectory.points.length;

    position = Math.min(1, Math.max(0, position + positionDelta));

    if (position >= 1) {
      state = 'paused';
      return;
    }

    updateVisualization(position);
    animationFrame = requestAnimationFrame(animate);
  };

  return {
    get state() { return state; },
    get position() { return position; },
    get tokenIndex() { return Math.floor(position * trajectory.points.length); },
    get speed() { return speed; },
    direction: 1,

    play: () => {
      if (state === 'playing') return;
      state = 'playing';
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(animate);
    },

    pause: () => {
      state = 'paused';
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    },

    seek: (newPosition: number) => {
      position = Math.min(1, Math.max(0, newPosition));
      updateVisualization(position);
    },

    setSpeed: (newSpeed: number) => {
      speed = Math.max(0.5, Math.min(10, newSpeed));
    },

    stepForward: () => {
      const newIndex = Math.min(
        trajectory.points.length - 1,
        Math.floor(position * trajectory.points.length) + 1
      );
      position = newIndex / trajectory.points.length;
      updateVisualization(position);
    },

    stepBackward: () => {
      const newIndex = Math.max(
        0,
        Math.floor(position * trajectory.points.length) - 1
      );
      position = newIndex / trajectory.points.length;
      updateVisualization(position);
    },
  };
};
```

---

## 3D Path Rendering

Use Three.js `TubeGeometry` or `Line2` for smooth curves:

```typescript
import { extend, useFrame } from '@react-three/fiber';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';

extend({ Line2, LineMaterial, LineGeometry });

function TrajectoryPath({ trajectory, currentPosition }: TrajectoryPathProps) {
  const lineRef = useRef<Line2>(null);

  // Build spline from trajectory points
  const curve = useMemo(() => {
    const points = trajectory.points.map(p =>
      new THREE.Vector3(p.position[0], p.position[1], p.position[2])
    );
    return new THREE.CatmullRomCurve3(points);
  }, [trajectory]);

  // Sample curve for smooth rendering
  const positions = useMemo(() => {
    const samples = curve.getPoints(trajectory.points.length * 10);
    return samples.flatMap(p => [p.x, p.y, p.z]);
  }, [curve, trajectory.points.length]);

  // Update line colors based on playback position
  useFrame(() => {
    if (!lineRef.current) return;

    const geometry = lineRef.current.geometry as LineGeometry;
    const colors: number[] = [];

    const totalSegments = positions.length / 3;
    const currentSegment = Math.floor(currentPosition * totalSegments);

    for (let i = 0; i < totalSegments; i++) {
      if (i < currentSegment) {
        // Past: dimmed gold
        colors.push(0.5, 0.4, 0.1);
      } else if (i === currentSegment) {
        // Current: bright gold
        colors.push(1.0, 0.84, 0.0);
      } else {
        // Future: very dim
        colors.push(0.2, 0.2, 0.25);
      }
    }

    geometry.setColors(colors);
  });

  return (
    <line2 ref={lineRef}>
      <lineGeometry args={[positions]} />
      <lineMaterial
        color={0xffd700}
        linewidth={3}
        vertexColors
        resolution={[window.innerWidth, window.innerHeight]}
      />
    </line2>
  );
}
```

---

## Current Position Indicator

Glowing sphere at current trajectory position:

```typescript
function TrajectoryMarker({ trajectory, position }: TrajectoryMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);

  // Interpolate position along curve
  const currentPos = useMemo(() => {
    const points = trajectory.points.map(p =>
      new THREE.Vector3(...p.position)
    );
    const curve = new THREE.CatmullRomCurve3(points);
    return curve.getPointAt(position);
  }, [trajectory, position]);

  // Animate glow pulse
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.1;
      glowRef.current.scale.setScalar(scale * 0.5);
    }
  });

  return (
    <group position={currentPos}>
      {/* Core sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={0xffd700} />
      </mesh>
      {/* Glow sprite */}
      <sprite ref={glowRef} scale={[0.5, 0.5, 0.5]}>
        <spriteMaterial
          map={glowTexture}
          color={0xffd700}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
```

---

## Timeline Scrubber Component

```tsx
interface TimelineScrubberProps {
  trajectory: Trajectory;
  position: number;
  onPositionChange: (position: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

function TimelineScrubber({
  trajectory,
  position,
  onPositionChange,
  isPlaying,
  onPlayPause,
}: TimelineScrubberProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [hoveredToken, setHoveredToken] = useState<number | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newPosition = x / rect.width;
    onPositionChange(Math.max(0, Math.min(1, newPosition)));
  }, [onPositionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hoverPosition = x / rect.width;
    const tokenIndex = Math.floor(hoverPosition * trajectory.points.length);
    setHoveredToken(tokenIndex);
  }, [trajectory.points.length]);

  const currentToken = Math.floor(position * trajectory.points.length);

  return (
    <div className="timeline-scrubber">
      <button
        className="timeline-play-btn"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div
        ref={timelineRef}
        className="timeline-track"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredToken(null)}
      >
        {/* Activation waveform */}
        <svg className="timeline-waveform" viewBox="0 0 100 20" preserveAspectRatio="none">
          {trajectory.points.map((point, i) => {
            const maxActivation = Math.max(...point.activations.values());
            const height = Math.min(maxActivation * 2, 20);
            const x = (i / trajectory.points.length) * 100;
            return (
              <rect
                key={i}
                x={x}
                y={20 - height}
                width={100 / trajectory.points.length}
                height={height}
                fill={i <= currentToken ? '#d4af37' : '#2a2a2a'}
              />
            );
          })}
        </svg>

        {/* Playhead */}
        <div
          className="timeline-playhead"
          style={{ left: `${position * 100}%` }}
        />

        {/* Hover preview */}
        {hoveredToken !== null && (
          <div
            className="timeline-hover-preview"
            style={{ left: `${(hoveredToken / trajectory.points.length) * 100}%` }}
          >
            <span className="timeline-hover-token">
              {trajectory.points[hoveredToken]?.token}
            </span>
          </div>
        )}
      </div>

      <span className="timeline-position">
        {currentToken + 1} / {trajectory.points.length}
      </span>
    </div>
  );
}
```

---

## Keyboard Controls

```typescript
function useTrajectoryKeyboard(playback: TrajectoryPlayback) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no input is focused
      if (document.activeElement?.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          playback.state === 'playing' ? playback.pause() : playback.play();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            playback.seek(Math.min(1, playback.position + 0.1));
          } else {
            playback.stepForward();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            playback.seek(Math.max(0, playback.position - 0.1));
          } else {
            playback.stepBackward();
          }
          break;
        case 'Home':
          e.preventDefault();
          playback.seek(0);
          break;
        case 'End':
          e.preventDefault();
          playback.seek(1);
          break;
        case '+':
        case '=':
          playback.setSpeed(playback.speed + 0.5);
          break;
        case '-':
          playback.setSpeed(playback.speed - 0.5);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playback]);
}
```

---

## Real-Time Generation Animation

Animate new points appearing during generation:

```typescript
function useGenerationTrajectory() {
  const trajectoryRef = useRef<Trajectory>({
    id: crypto.randomUUID(),
    text: '',
    points: [],
    color: '#d4af37',
    metadata: { modelId: 'gemma-2-2b', createdAt: new Date().toISOString() },
  });

  const appendPoint = useCallback((point: TrajectoryPoint) => {
    trajectoryRef.current.points.push(point);
    trajectoryRef.current.text += point.token;

    // Animate the new segment
    animateNewSegment(point);
  }, []);

  return { trajectory: trajectoryRef.current, appendPoint };
}

function animateNewSegment(point: TrajectoryPoint) {
  // Smoothly extend the path to the new position
  // Use spring animation for organic feel

  const spring = {
    tension: 200,
    friction: 20,
  };

  // Animate from previous position to new
  // (Implementation depends on animation library - react-spring, framer-motion, etc.)
}
```

---

## Camera Follow Mode

Optionally follow the trajectory marker:

```typescript
function useCameraFollow(
  enabled: boolean,
  markerPosition: THREE.Vector3,
  cameraRef: React.RefObject<THREE.PerspectiveCamera>
) {
  useFrame(() => {
    if (!enabled || !cameraRef.current) return;

    const camera = cameraRef.current;
    const targetPosition = markerPosition.clone().add(new THREE.Vector3(0, 5, 10));

    // Smooth follow with damping
    camera.position.lerp(targetPosition, 0.05);
    camera.lookAt(markerPosition);
  });
}
```

---

## Multi-Trajectory Comparison

Display multiple trajectories with different colors:

```typescript
function TrajectoryComparison({ trajectories, syncedPlayback }: ComparisonProps) {
  const [positions, setPositions] = useState<Map<string, number>>(new Map());

  // Sync all trajectories to same relative position
  useEffect(() => {
    if (syncedPlayback) {
      const newPositions = new Map<string, number>();
      for (const t of trajectories) {
        newPositions.set(t.id, positions.get(trajectories[0].id) ?? 0);
      }
      setPositions(newPositions);
    }
  }, [syncedPlayback, trajectories]);

  return (
    <>
      {trajectories.map((trajectory, i) => (
        <TrajectoryPath
          key={trajectory.id}
          trajectory={trajectory}
          currentPosition={positions.get(trajectory.id) ?? 0}
          color={TRAJECTORY_COLORS[i]}
        />
      ))}
    </>
  );
}

const TRAJECTORY_COLORS = ['#d4af37', '#00bfff', '#ff6b6b', '#20b2aa'];
```

---

## Performance

1. **Memoize curve computation** - Only recompute when trajectory changes
2. **LOD for long trajectories** - Reduce sample points when zoomed out
3. **Instanced markers** - Use InstancedMesh for multi-trajectory
4. **Throttle position updates** - 30fps is sufficient for smooth playback
