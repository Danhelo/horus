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

  // Rendering settings
  showEdges: boolean; // Whether to show edge lines

  // Actions
  setMovementSpeed: (speed: number) => void;
  setPointerLocked: (locked: boolean) => void;
  setLabelCount: (count: number) => void;
  setShowLabels: (show: boolean) => void;
  setLabelDistanceThreshold: (distance: number) => void;
  setShowEdges: (show: boolean) => void;
  loadSettingsFromStorage: () => void;
}

// Default settings
const DEFAULT_SETTINGS = {
  movementSpeed: 30,
  isPointerLocked: false,
  labelCount: 50,
  showLabels: true,
  labelDistanceThreshold: 15,
  showEdges: true,
};

interface StoredSettings {
  movementSpeed?: number;
  labelCount?: number;
  showLabels?: boolean;
  labelDistanceThreshold?: number;
  showEdges?: boolean;
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

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  // Initial values with defaults
  movementSpeed: DEFAULT_SETTINGS.movementSpeed,
  isPointerLocked: DEFAULT_SETTINGS.isPointerLocked,
  labelCount: DEFAULT_SETTINGS.labelCount,
  showLabels: DEFAULT_SETTINGS.showLabels,
  labelDistanceThreshold: DEFAULT_SETTINGS.labelDistanceThreshold,
  showEdges: DEFAULT_SETTINGS.showEdges,

  setMovementSpeed: (speed) => {
    const clamped = Math.max(5, Math.min(200, speed));
    set({ movementSpeed: clamped });
    saveToStorage({
      movementSpeed: clamped,
      labelCount: get().labelCount,
      showLabels: get().showLabels,
      labelDistanceThreshold: get().labelDistanceThreshold,
      showEdges: get().showEdges,
    });
  },

  setPointerLocked: (locked) => {
    set({ isPointerLocked: locked });
    // Don't persist pointer lock state - it's transient
  },

  setLabelCount: (count) => {
    const clamped = Math.max(0, Math.min(200, count));
    set({ labelCount: clamped });
    saveToStorage({
      movementSpeed: get().movementSpeed,
      labelCount: clamped,
      showLabels: get().showLabels,
      labelDistanceThreshold: get().labelDistanceThreshold,
      showEdges: get().showEdges,
    });
  },

  setShowLabels: (show) => {
    set({ showLabels: show });
    saveToStorage({
      movementSpeed: get().movementSpeed,
      labelCount: get().labelCount,
      showLabels: show,
      labelDistanceThreshold: get().labelDistanceThreshold,
      showEdges: get().showEdges,
    });
  },

  setLabelDistanceThreshold: (distance) => {
    const clamped = Math.max(5, Math.min(100, distance));
    set({ labelDistanceThreshold: clamped });
    saveToStorage({
      movementSpeed: get().movementSpeed,
      labelCount: get().labelCount,
      showLabels: get().showLabels,
      labelDistanceThreshold: clamped,
      showEdges: get().showEdges,
    });
  },

  setShowEdges: (show) => {
    set({ showEdges: show });
    saveToStorage({
      movementSpeed: get().movementSpeed,
      labelCount: get().labelCount,
      showLabels: get().showLabels,
      labelDistanceThreshold: get().labelDistanceThreshold,
      showEdges: show,
    });
  },

  loadSettingsFromStorage: () => {
    const stored = loadFromStorage();
    set({
      movementSpeed: stored.movementSpeed ?? DEFAULT_SETTINGS.movementSpeed,
      labelCount: stored.labelCount ?? DEFAULT_SETTINGS.labelCount,
      showLabels: stored.showLabels ?? DEFAULT_SETTINGS.showLabels,
      labelDistanceThreshold:
        stored.labelDistanceThreshold ?? DEFAULT_SETTINGS.labelDistanceThreshold,
      showEdges: stored.showEdges ?? DEFAULT_SETTINGS.showEdges,
    });
  },
});
