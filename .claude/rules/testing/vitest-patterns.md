# Vitest Testing Patterns

## Test Framework

HORUS uses Vitest for unit and integration tests, Playwright for E2E.

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
pnpm test:coverage # With coverage
```

---

## File Organization

```
packages/frontend/src/
├── components/
│   └── GraphCanvas.tsx
├── __tests__/
│   ├── components/
│   │   └── GraphCanvas.test.tsx
│   ├── stores/
│   │   └── appStore.test.ts
│   └── utils/
│       └── graphLoader.test.ts
└── __mocks__/
    ├── three.ts
    └── neuronpedia.ts

packages/backend/src/
├── routes/
│   └── features.ts
└── __tests__/
    └── routes/
        └── features.test.ts
```

---

## Unit Test Patterns

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('graphLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads graph data from JSON', async () => {
    const result = await loadGraphFromJSON(mockGraphJSON);

    expect(result.nodes.size).toBe(100);
    expect(result.edges.size).toBe(50);
    expect(result.metadata.modelId).toBe('gemma-2-2b');
  });

  it('throws on invalid schema', async () => {
    await expect(
      loadGraphFromJSON({ invalid: true })
    ).rejects.toThrow('Invalid graph schema');
  });
});
```

### Testing Zustand Stores

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAppStore.setState({
      currentText: '',
      selectedNodeIds: new Set(),
      dials: new Map(),
    });
  });

  it('selects nodes', () => {
    const { selectNodes } = useAppStore.getState();

    selectNodes(['node-1', 'node-2']);

    const { selectedNodeIds } = useAppStore.getState();
    expect(selectedNodeIds.size).toBe(2);
    expect(selectedNodeIds.has('node-1')).toBe(true);
  });

  it('updates dial value and triggers steering recompute', () => {
    const { setDialValue, dials } = useAppStore.getState();

    setDialValue('formality', 0.5);

    expect(useAppStore.getState().dials.get('formality')?.value).toBe(0.5);
  });
});
```

### Testing React Components

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Panel } from '../components/ui/Panel';

describe('Panel', () => {
  it('renders children when open', () => {
    render(
      <Panel title="Test Panel" isOpen onClose={vi.fn()}>
        <div>Content</div>
      </Panel>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <Panel title="Test Panel" isOpen onClose={onClose}>
        <div>Content</div>
      </Panel>
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when not open', () => {
    const { container } = render(
      <Panel title="Test Panel" isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </Panel>
    );

    expect(container.firstChild).toBeNull();
  });
});
```

### Testing React Three Fiber Components

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@react-three/test-renderer';
import { NodeMesh } from '../components/graph/NodeMesh';

// Mock Zustand stores
vi.mock('../stores/largeDataStore', () => ({
  useLargeDataStore: {
    getState: () => ({
      nodePositions: new Float32Array(300), // 100 nodes * 3
      nodeColors: new Float32Array(300),
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

describe('NodeMesh', () => {
  it('renders instanced mesh with correct count', async () => {
    const renderer = await render(<NodeMesh count={100} />);

    const mesh = renderer.scene.children[0];
    expect(mesh.type).toBe('InstancedMesh');
    expect(mesh.count).toBe(100);
  });
});
```

---

## Mocking Patterns

### Mocking Three.js

```typescript
// __mocks__/three.ts
import { vi } from 'vitest';

export const Vector3 = vi.fn(() => ({
  set: vi.fn().mockReturnThis(),
  copy: vi.fn().mockReturnThis(),
  toArray: vi.fn(() => [0, 0, 0]),
}));

export const Matrix4 = vi.fn(() => ({
  setPosition: vi.fn().mockReturnThis(),
  identity: vi.fn().mockReturnThis(),
}));

export const Color = vi.fn(() => ({
  setHSL: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
}));

export const InstancedMesh = vi.fn(() => ({
  setMatrixAt: vi.fn(),
  setColorAt: vi.fn(),
  instanceMatrix: { needsUpdate: false },
  instanceColor: { needsUpdate: false },
}));
```

### Mocking Neuronpedia API

```typescript
// __mocks__/neuronpedia.ts
import { vi } from 'vitest';

export const mockFeature = {
  modelId: 'gemma-2-2b',
  layer: 12,
  index: 1622,
  explanations: [
    { description: 'Nostalgic memory recall', score: 0.85 },
  ],
  topLogits: [
    { token: 'memory', value: 0.95 },
  ],
};

export const mockNeuronpediaClient = {
  getFeature: vi.fn().mockResolvedValue(mockFeature),
  getActivations: vi.fn().mockResolvedValue({
    tokens: ['Hello', ' world'],
    activations: [
      { layer: 12, features: [{ index: 1622, activation: 0.8 }] },
    ],
  }),
  steer: vi.fn().mockResolvedValue({
    defaultOutput: { text: 'Original output' },
    steeredOutput: { text: 'Steered output' },
  }),
};
```

### Mocking Fetch

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockData),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('fetches data correctly', async () => {
  const result = await fetchFeature('gemma-2-2b', 12, 1622);

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/feature/gemma-2-2b/12-gemmascope-res-16k/1622'),
    expect.any(Object)
  );
});
```

---

## Integration Test Patterns

### Testing Hono Routes

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../app';
import { db } from '../db';

describe('GET /api/features/:model/:layer/:index', () => {
  beforeAll(async () => {
    // Seed test database
    await db.insert(features).values({
      modelId: 'gemma-2-2b',
      layer: 12,
      index: 1622,
      data: JSON.stringify(mockFeature),
      cachedAt: new Date(),
    });
  });

  afterAll(async () => {
    // Clean up
    await db.delete(features);
  });

  it('returns cached feature', async () => {
    const res = await app.request('/api/features/gemma-2-2b/12/1622');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.cached).toBe(true);
    expect(json.layer).toBe(12);
  });

  it('returns 404 for non-existent feature', async () => {
    const res = await app.request('/api/features/gemma-2-2b/12/99999');

    expect(res.status).toBe(404);
  });
});
```

### Testing with MSW (Mock Service Worker)

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { beforeAll, afterAll, afterEach } from 'vitest';

const server = setupServer(
  http.get('https://www.neuronpedia.org/api/feature/*', () => {
    return HttpResponse.json(mockFeature);
  }),
  http.post('https://www.neuronpedia.org/api/steer', () => {
    return HttpResponse.json({
      defaultOutput: { text: 'Default' },
      steeredOutput: { text: 'Steered' },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('fetches from Neuronpedia', async () => {
  const feature = await client.getFeature('gemma-2-2b', 12, 1622);
  expect(feature.layer).toBe(12);
});
```

---

## Test Utilities

### Graph Data Fixtures

```typescript
// __fixtures__/graphData.ts
import { GraphData, GraphNode, GraphEdge } from '@horus/shared';

export function createMockGraphData(options: {
  nodeCount?: number;
  edgeCount?: number;
} = {}): GraphData {
  const { nodeCount = 100, edgeCount = 50 } = options;

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (let i = 0; i < nodeCount; i++) {
    const id = `gemma-2-2b:12:${i}`;
    nodes.set(id, {
      id,
      featureId: { modelId: 'gemma-2-2b', layer: 12, index: i },
      position: [Math.random() * 100, Math.random() * 100, Math.random() * 100],
      label: `Feature ${i}`,
    });
  }

  for (let i = 0; i < edgeCount; i++) {
    const sourceIdx = Math.floor(Math.random() * nodeCount);
    const targetIdx = Math.floor(Math.random() * nodeCount);
    const id = `edge-${i}`;
    edges.set(id, {
      id,
      source: `gemma-2-2b:12:${sourceIdx}`,
      target: `gemma-2-2b:12:${targetIdx}`,
      weight: Math.random(),
      type: 'coactivation',
    });
  }

  return {
    nodes,
    edges,
    metadata: {
      modelId: 'gemma-2-2b',
      layers: [12],
      nodeCount,
      edgeCount,
      createdAt: new Date().toISOString(),
    },
  };
}
```

### Store Reset Utility

```typescript
// __utils__/storeReset.ts
import { useAppStore } from '../stores/appStore';
import { useLargeDataStore } from '../stores/largeDataStore';

export function resetStores() {
  useAppStore.setState({
    currentText: '',
    selectedNodeIds: new Set(),
    dials: new Map(),
    panels: { mixer: { open: false }, activation: { open: false } },
  });

  useLargeDataStore.setState({
    nodes: new Map(),
    edges: new Map(),
    nodePositions: new Float32Array(0),
    nodeColors: new Float32Array(0),
  });
}
```

---

## Coverage Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/__mocks__/',
        '**/*.d.ts',
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
```

---

## Test Setup File

```typescript
// src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebGL
vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas'),
    })),
  };
});
```

---

## Anti-Patterns

1. **Testing implementation details** - Test behavior, not internal state
2. **Not resetting stores** - Always reset between tests
3. **Hardcoded timeouts** - Use `waitFor` instead of `setTimeout`
4. **Mocking too much** - Only mock external dependencies
5. **Snapshot testing React components** - Test behavior, not markup
