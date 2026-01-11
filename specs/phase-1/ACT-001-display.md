# ACT-001: Activation Display

| Field | Value |
|-------|-------|
| **Spec ID** | ACT-001 |
| **Phase** | 1 - Static Viewer |
| **Status** | Complete |
| **Package** | `@horus/frontend` |

## Summary

Display detailed information about selected nodes/features in a sidebar panel. Show activation values, feature explanations from Neuronpedia, top activating examples, and related features. Handle loading states gracefully to maintain flow.

## Requirements

### REQ-1: Sidebar Panel Layout

Create a collapsible sidebar panel for displaying node details.

```typescript
function ActivationPanel() {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const isPanelOpen = useAppStore((s) => s.panelsOpen.activation);

  if (!isPanelOpen) return null;

  return (
    <aside className="absolute right-0 top-0 h-full w-80 bg-gray-900/95 backdrop-blur border-l border-gray-700 overflow-y-auto">
      <PanelHeader onClose={() => useAppStore.getState().togglePanel('activation')} />
      {selectedNodeId ? (
        <FeatureDetails nodeId={selectedNodeId} />
      ) : (
        <EmptyState message="Select a node to see details" />
      )}
    </aside>
  );
}
```

**Acceptance Criteria:**
- [x] Panel positioned on right side of viewport
- [x] Panel is collapsible/toggleable via header button
- [x] Panel has dark theme matching cosmic aesthetic
- [x] Panel scrolls independently of graph canvas
- [x] Panel width is fixed (320px) but content wraps
- [x] Shows empty state when no node selected

### REQ-2: Feature Basic Info Display

Show core feature information immediately from local data.

```typescript
interface FeatureBasicInfo {
  id: string;
  modelId: string;
  layer: number;
  index: number;
  label?: string;
  category?: string;
}

function FeatureHeader({ feature }: { feature: FeatureBasicInfo }) {
  return (
    <div className="p-4 border-b border-gray-700">
      <h2 className="text-lg font-medium text-gold-400">
        {feature.label || `Feature ${feature.index}`}
      </h2>
      <p className="text-sm text-gray-400">
        Layer {feature.layer} | Index {feature.index}
      </p>
      {feature.category && (
        <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-800 rounded">
          {feature.category}
        </span>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [x] Shows feature label (or "Feature {index}" if no label)
- [x] Displays layer and index information
- [x] Shows category tag if available
- [x] Basic info renders instantly (no loading delay)
- [x] Typography follows design system (sacred gold accents)

### REQ-3: Activation Value Display

Show the current activation value for the selected feature.

```typescript
function ActivationValue({ nodeId }: { nodeId: string }) {
  const activation = useAppStore((s) => s.activations?.get(nodeId) ?? 0);

  return (
    <div className="p-4 border-b border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Current Activation</h3>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-800 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-gold-400 transition-all duration-200"
            style={{ width: `${activation * 100}%` }}
          />
        </div>
        <span className="text-lg font-mono text-gold-400">
          {activation.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [x] Shows activation as progress bar and numeric value
- [x] Progress bar uses gold gradient matching graph colors
- [x] Value updates in real-time when activations change
- [x] Shows 0.000 when feature is not activated
- [x] Transition animation on value changes (200ms)

### REQ-4: Neuronpedia Feature Details

Fetch and display extended feature information from Neuronpedia API.

```typescript
interface NeuronpediaFeature {
  description?: string;
  explanations?: Array<{
    description: string;
    score: number;
  }>;
  topLogits?: Array<{
    token: string;
    value: number;
  }>;
  examples?: Array<{
    text: string;
    activations: number[];
  }>;
}

function FeatureExplanation({ feature }: { feature: NeuronpediaFeature }) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Explanation</h3>
      {feature.explanations?.length ? (
        <div className="space-y-2">
          {feature.explanations.slice(0, 3).map((exp, i) => (
            <p key={i} className="text-sm text-gray-200">
              {exp.description}
              <span className="text-gray-500 ml-2">
                ({(exp.score * 100).toFixed(0)}%)
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No explanation available</p>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [x] Fetches feature data from Neuronpedia when node selected
- [x] Displays auto-generated explanations with confidence scores
- [x] Shows top 3 explanations (sorted by score)
- [x] Handles missing explanations gracefully
- [x] Caches fetched data to avoid repeat requests

### REQ-5: Top Activating Tokens

Display tokens that most strongly activate this feature.

```typescript
function TopTokens({ tokens }: { tokens: Array<{ token: string; value: number }> }) {
  return (
    <div className="p-4 border-t border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Top Activating Tokens</h3>
      <div className="flex flex-wrap gap-2">
        {tokens.slice(0, 10).map((t, i) => (
          <span
            key={i}
            className="px-2 py-1 text-sm bg-gray-800 rounded font-mono"
            title={`Logit: ${t.value.toFixed(2)}`}
          >
            {t.token}
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [x] Shows up to 10 top activating tokens
- [x] Tokens displayed as chips/tags
- [x] Logit value shown on hover (tooltip)
- [x] Handles special tokens (newlines, spaces) with visible representation
- [x] Empty state when no token data available

### REQ-6: Loading States

Show appropriate loading states during async operations.

```typescript
function FeatureDetails({ nodeId }: { nodeId: string }) {
  const { data, isLoading, error } = useFeatureDetails(nodeId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <FeatureHeaderSkeleton />
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorDisplay error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (/* full content */);
}
```

**Acceptance Criteria:**
- [x] Skeleton loading state matches content layout
- [x] Loading state appears within 100ms of selection
- [x] Basic info (from local data) shows immediately
- [x] Only extended info (Neuronpedia) shows loading
- [x] Error state includes retry button
- [x] Loading transitions are smooth (no flicker)

### REQ-7: Related Features

Show features that are commonly co-activated or semantically related.

```typescript
function RelatedFeatures({ nodeId }: { nodeId: string }) {
  const edges = useAppStore((s) => {
    const allEdges = s.graph?.edges;
    if (!allEdges) return [];
    return [...allEdges.values()]
      .filter(e => e.source === nodeId || e.target === nodeId)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  });

  return (
    <div className="p-4 border-t border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 mb-2">Related Features</h3>
      <ul className="space-y-2">
        {edges.map(edge => (
          <RelatedFeatureItem
            key={edge.id}
            nodeId={edge.source === nodeId ? edge.target : edge.source}
            weight={edge.weight}
            onClick={() => useAppStore.getState().selectNode(edge.target)}
          />
        ))}
      </ul>
    </div>
  );
}
```

**Acceptance Criteria:**
- [x] Shows top 5 related features by edge weight
- [x] Each item shows feature label and connection strength
- [x] Clicking related feature navigates to it
- [x] Connection type (coactivation/attention/circuit) indicated
- [x] Empty state when no connected features

### REQ-8: Performance Requirements

Maintain snappy interactions for flow state.

**Acceptance Criteria:**
- [x] Panel opens within 50ms of toggle action
- [x] Basic info renders within 16ms of node selection
- [x] API fetch initiated within 100ms of selection
- [x] Cached data returns instantly (no loading state)
- [x] Panel does not cause graph rendering jank

## Technical Notes

- Use React Query (TanStack Query) for Neuronpedia data fetching
- Cache feature details in IndexedDB for offline access
- Subscribe to activation changes via Zustand selector
- Panel should not trigger graph re-renders
- Consider virtualization if showing many examples/tokens

## API Integration

```typescript
// Hook for fetching Neuronpedia data
function useFeatureDetails(nodeId: string) {
  const node = useAppStore((s) => s.graph?.nodes.get(nodeId));

  return useQuery({
    queryKey: ['feature', node?.featureId.modelId, node?.featureId.layer, node?.featureId.index],
    queryFn: () => fetchFeatureFromNeuronpedia(node!.featureId),
    enabled: !!node,
    staleTime: 1000 * 60 * 60, // 1 hour
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
```

## File Structure

```
packages/frontend/src/
├── components/panels/
│   ├── ActivationPanel.tsx     # Main panel container
│   ├── FeatureHeader.tsx       # Basic info display
│   ├── ActivationValue.tsx     # Activation progress bar
│   ├── FeatureExplanation.tsx  # Neuronpedia explanations
│   ├── TopTokens.tsx           # Token chips
│   ├── RelatedFeatures.tsx     # Connected nodes list
│   ├── LoadingStates.tsx       # Skeletons and spinners
│   └── index.ts
├── hooks/
│   └── useFeatureDetails.ts    # React Query hook
└── services/
    └── neuronpedia.ts          # API client (if not via backend)
```

## Dependencies

- [x] GRAPH-001: Graph Data Model (node structure)
- [x] GRAPH-002: Graph Loader (graph must be loaded)
- [x] GRAPH-003: Graph Renderer (node selection triggers display)
- [ ] API-001: Neuronpedia Client (for fetching extended data)

## Open Questions

1. Should we fetch Neuronpedia data via backend proxy or direct client call?
2. Do we show example texts with highlighted activation spans?
3. Should users be able to pin multiple features for comparison?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
