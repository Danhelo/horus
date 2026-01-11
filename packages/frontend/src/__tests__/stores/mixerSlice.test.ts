import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../stores/appStore';

describe('mixerSlice', () => {
  beforeEach(() => {
    // Reset store between tests
    useAppStore.setState({
      dials: new Map(),
      groups: new Map(),
      activeTraces: new Map(),
    });
  });

  describe('loadDefaultDials', () => {
    it('creates 8 default dials', () => {
      const { loadDefaultDials } = useAppStore.getState();

      loadDefaultDials();

      const { dials } = useAppStore.getState();
      expect(dials.size).toBe(8);
    });

    it('creates 3 default groups', () => {
      const { loadDefaultDials } = useAppStore.getState();

      loadDefaultDials();

      const { groups } = useAppStore.getState();
      expect(groups.size).toBe(3);
    });

    it('creates dials with correct default values', () => {
      const { loadDefaultDials } = useAppStore.getState();

      loadDefaultDials();

      const { dials } = useAppStore.getState();

      // Check a bipolar dial
      const formality = dials.get('formality');
      expect(formality).toBeDefined();
      expect(formality?.value).toBe(0);
      expect(formality?.polarity).toBe('bipolar');

      // Check a unipolar dial
      const complexity = dials.get('complexity');
      expect(complexity).toBeDefined();
      expect(complexity?.value).toBe(0);
      expect(complexity?.polarity).toBe('unipolar');
    });

    it('organizes dials into correct groups', () => {
      const { loadDefaultDials } = useAppStore.getState();

      loadDefaultDials();

      const { groups } = useAppStore.getState();

      const styleGroup = groups.get('style');
      expect(styleGroup).toBeDefined();
      expect(styleGroup?.dials).toContain('formality');
      expect(styleGroup?.dials).toContain('brevity');
      expect(styleGroup?.dials).toContain('complexity');

      const toneGroup = groups.get('tone');
      expect(toneGroup).toBeDefined();
      expect(toneGroup?.dials).toContain('emotional-valence');
      expect(toneGroup?.dials).toContain('certainty');

      const contentGroup = groups.get('content');
      expect(contentGroup).toBeDefined();
      expect(contentGroup?.dials).toContain('abstractness');
      expect(contentGroup?.dials).toContain('creativity');
      expect(contentGroup?.dials).toContain('technical');
    });
  });

  describe('setDialValue', () => {
    beforeEach(() => {
      useAppStore.getState().loadDefaultDials();
    });

    it('updates dial value correctly', () => {
      const { setDialValue } = useAppStore.getState();

      setDialValue('formality', 0.5);

      const { dials } = useAppStore.getState();
      expect(dials.get('formality')?.value).toBe(0.5);
    });

    it('clamps bipolar dial value to [-1, 1]', () => {
      const { setDialValue } = useAppStore.getState();

      setDialValue('formality', 2);
      expect(useAppStore.getState().dials.get('formality')?.value).toBe(1);

      setDialValue('formality', -2);
      expect(useAppStore.getState().dials.get('formality')?.value).toBe(-1);
    });

    it('clamps unipolar dial value to [0, 1]', () => {
      const { setDialValue } = useAppStore.getState();

      setDialValue('complexity', 2);
      expect(useAppStore.getState().dials.get('complexity')?.value).toBe(1);

      setDialValue('complexity', -1);
      expect(useAppStore.getState().dials.get('complexity')?.value).toBe(0);
    });

    it('does not update locked dial', () => {
      const { setDialValue, lockDial } = useAppStore.getState();

      lockDial('formality', true);
      setDialValue('formality', 0.5);

      const { dials } = useAppStore.getState();
      expect(dials.get('formality')?.value).toBe(0);
    });

    it('does nothing for non-existent dial', () => {
      const { setDialValue } = useAppStore.getState();
      const dialsBefore = useAppStore.getState().dials;

      setDialValue('non-existent', 0.5);

      const dialsAfter = useAppStore.getState().dials;
      expect(dialsAfter).toBe(dialsBefore);
    });
  });

  describe('resetDial', () => {
    beforeEach(() => {
      useAppStore.getState().loadDefaultDials();
    });

    it('resets dial to default value', () => {
      const { setDialValue, resetDial } = useAppStore.getState();

      setDialValue('formality', 0.8);
      expect(useAppStore.getState().dials.get('formality')?.value).toBe(0.8);

      resetDial('formality');
      expect(useAppStore.getState().dials.get('formality')?.value).toBe(0);
    });

    it('does not reset locked dial', () => {
      const { setDialValue, lockDial, resetDial } = useAppStore.getState();

      setDialValue('formality', 0.8);
      lockDial('formality', true);
      resetDial('formality');

      expect(useAppStore.getState().dials.get('formality')?.value).toBe(0.8);
    });
  });

  describe('lockDial', () => {
    beforeEach(() => {
      useAppStore.getState().loadDefaultDials();
    });

    it('locks dial', () => {
      const { lockDial } = useAppStore.getState();

      lockDial('formality', true);

      const { dials } = useAppStore.getState();
      expect(dials.get('formality')?.locked).toBe(true);
    });

    it('unlocks dial', () => {
      const { lockDial } = useAppStore.getState();

      lockDial('formality', true);
      lockDial('formality', false);

      const { dials } = useAppStore.getState();
      expect(dials.get('formality')?.locked).toBe(false);
    });
  });

  describe('trace highlights', () => {
    beforeEach(() => {
      useAppStore.getState().loadDefaultDials();
    });

    it('sets trace highlight', () => {
      const { setTraceHighlight } = useAppStore.getState();

      setTraceHighlight('formality', 0.5);

      const { activeTraces } = useAppStore.getState();
      expect(activeTraces.has('formality')).toBe(true);
      expect(activeTraces.get('formality')?.active).toBe(true);
    });

    it('clears trace highlight', () => {
      const { setTraceHighlight, clearTraceHighlight } = useAppStore.getState();

      setTraceHighlight('formality', 0.5);
      clearTraceHighlight('formality');

      const { activeTraces } = useAppStore.getState();
      expect(activeTraces.has('formality')).toBe(false);
    });

    it('sets empty nodeIds and weights for dial without features', () => {
      const { setTraceHighlight } = useAppStore.getState();

      setTraceHighlight('formality', 0.5);

      const { activeTraces } = useAppStore.getState();
      const trace = activeTraces.get('formality');
      expect(trace?.nodeIds.size).toBe(0);
      expect(trace?.weights.size).toBe(0);
    });
  });

  describe('toggleGroupCollapsed', () => {
    beforeEach(() => {
      useAppStore.getState().loadDefaultDials();
    });

    it('toggles group collapsed state', () => {
      const { toggleGroupCollapsed } = useAppStore.getState();

      // Initially not collapsed
      expect(useAppStore.getState().groups.get('style')?.collapsed).toBe(false);

      toggleGroupCollapsed('style');
      expect(useAppStore.getState().groups.get('style')?.collapsed).toBe(true);

      toggleGroupCollapsed('style');
      expect(useAppStore.getState().groups.get('style')?.collapsed).toBe(false);
    });
  });

  describe('addDial/removeDial', () => {
    beforeEach(() => {
      useAppStore.getState().loadDefaultDials();
    });

    it('adds a new dial', () => {
      const { addDial } = useAppStore.getState();

      addDial({
        id: 'custom-dial',
        label: 'Custom',
        value: 0,
        defaultValue: 0,
        polarity: 'bipolar',
        locked: false,
        trace: { features: [] },
      });

      expect(useAppStore.getState().dials.has('custom-dial')).toBe(true);
    });

    it('adds dial to group when groupId specified', () => {
      const { addDial } = useAppStore.getState();

      addDial(
        {
          id: 'custom-dial',
          label: 'Custom',
          value: 0,
          defaultValue: 0,
          polarity: 'bipolar',
          locked: false,
          trace: { features: [] },
        },
        'style'
      );

      const styleGroup = useAppStore.getState().groups.get('style');
      expect(styleGroup?.dials).toContain('custom-dial');
    });

    it('removes dial', () => {
      const { removeDial } = useAppStore.getState();

      removeDial('formality');

      expect(useAppStore.getState().dials.has('formality')).toBe(false);
    });

    it('removes dial from group when removed', () => {
      const { removeDial } = useAppStore.getState();

      removeDial('formality');

      const styleGroup = useAppStore.getState().groups.get('style');
      expect(styleGroup?.dials).not.toContain('formality');
    });

    it('clears trace when dial is removed', () => {
      const { setTraceHighlight, removeDial } = useAppStore.getState();

      setTraceHighlight('formality', 0.5);
      expect(useAppStore.getState().activeTraces.has('formality')).toBe(true);

      removeDial('formality');
      expect(useAppStore.getState().activeTraces.has('formality')).toBe(false);
    });
  });

  describe('clearAllDials', () => {
    it('clears all dials, groups, and traces', () => {
      const { loadDefaultDials, setTraceHighlight, clearAllDials } = useAppStore.getState();

      loadDefaultDials();
      setTraceHighlight('formality', 0.5);

      clearAllDials();

      const state = useAppStore.getState();
      expect(state.dials.size).toBe(0);
      expect(state.groups.size).toBe(0);
      expect(state.activeTraces.size).toBe(0);
    });
  });
});
