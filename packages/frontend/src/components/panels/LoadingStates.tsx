import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: CSSProperties;
}

const skeletonBase: CSSProperties = {
  background:
    'linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface-elevated) 50%, var(--color-surface) 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
};

/**
 * Skeleton loading placeholder
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        ...skeletonBase,
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

/**
 * Skeleton for feature header section
 */
export function FeatureHeaderSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <Skeleton width={180} height={24} style={{ marginBottom: 8 }} />
      <Skeleton width={120} height={14} style={{ marginBottom: 12 }} />
      <Skeleton width={80} height={24} borderRadius={12} />
    </div>
  );
}

/**
 * Skeleton for activation value section
 */
export function ActivationValueSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <Skeleton width={120} height={12} style={{ marginBottom: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton height={8} borderRadius={4} style={{ flex: 1 }} />
        <Skeleton width={50} height={20} />
      </div>
    </div>
  );
}

/**
 * Skeleton for explanation section
 */
export function ExplanationSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <Skeleton width={100} height={12} style={{ marginBottom: 12 }} />
      <Skeleton height={14} style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="90%" style={{ marginBottom: 8 }} />
      <Skeleton height={14} width="75%" />
    </div>
  );
}

/**
 * Skeleton for tokens section
 */
export function TokensSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <Skeleton width={140} height={12} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Skeleton width={50} height={26} borderRadius={4} />
        <Skeleton width={70} height={26} borderRadius={4} />
        <Skeleton width={45} height={26} borderRadius={4} />
        <Skeleton width={60} height={26} borderRadius={4} />
        <Skeleton width={55} height={26} borderRadius={4} />
      </div>
    </div>
  );
}

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
}

/**
 * Error display with optional retry button
 */
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const message = typeof error === 'string' ? error : error.message;

  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#e57373',
          fontSize: 14,
          marginBottom: 12,
        }}
      >
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontSize: 13,
            padding: '6px 12px',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  icon?: string;
}

/**
 * Empty state placeholder
 */
export function EmptyState({ message, icon = 'select' }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-xl)',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 32,
          marginBottom: 12,
          opacity: 0.5,
        }}
      >
        {icon === 'select' ? '\u25CB' : '\u2026'}
      </div>
      <div style={{ fontSize: 14 }}>{message}</div>
    </div>
  );
}

// Add shimmer keyframes to document
if (typeof document !== 'undefined') {
  const styleId = 'horus-skeleton-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
