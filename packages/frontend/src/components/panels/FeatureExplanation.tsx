import { ExplanationSkeleton } from './LoadingStates';

interface Explanation {
  description: string;
  score: number;
}

interface FeatureExplanationProps {
  explanations?: Explanation[];
  isLoading?: boolean;
}

/**
 * Displays AI-generated feature explanations from Neuronpedia
 */
export function FeatureExplanation({ explanations, isLoading }: FeatureExplanationProps) {
  if (isLoading) {
    return <ExplanationSkeleton />;
  }

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
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Explanation
      </h3>

      {explanations && explanations.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Show top 3 explanations */}
          {explanations.slice(0, 3).map((exp, i) => (
            <p
              key={i}
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              {exp.description}
              <span
                style={{
                  marginLeft: 8,
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                }}
              >
                ({Math.round(exp.score * 100)}%)
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
          }}
        >
          No explanation available
        </p>
      )}
    </div>
  );
}
