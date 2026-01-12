import type { StateCreator } from 'zustand';
import type { Dial, DialGroup, TraceHighlight } from '@horus/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MixerSlice {
  // State
  dials: Map<string, Dial>;
  groups: Map<string, DialGroup>;
  activeTraces: Map<string, TraceHighlight>;

  // Actions
  setDialValue: (dialId: string, value: number) => void;
  resetDial: (dialId: string) => void;
  lockDial: (dialId: string, locked: boolean) => void;
  setTraceHighlight: (dialId: string, intensity: number) => void;
  clearTraceHighlight: (dialId: string) => void;
  addDial: (dial: Dial, groupId?: string) => void;
  removeDial: (dialId: string) => void;
  addGroup: (group: DialGroup) => void;
  removeGroup: (groupId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  loadDefaultDials: () => void;
  clearAllDials: () => void;
}

// ---------------------------------------------------------------------------
// Trace Colors
// ---------------------------------------------------------------------------

const TRACE_COLORS = [
  '#d4af37', // Gold (primary)
  '#00bfff', // Electric blue
  '#ff6b6b', // Coral
  '#20b2aa', // Teal
  '#9b59b6', // Purple
  '#ffa500', // Orange
];

function getTraceColor(dialIndex: number): string {
  return TRACE_COLORS[dialIndex % TRACE_COLORS.length];
}

// ---------------------------------------------------------------------------
// Default Dials Configuration
// ---------------------------------------------------------------------------

interface DefaultDialDefinition {
  id: string;
  label: string;
  description: string;
  polarity: 'bipolar' | 'unipolar';
  groupId: string;
}

const DEFAULT_DIAL_DEFINITIONS: DefaultDialDefinition[] = [
  // Style group
  {
    id: 'formality',
    label: 'Formality',
    description: 'Casual to formal',
    polarity: 'bipolar',
    groupId: 'style',
  },
  {
    id: 'brevity',
    label: 'Brevity',
    description: 'Verbose to concise',
    polarity: 'bipolar',
    groupId: 'style',
  },
  {
    id: 'complexity',
    label: 'Complexity',
    description: 'Simple to complex',
    polarity: 'unipolar',
    groupId: 'style',
  },

  // Tone group
  {
    id: 'emotional-valence',
    label: 'Valence',
    description: 'Negative to positive',
    polarity: 'bipolar',
    groupId: 'tone',
  },
  {
    id: 'certainty',
    label: 'Certainty',
    description: 'Uncertain to confident',
    polarity: 'bipolar',
    groupId: 'tone',
  },

  // Content group
  {
    id: 'abstractness',
    label: 'Abstractness',
    description: 'Concrete to abstract',
    polarity: 'bipolar',
    groupId: 'content',
  },
  {
    id: 'creativity',
    label: 'Creativity',
    description: 'Conventional to creative',
    polarity: 'unipolar',
    groupId: 'content',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'General to technical',
    polarity: 'unipolar',
    groupId: 'content',
  },
];

const DEFAULT_GROUPS: Array<{ id: string; label: string; description?: string }> = [
  { id: 'style', label: 'Style', description: 'Writing style controls' },
  { id: 'tone', label: 'Tone', description: 'Emotional tone controls' },
  { id: 'content', label: 'Content', description: 'Content type controls' },
];

function createDefaultDial(def: DefaultDialDefinition): Dial {
  const defaultValue = def.polarity === 'bipolar' ? 0 : 0;
  return {
    id: def.id,
    label: def.label,
    value: defaultValue,
    defaultValue,
    polarity: def.polarity,
    locked: false,
    trace: {
      features: [], // Will be populated from Neuronpedia search later
      color: undefined,
    },
  };
}

function createDefaultGroup(
  def: { id: string; label: string; description?: string },
  dialIds: string[]
): DialGroup {
  return {
    id: def.id,
    label: def.label,
    dials: dialIds,
    collapsed: false,
  };
}

// ---------------------------------------------------------------------------
// Slice Creator
// ---------------------------------------------------------------------------

export const createMixerSlice: StateCreator<MixerSlice, [], [], MixerSlice> = (set, get) => ({
  // Initial state
  dials: new Map(),
  groups: new Map(),
  activeTraces: new Map(),

  // Actions
  setDialValue: (dialId: string, value: number) => {
    const { dials } = get();
    const dial = dials.get(dialId);
    if (!dial || dial.locked) return;

    // Clamp value based on polarity
    const { min, max } = dial.polarity === 'bipolar' ? { min: -1, max: 1 } : { min: 0, max: 1 };
    const clampedValue = Math.max(min, Math.min(max, value));

    const newDials = new Map(dials);
    newDials.set(dialId, { ...dial, value: clampedValue });

    set({ dials: newDials });
  },

  resetDial: (dialId: string) => {
    const { dials } = get();
    const dial = dials.get(dialId);
    if (!dial || dial.locked) return;

    const newDials = new Map(dials);
    newDials.set(dialId, { ...dial, value: dial.defaultValue });

    set({ dials: newDials });
  },

  lockDial: (dialId: string, locked: boolean) => {
    const { dials } = get();
    const dial = dials.get(dialId);
    if (!dial) return;

    const newDials = new Map(dials);
    newDials.set(dialId, { ...dial, locked });

    set({ dials: newDials });
  },

  setTraceHighlight: (dialId: string, intensity: number) => {
    const { dials, activeTraces } = get();
    const dial = dials.get(dialId);
    if (!dial) return;

    // Get node IDs and weights from dial's trace
    const nodeIds = new Set(dial.trace.features.map((f) => f.nodeId));
    const weights = new Map(dial.trace.features.map((f) => [f.nodeId, f.weight]));

    // Get dial index for color
    const dialIndex = Array.from(dials.keys()).indexOf(dialId);
    const _color = dial.trace.color ?? getTraceColor(dialIndex);

    const newActiveTraces = new Map(activeTraces);
    newActiveTraces.set(dialId, {
      dialId,
      nodeIds,
      weights,
      active: intensity > 0,
    });

    set({ activeTraces: newActiveTraces });
  },

  clearTraceHighlight: (dialId: string) => {
    const { activeTraces } = get();
    const newActiveTraces = new Map(activeTraces);
    newActiveTraces.delete(dialId);

    set({ activeTraces: newActiveTraces });
  },

  addDial: (dial: Dial, groupId?: string) => {
    const { dials, groups } = get();
    const newDials = new Map(dials);
    newDials.set(dial.id, dial);

    // If groupId specified, add dial to that group
    if (groupId) {
      const group = groups.get(groupId);
      if (group && !group.dials.includes(dial.id)) {
        const newGroups = new Map(groups);
        newGroups.set(groupId, {
          ...group,
          dials: [...group.dials, dial.id],
        });
        set({ dials: newDials, groups: newGroups });
        return;
      }
    }

    set({ dials: newDials });
  },

  removeDial: (dialId: string) => {
    const { dials, groups, activeTraces } = get();

    // Remove from dials
    const newDials = new Map(dials);
    newDials.delete(dialId);

    // Remove from any groups
    const newGroups = new Map(groups);
    for (const [groupId, group] of newGroups) {
      if (group.dials.includes(dialId)) {
        newGroups.set(groupId, {
          ...group,
          dials: group.dials.filter((id) => id !== dialId),
        });
      }
    }

    // Remove any active traces
    const newActiveTraces = new Map(activeTraces);
    newActiveTraces.delete(dialId);

    set({
      dials: newDials,
      groups: newGroups,
      activeTraces: newActiveTraces,
    });
  },

  addGroup: (group: DialGroup) => {
    const { groups } = get();
    const newGroups = new Map(groups);
    newGroups.set(group.id, group);
    set({ groups: newGroups });
  },

  removeGroup: (groupId: string) => {
    const { groups } = get();
    const newGroups = new Map(groups);
    newGroups.delete(groupId);
    set({ groups: newGroups });
  },

  toggleGroupCollapsed: (groupId: string) => {
    const { groups } = get();
    const group = groups.get(groupId);
    if (!group) return;

    const newGroups = new Map(groups);
    newGroups.set(groupId, {
      ...group,
      collapsed: !group.collapsed,
    });

    set({ groups: newGroups });
  },

  loadDefaultDials: () => {
    const newDials = new Map<string, Dial>();
    const newGroups = new Map<string, DialGroup>();

    // Create dials
    for (const def of DEFAULT_DIAL_DEFINITIONS) {
      newDials.set(def.id, createDefaultDial(def));
    }

    // Create groups with their dial IDs
    for (const groupDef of DEFAULT_GROUPS) {
      const dialIds = DEFAULT_DIAL_DEFINITIONS.filter((d) => d.groupId === groupDef.id).map(
        (d) => d.id
      );
      newGroups.set(groupDef.id, createDefaultGroup(groupDef, dialIds));
    }

    set({
      dials: newDials,
      groups: newGroups,
      activeTraces: new Map(),
    });
  },

  clearAllDials: () => {
    set({
      dials: new Map(),
      groups: new Map(),
      activeTraces: new Map(),
    });
  },
});
