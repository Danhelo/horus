import type { ReactNode, CSSProperties } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  width?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const positionStyles: Record<string, CSSProperties> = {
  'top-left': { top: 16, left: 16 },
  'top-right': { top: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 },
  'bottom-right': { bottom: 16, right: 16 },
};

export function Panel({
  title,
  children,
  position = 'top-left',
  width = 280,
  isOpen = true,
  onClose,
}: PanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className="panel"
      style={{
        ...positionStyles[position],
        width,
      }}
    >
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
              padding: 4,
            }}
            aria-label="Close panel"
          >
            x
          </button>
        )}
      </div>
      <div className="panel-content">{children}</div>
    </div>
  );
}
