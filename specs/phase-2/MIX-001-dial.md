# MIX-001: Dial Component

| Field | Value |
|-------|-------|
| **Spec ID** | MIX-001 |
| **Phase** | 2 - Interactive Explorer |
| **Status** | Draft |
| **Package** | `@horus/frontend` |

## Summary

Implement the Dial component - a knob-style control for manipulating feature strengths. Dials represent weighted sums of features (traces) and provide intuitive control over semantic dimensions like formality, abstractness, or emotional valence. When a dial is adjusted, its trace highlights in the graph and the steering vector updates accordingly.

## Requirements

### REQ-1: Dial Data Structure

```typescript
interface Dial {
  id: string;                      // Unique identifier
  label: string;                   // Display name ("Formality", "Abstractness")
  value: number;                   // Current value (-1 to 1 for bipolar, 0 to 1 for unipolar)
  defaultValue: number;            // Reset target
  polarity: 'bipolar' | 'unipolar';
  trace: DialTrace;                // Features this dial affects
  locked: boolean;                 // Prevent changes when true
}

interface DialTrace {
  features: Array<{
    nodeId: string;                // Graph node ID
    weight: number;                // Contribution weight (0-1)
  }>;
  color?: string;                  // Trace highlight color
}

interface DialGroup {
  id: string;
  label: string;                   // "Tone", "Style", "Content"
  dials: string[];                 // Dial IDs in this group
  collapsed: boolean;
}
```

**Acceptance Criteria:**
- [ ] Dial interface defined in `@horus/shared`
- [ ] DialTrace links dials to graph nodes
- [ ] Bipolar dials support negative values (e.g., formal <-> casual)
- [ ] Unipolar dials are 0-1 range (e.g., more/less technical)

### REQ-2: Dial Visual Component

The dial should feel like a professional audio mixing board control.

**Visual Requirements:**
- Circular knob with rotation indicator
- Gold accent color for active/hovered state
- Value display (numeric or visual arc)
- Label positioned below knob
- Lock icon overlay when locked
- Subtle glow effect proportional to activation level

**Interaction Requirements:**
- Drag vertically or rotationally to change value
- Double-click to reset to default
- Right-click context menu for lock/unlock/reset
- Scroll wheel for fine adjustment when focused
- Keyboard: arrow keys for adjustment when focused

```typescript
interface DialProps {
  dial: Dial;
  size?: 'sm' | 'md' | 'lg';       // 32px, 48px, 64px diameter
  onChange: (value: number) => void;
  onHover: (hovered: boolean) => void;
  disabled?: boolean;
}
```

**Acceptance Criteria:**
- [ ] Dial renders with gold-on-dark Egyptian aesthetic
- [ ] Smooth drag interaction with visual feedback
- [ ] Double-click resets to default value
- [ ] Scroll wheel adjusts value by 0.05 increments
- [ ] Keyboard navigation works (Tab, Arrow keys)
- [ ] Lock state visually distinct and prevents changes

### REQ-3: Trace Visualization

When a dial is hovered or actively being adjusted, its trace lights up in the graph.

```typescript
// In graph store
interface TraceHighlight {
  dialId: string;
  nodeIds: Set<string>;
  weights: Map<string, number>;    // Node ID -> weight
  active: boolean;
}
```

**Behavior:**
- On dial hover: trace highlights with 50% intensity
- On dial drag: trace highlights with 100% intensity
- Highlight intensity per node proportional to feature weight
- Trace color matches dial accent color
- Smooth fade in/out transitions (150ms)

**Acceptance Criteria:**
- [ ] Hovering dial highlights its trace in the graph
- [ ] Node glow intensity proportional to feature weight
- [ ] Trace deactivates smoothly when dial interaction ends
- [ ] Multiple traces can be active simultaneously (different colors)

### REQ-4: Dial Value Change Flow

```
User drags dial
    -> DialComponent.onChange(newValue)
    -> useMixerStore.setDialValue(id, value)
    -> useSteeringStore.updateSteeringVector()
    -> If auto-generate enabled: trigger generation
```

**Acceptance Criteria:**
- [ ] Dial changes update Zustand store
- [ ] Store changes trigger steering vector recalculation
- [ ] Debounce dial changes (100ms) before triggering generation
- [ ] Changes are added to undo history

### REQ-5: Mixer Panel Layout

```typescript
interface MixerPanelProps {
  groups: DialGroup[];
  position: 'left' | 'right' | 'bottom';
  collapsed?: boolean;
}
```

**Layout:**
- Collapsible panel with drag handle
- Groups are expandable sections
- 2-4 dials per row depending on panel width
- Scroll for overflow
- "Add dial" button at bottom

**Acceptance Criteria:**
- [ ] Panel can be collapsed/expanded
- [ ] Groups organize dials into logical sections
- [ ] Responsive layout adjusts dial grid
- [ ] Panel position is user-configurable

### REQ-6: Default Dial Set

Provide a curated set of default dials for common use cases:

| Dial | Polarity | Description |
|------|----------|-------------|
| Formality | Bipolar | Casual <-> Formal |
| Abstractness | Bipolar | Concrete <-> Abstract |
| Emotional Valence | Bipolar | Negative <-> Positive |
| Complexity | Unipolar | Simple -> Complex |
| Creativity | Unipolar | Conventional -> Creative |
| Technical | Unipolar | General -> Technical |
| Brevity | Bipolar | Verbose <-> Concise |
| Certainty | Bipolar | Uncertain <-> Confident |

**Acceptance Criteria:**
- [ ] 8 default dials defined with feature mappings
- [ ] Dials use Neuronpedia feature search to populate traces
- [ ] Default dial set loads on first use
- [ ] Users can hide/show individual default dials

## Technical Notes

- Use `@radix-ui/react-slider` as base, heavily customized
- Dial rotation: map value to 270-degree arc (-135 to +135 from top)
- GPU-optimized trace highlighting via instanced mesh color updates
- Store dial configurations in localStorage for persistence
- Feature weights for dials can come from:
  - NMF clustering on feature embeddings
  - LLM-assisted semantic grouping
  - User manual selection

## Dependencies

- [STA-001](../shared/STA-001-state.md) - Zustand store architecture
- [UI-001](../shared/UI-001-design.md) - Design system tokens
- [GRAPH-003](../phase-1/GRAPH-003-renderer.md) - Graph renderer for trace visualization
- [MIX-002](./MIX-002-steering.md) - Steering vector computation

## Open Questions

1. How do we handle dial value conflicts (e.g., boosting both "formal" and "casual")?
2. Should dial traces be computed client-side or fetched from backend?
3. Maximum number of active dials before performance degrades?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
