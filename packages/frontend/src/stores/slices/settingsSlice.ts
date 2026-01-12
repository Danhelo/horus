import type { StateCreator } from 'zustand';

// ---------------------------------------------------------------------------
// Settings Slice
// ---------------------------------------------------------------------------
// Persistent user settings for camera, labels, and rendering.

// LocalStorage key for settings persistence
const SETTINGS_STORAGE_KEY = 'horus-settings';

export interface SettingsSlice {
  // Camera settings
  movementSpeed: number; // Base movement speed (units/sec), default 30
  isPointerLocked: boolean; // FPS mode active

  // Label settings
  labelCount: number; // Number of proximity labels to show, default 50
  showLabels: boolean; // Whether to show labels at all
  labelDistanceThreshold: number; // Distance for full vs truncated labels
  labelFontSize: number; // Font size multiplier (0.5-2.0), default 1.0

  // Rendering settings
  showEdges: boolean; // Whether to show edge lines
  edgeFadeStart: number; // Distance where edges start fading, default 40
  edgeFadeEnd: number; // Distance where edges are fully transparent, default 80

  // UI settings
  settingsBarCollapsed: boolean; // Whether settings bar is collapsed

  // Actions
  setMovementSpeed: (speed: number) => void;
  setPointerLocked: (locked: boolean) => void;
  setLabelCount: (count: number) => void;
  setShowLabels: (show: boolean) => void;
  setLabelDistanceThreshold: (distance: number) => void;
  setLabelFontSize: (size: number) => void;
  setShowEdges: (show: boolean) => void;
  setEdgeFadeStart: (distance: number) => void;
  setEdgeFadeEnd: (distance: number) => void;
  setSettingsBarCollapsed: (collapsed: boolean) => void;
  loadSettingsFromStorage: () => void;
}

// Default settings
const DEFAULT_SETTINGS = {
  movementSpeed: 30,
  isPointerLocked: false,
  labelCount: 50,
  showLabels: true,
  labelDistanceThreshold: 15,
  labelFontSize: 1.0,
  showEdges: true,
  edgeFadeStart: 40,
  edgeFadeEnd: 80,
  settingsBarCollapsed: false,
};

interface StoredSettings {
  movementSpeed?: number;
  labelCount?: number;
  showLabels?: boolean;
  labelDistanceThreshold?: number;
  labelFontSize?: number;
  showEdges?: boolean;
  edgeFadeStart?: number;
  edgeFadeEnd?: number;
  settingsBarCollapsed?: boolean;
}

function loadFromStorage(): Partial<StoredSettings> {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as StoredSettings;
  } catch {
    return {};
  }
}

function saveToStorage(settings: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

// Helper to get all persistable settings from current state
function getAllSettings(state: SettingsSlice): StoredSettings {
  return {
    movementSpeed: state.movementSpeed,
    labelCount: state.labelCount,
    showLabels: state.showLabels,
    labelDistanceThreshold: state.labelDistanceThreshold,
    labelFontSize: state.labelFontSize,
    showEdges: state.showEdges,
    edgeFadeStart: state.edgeFadeStart,
    edgeFadeEnd: state.edgeFadeEnd,
    settingsBarCollapsed: state.settingsBarCollapsed,
  };
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (
  set,
  get
) => ({
  // Initial values with defaults
  movementSpeed: DEFAULT_SETTINGS.movementSpeed,
  isPointerLocked: DEFAULT_SETTINGS.isPointerLocked,
  labelCount: DEFAULT_SETTINGS.labelCount,
  showLabels: DEFAULT_SETTINGS.showLabels,
  labelDistanceThreshold: DEFAULT_SETTINGS.labelDistanceThreshold,
  labelFontSize: DEFAULT_SETTINGS.labelFontSize,
  showEdges: DEFAULT_SETTINGS.showEdges,
  edgeFadeStart: DEFAULT_SETTINGS.edgeFadeStart,
  edgeFadeEnd: DEFAULT_SETTINGS.edgeFadeEnd,
  settingsBarCollapsed: DEFAULT_SETTINGS.settingsBarCollapsed,

  setMovementSpeed: (speed) => {
    const clamped = Math.max(5, Math.min(200, speed));
    set({ movementSpeed: clamped });
    saveToStorage({ ...getAllSettings(get()), movementSpeed: clamped });
  },

  setPointerLocked: (locked) => {
    set({ isPointerLocked: locked });
    // Don't persist pointer lock state - it's transient
  },

  setLabelCount: (count) => {
    const clamped = Math.max(0, Math.min(200, count));
    set({ labelCount: clamped });
    saveToStorage({ ...getAllSettings(get()), labelCount: clamped });
  },

  setShowLabels: (show) => {
    set({ showLabels: show });
    saveToStorage({ ...getAllSettings(get()), showLabels: show });
  },

  setLabelDistanceThreshold: (distance) => {
    const clamped = Math.max(5, Math.min(100, distance));
    set({ labelDistanceThreshold: clamped });
    saveToStorage({ ...getAllSettings(get()), labelDistanceThreshold: clamped });
  },

  setLabelFontSize: (size) => {
    const clamped = Math.max(0.5, Math.min(2.0, size));
    set({ labelFontSize: clamped });
    saveToStorage({ ...getAllSettings(get()), labelFontSize: clamped });
  },

  setShowEdges: (show) => {
    set({ showEdges: show });
    saveToStorage({ ...getAllSettings(get()), showEdges: show });
  },

  setEdgeFadeStart: (distance) => {
    const clamped = Math.max(20, Math.min(80, distance));
    set({ edgeFadeStart: clamped });
    saveToStorage({ ...getAllSettings(get()), edgeFadeStart: clamped });
  },

  setEdgeFadeEnd: (distance) => {
    const clamped = Math.max(50, Math.min(150, distance));
    set({ edgeFadeEnd: clamped });
    saveToStorage({ ...getAllSettings(get()), edgeFadeEnd: clamped });
  },

  setSettingsBarCollapsed: (collapsed) => {
    set({ settingsBarCollapsed: collapsed });
    saveToStorage({ ...getAllSettings(get()), settingsBarCollapsed: collapsed });
  },

  loadSettingsFromStorage: () => {
    const stored = loadFromStorage();
    set({
      movementSpeed: stored.movementSpeed ?? DEFAULT_SETTINGS.movementSpeed,
      labelCount: stored.labelCount ?? DEFAULT_SETTINGS.labelCount,
      showLabels: stored.showLabels ?? DEFAULT_SETTINGS.showLabels,
      labelDistanceThreshold:
        stored.labelDistanceThreshold ?? DEFAULT_SETTINGS.labelDistanceThreshold,
      labelFontSize: stored.labelFontSize ?? DEFAULT_SETTINGS.labelFontSize,
      showEdges: stored.showEdges ?? DEFAULT_SETTINGS.showEdges,
      edgeFadeStart: stored.edgeFadeStart ?? DEFAULT_SETTINGS.edgeFadeStart,
      edgeFadeEnd: stored.edgeFadeEnd ?? DEFAULT_SETTINGS.edgeFadeEnd,
      settingsBarCollapsed: stored.settingsBarCollapsed ?? DEFAULT_SETTINGS.settingsBarCollapsed,
    });
  },
});
