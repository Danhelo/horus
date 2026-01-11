# TRJ-001: Trajectory View

| Field | Value |
|-------|-------|
| **Spec ID** | TRJ-001 |
| **Phase** | 2 - Interactive Explorer |
| **Status** | Draft |
| **Package** | `@horus/frontend` |

## Summary

Implement the trajectory view - a visualization showing how text moves through ideaspace token by token. Text is not static; it's a journey. Each token activates different features, tracing a path through the graph. Users can scrub through the text to see the path animate, compare trajectories of different texts, and understand the temporal structure of ideas.

## Requirements

### REQ-1: Trajectory Data Structure

```typescript
interface TrajectoryPoint {
  tokenIndex: number;
  token: string;                   // The actual token text
  activations: Map<string, number>; // nodeId -> activation strength
  position: [number, number, number]; // Weighted centroid in graph space
  timestamp?: number;              // For real-time generation
}

interface Trajectory {
  id: string;
  text: string;                    // Full source text
  points: TrajectoryPoint[];       // One per token
  metadata: {
    modelId: string;
    createdAt: string;
    color: string;                 // For multi-trajectory display
  };
}

interface TrajectoryStore {
  trajectories: Map<string, Trajectory>;
  activeTrajectoryId: string | null;
  playbackPosition: number;        // 0-1 normalized position
  isPlaying: boolean;
  playbackSpeed: number;           // Tokens per second

  // Actions
  addTrajectory: (text: string) => Promise<string>;
  removeTrajectory: (id: string) => void;
  setPlaybackPosition: (position: number) => void;
  play: () => void;
  pause: () => void;
}
```

**Acceptance Criteria:**
- [ ] Trajectory captures per-token activations
- [ ] Position computed as weighted centroid of active features
- [ ] Store supports multiple simultaneous trajectories
- [ ] Playback state managed in store

### REQ-2: Trajectory Path Rendering

Render the trajectory as a glowing path through the 3D graph.

**Visual Requirements:**
- Line connects trajectory points in sequence
- Line color matches trajectory color (gold for primary)
- Line opacity/thickness indicates activation intensity
- Current playback position shown as bright sphere
- Past path slightly dimmer than future path
- Smooth curved interpolation between points (CatmullRom spline)

```typescript
interface TrajectoryRendererProps {
  trajectory: Trajectory;
  currentPosition: number;         // 0-1 normalized
  showFullPath: boolean;           // Show entire path or only up to current
  lineWidth: number;               // Base line width
  glowIntensity: number;           // 0-1
}
```

**Acceptance Criteria:**
- [ ] Path renders as smooth 3D curve through graph
- [ ] Current position indicator (glowing sphere)
- [ ] Path segments before/after current position visually distinct
- [ ] Performance: 60fps with 1000+ point trajectories

### REQ-3: Timeline Scrubber

Horizontal timeline control synchronized with trajectory playback.

**Visual Requirements:**
- Timeline bar showing full text extent
- Token markers as tick marks
- Current position indicator (draggable)
- Waveform-like visualization of activation intensity over time
- Text preview on hover (show token at hovered position)

**Interaction:**
- Drag scrubber to seek
- Click anywhere on timeline to jump
- Scroll wheel for fine adjustment
- Space bar to play/pause
- Arrow keys for frame-by-frame

```typescript
interface TimelineProps {
  trajectory: Trajectory;
  position: number;
  onPositionChange: (position: number) => void;
  onPlay: () => void;
  onPause: () => void;
  isPlaying: boolean;
}
```

**Acceptance Criteria:**
- [ ] Scrubber moves smoothly during playback
- [ ] Dragging scrubber updates graph in real-time
- [ ] Token text visible on hover
- [ ] Keyboard controls work when focused

### REQ-4: Spectrogram View

2D visualization: time on x-axis, features on y-axis, intensity as color.

```
Features (y)
    │ ██░░░░██████░░░░░░  Feature A
    │ ░░████░░░░░░██████  Feature B
    │ ██████████░░░░░░░░  Feature C
    └────────────────────→ Tokens (x)
```

**Visual Requirements:**
- Compact 2D heatmap
- Gold color scale for activation intensity
- Feature labels on y-axis (scrollable if many)
- Token text on x-axis (show on hover)
- Current position as vertical line
- Click to seek

```typescript
interface SpectrogramProps {
  trajectory: Trajectory;
  features: string[];              // Which features to show (top N by activation)
  maxFeatures: number;             // Limit visible rows
  position: number;
  onPositionChange: (position: number) => void;
  onFeatureClick: (featureId: string) => void;
}
```

**Acceptance Criteria:**
- [ ] Spectrogram shows top-N most active features
- [ ] Clicking cell navigates to that token/feature
- [ ] Synchronized with 3D graph and timeline
- [ ] Canvas-based rendering for performance

### REQ-5: Multi-Trajectory Comparison

Support displaying multiple trajectories simultaneously for comparison.

**Visual Requirements:**
- Each trajectory has distinct color
- Legend showing trajectory names/colors
- Opacity controls per trajectory
- "Diff mode" highlighting divergence points

```typescript
interface TrajectoryComparisonProps {
  trajectoryIds: string[];         // Up to 4 trajectories
  syncedPlayback: boolean;         // All trajectories play together
  showDivergence: boolean;         // Highlight where paths differ
}
```

**Divergence Calculation:**
```typescript
function computeDivergence(t1: Trajectory, t2: Trajectory): DivergenceMap {
  // For each token position, compute:
  // - Euclidean distance between centroids
  // - Cosine similarity of activation vectors
  // Return positions where divergence exceeds threshold
}
```

**Acceptance Criteria:**
- [ ] Up to 4 trajectories visible simultaneously
- [ ] Distinct colors for each trajectory
- [ ] Synced playback option
- [ ] Divergence highlighting shows where texts differ

### REQ-6: Real-Time Generation Trajectory

When text is being generated, show the trajectory extending in real-time.

**Behavior:**
- New points appear as tokens generate
- Path animates smoothly to new positions
- Automatic follow mode (camera tracks current position)
- Optional: show "frontier" of likely next positions

```typescript
interface GenerationTrajectoryProps {
  trajectory: Trajectory;
  isGenerating: boolean;
  followMode: boolean;             // Camera follows generation
}
```

**Acceptance Criteria:**
- [ ] New trajectory points animate in during generation
- [ ] Smooth path extension (not jarring jumps)
- [ ] Follow mode keeps current position centered
- [ ] Generation can be paused/resumed

## Technical Notes

- Use Three.js `TubeGeometry` or `Line2` for path rendering
- Spline interpolation via `THREE.CatmullRomCurve3`
- Spectrogram: WebGL canvas or `<canvas>` with 2D context
- Cache trajectory computations - only recompute on text change
- Consider Web Workers for trajectory analysis (divergence, etc.)
- Position computation: weighted average of node positions by activation

```typescript
function computeCentroid(activations: Map<string, number>, nodes: GraphData): [number, number, number] {
  let sumX = 0, sumY = 0, sumZ = 0, totalWeight = 0;
  for (const [nodeId, activation] of activations) {
    const node = nodes.get(nodeId);
    if (node && activation > 0.1) {  // Threshold
      sumX += node.position[0] * activation;
      sumY += node.position[1] * activation;
      sumZ += node.position[2] * activation;
      totalWeight += activation;
    }
  }
  return totalWeight > 0
    ? [sumX / totalWeight, sumY / totalWeight, sumZ / totalWeight]
    : [0, 0, 0];
}
```

## Dependencies

- [GRAPH-003](../phase-1/GRAPH-003-renderer.md) - Graph renderer integration
- [ACT-001](../phase-1/ACT-001-display.md) - Activation data format
- [STA-001](../shared/STA-001-state.md) - Zustand store architecture
- [UI-001](../shared/UI-001-design.md) - Design system (gold color scale)

## Open Questions

1. How do we aggregate activations across layers for position computation?
2. Should spectrogram show all layers or just one?
3. What's the maximum trajectory length before performance issues?
4. How do we align trajectories of different lengths for comparison?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
