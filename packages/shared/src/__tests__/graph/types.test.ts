import { describe, it, expect } from 'vitest';
import { createNodeId, parseNodeId } from '../../graph/types';

describe('createNodeId', () => {
  it('creates correct node ID format', () => {
    const id = createNodeId('gemma-2-2b', 12, 456);
    expect(id).toBe('gemma-2-2b:12:456');
  });

  it('handles model IDs with colons', () => {
    const id = createNodeId('model:variant', 5, 100);
    expect(id).toBe('model:variant:5:100');
  });

  it('handles zero layer and index', () => {
    const id = createNodeId('test', 0, 0);
    expect(id).toBe('test:0:0');
  });
});

describe('parseNodeId', () => {
  it('parses valid node ID', () => {
    const result = parseNodeId('gemma-2-2b:12:456');
    expect(result).toEqual({
      modelId: 'gemma-2-2b',
      layer: 12,
      index: 456,
    });
  });

  it('handles model IDs with colons', () => {
    const result = parseNodeId('model:variant:5:100');
    expect(result).toEqual({
      modelId: 'model:variant',
      layer: 5,
      index: 100,
    });
  });

  it('returns null for invalid format', () => {
    expect(parseNodeId('invalid')).toBeNull();
    expect(parseNodeId('only:one')).toBeNull();
    expect(parseNodeId('model:notanumber:456')).toBeNull();
    expect(parseNodeId('model:12:notanumber')).toBeNull();
  });

  it('round-trips with createNodeId', () => {
    const original = { modelId: 'gemma-2-2b', layer: 12, index: 456 };
    const id = createNodeId(original.modelId, original.layer, original.index);
    const parsed = parseNodeId(id);
    expect(parsed).toEqual(original);
  });
});
