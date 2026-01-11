import { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore, useLargeDataStore } from '../../stores';

// Update interval for region detection (ms)
const UPDATE_INTERVAL = 500;

interface RegionInfo {
  nearbyLabels: string[];
  dominantConcepts: string[];
}

/**
 * Extract common words/concepts from a list of labels
 */
function extractDominantConcepts(labels: string[], maxConcepts: number = 3): string[] {
  const wordFreq = new Map<string, number>();
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'that',
    'this', 'these', 'those', 'it', 'its', 'they', 'their', 'we', 'our',
    'you', 'your', 'he', 'she', 'him', 'her', 'his', 'hers', 'related',
    'words', 'text', 'phrases', 'about', 'like', 'such', 'often', 'when',
  ]);

  for (const label of labels) {
    const words = label.toLowerCase().split(/\s+/);
    for (const word of words) {
      // Skip short words and stop words
      if (word.length < 3 || stopWords.has(word)) continue;
      // Skip words that are just numbers
      if (/^\d+$/.test(word)) continue;

      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  // Sort by frequency and take top N
  const sorted = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxConcepts)
    .map(([word]) => word);

  return sorted;
}

/**
 * RegionContext component - shows info about the nearby feature space region.
 */
export function RegionContext() {
  const [regionInfo, setRegionInfo] = useState<RegionInfo>({
    nearbyLabels: [],
    dominantConcepts: [],
  });
  const lastUpdateRef = useRef<number>(0);

  // Get data from stores
  const nodes = useAppStore((state) => state.nodes);
  const position = useAppStore((state) => state.position);
  const positions = useLargeDataStore((state) => state.positions);
  const nodeIndexMap = useLargeDataStore((state) => state.nodeIndexMap);

  // Build index of nodes with labels
  const labeledNodes = useMemo(() => {
    const result: Array<{ id: string; label: string; position: THREE.Vector3 }> = [];

    for (const [id, node] of nodes) {
      if (!node.label) continue;

      const idx = nodeIndexMap.get(id);
      if (idx === undefined || !positions) continue;

      result.push({
        id,
        label: node.label,
        position: new THREE.Vector3(
          positions[idx * 3],
          positions[idx * 3 + 1],
          positions[idx * 3 + 2]
        ),
      });
    }

    return result;
  }, [nodes, nodeIndexMap, positions]);

  // Update region info periodically
  useEffect(() => {
    const updateRegion = () => {
      const now = performance.now();
      if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
      lastUpdateRef.current = now;

      if (labeledNodes.length === 0) {
        setRegionInfo({ nearbyLabels: [], dominantConcepts: [] });
        return;
      }

      const cameraPos = new THREE.Vector3(...position);
      const searchRadius = 30; // Units to search for context

      // Find nearby labeled nodes
      const nearby = labeledNodes
        .map((node) => ({
          ...node,
          distance: cameraPos.distanceTo(node.position),
        }))
        .filter((node) => node.distance < searchRadius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20); // Top 20 nearest

      const nearbyLabels = nearby.map((n) => n.label);
      const dominantConcepts = extractDominantConcepts(nearbyLabels);

      setRegionInfo({
        nearbyLabels: nearbyLabels.slice(0, 5), // Show first 5
        dominantConcepts,
      });
    };

    // Initial update
    updateRegion();

    // Set up interval
    const intervalId = setInterval(updateRegion, UPDATE_INTERVAL);
    return () => clearInterval(intervalId);
  }, [labeledNodes, position]);

  // Don't show if no region info
  if (regionInfo.nearbyLabels.length === 0 && regionInfo.dominantConcepts.length === 0) {
    return (
      <div style={{ color: '#6b6b7b', fontSize: 11, fontStyle: 'italic' }}>
        Navigate to explore regions...
      </div>
    );
  }

  return (
    <div>
      {/* Dominant concepts */}
      {regionInfo.dominantConcepts.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#6b6b7b', fontSize: 10, marginBottom: 4 }}>Dominant Concepts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {regionInfo.dominantConcepts.map((concept, i) => (
              <span
                key={i}
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'rgba(212, 168, 67, 0.2)',
                  color: 'var(--color-gold-dim)',
                  fontSize: 11,
                  borderRadius: 3,
                }}
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Nearby features */}
      {regionInfo.nearbyLabels.length > 0 && (
        <div>
          <div style={{ color: '#6b6b7b', fontSize: 10, marginBottom: 4 }}>Nearby Features</div>
          <div style={{ fontSize: 11, color: '#9a9aaa', maxHeight: 60, overflow: 'hidden' }}>
            {regionInfo.nearbyLabels.slice(0, 3).map((label, i) => (
              <div
                key={i}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 2,
                }}
                title={label}
              >
                • {label.length > 40 ? label.slice(0, 40) + '…' : label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
