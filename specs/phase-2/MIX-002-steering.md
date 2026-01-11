# MIX-002: Steering Vector

| Field | Value |
|-------|-------|
| **Spec ID** | MIX-002 |
| **Phase** | 2 - Interactive Explorer |
| **Status** | Draft |
| **Package** | `@horus/shared` |

## Summary

Define the steering vector data structure and computation logic. A steering vector represents the cumulative effect of all active dials, translating high-level dial positions into feature-level interventions that can be sent to the Neuronpedia steering API. This is the bridge between user intent (dial positions) and model behavior (feature clamping).

## Requirements

### REQ-1: Steering Vector Structure

```typescript
interface SteeringVector {
  features: Array<{
    source: string;              // Neuronpedia source ID (e.g., "12-gemmascope-res-16k")
    index: number;               // Feature index within source
    strength: number;            // -1 to 1 (negative = suppress, positive = amplify)
  }>;
  modelId: string;               // Target model (e.g., "gemma-2-2b")
  timestamp: number;             // When computed
}

interface SteeringConfig {
  method: 'SIMPLE_ADDITIVE';     // Neuronpedia steering method
  maxFeatures: number;           // Limit features in vector (default: 20)
  strengthMultiplier: number;    // Scale factor for all strengths (default: 1.0)
  clampRange: [number, number];  // Min/max strength values (default: [-2, 2])
}
```

**Acceptance Criteria:**
- [ ] SteeringVector interface defined in `@horus/shared`
- [ ] Compatible with Neuronpedia `/api/steer` request format
- [ ] Configurable limits on feature count and strength range

### REQ-2: Vector Computation from Dials

```typescript
function computeSteeringVector(
  dials: Dial[],
  config: SteeringConfig
): SteeringVector;
```

**Algorithm:**
1. For each dial with non-zero value:
   - Multiply each feature weight by dial value
   - Add to cumulative feature map
2. If same feature appears in multiple dials:
   - Sum the contributions (can exceed 1.0)
3. Clamp total strength to configured range
4. Sort by absolute strength, take top N features
5. Return sparse vector with only significant features

**Example:**
```typescript
// Dial "Formality" at 0.8 with trace:
//   feat_1234: weight 0.5
//   feat_5678: weight 0.3

// Dial "Technical" at 0.5 with trace:
//   feat_1234: weight 0.2  (overlaps!)
//   feat_9999: weight 0.4

// Result:
// feat_1234: 0.8 * 0.5 + 0.5 * 0.2 = 0.5
// feat_5678: 0.8 * 0.3 = 0.24
// feat_9999: 0.5 * 0.4 = 0.2
```

**Acceptance Criteria:**
- [ ] Vector correctly aggregates multiple dial contributions
- [ ] Overlapping features sum their strengths
- [ ] Strength values clamped to configured range
- [ ] Only top-N features included (configurable)
- [ ] Zero-value dials contribute nothing

### REQ-3: Steering Store Integration

```typescript
interface SteeringStore {
  vector: SteeringVector | null;
  config: SteeringConfig;
  isStale: boolean;               // True when dials changed but vector not recomputed

  // Actions
  recompute: () => void;
  setConfig: (config: Partial<SteeringConfig>) => void;
  clear: () => void;
}
```

**Behavior:**
- Vector recomputes when any dial value changes
- Debounce recomputation (50ms) to batch rapid changes
- Mark as stale immediately on dial change
- Clear vector when all dials reset to zero

**Acceptance Criteria:**
- [ ] Store exposes current steering vector
- [ ] Automatic recomputation on dial changes
- [ ] Stale flag for UI feedback during computation
- [ ] Config changes trigger recomputation

### REQ-4: Dial Conflict Detection

When dials have opposing effects, detect and surface conflicts.

```typescript
interface DialConflict {
  dialIds: [string, string];
  conflictingFeatures: Array<{
    featureId: string;
    contributions: [number, number];  // Opposing signs
  }>;
  severity: 'low' | 'medium' | 'high';  // Based on magnitude
}

function detectConflicts(dials: Dial[]): DialConflict[];
```

**Conflict Severity:**
- Low: < 0.3 net cancellation
- Medium: 0.3 - 0.6 net cancellation
- High: > 0.6 net cancellation

**Acceptance Criteria:**
- [ ] Detect when dial traces have opposing contributions
- [ ] Calculate severity based on cancellation magnitude
- [ ] Return list of conflicts for UI display
- [ ] Conflicts don't prevent steering (just warn)

### REQ-5: Vector Serialization

For saving/sharing steering configurations:

```typescript
interface SerializedSteeringState {
  version: 1;
  dials: Array<{
    id: string;
    value: number;
  }>;
  config: SteeringConfig;
}

function serializeSteeringState(store: SteeringStore, mixerStore: MixerStore): string;
function deserializeSteeringState(json: string): SerializedSteeringState;
```

**Acceptance Criteria:**
- [ ] Serialize dial values (not computed vector)
- [ ] Include config for reproducibility
- [ ] Version field for future compatibility
- [ ] Compact JSON output

### REQ-6: Neuronpedia API Integration

```typescript
interface SteerRequest {
  modelId: string;
  features: Array<{
    source: string;
    index: number;
    strength: number;
  }>;
  prompt: string;
  method: 'SIMPLE_ADDITIVE';
  temperature?: number;
  maxTokens?: number;
}

interface SteerResponse {
  text: string;
  tokens: string[];
  activations?: ActivationData;  // If requested
}
```

**Acceptance Criteria:**
- [ ] SteeringVector converts to Neuronpedia request format
- [ ] Validate steering vector before API call
- [ ] Handle API errors gracefully (rate limits, invalid features)

## Technical Notes

- Feature source format: `${layer}-gemmascope-res-16k` for Gemma-2-2B
- Neuronpedia steering uses "SIMPLE_ADDITIVE" method
- Strength range [-2, 2] recommended by Neuronpedia
- Consider caching computed vectors for undo/redo
- Vector should be immutable once computed

## Dependencies

- [MIX-001](./MIX-001-dial.md) - Dial component and data structures
- [API-001](../phase-1/API-001-neuronpedia.md) - Neuronpedia client
- [STA-001](../shared/STA-001-state.md) - Zustand store architecture

## Open Questions

1. How do we handle features from different layers? Weight by layer importance?
2. Should we support non-linear dial response curves?
3. Cache steering vectors for common dial combinations?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
