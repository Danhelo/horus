import { useAppStore } from '../../stores';

interface ActivationValueProps {
  nodeId: string;
}

/**
 * Displays the current activation value for a selected feature
 * with a gold gradient progress bar
 */
export function ActivationValue({ nodeId }: ActivationValueProps) {
  // Subscribe to activation value for this specific node
  const activation = useAppStore((s) => s.activations.get(nodeId) ?? 0);

  // Clamp percentage to 0-100 (activation can exceed 1)
  const percentage = Math.min(activation * 100, 100);

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Section header */}
      <h3
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Current Activation
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Progress bar container */}
        <div
          style={{
            flex: 1,
            height: 8,
            backgroundColor: 'var(--color-surface)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* Progress bar fill */}
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background:
                'linear-gradient(90deg, var(--color-gold-dim) 0%, var(--color-gold) 50%, var(--color-gold-bright) 100%)',
              borderRadius: 4,
              transition: 'width 200ms ease-out',
            }}
          />
        </div>

        {/* Numeric value */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 500,
            color: activation > 0 ? 'var(--color-gold)' : 'var(--color-text-muted)',
            minWidth: 55,
            textAlign: 'right',
          }}
        >
          {activation.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
