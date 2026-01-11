import { useEffect } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { ActivationPanel } from './components/panels';
import { MixerPanel } from './components/mixer';
import { useAppStore } from './stores';

export function App() {
  const loadGraphFromURL = useAppStore((state) => state.loadGraphFromURL);
  const isLoading = useAppStore((state) => state.isLoading);
  const loadError = useAppStore((state) => state.loadError);

  // Load computed UMAP position data on mount
  useEffect(() => {
    loadGraphFromURL('/data/layer-12.json');
  }, [loadGraphFromURL]);

  return (
    <div className="canvas-container">
      {loadError && (
        <div className="absolute top-4 left-4 z-50 bg-red-900/80 text-white px-4 py-2 rounded">
          Error: {loadError.message}
        </div>
      )}
      {isLoading && (
        <div className="absolute top-4 left-4 z-50 bg-black/80 text-white px-4 py-2 rounded">
          Loading graph...
        </div>
      )}
      <GraphCanvas />
      <MixerPanel position="left" />
      <ActivationPanel />
    </div>
  );
}
