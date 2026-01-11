/**
 * Vitest test setup file for HORUS frontend
 *
 * Provides mocks for:
 * - React Three Fiber
 * - Three.js
 * - Browser APIs (matchMedia, ResizeObserver, etc.)
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Browser API Mocks
// ---------------------------------------------------------------------------

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
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

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16) as unknown as number);
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id as unknown as NodeJS.Timeout));

// Mock PointerEvent (not available in jsdom)
class MockPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;

  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    this.pointerId = params.pointerId ?? 0;
    this.pointerType = params.pointerType ?? 'mouse';
  }
}
global.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;

// ---------------------------------------------------------------------------
// Three.js Mocks
// ---------------------------------------------------------------------------

// Create mock classes that simulate Three.js behavior
class MockVector3 {
  x = 0;
  y = 0;
  z = 0;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: MockVector3) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  distanceTo(v: MockVector3) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  lerp(v: MockVector3, alpha: number) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
}

class MockMatrix4 {
  elements = new Float32Array(16);

  constructor() {
    this.identity();
  }

  identity() {
    this.elements.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return this;
  }

  setPosition(x: number, y: number, z: number) {
    this.elements[12] = x;
    this.elements[13] = y;
    this.elements[14] = z;
    return this;
  }

  decompose(position: MockVector3, _quaternion: unknown, scale: MockVector3) {
    position.set(this.elements[12], this.elements[13], this.elements[14]);
    scale.set(1, 1, 1);
    return this;
  }
}

class MockColor {
  r = 0;
  g = 0;
  b = 0;

  constructor(color?: string | number) {
    if (typeof color === 'string') {
      this.setStyle(color);
    } else if (typeof color === 'number') {
      this.setHex(color);
    }
  }

  setRGB(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }

  setHSL(h: number, s: number, l: number) {
    // Simplified HSL to RGB conversion
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;

    if (h < 1 / 6) {
      this.r = c + m;
      this.g = x + m;
      this.b = m;
    } else if (h < 2 / 6) {
      this.r = x + m;
      this.g = c + m;
      this.b = m;
    } else if (h < 3 / 6) {
      this.r = m;
      this.g = c + m;
      this.b = x + m;
    } else if (h < 4 / 6) {
      this.r = m;
      this.g = x + m;
      this.b = c + m;
    } else if (h < 5 / 6) {
      this.r = x + m;
      this.g = m;
      this.b = c + m;
    } else {
      this.r = c + m;
      this.g = m;
      this.b = x + m;
    }
    return this;
  }

  setHex(hex: number) {
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }

  setStyle(style: string) {
    if (style.startsWith('#')) {
      this.setHex(parseInt(style.slice(1), 16));
    }
    return this;
  }

  copy(color: MockColor) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }

  lerpColors(c1: MockColor, c2: MockColor, alpha: number) {
    this.r = c1.r + (c2.r - c1.r) * alpha;
    this.g = c1.g + (c2.g - c1.g) * alpha;
    this.b = c1.b + (c2.b - c1.b) * alpha;
    return this;
  }
}

class MockBufferAttribute {
  array: Float32Array;
  itemSize: number;
  needsUpdate = false;

  constructor(array: Float32Array, itemSize: number) {
    this.array = array;
    this.itemSize = itemSize;
  }
}

class MockBufferGeometry {
  attributes: Record<string, MockBufferAttribute> = {};

  setAttribute(name: string, attribute: MockBufferAttribute) {
    this.attributes[name] = attribute;
    return this;
  }

  getAttribute(name: string) {
    return this.attributes[name];
  }

  computeBoundingSphere() {}
  computeBoundingBox() {}
  dispose() {}
}

class MockInstancedMesh {
  count: number;
  geometry: MockBufferGeometry;
  material: unknown;
  instanceMatrix: { needsUpdate: boolean; array: Float32Array };
  instanceColor: { needsUpdate: boolean; array: Float32Array } | null = null;
  frustumCulled = true;

  constructor(_geometry?: unknown, _material?: unknown, count = 0) {
    this.count = count;
    this.geometry = new MockBufferGeometry();
    this.material = _material;
    this.instanceMatrix = {
      needsUpdate: false,
      array: new Float32Array(count * 16),
    };
  }

  setMatrixAt(index: number, matrix: MockMatrix4) {
    this.instanceMatrix.array.set(matrix.elements, index * 16);
  }

  getMatrixAt(index: number, matrix: MockMatrix4) {
    const offset = index * 16;
    for (let i = 0; i < 16; i++) {
      matrix.elements[i] = this.instanceMatrix.array[offset + i];
    }
  }

  setColorAt(index: number, color: MockColor) {
    if (!this.instanceColor) {
      this.instanceColor = {
        needsUpdate: false,
        array: new Float32Array(this.count * 3),
      };
    }
    const offset = index * 3;
    this.instanceColor.array[offset] = color.r;
    this.instanceColor.array[offset + 1] = color.g;
    this.instanceColor.array[offset + 2] = color.b;
  }

  computeBoundingSphere() {}
  computeBoundingBox() {}
  dispose() {}
}

class MockWebGLRenderer {
  domElement = document.createElement('canvas');

  setSize() {}
  setPixelRatio() {}
  render() {}
  dispose() {}
}

// Export mocks for use in tests
export const ThreeMocks = {
  Vector3: MockVector3,
  Matrix4: MockMatrix4,
  Color: MockColor,
  BufferAttribute: MockBufferAttribute,
  BufferGeometry: MockBufferGeometry,
  InstancedMesh: MockInstancedMesh,
  WebGLRenderer: MockWebGLRenderer,
};

// ---------------------------------------------------------------------------
// React Three Fiber Mocks
// ---------------------------------------------------------------------------

vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual('@react-three/fiber');
  return {
    ...actual,
    Canvas: vi.fn(({ children }) => children),
    useFrame: vi.fn(),
    useThree: vi.fn(() => ({
      camera: {
        position: new MockVector3(0, 0, 10),
        lookAt: vi.fn(),
        updateProjectionMatrix: vi.fn(),
      },
      gl: new MockWebGLRenderer(),
      scene: {},
      size: { width: 800, height: 600 },
      invalidate: vi.fn(),
      setSize: vi.fn(),
    })),
  };
});

// ---------------------------------------------------------------------------
// drei Mocks
// ---------------------------------------------------------------------------

vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual('@react-three/drei');
  return {
    ...actual,
    OrbitControls: vi.fn(() => null),
    Environment: vi.fn(() => null),
    Stats: vi.fn(() => null),
  };
});

// ---------------------------------------------------------------------------
// Zustand Store Reset Helper
// ---------------------------------------------------------------------------

export function resetAllStores() {
  // Import stores dynamically to avoid circular dependencies
  import('../stores').then(({ useAppStore, useLargeDataStore }) => {
    useAppStore.setState({
      hoveredNodeId: null,
      selectedNodeIds: new Set(),
      lod: 'medium' as const,
      panelsOpen: { mixer: true, details: false, trajectory: false },
      nodes: new Map(),
      edges: new Map(),
      activations: new Map(),
    });

    useLargeDataStore.setState({
      positions: null,
      colors: null,
      scales: null,
      edgePositions: null,
      edgeColors: null,
      nodeIndexMap: new Map(),
      nodeCount: 0,
      edgeCount: 0,
      edgeWeightThreshold: 0.1,
      edgesVisible: true,
    });
  });
}
