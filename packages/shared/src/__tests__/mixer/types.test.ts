import { describe, it, expect } from 'vitest';
import { createDialId, parseDialId, getDialRange, clampDialValue } from '../../mixer/types';

describe('createDialId', () => {
  it('creates correct dial ID format', () => {
    const id = createDialId('tone', 'formality');
    expect(id).toBe('tone:formality');
  });

  it('handles empty name', () => {
    const id = createDialId('group', '');
    expect(id).toBe('group:');
  });

  it('handles special characters in name', () => {
    const id = createDialId('style', 'formal-casual');
    expect(id).toBe('style:formal-casual');
  });
});

describe('parseDialId', () => {
  it('parses valid dial ID', () => {
    const result = parseDialId('tone:formality');
    expect(result).toEqual({
      groupId: 'tone',
      name: 'formality',
    });
  });

  it('handles name with colons', () => {
    const result = parseDialId('style:sub:category');
    expect(result).toEqual({
      groupId: 'style',
      name: 'sub:category',
    });
  });

  it('returns null for invalid format', () => {
    expect(parseDialId('nocolon')).toBeNull();
    expect(parseDialId('')).toBeNull();
  });

  it('round-trips with createDialId', () => {
    const original = { groupId: 'tone', name: 'formality' };
    const id = createDialId(original.groupId, original.name);
    const parsed = parseDialId(id);
    expect(parsed).toEqual(original);
  });
});

describe('getDialRange', () => {
  it('returns bipolar range', () => {
    const range = getDialRange('bipolar');
    expect(range).toEqual({ min: -1, max: 1 });
  });

  it('returns unipolar range', () => {
    const range = getDialRange('unipolar');
    expect(range).toEqual({ min: 0, max: 1 });
  });
});

describe('clampDialValue', () => {
  it('clamps bipolar values', () => {
    expect(clampDialValue(-2, 'bipolar')).toBe(-1);
    expect(clampDialValue(2, 'bipolar')).toBe(1);
    expect(clampDialValue(0.5, 'bipolar')).toBe(0.5);
    expect(clampDialValue(-0.5, 'bipolar')).toBe(-0.5);
  });

  it('clamps unipolar values', () => {
    expect(clampDialValue(-1, 'unipolar')).toBe(0);
    expect(clampDialValue(2, 'unipolar')).toBe(1);
    expect(clampDialValue(0.5, 'unipolar')).toBe(0.5);
  });

  it('handles boundary values', () => {
    expect(clampDialValue(-1, 'bipolar')).toBe(-1);
    expect(clampDialValue(1, 'bipolar')).toBe(1);
    expect(clampDialValue(0, 'unipolar')).toBe(0);
    expect(clampDialValue(1, 'unipolar')).toBe(1);
  });
});
