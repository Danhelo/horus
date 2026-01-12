# GEN-001: Steered Generation

| Field       | Value                    |
| ----------- | ------------------------ |
| **Spec ID** | GEN-001                  |
| **Phase**   | 2 - Interactive Explorer |
| **Status**  | Draft                    |
| **Package** | `@horus/backend`         |

## Summary

Implement steered text generation using the Neuronpedia API. When users adjust dials, the steering vector is applied during generation, causing the model to produce text that reflects the feature amplifications and suppressions. This is the core creative capability - direct manipulation of model behavior through feature-level intervention.

## Requirements

### REQ-1: Generation Request Structure

```typescript
interface GenerationRequest {
  prompt: string; // Input text / context
  steeringVector: SteeringVector; // From MIX-002
  options: GenerationOptions;
}

interface GenerationOptions {
  maxTokens: number; // Default: 100
  temperature: number; // Default: 0.7
  topP?: number; // Optional nucleus sampling
  stopSequences?: string[]; // Stop generation at these
  stream: boolean; // Stream tokens as generated
  returnActivations: boolean; // Include activation data in response
}

interface GenerationResponse {
  text: string; // Generated text
  tokens: string[]; // Individual tokens
  activations?: TrajectoryPoint[]; // If returnActivations=true
  metadata: {
    modelId: string;
    tokenCount: number;
    latencyMs: number;
    finishReason: 'stop' | 'max_tokens' | 'stop_sequence';
  };
}
```

**Acceptance Criteria:**

- [ ] Request structure compatible with Neuronpedia steer API
- [ ] Options allow fine control over generation
- [ ] Streaming mode for real-time token display
- [ ] Activations optionally returned for trajectory view

### REQ-2: Streaming Generation

Tokens should stream to the client as they're generated, not wait for completion.

```typescript
interface StreamingGenerationEvent {
  type: 'token' | 'activation' | 'done' | 'error';
  data: {
    token?: string;
    activation?: TrajectoryPoint;
    error?: string;
    metadata?: GenerationResponse['metadata'];
  };
}

// Server-Sent Events or WebSocket
type GenerationStream = AsyncIterable<StreamingGenerationEvent>;
```

**Behavior:**

- Each token emitted as soon as available
- Activation data follows token (if requested)
- Client can display partial text during generation
- Clean termination on completion or error

**Acceptance Criteria:**

- [ ] Tokens stream in real-time (< 100ms between tokens)
- [ ] Frontend displays tokens as they arrive
- [ ] Activations stream alongside tokens for live trajectory
- [ ] Proper error handling for mid-stream failures

### REQ-3: Backend Proxy Service

The backend proxies Neuronpedia API calls to:

- Hide API key from client
- Add caching layer
- Handle rate limiting
- Transform responses

```typescript
// routes/generation.ts
const generationRoutes = new Hono()
  .post('/generate', zValidator('json', GenerationRequestSchema), async (c) => {
    const request = c.req.valid('json');
    const stream = await neuronpediaService.steer(request);
    return streamSSE(c, stream);
  })
  .post('/generate-batch', zValidator('json', BatchGenerationRequestSchema), async (c) => {
    // For comparing multiple steering vectors
  });
```

**Acceptance Criteria:**

- [ ] API key stored securely on backend
- [ ] Rate limiting (10 req/sec per user)
- [ ] Request validation before forwarding
- [ ] Proper error responses for API failures

### REQ-4: Generation Queue

Handle concurrent generation requests gracefully.

```typescript
interface GenerationQueue {
  add: (request: GenerationRequest) => Promise<string>; // Returns job ID
  cancel: (jobId: string) => void;
  status: (jobId: string) => 'pending' | 'running' | 'complete' | 'cancelled' | 'error';
}
```

**Behavior:**

- Only one generation runs at a time per session
- New request cancels pending request
- Queue depth of 1 (most recent request wins)
- Clear feedback on generation state

**Acceptance Criteria:**

- [ ] New generation request cancels in-progress generation
- [ ] UI shows generation state (idle, generating, error)
- [ ] Cancel button stops generation immediately
- [ ] No orphaned generation processes

### REQ-5: Auto-Generate Mode

Optional mode where dial changes automatically trigger regeneration.

```typescript
interface AutoGenerateConfig {
  enabled: boolean;
  debounceMs: number; // Default: 500ms
  minTokens: number; // Minimum prompt length to trigger
  maxTokens: number; // Auto-generation token limit
}
```

**Behavior:**

- When enabled, dial changes trigger generation after debounce
- Only regenerates if prompt text exists
- Shows visual indicator that auto-generate is active
- Can be paused without disabling

**Acceptance Criteria:**

- [ ] Toggle for auto-generate mode
- [ ] Configurable debounce delay
- [ ] Visual indicator when auto-generate is pending
- [ ] Pause/resume without losing settings

### REQ-6: Generation History

Track recent generations for comparison and undo.

```typescript
interface GenerationHistoryEntry {
  id: string;
  timestamp: number;
  prompt: string;
  steeringVector: SteeringVector;
  result: GenerationResponse;
}

interface GenerationHistoryStore {
  entries: GenerationHistoryEntry[];
  maxEntries: number; // Default: 20

  add: (entry: GenerationHistoryEntry) => void;
  get: (id: string) => GenerationHistoryEntry | undefined;
  restore: (id: string) => void; // Restore this generation state
  clear: () => void;
}
```

**Acceptance Criteria:**

- [ ] Last 20 generations stored
- [ ] Can restore previous generation (text + dial settings)
- [ ] History persists across page refresh (localStorage)
- [ ] Clear history option

### REQ-7: Error Handling

```typescript
type GenerationError =
  | { type: 'RATE_LIMITED'; retryAfter: number }
  | { type: 'INVALID_STEERING'; details: string }
  | { type: 'MODEL_UNAVAILABLE'; message: string }
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'CANCELLED' };

function handleGenerationError(error: GenerationError): UserMessage {
  // Return user-friendly error message
  // Include retry action if applicable
}
```

**Acceptance Criteria:**

- [ ] Rate limit errors show retry countdown
- [ ] Invalid steering errors identify problematic features
- [ ] Network errors offer retry option
- [ ] All errors logged for debugging

## Technical Notes

- Use Hono's streaming SSE support for real-time tokens
- Neuronpedia steer endpoint: `POST /api/steer`
- Model: `gemma-2-2b` (or `gemma-2-2b-it` for instruction-tuned)
- Steering method: `SIMPLE_ADDITIVE`
- Consider caching identical request/vector combinations
- Implement exponential backoff for rate limits

**Latency Targets:**
| Metric | Target |
|--------|--------|
| First token | < 500ms |
| Token-to-token | < 100ms |
| Total (100 tokens) | < 5s |

## Dependencies

- [MIX-002](./MIX-002-steering.md) - Steering vector structure
- [API-001](../phase-1/API-001-neuronpedia.md) - Neuronpedia client
- [TRJ-001](./TRJ-001-trajectory.md) - Trajectory data (if returnActivations)
- [STA-001](../shared/STA-001-state.md) - Zustand store for state management

## Open Questions

1. Should we support multiple model options or lock to Gemma-2-2B?
2. How do we handle context windows for long prompts?
3. Should steering vectors be validated against model features?
4. Cache policy for repeated generations?

## Changelog

| Date       | Changes       |
| ---------- | ------------- |
| 2025-01-10 | Initial draft |
