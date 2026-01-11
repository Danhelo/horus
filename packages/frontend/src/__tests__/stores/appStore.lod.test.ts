import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../stores/appStore';

describe('LOD Slice', () => {
  beforeEach(() => {
    // Reset store to default state
    useAppStore.setState({ lod: 'medium' });
  });

  it('initializes with medium LOD by default', () => {
    const { lod } = useAppStore.getState();
    expect(lod).toBe('medium');
  });

  it('updates LOD to near', () => {
    const { setLod } = useAppStore.getState();

    setLod('near');

    expect(useAppStore.getState().lod).toBe('near');
  });

  it('updates LOD to far', () => {
    const { setLod } = useAppStore.getState();

    setLod('far');

    expect(useAppStore.getState().lod).toBe('far');
  });

  it('updates LOD to medium', () => {
    const { setLod } = useAppStore.getState();

    // First set to a different value
    setLod('far');
    expect(useAppStore.getState().lod).toBe('far');

    // Then set back to medium
    setLod('medium');
    expect(useAppStore.getState().lod).toBe('medium');
  });

  it('allows rapid LOD changes', () => {
    const { setLod } = useAppStore.getState();

    // Simulate rapid zoom in/out
    setLod('near');
    setLod('medium');
    setLod('far');
    setLod('medium');
    setLod('near');

    expect(useAppStore.getState().lod).toBe('near');
  });
});
