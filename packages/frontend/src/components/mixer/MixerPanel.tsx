import { useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../../stores';
import { DialGroup } from './DialGroup';
import type { Dial, DialGroup as DialGroupType } from '@horus/shared';

// ---------------------------------------------------------------------------
// Close Icon Component
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Collapse Icon Component
// ---------------------------------------------------------------------------

interface CollapseIconProps {
  collapsed: boolean;
}

function CollapseIcon({ collapsed }: CollapseIconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 150ms ease',
      }}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MixerPanel Component
// ---------------------------------------------------------------------------

interface MixerPanelProps {
  position?: 'left' | 'right' | 'bottom';
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function MixerPanel({
  position = 'left',
  collapsed = false,
  onToggleCollapsed,
}: MixerPanelProps) {
  // Store selectors
  const isPanelOpen = useAppStore((s) => s.panelsOpen.mixer);
  const dials = useAppStore((s) => s.dials);
  const groups = useAppStore((s) => s.groups);

  // Store actions
  const togglePanel = useAppStore((s) => s.togglePanel);
  const setDialValue = useAppStore((s) => s.setDialValue);
  const resetDial = useAppStore((s) => s.resetDial);
  const toggleGroupCollapsed = useAppStore((s) => s.toggleGroupCollapsed);
  const setTraceHighlight = useAppStore((s) => s.setTraceHighlight);
  const clearTraceHighlight = useAppStore((s) => s.clearTraceHighlight);
  const loadDefaultDials = useAppStore((s) => s.loadDefaultDials);

  // Load default dials on mount
  useEffect(() => {
    if (dials.size === 0) {
      loadDefaultDials();
    }
  }, [dials.size, loadDefaultDials]);

  // Handlers
  const handleClose = useCallback(() => {
    togglePanel('mixer');
  }, [togglePanel]);

  const handleDialChange = useCallback(
    (dialId: string, value: number) => {
      setDialValue(dialId, value);
    },
    [setDialValue]
  );

  const handleDialReset = useCallback(
    (dialId: string) => {
      resetDial(dialId);
    },
    [resetDial]
  );

  const handleDialHover = useCallback(
    (dialId: string, hovered: boolean) => {
      if (hovered) {
        setTraceHighlight(dialId, 0.5);
      } else {
        clearTraceHighlight(dialId);
      }
    },
    [setTraceHighlight, clearTraceHighlight]
  );

  const handleToggleGroup = useCallback(
    (groupId: string) => () => {
      toggleGroupCollapsed(groupId);
    },
    [toggleGroupCollapsed]
  );

  // Get ordered groups with their dials
  const groupsWithDials = useMemo(() => {
    const result: Array<{ group: DialGroupType; dials: Dial[] }> = [];

    for (const group of groups.values()) {
      const groupDials = group.dials
        .map((dialId) => dials.get(dialId))
        .filter((d): d is Dial => d !== undefined);

      result.push({ group, dials: groupDials });
    }

    return result;
  }, [groups, dials]);

  // Don't render if panel is closed
  if (!isPanelOpen) return null;

  // Position styles
  const positionStyles: React.CSSProperties =
    position === 'left'
      ? { left: 0, top: 0, bottom: 0, width: collapsed ? 40 : 280 }
      : position === 'right'
        ? { right: 0, top: 0, bottom: 0, width: collapsed ? 40 : 280 }
        : { left: 0, right: 0, bottom: 0, height: collapsed ? 40 : 280 };

  return (
    <aside
      className="mixer-panel"
      style={{
        position: 'fixed',
        ...positionStyles,
        backgroundColor: 'rgba(18, 18, 26, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRight: position === 'left' ? '1px solid var(--color-border)' : undefined,
        borderLeft: position === 'right' ? '1px solid var(--color-border)' : undefined,
        borderTop: position === 'bottom' ? '1px solid var(--color-border)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'width 200ms ease, height 200ms ease',
      }}
    >
      {/* Panel Header */}
      <div
        className="mixer-panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-gold)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Mixer
          </span>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Collapse toggle */}
          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
                borderRadius: 4,
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  'var(--color-text-secondary)';
              }}
            >
              <CollapseIcon collapsed={collapsed} />
            </button>
          )}

          {/* Close button */}
          {!collapsed && (
            <button
              onClick={handleClose}
              aria-label="Close panel"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
                borderRadius: 4,
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  'var(--color-text-secondary)';
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      {!collapsed && (
        <div
          className="mixer-panel-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-md)',
          }}
        >
          {groupsWithDials.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-xl)',
                color: 'var(--color-text-muted)',
                fontSize: 13,
              }}
            >
              No dials configured
            </div>
          ) : (
            groupsWithDials.map(({ group, dials: groupDials }) => (
              <DialGroup
                key={group.id}
                group={group}
                dials={groupDials}
                onToggleCollapsed={handleToggleGroup(group.id)}
                onDialChange={handleDialChange}
                onDialReset={handleDialReset}
                onDialHover={handleDialHover}
              />
            ))
          )}

          {/* Add Dial Button (placeholder for future) */}
          <button
            style={{
              width: '100%',
              padding: '12px 16px',
              marginTop: 'var(--spacing-sm)',
              backgroundColor: 'transparent',
              border: '1px dashed var(--color-border)',
              borderRadius: 8,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-gold-dim)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gold)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-border)';
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-muted)';
            }}
            onClick={() => {
              // TODO: Open dial search/add modal
              console.log('Add dial clicked');
            }}
          >
            + Add Dial
          </button>
        </div>
      )}
    </aside>
  );
}
