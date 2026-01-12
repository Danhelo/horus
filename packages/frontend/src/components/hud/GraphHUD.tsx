import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore, useLargeDataStore } from '../../stores';
import { RegionContext } from './RegionContext';

/**
 * Graph statistics HUD - displays in top-right corner.
 * Shows graph stats, camera position, region context, and optional perf stats.
 */
export function GraphHUD() {
  const [showPerf, setShowPerf] = useState(false);
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  // eslint-disable-next-line react-hooks/purity -- Initial timestamp for FPS calculation is correct pattern
  const lastTimeRef = useRef(performance.now());

  // Graph data
  const nodes = useAppStore((state) => state.nodes);
  const nodeCount = useLargeDataStore((state) => state.nodeCount);
  const edgeCount = useLargeDataStore((state) => state.edgeCount);
  const isPointerLocked = useAppStore((state) => state.isPointerLocked);
  const movementSpeed = useAppStore((state) => state.movementSpeed);

  // Camera position from store
  const position = useAppStore((state) => state.position);

  // Get metadata from nodes
  const metadata = useMemo(() => {
    // Try to get layer info from first node
    let layer = '?';
    let modelId = 'unknown';

    for (const node of nodes.values()) {
      if (node.featureId) {
        layer = String(node.featureId.layer);
        modelId = node.featureId.modelId;
        break;
      }
    }

    return { layer, modelId };
  }, [nodes]);

  // Count nodes with labels
  const labeledNodeCount = useMemo(() => {
    let count = 0;
    for (const node of nodes.values()) {
      if (node.label) count++;
    }
    return count;
  }, [nodes]);

  // FPS counter
  useEffect(() => {
    let rafId: number;

    const updateFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafId = requestAnimationFrame(updateFps);
    };

    rafId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Format position for display
  const posStr = `[${position[0].toFixed(0)}, ${position[1].toFixed(0)}, ${position[2].toFixed(0)}]`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 50,
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          border: '1px solid rgba(154, 120, 48, 0.3)',
          padding: 12,
          minWidth: 280,
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Graph Stats */}
        <div
          style={{
            color: 'var(--color-gold)',
            fontWeight: 600,
            marginBottom: 8,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Ideaspace Navigator
        </div>

        <div style={{ color: '#d1d1d8' }}>
          {/* Layer / Model */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#6b6b7b' }}>Layer</span>
            <span style={{ color: 'var(--color-gold-dim)' }}>{metadata.layer}</span>
          </div>

          {/* Node count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#6b6b7b' }}>Nodes</span>
            <span>{nodeCount.toLocaleString()}</span>
          </div>

          {/* Edge count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#6b6b7b' }}>Edges</span>
            <span>{edgeCount.toLocaleString()}</span>
          </div>

          {/* Labeled nodes */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b6b7b' }}>Labeled</span>
            <span style={{ color: 'var(--color-gold-dim)' }}>
              {labeledNodeCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #3a3a45', margin: '8px 0' }} />

        {/* Camera Info */}
        <div style={{ color: '#d1d1d8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#6b6b7b' }}>Position</span>
            <span style={{ fontSize: 11 }}>{posStr}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#6b6b7b' }}>Speed</span>
            <span>{movementSpeed} u/s</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b6b7b' }}>Mode</span>
            <span style={{ color: isPointerLocked ? 'var(--color-gold)' : '#6b6b7b' }}>
              {isPointerLocked ? 'FPS Locked' : 'Click to fly'}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #3a3a45', margin: '8px 0' }} />

        {/* Region Context */}
        <RegionContext />

        {/* Perf Stats (collapsible) */}
        <div style={{ borderTop: '1px solid #3a3a45', margin: '8px 0' }} />
        <button
          onClick={() => setShowPerf(!showPerf)}
          style={{
            fontSize: 11,
            color: '#6b6b7b',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#d1d1d8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#6b6b7b';
          }}
        >
          <span style={{ fontSize: 9 }}>{showPerf ? '▼' : '▶'}</span>
          Performance
        </button>

        {showPerf && (
          <div style={{ marginTop: 8, color: '#8a8a9a', fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>FPS</span>
              <span
                style={{
                  color: fps < 30 ? '#f87171' : fps < 50 ? '#fbbf24' : '#4ade80',
                }}
              >
                {fps}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Model</span>
              <span style={{ color: '#6b6b7b' }}>{metadata.modelId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: '#6b6b7b',
          textAlign: 'right',
        }}
      >
        Drag orbit · Scroll zoom · Double-click FPS · WASD move · R reset
      </div>
    </div>
  );
}
