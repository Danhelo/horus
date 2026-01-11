# Hono + Drizzle Backend Patterns

## Project Structure

```
packages/backend/
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Hono app setup
│   ├── env.ts             # Environment validation
│   ├── db/
│   │   ├── index.ts       # Drizzle client
│   │   ├── schema/        # Table definitions
│   │   │   ├── users.ts
│   │   │   ├── artifacts.ts
│   │   │   └── features.ts
│   │   └── migrations/    # SQL migrations
│   ├── routes/
│   │   ├── index.ts       # Route barrel
│   │   ├── features.ts
│   │   ├── artifacts.ts
│   │   └── auth.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── rate-limit.ts
│   │   └── error-handler.ts
│   └── services/
│       ├── neuronpedia.ts # API proxy
│       └── features.ts    # Caching layer
├── drizzle.config.ts
└── package.json
```

## Hono App Setup

```typescript
// src/app.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { featuresRoutes } from './routes/features';
import { artifactsRoutes } from './routes/artifacts';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

const app = new Hono()
  .use('*', logger())
  .use('*', cors())
  .route('/api/features', featuresRoutes)
  .route('/api/artifacts', artifactsRoutes)
  .onError(errorHandler)
  .notFound(notFoundHandler);

export type AppType = typeof app;
export default app;
```

## Drizzle Schema Pattern

```typescript
// src/db/schema/artifacts.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  type: text('type', { enum: ['fingerprint', 'trajectory', 'collection'] }).notNull(),
  name: text('name').notNull(),
  data: text('data', { mode: 'json' }).$type<ArtifactData>(),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, (table) => [
  index('artifacts_user_idx').on(table.userId),
  index('artifacts_type_idx').on(table.type),
]);
```

## Route Pattern

```typescript
// src/routes/features.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { featureService } from '../services/features';

const featuresRoutes = new Hono()
  .get('/:model/:layer/:index', async (c) => {
    const { model, layer, index } = c.req.param();
    const feature = await featureService.getFeature(
      model,
      parseInt(layer),
      parseInt(index)
    );
    return c.json(feature);
  })
  .post('/search',
    zValidator('json', z.object({
      query: z.string().min(2),
      limit: z.number().max(100).default(20),
    })),
    async (c) => {
      const { query, limit } = c.req.valid('json');
      const results = await featureService.searchFeatures(query, limit);
      return c.json(results);
    }
  );

export { featuresRoutes };
```

## Error Handling

```typescript
// src/middleware/error-handler.ts
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
  }
}

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message } }, err.status);
  }

  if (err instanceof ZodError) {
    return c.json({
      error: {
        message: 'Validation failed',
        details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
      },
    }, 400);
  }

  if (err instanceof AppError) {
    return c.json({ error: { message: err.message, code: err.code } }, err.statusCode);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: { message: 'Internal server error' } }, 500);
};
```

## Auth Middleware

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { db } from '../db';
import { sessions, users } from '../db/schema';

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization' });
  }

  const token = authHeader.slice(7);
  const result = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date())
    ))
    .limit(1);

  if (result.length === 0) {
    throw new HTTPException(401, { message: 'Invalid or expired session' });
  }

  c.set('user', result[0].user);
  await next();
});
```

## Environment Validation

```typescript
// src/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default('./data/app.db'),
  NEURONPEDIA_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
```

## Neuronpedia Proxy Service

```typescript
// src/services/neuronpedia.ts
import { env } from '../env';
import { AppError } from '../middleware/error-handler';

class NeuronpediaService {
  private baseUrl = 'https://www.neuronpedia.org';

  async getFeature(model: string, layer: number, index: number) {
    return this.fetch(`/api/feature/${model}/${layer}/${index}`);
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.NEURONPEDIA_API_KEY, // Hidden from client
        ...options?.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new AppError('Rate limit exceeded', 429, 'RATE_LIMITED');
      }
      throw new AppError(`Upstream error: ${response.status}`, 502);
    }

    return response.json();
  }
}

export const neuronpediaService = new NeuronpediaService();
```

## Database Initialization

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '../env';

const sqlite = new Database(env.DATABASE_URL);
export const db = drizzle(sqlite, { schema });
```

## Migration Commands

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

## SQLite to Postgres Migration Path

Schema remains the same, change:
1. `better-sqlite3` -> `postgres` driver
2. `sqliteTable` -> `pgTable`
3. `integer('timestamp')` -> `timestamp()`
4. Update DATABASE_URL to postgres connection string
