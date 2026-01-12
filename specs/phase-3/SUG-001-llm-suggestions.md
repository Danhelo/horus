# SUG-001: LLM Suggestions

| Field | Value |
|-------|-------|
| **Spec ID** | SUG-001 |
| **Phase** | 3 - Dynamic Hierarchy |
| **Status** | Draft |
| **Package** | `@horus/frontend`, `@horus/backend` |

## Summary

The system observes user steering actions and proactively suggests relevant steering groups. When a user boosts "nostalgia," the LLM might suggest "temporal distance," "sensory memory," or "bittersweet" as complementary concepts. This implements the "perspectival grouping" vision where the right controls surface based on context.

> *"The dials that appear are dynamic—they change based on what you're doing."*
> — ideas/05-mixing.md

## Requirements

### REQ-1: Steering Context Model

Capture the user's current steering state for LLM analysis.

```typescript
interface SteeringContext {
  // Current text being worked on
  currentText: string;

  // Active steering configuration
  activeFeatures: {
    featureId: string;
    label?: string;
    strength: number;
  }[];

  activeGroups: {
    groupId: string;
    label: string;
    strength: number;
    category?: string;
  }[];

  // Recent actions (for momentum detection)
  recentActions: SteeringAction[];

  // Generated text (if any)
  generatedText?: string;
}

interface SteeringAction {
  type: 'add_feature' | 'remove_feature' | 'adjust_strength' | 'add_group' | 'search';
  target: string;          // Feature/group ID or search query
  value?: number;          // Strength value
  timestamp: number;
}

// Keep last 10 actions, last 30 seconds
const MAX_ACTIONS = 10;
const ACTION_WINDOW_MS = 30000;
```

**Acceptance Criteria:**
- [ ] Context captures current steering state
- [ ] Recent actions tracked (last 10, last 30s)
- [ ] Context serializable for API request

### REQ-2: Suggestion Request/Response

```typescript
interface SuggestionRequest {
  context: SteeringContext;
  maxSuggestions?: number;   // Default: 3
  excludeGroups?: string[];  // Don't suggest already-active groups
}

interface GroupSuggestion {
  concept: string;           // The suggested concept
  reason: string;            // Why this is suggested
  confidence: number;        // 0-1, how confident the suggestion is
  category?: string;         // Suggested category

  // If we have precomputed group, include it
  existingGroupId?: string;
}

interface SuggestionResponse {
  suggestions: GroupSuggestion[];
  metadata: {
    modelUsed: string;       // Which LLM generated this
    latencyMs: number;
    cached: boolean;
  };
}
```

**Acceptance Criteria:**
- [ ] Request includes full steering context
- [ ] Response includes 1-5 suggestions
- [ ] Each suggestion has reason and confidence
- [ ] Links to existing groups when available

### REQ-3: Backend Suggestion Endpoint

```typescript
// packages/backend/src/routes/suggestions.ts

const suggestionsRoutes = new Hono()
  .post('/suggest-groups',
    zValidator('json', SuggestionRequestSchema),
    rateLimit({ limit: 2, window: 60 }),  // 2/min to conserve LLM costs
    async (c) => {
      const request = c.req.valid('json');

      // Check cache
      const cacheKey = hashContext(request.context);
      const cached = await suggestionCache.get(cacheKey);
      if (cached) {
        return c.json({ ...cached, metadata: { ...cached.metadata, cached: true } });
      }

      // Build LLM prompt
      const prompt = buildSuggestionPrompt(request.context);

      // Call LLM
      const llmResponse = await llmService.complete({
        model: 'claude-3-haiku',  // Fast and cheap
        messages: [
          { role: 'system', content: SUGGESTION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        maxTokens: 500,
      });

      // Parse structured response
      const suggestions = parseSuggestionResponse(llmResponse);

      // Match with precomputed groups
      const enrichedSuggestions = await matchWithPrecomputed(suggestions);

      // Cache for 5 minutes (context-dependent)
      await suggestionCache.set(cacheKey, enrichedSuggestions, 300);

      return c.json(enrichedSuggestions);
    }
  );

// System prompt for suggestion generation
const SUGGESTION_SYSTEM_PROMPT = `You are a creative assistant helping users steer language model generation.

Given the user's current steering context (active features, groups, and recent actions), suggest 3 complementary steering concepts that would:
1. Enhance or refine their current creative direction
2. Offer interesting tangential explorations
3. Help achieve more nuanced control

Respond in JSON format:
{
  "suggestions": [
    {
      "concept": "temporal_distance",
      "reason": "Complements nostalgia by emphasizing the 'long ago' quality",
      "confidence": 0.85,
      "category": "emotion"
    }
  ]
}

Focus on:
- Concepts that compose well with current steering
- Non-obvious connections that might spark creativity
- Practical utility for text generation control`;

function buildSuggestionPrompt(context: SteeringContext): string {
  return `
Current text: "${context.currentText.slice(0, 200)}..."

Active steering:
${context.activeFeatures.map(f => `- ${f.label || f.featureId}: ${f.strength > 0 ? '+' : ''}${f.strength}`).join('\n')}
${context.activeGroups.map(g => `- ${g.label} (${g.category}): ${g.strength > 0 ? '+' : ''}${g.strength}`).join('\n')}

Recent actions:
${context.recentActions.slice(-5).map(a => `- ${a.type}: ${a.target}`).join('\n')}

${context.generatedText ? `Generated text: "${context.generatedText.slice(0, 200)}..."` : ''}

Suggest 3 steering concepts that would complement this creative direction.
`.trim();
}
```

**Acceptance Criteria:**
- [ ] Endpoint calls LLM with structured prompt
- [ ] Response parsed into typed suggestions
- [ ] Rate limited to prevent cost overrun
- [ ] Cached by context hash

### REQ-4: Frontend Suggestion Hook

```typescript
// packages/frontend/src/hooks/useSuggestions.ts

interface UseSuggestionsOptions {
  enabled?: boolean;
  debounceMs?: number;       // Default: 5000 (5 seconds)
  minInterval?: number;      // Default: 30000 (30 seconds)
}

function useSuggestions(options: UseSuggestionsOptions = {}) {
  const { enabled = true, debounceMs = 5000, minInterval = 30000 } = options;

  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef(0);

  // Build context from stores
  const context = useSteeringContext();

  // Debounced fetch
  const fetchSuggestions = useDebouncedCallback(
    async () => {
      // Enforce minimum interval
      const now = Date.now();
      if (now - lastFetchRef.current < minInterval) return;

      // Don't fetch if context is empty
      if (context.activeFeatures.length === 0 && context.activeGroups.length === 0) {
        return;
      }

      setLoading(true);

      try {
        const response = await fetch('/api/suggestions/suggest-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context }),
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setLoading(false);
        lastFetchRef.current = Date.now();
      }
    },
    debounceMs
  );

  // Trigger on context changes
  useEffect(() => {
    if (enabled) {
      fetchSuggestions();
    }
  }, [context, enabled]);

  // Action: create group from suggestion
  const applySuggestion = async (suggestion: GroupSuggestion) => {
    if (suggestion.existingGroupId) {
      // Activate existing precomputed group
      toggleGroup(suggestion.existingGroupId);
    } else {
      // Create new group via search
      const group = await createGroupFromSearch({ query: suggestion.concept });
      addGroup(group);
    }

    // Remove from suggestions
    setSuggestions(prev => prev.filter(s => s.concept !== suggestion.concept));
  };

  const dismissSuggestion = (concept: string) => {
    setSuggestions(prev => prev.filter(s => s.concept !== concept));
  };

  return {
    suggestions,
    loading,
    applySuggestion,
    dismissSuggestion,
    refresh: fetchSuggestions,
  };
}
```

**Acceptance Criteria:**
- [ ] Hook fetches suggestions after steering changes
- [ ] 5 second debounce before fetching
- [ ] Minimum 30 second interval between fetches
- [ ] Apply/dismiss actions for each suggestion

### REQ-5: Suggestion UI Component

Display suggestions in the mixer panel.

```typescript
// packages/frontend/src/components/ui/SuggestedGroups.tsx

function SuggestedGroups() {
  const { suggestions, loading, applySuggestion, dismissSuggestion } = useSuggestions();

  if (suggestions.length === 0 && !loading) {
    return null;  // Don't show empty section
  }

  return (
    <div className="suggested-groups">
      <div className="section-header">
        <span>Suggested</span>
        {loading && <Spinner size="sm" />}
      </div>

      <div className="suggestion-chips">
        {suggestions.map(suggestion => (
          <SuggestionChip
            key={suggestion.concept}
            suggestion={suggestion}
            onApply={() => applySuggestion(suggestion)}
            onDismiss={() => dismissSuggestion(suggestion.concept)}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionChip({ suggestion, onApply, onDismiss }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="suggestion-chip"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button className="chip-main" onClick={onApply}>
        <span className="concept">{formatConcept(suggestion.concept)}</span>
        <span className="confidence">
          {Math.round(suggestion.confidence * 100)}%
        </span>
      </button>

      <button className="chip-dismiss" onClick={onDismiss}>
        ×
      </button>

      {showTooltip && (
        <Tooltip>
          {suggestion.reason}
        </Tooltip>
      )}
    </div>
  );
}
```

**Visual Design:**
- Chips appear below active groups in mixer
- Gold accent color (matches theme)
- Confidence shown as percentage
- Hover shows reason tooltip
- "×" to dismiss

**Acceptance Criteria:**
- [ ] Suggestions appear as clickable chips
- [ ] Tooltip shows reason on hover
- [ ] Click creates/activates group
- [ ] Dismiss button removes suggestion
- [ ] Loading indicator during fetch

### REQ-6: LLM Service Abstraction

Support multiple LLM providers.

```typescript
// packages/backend/src/services/llm.ts

interface LLMService {
  complete: (request: CompletionRequest) => Promise<string>;
}

interface CompletionRequest {
  model: string;
  messages: Message[];
  maxTokens: number;
  temperature?: number;
}

class AnthropicLLMService implements LLMService {
  async complete(request: CompletionRequest): Promise<string> {
    const response = await anthropic.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages,
    });
    return response.content[0].text;
  }
}

class OpenAILLMService implements LLMService {
  async complete(request: CompletionRequest): Promise<string> {
    const response = await openai.chat.completions.create({
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages,
    });
    return response.choices[0].message.content;
  }
}

// Factory based on env config
function createLLMService(): LLMService {
  if (env.ANTHROPIC_API_KEY) {
    return new AnthropicLLMService();
  }
  if (env.OPENAI_API_KEY) {
    return new OpenAILLMService();
  }
  throw new Error('No LLM API key configured');
}
```

**Acceptance Criteria:**
- [ ] Support Claude (Anthropic) and GPT (OpenAI)
- [ ] Model selection via environment variable
- [ ] Error handling for API failures
- [ ] Cost tracking (optional, for monitoring)

## Technical Notes

### Cost Management

LLM calls are expensive. Strategies:

1. **Use fast/cheap models**: Claude Haiku, GPT-3.5-turbo
2. **Aggressive caching**: Cache by context hash, 5 min TTL
3. **Rate limiting**: Max 2 calls/minute per user
4. **Context truncation**: Limit text/action history size

### Context Hashing

For caching, hash the context to detect similar states:

```typescript
function hashContext(context: SteeringContext): string {
  // Normalize and hash
  const normalized = {
    text: context.currentText.slice(0, 100),  // First 100 chars
    features: context.activeFeatures
      .sort((a, b) => a.featureId.localeCompare(b.featureId))
      .map(f => `${f.featureId}:${Math.round(f.strength)}`),
    groups: context.activeGroups
      .sort((a, b) => a.groupId.localeCompare(b.groupId))
      .map(g => `${g.groupId}:${Math.round(g.strength)}`),
  };

  return sha256(JSON.stringify(normalized));
}
```

### Precomputed Group Matching

Link suggestions to existing groups when possible:

```typescript
async function matchWithPrecomputed(
  suggestions: GroupSuggestion[]
): Promise<GroupSuggestion[]> {
  const precomputed = await loadPrecomputedGroups();

  return suggestions.map(suggestion => {
    // Fuzzy match concept to precomputed group labels
    const match = precomputed.find(g =>
      g.label.toLowerCase().includes(suggestion.concept.toLowerCase()) ||
      suggestion.concept.toLowerCase().includes(g.label.toLowerCase())
    );

    return {
      ...suggestion,
      existingGroupId: match?.id,
    };
  });
}
```

## Dependencies

- [GRP-001](GRP-001-steering-groups.md) - Group creation/activation
- [LIVE-001](LIVE-001-click-to-steer.md) - Active features context
- [MIX-001](../phase-2/MIX-001-dial.md) - Mixer panel integration

## Open Questions

1. Should suggestions persist across sessions?
2. Can users provide feedback on suggestion quality?
3. Should suggestions consider user history across sessions?
4. How to handle conflicting suggestions?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-11 | Initial draft |
