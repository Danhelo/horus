import { describe, it, expect } from 'vitest';
import {
  isDialPolarity,
  isTraceFeature,
  isDialTrace,
  isDial,
  isDialGroup,
  isTraceHighlight,
} from '../../mixer/guards';
import type { Dial, DialGroup, TraceHighlight } from '../../mixer/types';

describe('isDialPolarity', () => {
  it('validates bipolar', () => {
    expect(isDialPolarity('bipolar')).toBe(true);
  });

  it('validates unipolar', () => {
    expect(isDialPolarity('unipolar')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isDialPolarity('invalid')).toBe(false);
    expect(isDialPolarity('')).toBe(false);
    expect(isDialPolarity(123)).toBe(false);
    expect(isDialPolarity(null)).toBe(false);
    expect(isDialPolarity(undefined)).toBe(false);
  });
});

describe('isTraceFeature', () => {
  it('validates correct trace feature', () => {
    expect(isTraceFeature({ nodeId: 'gemma-2-2b:12:456', weight: 0.8 })).toBe(true);
  });

  it('validates boundary weights', () => {
    expect(isTraceFeature({ nodeId: 'test:0:0', weight: 0 })).toBe(true);
    expect(isTraceFeature({ nodeId: 'test:0:0', weight: 1 })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isTraceFeature(null)).toBe(false);
    expect(isTraceFeature(undefined)).toBe(false);
  });

  it('rejects invalid nodeId', () => {
    expect(isTraceFeature({ nodeId: '', weight: 0.5 })).toBe(false);
    expect(isTraceFeature({ nodeId: 123, weight: 0.5 })).toBe(false);
  });

  it('rejects invalid weight', () => {
    expect(isTraceFeature({ nodeId: 'test', weight: -0.1 })).toBe(false);
    expect(isTraceFeature({ nodeId: 'test', weight: 1.1 })).toBe(false);
    expect(isTraceFeature({ nodeId: 'test', weight: 'high' })).toBe(false);
  });
});

describe('isDialTrace', () => {
  it('validates correct dial trace', () => {
    expect(isDialTrace({
      features: [
        { nodeId: 'gemma-2-2b:12:456', weight: 0.8 },
        { nodeId: 'gemma-2-2b:12:789', weight: 0.6 },
      ],
    })).toBe(true);
  });

  it('validates with optional color', () => {
    expect(isDialTrace({
      features: [{ nodeId: 'test:0:0', weight: 0.5 }],
      color: '#d4af37',
    })).toBe(true);
  });

  it('validates empty features array', () => {
    expect(isDialTrace({ features: [] })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isDialTrace(null)).toBe(false);
    expect(isDialTrace(undefined)).toBe(false);
  });

  it('rejects non-array features', () => {
    expect(isDialTrace({ features: 'not an array' })).toBe(false);
  });

  it('rejects invalid feature in array', () => {
    expect(isDialTrace({
      features: [
        { nodeId: 'valid:0:0', weight: 0.5 },
        { nodeId: '', weight: 0.5 }, // invalid
      ],
    })).toBe(false);
  });

  it('rejects invalid color type', () => {
    expect(isDialTrace({
      features: [],
      color: 123,
    })).toBe(false);
  });
});

describe('isDial', () => {
  const validDial: Dial = {
    id: 'tone:formality',
    label: 'Formality',
    value: 0.5,
    defaultValue: 0,
    polarity: 'bipolar',
    trace: { features: [] },
    locked: false,
  };

  it('validates correct dial', () => {
    expect(isDial(validDial)).toBe(true);
  });

  it('validates with complex trace', () => {
    expect(isDial({
      ...validDial,
      trace: {
        features: [
          { nodeId: 'gemma-2-2b:12:456', weight: 0.8 },
        ],
        color: '#ffd700',
      },
    })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isDial(null)).toBe(false);
    expect(isDial(undefined)).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isDial({ ...validDial, id: '' })).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isDial({ ...validDial, value: NaN })).toBe(false);
    expect(isDial({ ...validDial, value: Infinity })).toBe(false);
    expect(isDial({ ...validDial, defaultValue: NaN })).toBe(false);
  });

  it('rejects invalid polarity', () => {
    expect(isDial({ ...validDial, polarity: 'tripolar' })).toBe(false);
  });

  it('rejects invalid trace', () => {
    expect(isDial({ ...validDial, trace: null })).toBe(false);
    expect(isDial({ ...validDial, trace: {} })).toBe(false);
  });

  it('rejects non-boolean locked', () => {
    expect(isDial({ ...validDial, locked: 'yes' })).toBe(false);
  });
});

describe('isDialGroup', () => {
  const validGroup: DialGroup = {
    id: 'tone',
    label: 'Tone',
    dials: ['tone:formality', 'tone:warmth'],
    collapsed: false,
  };

  it('validates correct dial group', () => {
    expect(isDialGroup(validGroup)).toBe(true);
  });

  it('validates empty dials array', () => {
    expect(isDialGroup({ ...validGroup, dials: [] })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isDialGroup(null)).toBe(false);
    expect(isDialGroup(undefined)).toBe(false);
  });

  it('rejects empty id', () => {
    expect(isDialGroup({ ...validGroup, id: '' })).toBe(false);
  });

  it('rejects non-array dials', () => {
    expect(isDialGroup({ ...validGroup, dials: 'not-array' })).toBe(false);
  });

  it('rejects non-string dial IDs', () => {
    expect(isDialGroup({ ...validGroup, dials: [123, 456] })).toBe(false);
  });

  it('rejects non-boolean collapsed', () => {
    expect(isDialGroup({ ...validGroup, collapsed: 'yes' })).toBe(false);
  });
});

describe('isTraceHighlight', () => {
  const validHighlight: TraceHighlight = {
    dialId: 'tone:formality',
    nodeIds: new Set(['gemma-2-2b:12:456', 'gemma-2-2b:12:789']),
    weights: new Map([
      ['gemma-2-2b:12:456', 0.8],
      ['gemma-2-2b:12:789', 0.6],
    ]),
    active: true,
  };

  it('validates correct trace highlight', () => {
    expect(isTraceHighlight(validHighlight)).toBe(true);
  });

  it('validates with empty Set and Map', () => {
    expect(isTraceHighlight({
      dialId: 'test',
      nodeIds: new Set(),
      weights: new Map(),
      active: false,
    })).toBe(true);
  });

  it('rejects null and undefined', () => {
    expect(isTraceHighlight(null)).toBe(false);
    expect(isTraceHighlight(undefined)).toBe(false);
  });

  it('rejects empty dialId', () => {
    expect(isTraceHighlight({ ...validHighlight, dialId: '' })).toBe(false);
  });

  it('rejects non-Set nodeIds', () => {
    expect(isTraceHighlight({ ...validHighlight, nodeIds: [] })).toBe(false);
    expect(isTraceHighlight({ ...validHighlight, nodeIds: {} })).toBe(false);
  });

  it('rejects non-Map weights', () => {
    expect(isTraceHighlight({ ...validHighlight, weights: {} })).toBe(false);
    expect(isTraceHighlight({ ...validHighlight, weights: [] })).toBe(false);
  });

  it('rejects non-boolean active', () => {
    expect(isTraceHighlight({ ...validHighlight, active: 'yes' })).toBe(false);
  });
});
