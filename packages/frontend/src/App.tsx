import { useEffect, useRef } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { ActivationPanel } from './components/panels';
import { MixerPanel } from './components/mixer';
import { GraphHUD } from './components/hud';
import { SettingsBar } from './components/settings';
import { ModelSelector } from './components/ModelSelector';
import { useAppStore } from './stores';

export function App() {
  const loadGraphFromURL = useAppStore((state) => state.loadGraphFromURL);
  const isLoading = useAppStore((state) => state.isLoading);
  const loadError = useAppStore((state) => state.loadError);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const selectedLayer = useAppStore((state) => state.selectedLayer);
  const loadModels = useAppStore((state) => state.loadModels);

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  // Load available models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Load graph data when model/layer changes
  useEffect(() => {
    // Build the data URL dynamically based on selection
    // Format: /data/{modelId}/layer-{layer}.json
    const dataUrl = `/data/${selectedModel}/layer-${selectedLayer}.json`;

    // Skip loading if models haven't been initialized yet
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // On initial mount, check if data file exists for selected model/layer
      // Fall back to default if not available
      loadGraphFromURL(dataUrl).catch(() => {
        // If the selected model/layer data doesn't exist, try the default
        console.warn(
          `Data not found for ${selectedModel}/layer-${selectedLayer}, trying fallback...`
        );
        loadGraphFromURL('/data/gemma-2-2b/layer-12.json').catch(() => {
          // Final fallback to legacy path
          loadGraphFromURL('/data/layer-12.json');
        });
      });
    } else {
      // On subsequent changes, just load the new data
      loadGraphFromURL(dataUrl);
    }
  }, [selectedModel, selectedLayer, loadGraphFromURL]);

  return (
    <div className="canvas-container">
      {/* Model/Layer Selector - Top Center */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
        }}
      >
        <ModelSelector />
      </div>

      {/* Error Message */}
      {loadError && (
        <div className="absolute top-4 left-4 z-50 bg-red-900/80 text-white px-4 py-2 rounded">
          Error: {loadError.message}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded">
          Loading graph data...
        </div>
      )}

      <GraphCanvas />
      <MixerPanel position="left" />
      <ActivationPanel />
      <GraphHUD />
      <SettingsBar />
    </div>
  );
}
