# Backend Patterns (Hono + Drizzle)

## Structure

```
src/
├── app.ts              # Hono app + middleware
├── env.ts              # Zod env validation
├── db/{index,schema/}  # Drizzle + SQLite
├── routes/             # Feature routes
├── middleware/         # auth, cors, rate-limit, errors
└── services/           # neuronpedia proxy, caching
```

## Hono App

```typescript
const app = new Hono()
  .use('*', logger())
  .use('*', cors())
  .route('/api/features', featuresRoutes)
  .onError(errorHandler)
  .notFound(notFoundHandler);

export type AppType = typeof app;
```

## Routes with Zod

```typescript
const featuresRoutes = new Hono()
  .get('/:model/:layer/:index', async (c) => {
    const { model, layer, index } = c.req.param();
    return c.json(await featureService.getFeature(model, +layer, +index));
  })
  .post('/search', zValidator('json', z.object({ query: z.string().min(2) })), async (c) => {
    return c.json(await featureService.search(c.req.valid('json').query));
  });
```

## Drizzle Schema

```typescript
export const artifacts = sqliteTable(
  'artifacts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    data: text('data', { mode: 'json' }).$type<ArtifactData>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (t) => [index('artifacts_user_idx').on(t.userId)]
);
```

## SSE Streaming

```typescript
import { streamSSE } from 'hono/streaming';

app.post('/generate', async (c) => {
  const { prompt, steeringVector } = await c.req.json();
  return streamSSE(c, async (stream) => {
    for await (const token of generateTokens(prompt, steeringVector)) {
      await stream.writeSSE({ event: 'token', data: JSON.stringify(token) });
    }
    await stream.writeSSE({ event: 'done', data: '{}' });
  });
});
```

## Error Handling

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string
  ) {
    super(message);
  }
}

const errorHandler = (err: Error, c: Context) => {
  if (err instanceof ZodError) return c.json({ error: err.errors }, 400);
  if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode);
  return c.json({ error: 'Internal error' }, 500);
};
```

## Neuronpedia Proxy

```typescript
class NeuronpediaService {
  private baseUrl = 'https://www.neuronpedia.org';

  async fetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.NEURONPEDIA_API_KEY },
    });
    if (res.status === 429) throw new AppError('Rate limited', 429);
    if (!res.ok) throw new AppError(`Upstream: ${res.status}`, 502);
    return res.json();
  }
}
```

## Rate Limiting

- Server: `hono-rate-limiter` - 10 req/min/IP for generate
- Client: Debounce dial changes 500ms before generation
- Neuronpedia: 100 steers/hour, exponential backoff on 429/503
