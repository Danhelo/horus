# Streaming SSE Patterns

## Overview

Server-Sent Events (SSE) enable real-time token streaming from Neuronpedia during steered generation. This is the core UX for Phase 2 - users see text appear token-by-token as the model generates.

---

## Hono SSE Setup

### Basic SSE Response

```typescript
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const generationRoutes = new Hono()
  .post('/generate', async (c) => {
    const { prompt, steeringVector, options } = await c.req.json();

    return streamSSE(c, async (stream) => {
      try {
        // Stream tokens from Neuronpedia
        const generator = await neuronpediaService.streamSteer({
          prompt,
          features: steeringVector.features,
          maxTokens: options.maxTokens ?? 100,
          temperature: options.temperature ?? 0.7,
        });

        for await (const event of generator) {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        }

        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ finishReason: 'complete' }),
        });
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    });
  });
```

### Event Types

```typescript
type StreamEvent =
  | { type: 'token'; data: { token: string; index: number } }
  | { type: 'activation'; data: { tokenIndex: number; features: FeatureActivation[] } }
  | { type: 'done'; data: { finishReason: 'complete' | 'max_tokens' | 'stop_sequence' } }
  | { type: 'error'; data: { message: string; code?: string } };
```

---

## Neuronpedia Streaming Proxy

Neuronpedia's `/api/steer` doesn't stream natively, so we poll or use their chat endpoint:

```typescript
// services/neuronpedia.ts

interface SteerStreamOptions {
  prompt: string;
  features: SteeringFeature[];
  maxTokens: number;
  temperature: number;
  onToken?: (token: string) => void;
}

async function* streamSteer(options: SteerStreamOptions): AsyncGenerator<StreamEvent> {
  // Option 1: Neuronpedia chat endpoint with streaming (if available)
  // Option 2: Batch request, then yield tokens with delay for UX

  const response = await this.fetchFromApi<SteerResponse>('/api/steer', {
    method: 'POST',
    body: JSON.stringify({
      modelId: 'gemma-2-2b',
      prompt: options.prompt,
      features: options.features,
      temperature: options.temperature,
      n_tokens: options.maxTokens,
      steer_method: 'SIMPLE_ADDITIVE',
    }),
  });

  // Tokenize response and yield with realistic timing
  const tokens = tokenize(response.steeredOutput.text);

  for (let i = 0; i < tokens.length; i++) {
    yield {
      type: 'token',
      data: { token: tokens[i], index: i },
    };

    // Simulate streaming delay (50-100ms per token)
    await sleep(50 + Math.random() * 50);
  }
}

// Simple tokenization (or use tiktoken for accuracy)
function tokenize(text: string): string[] {
  // Split on whitespace, keeping punctuation attached
  return text.match(/\S+|\s+/g) || [];
}
```

---

## Frontend EventSource

### React Hook for SSE

```typescript
interface UseGenerationStreamOptions {
  onToken: (token: string, index: number) => void;
  onActivation?: (tokenIndex: number, features: FeatureActivation[]) => void;
  onDone: (reason: string) => void;
  onError: (error: string) => void;
}

function useGenerationStream(options: UseGenerationStreamOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback(async (
    prompt: string,
    steeringVector: SteeringVector,
    genOptions: GenerationOptions
  ) => {
    // Cancel any in-flight generation
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, steeringVector, options: genOptions }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            handleEvent(eventType, data);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;  // Cancelled, not an error
      }
      options.onError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [options]);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  return { isGenerating, startGeneration, cancelGeneration };
}
```

### Alternative: Native EventSource

For simpler cases without POST body:

```typescript
function useEventSourceGeneration(url: string) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.addEventListener('token', (e) => {
      const data = JSON.parse(e.data);
      setEvents(prev => [...prev, { type: 'token', data }]);
    });

    eventSourceRef.current.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setEvents(prev => [...prev, { type: 'done', data }]);
      eventSourceRef.current?.close();
    });

    eventSourceRef.current.addEventListener('error', (e) => {
      console.error('SSE error:', e);
      eventSourceRef.current?.close();
    });
  }, [url]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
  }, []);

  return { events, connect, disconnect };
}
```

---

## Store Integration

### Generation Store Slice

```typescript
interface GenerationSlice {
  isGenerating: boolean;
  generatedText: string;
  generatedTokens: string[];
  currentTokenIndex: number;
  error: string | null;

  // Actions
  startGeneration: (prompt: string, vector: SteeringVector) => void;
  cancelGeneration: () => void;
  appendToken: (token: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const createGenerationSlice: StateCreator<GenerationSlice> = (set, get) => {
  let abortController: AbortController | null = null;

  return {
    isGenerating: false,
    generatedText: '',
    generatedTokens: [],
    currentTokenIndex: 0,
    error: null,

    startGeneration: async (prompt, vector) => {
      // Cancel existing
      abortController?.abort();
      abortController = new AbortController();

      set({
        isGenerating: true,
        generatedText: '',
        generatedTokens: [],
        currentTokenIndex: 0,
        error: null,
      });

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, steeringVector: vector }),
          signal: abortController.signal,
        });

        // Process stream...
        await processStream(response, {
          onToken: (token) => {
            set(state => ({
              generatedTokens: [...state.generatedTokens, token],
              generatedText: state.generatedText + token,
              currentTokenIndex: state.currentTokenIndex + 1,
            }));
          },
          onDone: () => {
            set({ isGenerating: false });
          },
          onError: (error) => {
            set({ isGenerating: false, error });
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          set({ isGenerating: false, error: error.message });
        }
      }
    },

    cancelGeneration: () => {
      abortController?.abort();
      set({ isGenerating: false });
    },

    appendToken: (token) => {
      set(state => ({
        generatedTokens: [...state.generatedTokens, token],
        generatedText: state.generatedText + token,
        currentTokenIndex: state.currentTokenIndex + 1,
      }));
    },

    setError: (error) => set({ error }),

    reset: () => set({
      generatedText: '',
      generatedTokens: [],
      currentTokenIndex: 0,
      error: null,
    }),
  };
};
```

---

## Live Trajectory Updates

Update trajectory in real-time as tokens stream:

```typescript
// In generation handler
onToken: async (token, index) => {
  // Append to generated text
  useGenerationStore.getState().appendToken(token);

  // If returning activations, update trajectory
  if (options.returnActivations) {
    const activation = await fetchActivationForToken(token, index);
    useTrajectoryStore.getState().appendPoint({
      tokenIndex: index,
      token,
      activations: activation.features,
      position: computeCentroid(activation.features),
    });
  }
};
```

---

## Debouncing & Rate Limiting

### Client-Side Debounce

Don't spam generation requests during dial adjustment:

```typescript
const debouncedGenerate = useMemo(
  () => debounce((prompt: string, vector: SteeringVector) => {
    startGeneration(prompt, vector);
  }, 500),  // 500ms debounce
  [startGeneration]
);

// When dial changes in auto-generate mode
useEffect(() => {
  if (autoGenerateEnabled && prompt.length > 0) {
    debouncedGenerate(prompt, steeringVector);
  }
}, [steeringVector, autoGenerateEnabled, prompt, debouncedGenerate]);
```

### Server-Side Rate Limiting

```typescript
import { rateLimiter } from 'hono-rate-limiter';

const generationLimiter = rateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  limit: 10,            // 10 requests per minute per IP
  standardHeaders: 'draft-6',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
  handler: (c) => {
    return c.json({
      error: 'Rate limited. Please wait before generating again.',
      retryAfter: c.res.headers.get('Retry-After'),
    }, 429);
  },
});

generationRoutes.use('/generate', generationLimiter);
```

---

## Error Handling UI

```tsx
function GenerationError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const isRateLimit = error.includes('Rate limit');

  return (
    <div className="generation-error">
      <AlertCircle className="w-4 h-4 text-signal-coral" />
      <span>{error}</span>
      {isRateLimit ? (
        <CountdownTimer onComplete={onRetry} seconds={60} />
      ) : (
        <button onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
```

---

## Connection Resilience

### Reconnection Logic

```typescript
function useResilientStream(options: StreamOptions) {
  const reconnectAttempts = useRef(0);
  const maxReconnects = 3;

  const connect = useCallback(async () => {
    try {
      await startStream(options);
      reconnectAttempts.current = 0;  // Reset on success
    } catch (error) {
      if (reconnectAttempts.current < maxReconnects) {
        reconnectAttempts.current++;
        const delay = Math.pow(2, reconnectAttempts.current) * 1000;
        setTimeout(connect, delay);
      } else {
        options.onError('Connection failed after multiple attempts');
      }
    }
  }, [options]);

  return { connect };
}
```

---

## Testing SSE

```typescript
// __tests__/generation.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('Generation streaming', () => {
  it('streams tokens correctly', async () => {
    const tokens: string[] = [];

    const response = await app.request('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Hello',
        steeringVector: { features: [] },
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const matches = text.matchAll(/data: (.+)/g);
      for (const match of matches) {
        const data = JSON.parse(match[1]);
        if (data.token) tokens.push(data.token);
      }
    }

    expect(tokens.length).toBeGreaterThan(0);
  });
});
```

---

## Performance Considerations

1. **Buffer SSE writes** - Don't flush after every token
2. **Compress if possible** - SSE supports gzip
3. **Timeout long-running streams** - 30s max generation time
4. **Clean up on disconnect** - Cancel upstream requests

```typescript
// Detect client disconnect
streamSSE(c, async (stream) => {
  const abortSignal = c.req.raw.signal;

  abortSignal.addEventListener('abort', () => {
    // Client disconnected, clean up
    cancelUpstreamGeneration();
  });

  // ... stream logic
});
```
