import { useCallback } from 'react';
import type { DialGroup as DialGroupType, Dial as DialType } from '@horus/shared';

import { Dial } from './Dial';

// ---------------------------------------------------------------------------
// Chevron Icon Component
// ---------------------------------------------------------------------------

interface ChevronIconProps {
  expanded: boolean;
}

function ChevronIcon({ expanded }: ChevronIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 150ms ease',
        pointerEvents: 'none',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DialGroup Component
// ---------------------------------------------------------------------------

interface DialGroupProps {
  group: DialGroupType;
  dials: DialType[];
  onToggleCollapsed: () => void;
  onDialChange: (dialId: string, value: number) => void;
  onDialReset: (dialId: string) => void;
  onDialHover: (dialId: string, hovered: boolean) => void;
}

export function DialGroup({
  group,
  dials,
  onToggleCollapsed,
  onDialChange,
  onDialReset,
  onDialHover,
}: DialGroupProps) {
  const handleToggle = useCallback(() => {
    onToggleCollapsed();
  }, [onToggleCollapsed]);

  const handleDialChange = useCallback(
    (dialId: string) => (value: number) => {
      onDialChange(dialId, value);
    },
    [onDialChange]
  );

  const handleDialReset = useCallback(
    (dialId: string) => () => {
      onDialReset(dialId);
    },
    [onDialReset]
  );

  const handleDialHover = useCallback(
    (dialId: string) => (hovered: boolean) => {
      onDialHover(dialId, hovered);
    },
    [onDialHover]
  );

  return (
    <div
      className="dial-group"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* Group Header */}
      <button
        onClick={handleToggle}
        className="dial-group-header"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-primary)',
          borderBottom: group.collapsed ? 'none' : '1px solid var(--color-border)',
          transition: 'background-color 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            'var(--color-surface-elevated)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
        aria-expanded={!group.collapsed}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-gold)',
            pointerEvents: 'none',
          }}
        >
          {group.label}
        </span>
        <ChevronIcon expanded={!group.collapsed} />
      </button>

      {/* Dial Grid */}
      {!group.collapsed && (
        <div
          className="dial-group-content"
          style={{
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
            gap: '16px',
            justifyItems: 'center',
          }}
        >
          {dials.map((dial) => (
            <Dial
              key={dial.id}
              dial={dial}
              size="md"
              onChange={handleDialChange(dial.id)}
              onReset={handleDialReset(dial.id)}
              onHover={handleDialHover(dial.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
