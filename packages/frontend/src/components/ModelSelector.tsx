import { useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../stores';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LayerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ModelSelector Component
// ---------------------------------------------------------------------------

export function ModelSelector() {
  // Store selectors
  const selectedModel = useAppStore((s) => s.selectedModel);
  const selectedLayer = useAppStore((s) => s.selectedLayer);
  const availableModels = useAppStore((s) => s.availableModels);
  const modelsLoading = useAppStore((s) => s.modelsLoading);
  const modelsError = useAppStore((s) => s.modelsError);

  // Store actions
  const setModel = useAppStore((s) => s.setModel);
  const setLayer = useAppStore((s) => s.setLayer);
  const loadModels = useAppStore((s) => s.loadModels);

  // Load models on mount
  useEffect(() => {
    if (availableModels.length === 0 && !modelsLoading) {
      loadModels();
    }
  }, [availableModels.length, modelsLoading, loadModels]);

  // Get current model info
  const currentModel = useMemo(
    () => availableModels.find((m) => m.modelId === selectedModel),
    [availableModels, selectedModel]
  );

  // Generate layer options for current model
  const layerOptions = useMemo(() => {
    if (!currentModel) return [];
    return Array.from({ length: currentModel.numLayers }, (_, i) => i);
  }, [currentModel]);

  // Handlers
  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModelId = e.target.value;
      const newModel = availableModels.find((m) => m.modelId === newModelId);

      if (newModel) {
        setModel(newModelId);
        // Adjust layer if it's out of range for the new model
        if (selectedLayer >= newModel.numLayers) {
          setLayer(newModel.numLayers - 1);
        }
      }
    },
    [availableModels, setModel, setLayer, selectedLayer]
  );

  const handleLayerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLayer(parseInt(e.target.value, 10));
    },
    [setLayer]
  );

  // Show loading state
  if (modelsLoading && availableModels.length === 0) {
    return (
      <div style={containerStyles}>
        <LoadingSpinner />
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Loading models...</span>
      </div>
    );
  }

  // Show error state
  if (modelsError && availableModels.length === 0) {
    return (
      <div style={containerStyles}>
        <span style={{ color: 'var(--color-signal-coral)', fontSize: 12 }}>{modelsError}</span>
        <button
          onClick={() => loadModels()}
          style={{
            background: 'none',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      {/* Model Selector */}
      <div style={selectorGroupStyles}>
        <label style={labelStyles}>Model</label>
        <div style={selectWrapperStyles}>
          <select
            value={selectedModel}
            onChange={handleModelChange}
            style={selectStyles}
            disabled={modelsLoading}
          >
            {availableModels.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.displayName}
              </option>
            ))}
          </select>
          <ChevronDownIcon />
        </div>
      </div>

      {/* Separator */}
      <div style={separatorStyles} />

      {/* Layer Selector */}
      <div style={selectorGroupStyles}>
        <label style={labelStyles}>
          <LayerIcon />
          Layer
        </label>
        <div style={selectWrapperStyles}>
          <select
            value={selectedLayer}
            onChange={handleLayerChange}
            style={selectStyles}
            disabled={modelsLoading || !currentModel}
          >
            {layerOptions.map((layer) => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
          <ChevronDownIcon />
        </div>
      </div>

      {/* Model Info */}
      {currentModel && (
        <div style={infoStyles}>
          <span style={infoBadgeStyles}>{currentModel.numLayers} layers</span>
          <span style={infoBadgeStyles}>
            {(currentModel.featuresPerLayer / 1000).toFixed(0)}k features
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  backgroundColor: 'rgba(18, 18, 26, 0.85)',
  backdropFilter: 'blur(8px)',
  borderRadius: 8,
  border: '1px solid var(--color-border)',
};

const selectorGroupStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const labelStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const selectWrapperStyles: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const selectStyles: React.CSSProperties = {
  appearance: 'none',
  backgroundColor: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 12,
  padding: '4px 24px 4px 8px',
  cursor: 'pointer',
  outline: 'none',
  minWidth: 80,
};

const separatorStyles: React.CSSProperties = {
  width: 1,
  height: 20,
  backgroundColor: 'var(--color-border)',
};

const infoStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginLeft: 8,
};

const infoBadgeStyles: React.CSSProperties = {
  fontSize: 10,
  padding: '2px 6px',
  backgroundColor: 'rgba(212, 175, 55, 0.1)',
  color: 'var(--color-gold)',
  borderRadius: 4,
  fontWeight: 500,
};
