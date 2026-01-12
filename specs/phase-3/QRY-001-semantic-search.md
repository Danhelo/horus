# QRY-001: Semantic Search

| Field       | Value                 |
| ----------- | --------------------- |
| **Spec ID** | QRY-001               |
| **Phase**   | 3 - Dynamic Hierarchy |
| **Status**  | Draft                 |
| **Package** | `@horus/backend`      |

## Summary

Implement semantic search - natural language queries that navigate the graph, highlight relevant features, and answer questions about ideaspace. Users can say "take me to concepts about uncertainty" and the camera flies to that region. They can ask "what features relate to nostalgia?" and see a highlighted cluster. This makes the graph navigable by intent, not just by clicking.

## Requirements

### REQ-1: Query Types

Support multiple query intents:

```typescript
type QueryType =
  | 'navigate' // "Take me to melancholy"
  | 'search' // "Find features related to formal writing"
  | 'explain' // "What does this cluster represent?"
  | 'compare' // "How is sadness different from grief?"
  | 'suggest'; // "What features should I boost for cosmic horror?"

interface SemanticQuery {
  text: string; // Raw user input
  type: QueryType; // Inferred or explicit
  context?: {
    selectedNodes?: string[]; // Currently selected
    activeText?: string; // Current text in editor
    dialValues?: Record<string, number>; // Current steering
  };
}

interface QueryResult {
  type: QueryType;
  relevantNodes: Array<{
    nodeId: string;
    relevance: number; // 0-1 score
    explanation?: string; // Why this node matches
  }>;
  suggestedAction?: {
    type: 'navigate' | 'highlight' | 'select' | 'adjust_dial';
    target: string | string[];
  };
  textResponse?: string; // Natural language answer
}
```

**Acceptance Criteria:**

- [ ] Query type inference from natural language
- [ ] All five query types supported
- [ ] Context-aware results (current selection affects results)
- [ ] Relevance scoring for all results

### REQ-2: Navigation Queries

"Take me to X" queries that move the camera.

**Examples:**

- "Take me to melancholy"
- "Go to features about space and cosmos"
- "Find the uncertainty region"
- "Navigate to technical writing concepts"

**Behavior:**

1. Parse query to extract target concept
2. Find features semantically related to concept
3. Compute target position (centroid of relevant features)
4. Animate camera to position
5. Highlight relevant features

```typescript
interface NavigationResult {
  targetPosition: [number, number, number];
  targetZoom: number;
  highlightedNodes: string[];
  confidence: number; // How confident in the match
}

async function executeNavigation(query: SemanticQuery): Promise<NavigationResult>;
```

**Acceptance Criteria:**

- [ ] Natural language maps to graph regions
- [ ] Camera animates smoothly to target
- [ ] Relevant features highlight on arrival
- [ ] Works for abstract concepts ("emotions", "formality")

### REQ-3: Search Queries

"Find X" queries that highlight matching features.

**Examples:**

- "Find features related to memory"
- "Search for nostalgia concepts"
- "Show me everything about formal writing"

**Behavior:**

1. Embed query text
2. Compute similarity to all feature embeddings
3. Return top-K most similar features
4. Highlight matching features in graph
5. List results in sidebar panel

```typescript
interface SearchResult {
  matches: Array<{
    nodeId: string;
    label: string;
    similarity: number;
    highlight: boolean;
  }>;
  totalMatches: number;
  queryEmbedding: number[]; // For re-ranking
}

async function executeSearch(query: SemanticQuery, topK: number): Promise<SearchResult>;
```

**Acceptance Criteria:**

- [ ] Semantic similarity search (not just keyword)
- [ ] Results ranked by relevance
- [ ] Results displayed in searchable list
- [ ] Click result to navigate to feature

### REQ-4: Explanation Queries

"What is X?" queries about selected features or clusters.

**Examples:**

- "What does this cluster represent?"
- "Explain the connection between these features"
- "Why are these features grouped together?"

**Behavior:**

1. Get feature descriptions for selection
2. Send to LLM with explanation prompt
3. Return natural language explanation
4. Optionally highlight related features

```typescript
interface ExplanationResult {
  explanation: string; // Natural language
  relatedNodes: string[]; // Features mentioned
  confidence: number;
}

async function executeExplanation(nodeIds: string[], question: string): Promise<ExplanationResult>;
```

**Acceptance Criteria:**

- [ ] LLM generates coherent explanations
- [ ] Explanations reference specific features
- [ ] Works for clusters and individual features
- [ ] Handles "why grouped" questions

### REQ-5: Suggestion Queries

"What should I do for X?" queries that recommend dial adjustments.

**Examples:**

- "What features should I boost for cosmic horror?"
- "How can I make this text more formal?"
- "Suggest dials for a nostalgic tone"

**Behavior:**

1. Interpret desired effect
2. Identify relevant features
3. Compute suggested dial settings
4. Optionally apply as preview

```typescript
interface SuggestionResult {
  suggestions: Array<{
    type: 'dial' | 'feature';
    id: string;
    suggestedValue: number;
    reason: string;
  }>;
  previewText?: string; // Generated sample with suggestions applied
}

async function executeSuggestion(query: SemanticQuery): Promise<SuggestionResult>;
```

**Acceptance Criteria:**

- [ ] Suggestions are actionable (can be applied directly)
- [ ] Reasons explain why each suggestion helps
- [ ] Preview shows effect before committing
- [ ] Works with existing dial set

### REQ-6: Query Interface

The query input component.

**Visual Requirements:**

- Search bar with semantic query input
- Autocomplete suggestions as you type
- Query type indicator (icon showing navigate/search/explain)
- Recent queries dropdown
- Voice input option (stretch)

```typescript
interface QueryInputProps {
  onSubmit: (query: string) => void;
  placeholder?: string;
  suggestions?: string[];
  recentQueries?: string[];
}
```

**Keyboard Shortcuts:**

- `Cmd/Ctrl + K`: Focus query input
- `Enter`: Execute query
- `Escape`: Close/clear
- Arrow keys: Navigate suggestions

**Acceptance Criteria:**

- [ ] Quick access via keyboard shortcut
- [ ] Autocomplete from feature labels
- [ ] Recent queries persisted
- [ ] Clear visual feedback during query execution

### REQ-7: Backend Query Service

```typescript
// routes/query.ts
const queryRoutes = new Hono()
  .post('/query', zValidator('json', SemanticQuerySchema), async (c) => {
    const query = c.req.valid('json');
    const result = await queryService.execute(query);
    return c.json(result);
  })
  .get('/suggestions', zValidator('query', z.object({ prefix: z.string() })), async (c) => {
    const { prefix } = c.req.valid('query');
    const suggestions = await queryService.autocomplete(prefix);
    return c.json({ suggestions });
  });
```

**Service Implementation:**

```typescript
class QueryService {
  private embedder: EmbeddingModel;
  private featureIndex: VectorIndex;
  private llm: LLMClient;

  async execute(query: SemanticQuery): Promise<QueryResult> {
    const type = await this.classifyQuery(query.text);

    switch (type) {
      case 'navigate':
        return this.handleNavigation(query);
      case 'search':
        return this.handleSearch(query);
      case 'explain':
        return this.handleExplanation(query);
      case 'suggest':
        return this.handleSuggestion(query);
      case 'compare':
        return this.handleComparison(query);
    }
  }

  private async classifyQuery(text: string): Promise<QueryType> {
    // LLM classification or rule-based
  }
}
```

**Acceptance Criteria:**

- [ ] Query classification accurate > 90%
- [ ] Response time < 500ms for search
- [ ] Response time < 2s for LLM-dependent queries
- [ ] Graceful fallback if LLM unavailable

## Technical Notes

- **Embedding Model**: Use same embeddings as feature space for consistency
- **Vector Index**: FAISS or similar for fast nearest neighbor
- **LLM**: Gemma-2-2B or Claude API for explanations
- **Caching**: Cache embeddings, LRU cache for common queries
- **Rate Limiting**: Throttle LLM-dependent queries (1/sec)

**Query Classification Heuristics:**

```typescript
function classifyQuery(text: string): QueryType {
  const lower = text.toLowerCase();
  if (lower.includes('take me') || lower.includes('go to') || lower.includes('navigate')) {
    return 'navigate';
  }
  if (lower.includes('find') || lower.includes('search') || lower.includes('show me')) {
    return 'search';
  }
  if (lower.includes('what is') || lower.includes('explain') || lower.includes('why')) {
    return 'explain';
  }
  if (lower.includes('how can') || lower.includes('suggest') || lower.includes('should I')) {
    return 'suggest';
  }
  if (lower.includes('difference') || lower.includes('compare') || lower.includes('versus')) {
    return 'compare';
  }
  return 'search'; // Default fallback
}
```

## Dependencies

- [GRAPH-004](../phase-1/GRAPH-004-camera.md) - Camera animation for navigation
- [API-001](../phase-1/API-001-neuronpedia.md) - Feature data for search
- [MIX-001](../phase-2/MIX-001-dial.md) - Dial suggestions
- [HIR-001](./HIR-001-semantic-zoom.md) - Hierarchy for cluster explanations

## Open Questions

1. Should navigation queries also adjust zoom level?
2. How do we handle ambiguous queries?
3. Should suggestions be auto-applied or require confirmation?
4. Can we do offline search (local embeddings)?

## Changelog

| Date       | Changes       |
| ---------- | ------------- |
| 2025-01-10 | Initial draft |
