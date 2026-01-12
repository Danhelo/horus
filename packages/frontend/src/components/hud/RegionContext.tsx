import { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore, useLargeDataStore } from '../../stores';

// Update interval for region detection (ms)
const UPDATE_INTERVAL = 500;

// Base search radius at distance 0
const BASE_SEARCH_RADIUS = 30;

interface ConceptWithCount {
  word: string;
  count: number;
}

interface RegionInfo {
  nearbyLabels: string[];
  dominantConcepts: ConceptWithCount[];
  nearbyCount: number;
  searchRadius: number;
  density: number; // features per unit volume
}

/**
 * Extract common words/concepts from a list of labels with counts
 */
function extractDominantConcepts(labels: string[], maxConcepts: number = 3): ConceptWithCount[] {
  const wordFreq = new Map<string, number>();
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'that',
    'this',
    'these',
    'those',
    'it',
    'its',
    'they',
    'their',
    'we',
    'our',
    'you',
    'your',
    'he',
    'she',
    'him',
    'her',
    'his',
    'hers',
    'related',
    'words',
    'text',
    'phrases',
    'about',
    'like',
    'such',
    'often',
    'when',
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

  // Sort by frequency and take top N, returning with counts
  const sorted = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxConcepts)
    .map(([word, count]) => ({ word, count }));

  return sorted;
}

/**
 * Compute adaptive search radius based on camera distance from origin
 * Closer = smaller radius (local context), farther = larger radius (regional context)
 */
function computeSearchRadius(cameraDistance: number): number {
  // Scale from BASE_SEARCH_RADIUS at distance 0 to ~2x at distance 100+
  return BASE_SEARCH_RADIUS * (1 + cameraDistance / 100);
}

/**
 * Compute feature density (features per unit volume)
 */
function computeDensity(nearbyCount: number, searchRadius: number): number {
  // Volume of sphere = (4/3) * π * r³
  const volume = (4 / 3) * Math.PI * Math.pow(searchRadius, 3);
  return nearbyCount / volume;
}

/**
 * RegionContext component - shows info about the nearby feature space region.
 */
export function RegionContext() {
  const [regionInfo, setRegionInfo] = useState<RegionInfo>({
    nearbyLabels: [],
    dominantConcepts: [],
    nearbyCount: 0,
    searchRadius: BASE_SEARCH_RADIUS,
    density: 0,
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
        setRegionInfo({
          nearbyLabels: [],
          dominantConcepts: [],
          nearbyCount: 0,
          searchRadius: BASE_SEARCH_RADIUS,
          density: 0,
        });
        return;
      }

      const cameraPos = new THREE.Vector3(...position);
      const cameraDistance = cameraPos.length();

      // Adaptive search radius based on camera distance
      const searchRadius = computeSearchRadius(cameraDistance);

      // Find nearby labeled nodes
      const nearby = labeledNodes
        .map((node) => ({
          ...node,
          distance: cameraPos.distanceTo(node.position),
        }))
        .filter((node) => node.distance < searchRadius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 30); // Top 30 nearest for concept extraction

      const nearbyLabels = nearby.map((n) => n.label);
      const dominantConcepts = extractDominantConcepts(nearbyLabels);
      const density = computeDensity(nearby.length, searchRadius);

      setRegionInfo({
        nearbyLabels: nearbyLabels.slice(0, 5), // Show first 5
        dominantConcepts,
        nearbyCount: nearby.length,
        searchRadius,
        density,
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

  // Format density for display (scientific notation for small numbers)
  const densityDisplay =
    regionInfo.density > 0.001
      ? regionInfo.density.toFixed(3)
      : regionInfo.density.toExponential(1);

  return (
    <div>
      {/* Region stats bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 8,
          fontSize: 10,
          color: '#6b6b7b',
        }}
      >
        <span title="Labeled features in search radius">
          <span style={{ color: 'var(--color-gold-dim)' }}>{regionInfo.nearbyCount}</span> nearby
        </span>
        <span title="Feature density (features per cubic unit)">
          ρ = <span style={{ color: 'var(--color-gold-dim)' }}>{densityDisplay}</span>
        </span>
        <span title="Adaptive search radius">
          r ={' '}
          <span style={{ color: 'var(--color-gold-dim)' }}>
            {regionInfo.searchRadius.toFixed(0)}
          </span>
        </span>
      </div>

      {/* Dominant concepts with counts */}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={`"${concept.word}" appears in ${concept.count} nearby features`}
              >
                {concept.word}
                <span
                  style={{
                    fontSize: 9,
                    opacity: 0.7,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ({concept.count})
                </span>
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
