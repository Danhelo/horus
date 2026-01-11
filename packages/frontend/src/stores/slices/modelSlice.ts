import type { StateCreator } from 'zustand';
import { DEFAULT_MODEL_ID } from '@horus/shared';
import type { ModelConfig } from '@horus/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelSlice {
  // Current selection
  selectedModel: string;
  selectedLayer: number;

  // Available models (loaded from API)
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  modelsError: string | null;

  // Actions
  setModel: (modelId: string) => void;
  setLayer: (layer: number) => void;
  setModelAndLayer: (modelId: string, layer: number) => void;
  loadModels: () => Promise<void>;
}

export interface ModelInfo {
  modelId: string;
  displayName: string;
  numLayers: number;
  featuresPerLayer: number;
  contextSize: number;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Local Storage Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'horus:model-selection';

interface PersistedModelSelection {
  modelId: string;
  layer: number;
}

function loadPersistedSelection(): PersistedModelSelection | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function persistSelection(modelId: string, layer: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ modelId, layer }));
  } catch {
    // Ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const persisted = loadPersistedSelection();

// ---------------------------------------------------------------------------
// Slice Creator
// ---------------------------------------------------------------------------

// Note: Using 'any' for AppStore type here to avoid circular dependency
// The actual type is inferred when combined in appStore.ts
export const createModelSlice: StateCreator<
  ModelSlice,
  [],
  [],
  ModelSlice
> = (set, get) => ({
  // Initial state from localStorage or defaults
  selectedModel: persisted?.modelId ?? DEFAULT_MODEL_ID,
  selectedLayer: persisted?.layer ?? 12,

  availableModels: [],
  modelsLoading: false,
  modelsError: null,

  setModel: (modelId) => {
    const { selectedLayer } = get();
    set({ selectedModel: modelId });
    persistSelection(modelId, selectedLayer);
  },

  setLayer: (layer) => {
    const { selectedModel } = get();
    set({ selectedLayer: layer });
    persistSelection(selectedModel, layer);
  },

  setModelAndLayer: (modelId, layer) => {
    set({ selectedModel: modelId, selectedLayer: layer });
    persistSelection(modelId, layer);
  },

  loadModels: async () => {
    set({ modelsLoading: true, modelsError: null });

    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.status}`);
      }

      const data = await response.json();
      set({
        availableModels: data.models,
        modelsLoading: false,
      });

      // Validate current selection against available models
      const { selectedModel, selectedLayer } = get();
      const currentModel = data.models.find(
        (m: ModelInfo) => m.modelId === selectedModel
      );

      if (!currentModel) {
        // Selected model not available, reset to default
        const defaultModel = data.models.find((m: ModelInfo) => m.isDefault);
        if (defaultModel) {
          set({
            selectedModel: defaultModel.modelId,
            selectedLayer: Math.min(selectedLayer, defaultModel.numLayers - 1),
          });
        }
      } else if (selectedLayer >= currentModel.numLayers) {
        // Layer out of range for selected model
        set({ selectedLayer: currentModel.numLayers - 1 });
      }
    } catch (error) {
      set({
        modelsLoading: false,
        modelsError: error instanceof Error ? error.message : 'Failed to load models',
      });
    }
  },
});
