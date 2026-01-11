/**
 * Tests for Conflict Detection
 */

import { describe, it, expect } from 'vitest';
import type { Dial } from '@horus/shared';
import {
  detectConflicts,
  checkDialPairConflict,
  getAffectedFeatures,
  filterConflictsBySeverity,
} from '../../utils/conflictDetection';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createTestDial(overrides: Partial<Dial> = {}): Dial {
  return {
    id: 'test-dial',
    label: 'Test Dial',
    value: 0,
    defaultValue: 0,
    polarity: 'bipolar',
    trace: { features: [] },
    locked: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  it('returns empty array when no dials have values', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: -0.5 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty array when dials have no overlapping features', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:5678', weight: 0.5 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty array when overlapping features have same-sign contributions', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.3 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflict when dials have opposing contributions', () => {
    const dials = new Map<string, Dial>([
      [
        'formal',
        createTestDial({
          id: 'formal',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
      [
        'casual',
        createTestDial({
          id: 'casual',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: -0.5 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].dialIds).toContain('formal');
    expect(conflicts[0].dialIds).toContain('casual');
    expect(conflicts[0].conflictingFeatures).toHaveLength(1);
    expect(conflicts[0].conflictingFeatures[0].featureId).toBe('gemma-2-2b:12:1234');
  });

  it('detects conflict with negative dial values', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: -1.0, // Negative dial value
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0, // Positive dial value
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);

    expect(conflicts).toHaveLength(1);
    // Contributions: -1.0 * 0.5 = -0.5 vs 1.0 * 0.5 = 0.5
    expect(conflicts[0].conflictingFeatures[0].contributions[0]).toBeCloseTo(-0.5);
    expect(conflicts[0].conflictingFeatures[0].contributions[1]).toBeCloseTo(0.5);
  });

  it('detects multiple conflicts between multiple dial pairs', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 1.0,
          trace: {
            features: [
              { nodeId: 'gemma-2-2b:12:1234', weight: 0.5 },
              { nodeId: 'gemma-2-2b:12:5678', weight: 0.3 },
            ],
          },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: -0.5 }],
          },
        }),
      ],
      [
        'dial3',
        createTestDial({
          id: 'dial3',
          value: 1.0,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:5678', weight: -0.3 }],
          },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);

    // dial1 conflicts with dial2 (on feature 1234)
    // dial1 conflicts with dial3 (on feature 5678)
    expect(conflicts).toHaveLength(2);
  });

  it('calculates low severity for small cancellation ratio', () => {
    // Low severity: when one contribution is much larger than the other
    // Cancellation ratio = min(|a|, |b|) / (|a| + |b|)
    // For low severity, we want this < 0.15 (so scaled ratio < 0.3)
    // e.g., 0.9 vs -0.1: ratio = 0.1 / 1.0 = 0.1 -> severity low
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.9 }] },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: -0.1 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('low');
  });

  it('calculates high severity for large cancellation', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 1.0 }] },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: -0.95 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe('high');
  });

  it('handles single dial without errors', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 1.0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
    ]);

    const conflicts = detectConflicts(dials);
    expect(conflicts).toHaveLength(0);
  });

  it('handles empty dials map', () => {
    const dials = new Map<string, Dial>();
    const conflicts = detectConflicts(dials);
    expect(conflicts).toHaveLength(0);
  });
});

describe('checkDialPairConflict', () => {
  it('returns null when no conflict exists', () => {
    const dialA = createTestDial({
      id: 'dialA',
      value: 1.0,
      trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
    });
    const dialB = createTestDial({
      id: 'dialB',
      value: 1.0,
      trace: { features: [{ nodeId: 'gemma-2-2b:12:5678', weight: 0.5 }] },
    });

    const conflict = checkDialPairConflict(dialA, dialB);
    expect(conflict).toBeNull();
  });

  it('returns conflict when dials conflict', () => {
    const dialA = createTestDial({
      id: 'dialA',
      value: 1.0,
      trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
    });
    const dialB = createTestDial({
      id: 'dialB',
      value: 1.0,
      trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: -0.5 }] },
    });

    const conflict = checkDialPairConflict(dialA, dialB);

    expect(conflict).not.toBeNull();
    expect(conflict?.dialIds).toContain('dialA');
    expect(conflict?.dialIds).toContain('dialB');
  });
});

describe('getAffectedFeatures', () => {
  it('returns empty map for empty dials', () => {
    const dials = new Map<string, Dial>();
    const features = getAffectedFeatures(dials);
    expect(features.size).toBe(0);
  });

  it('returns empty map when all dials are at zero', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 0,
          trace: { features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.5 }] },
        }),
      ],
    ]);

    const features = getAffectedFeatures(dials);
    expect(features.size).toBe(0);
  });

  it('aggregates feature contributions', () => {
    const dials = new Map<string, Dial>([
      [
        'dial1',
        createTestDial({
          id: 'dial1',
          value: 0.5,
          trace: {
            features: [
              { nodeId: 'gemma-2-2b:12:1234', weight: 0.4 },
              { nodeId: 'gemma-2-2b:12:5678', weight: 0.2 },
            ],
          },
        }),
      ],
      [
        'dial2',
        createTestDial({
          id: 'dial2',
          value: 1.0,
          trace: {
            features: [{ nodeId: 'gemma-2-2b:12:1234', weight: 0.3 }],
          },
        }),
      ],
    ]);

    const features = getAffectedFeatures(dials);

    expect(features.size).toBe(2);
    // Feature 1234: 0.5 * 0.4 + 1.0 * 0.3 = 0.2 + 0.3 = 0.5
    expect(features.get('gemma-2-2b:12:1234')).toBeCloseTo(0.5);
    // Feature 5678: 0.5 * 0.2 = 0.1
    expect(features.get('gemma-2-2b:12:5678')).toBeCloseTo(0.1);
  });
});

describe('filterConflictsBySeverity', () => {
  const conflicts = [
    {
      dialIds: ['a', 'b'] as [string, string],
      conflictingFeatures: [],
      severity: 'low' as const,
    },
    {
      dialIds: ['c', 'd'] as [string, string],
      conflictingFeatures: [],
      severity: 'medium' as const,
    },
    {
      dialIds: ['e', 'f'] as [string, string],
      conflictingFeatures: [],
      severity: 'high' as const,
    },
  ];

  it('filters to low and above', () => {
    const filtered = filterConflictsBySeverity(conflicts, 'low');
    expect(filtered).toHaveLength(3);
  });

  it('filters to medium and above', () => {
    const filtered = filterConflictsBySeverity(conflicts, 'medium');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((c) => c.severity !== 'low')).toBe(true);
  });

  it('filters to high only', () => {
    const filtered = filterConflictsBySeverity(conflicts, 'high');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].severity).toBe('high');
  });

  it('handles empty array', () => {
    const filtered = filterConflictsBySeverity([], 'high');
    expect(filtered).toHaveLength(0);
  });
});
