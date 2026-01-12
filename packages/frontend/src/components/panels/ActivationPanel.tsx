import { useAppStore } from '../../stores';
import { useFeatureDetails } from '../../hooks';

import { FeatureHeader } from './FeatureHeader';
import { ActivationValue } from './ActivationValue';
import { FeatureExplanation } from './FeatureExplanation';
import { TopTokens } from './TopTokens';
import { RelatedFeatures } from './RelatedFeatures';
import { EmptyState, ErrorDisplay } from './LoadingStates';

/**
 * Right-side panel displaying details about the selected node/feature
 */
export function ActivationPanel() {
  // Get panel visibility
  const isPanelOpen = useAppStore((s) => s.panelsOpen.details);

  // Get the first selected node (single selection for now)
  const selectedNodeId = useAppStore((s) => {
    const ids = s.selectedNodeIds;
    if (ids.size === 0) return null;
    return ids.values().next().value;
  });

  // Get the node data from the graph
  const selectedNode = useAppStore((s) => (selectedNodeId ? s.nodes.get(selectedNodeId) : null));

  // Fetch extended feature data from Neuronpedia
  const {
    data: featureData,
    isLoading,
    error,
    refetch,
  } = useFeatureDetails({
    featureId: selectedNode?.featureId,
    enabled: !!selectedNode && isPanelOpen,
  });

  // Handle close
  const handleClose = () => {
    useAppStore.getState().togglePanel('details');
  };

  // Don't render if panel is closed
  if (!isPanelOpen) return null;

  return (
    <aside
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 320,
        backgroundColor: 'rgba(18, 18, 26, 0.95)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-gold)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Feature Details
        </span>
        <button
          onClick={handleClose}
          aria-label="Close panel"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 18,
            padding: 4,
            lineHeight: 1,
            borderRadius: 4,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
          }}
        >
          x
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedNode ? (
          <>
            {/* Basic info - renders instantly from local data */}
            <FeatureHeader node={selectedNode} />

            {/* Activation value - from store */}
            <ActivationValue nodeId={selectedNodeId!} />

            {/* Error state */}
            {error && <ErrorDisplay error={error} onRetry={() => refetch()} />}

            {/* Extended info from Neuronpedia */}
            {!error && (
              <>
                <FeatureExplanation
                  explanations={featureData?.explanations}
                  isLoading={isLoading}
                />

                <TopTokens tokens={featureData?.topLogits} isLoading={isLoading} />
              </>
            )}

            {/* Related features - from local graph data */}
            <RelatedFeatures nodeId={selectedNodeId!} />
          </>
        ) : (
          <EmptyState message="Select a node to see details" />
        )}
      </div>
    </aside>
  );
}
