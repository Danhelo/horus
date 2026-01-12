# LIVE-001: Click-to-Steer

| Field       | Value                 |
| ----------- | --------------------- |
| **Spec ID** | LIVE-001              |
| **Phase**   | 3 - Dynamic Hierarchy |
| **Status**  | Draft                 |
| **Package** | `@horus/frontend`     |

## Summary

Enable users to click any node in the feature graph to add it to the active steering set. This is the core interaction that transforms the graph from a visualization into a control surface. Clicked features directly influence Gemma-2-2B's generation through Neuronpedia's steering API.

## Requirements

### REQ-1: Active Features Store

Track features the user has selected for steering.

```typescript
interface ActiveFeature {
  featureId: string; // "gemma-2-2b/12/2341"
  layer: number; // 12
  index: number; // 2341
  strength: number; // -10 to +10 (default: +2 on click)
  source: 'click' | 'dial' | 'group' | 'circuit';
  addedAt: number; // Timestamp for ordering
}

interface ActiveFeaturesSlice {
  activeFeatures: Map<string, ActiveFeature>;

  // Actions
  addFeature: (featureId: string, strength?: number, source?: string) => void;
  removeFeature: (featureId: string) => void;
  setStrength: (featureId: string, strength: number) => void;
  clearAll: () => void;

  // Selectors
  getActiveFeatureIds: () => string[];
  getTotalStrength: () => number;
}
```

**Acceptance Criteria:**

- [ ] Active features stored with strength and metadata
- [ ] Add/remove operations update in <10ms
- [ ] Maximum 50 active features (prevent overwhelming steering)
- [ ] Persists across component remounts (Zustand)

### REQ-2: Click Handler Enhancement

Modify `NodeMesh.tsx` click handler to add features to steering.

```typescript
// In NodeMesh.tsx handleClick
const handleClick = (event: ThreeEvent<MouseEvent>) => {
  const nodeId = getNodeIdFromInstanceId(event.instanceId);

  if (event.shiftKey) {
    // Multi-select: toggle in selection
    toggleNodeSelection(nodeId);
  } else {
    // Single click: add to active features for steering
    const isActive = activeFeatures.has(nodeId);

    if (isActive) {
      removeFeature(nodeId);
    } else {
      addFeature(nodeId, 2.0, 'click'); // Default strength +2
    }
  }

  // Always open details panel
  selectNodes([nodeId]);
  focusOnNode(nodeId);
};
```

**Behavior:**

- Single click → Add to activeFeatures (or remove if already active)
- Shift+click → Multi-select (existing behavior)
- Right-click → Context menu (future: REQ-6)
- Double-click → Focus camera only (no steering change)

**Acceptance Criteria:**

- [ ] Click adds feature with default strength +2
- [ ] Click on active feature removes it
- [ ] Shift+click preserves multi-select behavior
- [ ] Click provides immediate visual feedback (<100ms)

### REQ-3: Visual Feedback for Active Features

Active features need distinct visual treatment.

```typescript
// In colors.ts
export const ACTIVE_FEATURE_COLOR = new THREE.Color('#00ffff'); // Cyan
export const ACTIVE_FEATURE_GLOW = 0.8; // Emissive intensity

// Color priority (highest to lowest):
// 1. Active (cyan) - features being steered
// 2. Selected (existing cyan) - for info panel
// 3. Hovered (red)
// 4. Activation-based (gold gradient)
// 5. Inactive (dark gray)
```

**Visual States:**
| State | Color | Additional Effect |
|-------|-------|-------------------|
| Active | Cyan (#00ffff) | Slight pulse animation |
| Active + Negative | Purple (#ff00ff) | Pulse animation |
| Active Strength | Size varies | Scale 1.0 + (strength \* 0.1) |

**Acceptance Criteria:**

- [ ] Active features visually distinct from selected/hovered
- [ ] Color indicates positive (cyan) vs negative (purple) steering
- [ ] Scale indicates steering strength
- [ ] Updates in same frame as click (no flicker)

### REQ-4: Quick Steering Panel

Popup panel when feature is clicked, allowing strength adjustment.

```typescript
interface QuickSteeringPanelProps {
  featureId: string;
  position: { x: number; y: number }; // Screen coordinates
  onClose: () => void;
}

// Panel contents:
// - Feature label (from Neuronpedia or "Feature #index")
// - Strength slider: -10 to +10
// - Polarity toggle: Amplify / Suppress
// - Remove button
// - "Add to Mixer" button (creates permanent dial)
```

**UI Mockup:**

```
┌──────────────────────────────┐
│ formal academic tone         │
│ Layer 12 • Feature #2341     │
├──────────────────────────────┤
│ Strength                     │
│ ━━━━━━━━●━━━━━━━━━━  +2.0   │
│ [-] ─────────────── [+]      │
├──────────────────────────────┤
│ [Remove]    [Add to Mixer]   │
└──────────────────────────────┘
```

**Acceptance Criteria:**

- [ ] Panel appears near clicked node (screen space)
- [ ] Slider allows -10 to +10 range
- [ ] Changes apply immediately (optimistic update)
- [ ] Panel closes on click outside or Escape
- [ ] Keyboard accessible (Tab, Enter, arrows)

### REQ-5: Debounced Generation Trigger

Active feature changes should trigger generation after debounce.

```typescript
// In useSteeringGeneration.ts
const useSteeringGeneration = () => {
  const activeFeatures = useAppStore((s) => s.activeFeatures);
  const dialVector = useAppStore((s) => s.steeringVector);
  const currentText = useAppStore((s) => s.currentText);

  // Combine active features + dial vector
  const combinedVector = useMemo(() => {
    return mergeSteeringVectors(activeFeatures, dialVector);
  }, [activeFeatures, dialVector]);

  // Debounced generation
  const debouncedGenerate = useDebouncedCallback(
    async () => {
      if (!currentText || combinedVector.features.length === 0) return;

      setGenerationStatus({ state: 'generating' });

      const stream = await generateWithSteering({
        prompt: currentText,
        steeringVector: combinedVector,
        stream: true,
      });

      for await (const event of stream) {
        // Handle streaming tokens
      }
    },
    2000 // 2 second debounce
  );

  // Trigger on activeFeatures or dialVector change
  useEffect(() => {
    if (autoGenerateEnabled) {
      setGenerationStatus({ state: 'pending', generatesIn: 2000 });
      debouncedGenerate();
    }
  }, [combinedVector, autoGenerateEnabled]);
};
```

**Acceptance Criteria:**

- [ ] Generation triggers 2s after last change
- [ ] Pending state shows countdown
- [ ] New changes reset the debounce timer
- [ ] Can disable auto-generate (manual mode)

### REQ-6: Context Menu (Future Enhancement)

Right-click shows advanced options.

```typescript
interface ContextMenuAction {
  label: string;
  icon: string;
  action: () => void;
  disabled?: boolean;
}

const contextMenuActions: ContextMenuAction[] = [
  { label: 'Amplify (+2)', action: () => addFeature(id, 2) },
  { label: 'Suppress (-2)', action: () => addFeature(id, -2) },
  { label: 'Add to Mixer as Dial', action: () => createDialFromFeature(id) },
  { label: 'Find Similar Features', action: () => searchSimilar(id) },
  { label: 'Trace Connections', action: () => traceCircuit(id) },
  { label: 'Copy Feature ID', action: () => copyToClipboard(id) },
];
```

**Note:** Implement in later iteration. Focus on click-to-steer first.

**Acceptance Criteria:**

- [ ] Right-click shows context menu
- [ ] Menu positioned near click point
- [ ] Keyboard shortcut alternatives (e.g., 'A' to amplify hovered)

## Technical Notes

### Merging Steering Sources

Active features and dial-based steering must merge:

```typescript
function mergeSteeringVectors(
  activeFeatures: Map<string, ActiveFeature>,
  dialVector: SteeringVector
): SteeringVector {
  const merged = new Map<string, number>();

  // Add dial features
  for (const feature of dialVector.features) {
    merged.set(feature.featureId, feature.strength);
  }

  // Add/override with active features
  for (const [id, feature] of activeFeatures) {
    const existing = merged.get(id) || 0;
    merged.set(id, existing + feature.strength);
  }

  // Clamp and sort
  return {
    features: Array.from(merged.entries())
      .map(([featureId, strength]) => ({
        featureId,
        ...parseFeatureId(featureId),
        strength: clamp(strength, -10, 10),
      }))
      .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))
      .slice(0, 100), // Max 100 features per request
    modelId: 'gemma-2-2b',
    timestamp: Date.now(),
  };
}
```

### Performance Considerations

- Active feature changes should NOT trigger React re-renders of NodeMesh
- Use Zustand subscription + direct buffer updates
- Color updates via `setColorAt()` + `needsUpdate = true`

```typescript
// In NodeMesh.tsx - subscribe to activeFeatures changes
useEffect(() => {
  const unsubscribe = useAppStore.subscribe(
    (state) => state.activeFeatures,
    (activeFeatures) => {
      // Update colors directly, no re-render
      updateNodeColors(meshRef.current, activeFeatures);
    }
  );
  return unsubscribe;
}, []);
```

## Dependencies

- [MIX-002](../phase-2/MIX-002-steering.md) - Steering vector structure
- [GEN-001](../phase-2/GEN-001-generation.md) - Generation endpoint
- [GRAPH-003](../phase-1/GRAPH-003-renderer.md) - NodeMesh component
- [LIVE-000](LIVE-000-master-plan.md) - Master plan context

## Open Questions

1. Should click strength be configurable (currently hardcoded to +2)?
2. How to handle conflicts when same feature is in dial AND clicked?
3. Should there be a "clear all active features" shortcut?
4. Maximum number of active features before warning?

## Changelog

| Date       | Changes       |
| ---------- | ------------- |
| 2025-01-11 | Initial draft |
