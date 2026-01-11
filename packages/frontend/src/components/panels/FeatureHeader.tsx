import type { GraphNode } from '@horus/shared';

interface FeatureHeaderProps {
  node: GraphNode;
}

/**
 * Displays basic feature information from local data (instant render)
 */
export function FeatureHeader({ node }: FeatureHeaderProps) {
  const { featureId, label, category } = node;

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Feature label or fallback */}
      <h2
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--color-gold)',
          marginBottom: 4,
        }}
      >
        {label || `Feature ${featureId.index}`}
      </h2>

      {/* Layer and index info */}
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          marginBottom: category ? 8 : 0,
        }}
      >
        Layer {featureId.layer} | Index {featureId.index}
      </p>

      {/* Category tag if available */}
      {category && (
        <span
          style={{
            display: 'inline-block',
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            backgroundColor: 'var(--color-surface-elevated)',
            borderRadius: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          {category}
        </span>
      )}
    </div>
  );
}
