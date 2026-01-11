import { TokensSkeleton } from './LoadingStates';

interface Token {
  token: string;
  value: number;
}

interface TopTokensProps {
  tokens?: Token[];
  isLoading?: boolean;
}

/**
 * Renders special tokens with visible representation
 */
function formatToken(token: string): string {
  // Handle common special tokens
  if (token === '\n') return '\\n';
  if (token === '\t') return '\\t';
  if (token === ' ') return '\u2423'; // open box for space
  if (token === '') return '\u2205'; // empty set
  // Handle leading/trailing spaces
  return token.replace(/^ /, '\u2423').replace(/ $/, '\u2423');
}

/**
 * Displays tokens that most strongly activate this feature
 */
export function TopTokens({ tokens, isLoading }: TopTokensProps) {
  if (isLoading) {
    return <TokensSkeleton />;
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
        Top Activating Tokens
      </h3>

      {tokens && tokens.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {/* Show up to 10 tokens */}
          {tokens.slice(0, 10).map((t, i) => (
            <span
              key={i}
              title={`Logit: ${t.value.toFixed(2)}`}
              style={{
                display: 'inline-block',
                padding: '4px 8px',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--color-surface-elevated)',
                borderRadius: 4,
                color: 'var(--color-text-primary)',
                cursor: 'default',
                whiteSpace: 'pre',
              }}
            >
              {formatToken(t.token)}
            </span>
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
          No token data available
        </p>
      )}
    </div>
  );
}
