import { useCallback, useMemo } from 'react';

import { useAppStore } from '../../stores';
import type { GraphEdge } from '@horus/shared';

interface RelatedFeaturesProps {
  nodeId: string;
}

interface RelatedFeatureItemProps {
  nodeId: string;
  weight: number;
  edgeType: GraphEdge['type'];
  onClick: () => void;
}

const edgeTypeLabels: Record<GraphEdge['type'], string> = {
  coactivation: 'co',
  attention: 'attn',
  circuit: 'circ',
};

const edgeTypeColors: Record<GraphEdge['type'], string> = {
  coactivation: 'var(--color-activation-mid)',
  attention: 'var(--color-gold)',
  circuit: '#a5d6a7',
};

function RelatedFeatureItem({ nodeId, weight, edgeType, onClick }: RelatedFeatureItemProps) {
  // Get the node from the graph to show its label
  const node = useAppStore((s) => s.nodes.get(nodeId));
  const label = node?.label || `Feature ${node?.featureId.index ?? '?'}`;

  return (
    <li
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        borderRadius: 4,
        backgroundColor: 'var(--color-surface)',
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLLIElement).style.backgroundColor = 'var(--color-surface-elevated)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLLIElement).style.backgroundColor = 'var(--color-surface)';
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginRight: 8,
        }}
      >
        {label}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Edge type indicator */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            textTransform: 'uppercase',
            color: edgeTypeColors[edgeType],
            padding: '2px 4px',
            borderRadius: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          {edgeTypeLabels[edgeType]}
        </span>

        {/* Weight bar */}
        <div
          style={{
            width: 40,
            height: 4,
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${weight * 100}%`,
              height: '100%',
              backgroundColor: 'var(--color-gold-dim)',
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * Shows features that are connected to the selected node via graph edges
 */
export function RelatedFeatures({ nodeId }: RelatedFeaturesProps) {
  // Get edges connected to this node, sorted by weight
  const relatedEdges = useAppStore(
    useCallback(
      (s) => {
        const edges = s.edges;
        if (!edges) return [];

        const connected: Array<{ edge: GraphEdge; relatedNodeId: string }> = [];

        for (const edge of edges.values()) {
          if (edge.source === nodeId) {
            connected.push({ edge, relatedNodeId: edge.target });
          } else if (edge.target === nodeId) {
            connected.push({ edge, relatedNodeId: edge.source });
          }
        }

        // Sort by weight descending and take top 5
        return connected.sort((a, b) => b.edge.weight - a.edge.weight).slice(0, 5);
      },
      [nodeId]
    )
  );

  // Handle click on related feature - select it and focus camera
  const handleFeatureClick = useCallback((relatedNodeId: string) => {
    useAppStore.getState().selectNodes([relatedNodeId]);

    // Focus camera on the node (action injected by CameraController)
    const store = useAppStore.getState() as unknown as Record<string, unknown>;
    if (typeof store.focusOnNode === 'function') {
      (store.focusOnNode as (nodeId: string) => void)(relatedNodeId);
    }
  }, []);

  if (relatedEdges.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-md)' }}>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Related Features
        </h3>
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
          }}
        >
          No connected features
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      {/* Section header */}
      <h3
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Related Features
      </h3>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {relatedEdges.map(({ edge, relatedNodeId }) => (
          <RelatedFeatureItem
            key={edge.id}
            nodeId={relatedNodeId}
            weight={edge.weight}
            edgeType={edge.type}
            onClick={() => handleFeatureClick(relatedNodeId)}
          />
        ))}
      </ul>
    </div>
  );
}
