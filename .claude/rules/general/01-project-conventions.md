# Project Conventions

## Monorepo Structure

```
horus/
├── packages/
│   ├── frontend/    # React + Vite + R3F
│   ├── backend/     # Hono + Drizzle + SQLite
│   └── shared/      # Types, utils, contracts
├── specs/           # Specification documents
├── .claude/         # Claude Code configuration
└── docs/            # Generated documentation
```

## Package Naming

- Package names: `@horus/frontend`, `@horus/backend`, `@horus/shared`
- All packages use TypeScript
- Shared types are imported from `@horus/shared`

## File Naming

- **Components**: PascalCase (`GraphCanvas.tsx`, `MixerPanel.tsx`)
- **Hooks**: camelCase with `use` prefix (`useActivations.ts`, `useGraphStore.ts`)
- **Utils**: camelCase (`debounce.ts`, `featureCache.ts`)
- **Types**: PascalCase for types/interfaces (`Feature.ts`, `Activation.ts`)
- **Constants**: SCREAMING_SNAKE_CASE in camelCase files (`constants.ts`)

## Import Order

```typescript
// 1. React/core libraries
import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'

// 2. Third-party libraries
import { useControls } from 'leva'

// 3. Internal packages (@horus/*)
import { Feature } from '@horus/shared'

// 4. Relative imports (../*, ./*)
import { useGraphStore } from '../stores/graphStore'
import { NodeMesh } from './NodeMesh'
```

## TypeScript Conventions

- Strict mode enabled
- No `any` - use `unknown` and narrow
- Prefer interfaces for objects, types for unions/primitives
- Export types alongside implementations

## Git Conventions

- Branch naming: `feat/`, `fix/`, `refactor/`, `docs/`
- Commit messages: Conventional commits
  - `feat(frontend): add dial component`
  - `fix(api): handle rate limit errors`
  - `refactor(backend): extract auth middleware`

## Environment Variables

- Frontend: prefix with `VITE_`
- Backend: no prefix
- Never commit `.env` files
- Document all vars in `.env.example`
