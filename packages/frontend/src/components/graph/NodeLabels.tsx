import { useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

import { useAppStore, useLargeDataStore } from '../../stores';
import type { GraphNode } from '@horus/shared';

// Pre-allocated vector for distance calculations
const tempVec3 = new THREE.Vector3();

/**
 * Truncate label to first N words plus ellipsis
 */
function truncateLabel(label: string, maxWords: number): string {
  const words = label.split(/\s+/);
  if (words.length <= maxWords) {
    return label;
  }
  return words.slice(0, maxWords).join(' ') + '…';
}

interface LabelData {
  nodeId: string;
  position: [number, number, number];
  label: string;
  distance: number;
  activation: number;
}

/**
 * Compute the nearest N nodes with labels to the camera
 */
function computeNearestLabels(
  camera: THREE.Camera,
  nodes: Map<string, GraphNode>,
  nodeIndexMap: Map<string, number>,
  positions: Float32Array | null,
  activations: Map<string, number>,
  maxLabels: number
): LabelData[] {
  if (!positions) return [];

  const cameraPos = camera.position;
  const labeled: LabelData[] = [];

  for (const [nodeId, node] of nodes) {
    // Skip nodes without labels
    if (!node.label) continue;

    const idx = nodeIndexMap.get(nodeId);
    if (idx === undefined) continue;

    // Get position
    tempVec3.set(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);

    const distance = cameraPos.distanceTo(tempVec3);
    const activation = activations.get(nodeId) ?? 0;

    labeled.push({
      nodeId,
      position: [tempVec3.x, tempVec3.y, tempVec3.z],
      label: node.label,
      distance,
      activation,
    });
  }

  // Sort by distance and take top N
  labeled.sort((a, b) => a.distance - b.distance);
  return labeled.slice(0, maxLabels);
}

/**
 * Single label component with smart truncation and activation coloring
 */
function NodeLabel({
  position,
  label,
  distance,
  activation,
  distanceThreshold,
  fontSizeMultiplier,
}: {
  position: [number, number, number];
  label: string;
  distance: number;
  activation: number;
  distanceThreshold: number;
  fontSizeMultiplier: number;
}) {
  // Smart truncation based on distance
  const displayText = distance < distanceThreshold ? label : truncateLabel(label, 3);

  // Color: gray to gold based on activation
  // Base: #888888 (r=0.53, g=0.53, b=0.53)
  // Active: #ffd700 (r=1.0, g=0.84, b=0)
  const t = Math.min(activation / 2, 1); // Normalize activation (usually 0-5)
  const r = 0.53 + t * (1.0 - 0.53);
  const g = 0.53 + t * (0.84 - 0.53);
  const b = 0.53 + t * (0.0 - 0.53);
  const color = new THREE.Color(r, g, b);

  // Scale text based on distance for readability
  const scale = Math.max(0.5, Math.min(2, distance / 20));

  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      <Text
        fontSize={0.8 * scale * fontSizeMultiplier}
        color={color}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.03}
        outlineColor="#000000"
        maxWidth={20}
      >
        {displayText}
      </Text>
    </Billboard>
  );
}

/**
 * NodeLabels component - renders proximity-based labels for nodes.
 * Shows the N nearest labeled nodes to the camera with smart truncation.
 */
export function NodeLabels() {
  const { camera, invalidate } = useThree();
  const lastUpdateRef = useRef<number>(0);
  const [nearestLabels, setNearestLabels] = useState<LabelData[]>([]);

  // Get settings from store
  const showLabels = useAppStore((state) => state.showLabels);
  const labelCount = useAppStore((state) => state.labelCount);
  const labelDistanceThreshold = useAppStore((state) => state.labelDistanceThreshold);
  const labelFontSize = useAppStore((state) => state.labelFontSize);

  // Get graph data
  const nodes = useAppStore((state) => state.nodes);
  const activations = useAppStore((state) => state.activations);

  // Get position data
  const positions = useLargeDataStore((state) => state.positions);
  const nodeIndexMap = useLargeDataStore((state) => state.nodeIndexMap);

  // Update labels at 10fps, not 60fps
  const UPDATE_INTERVAL = 100; // ms

  useFrame(() => {
    if (!showLabels) return;

    const now = performance.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;

    const newLabels = computeNearestLabels(
      camera,
      nodes,
      nodeIndexMap,
      positions,
      activations,
      labelCount
    );

    // Only update if labels changed (simple length check for performance)
    if (
      newLabels.length !== nearestLabels.length ||
      (newLabels.length > 0 &&
        (newLabels[0].nodeId !== nearestLabels[0]?.nodeId ||
          newLabels[0].distance !== nearestLabels[0]?.distance))
    ) {
      setNearestLabels(newLabels);
      invalidate();
    }
  });

  // Don't render if labels disabled
  if (!showLabels) {
    return null;
  }

  return (
    <group>
      {nearestLabels.map((labelData) => (
        <NodeLabel
          key={labelData.nodeId}
          position={labelData.position}
          label={labelData.label}
          distance={labelData.distance}
          activation={labelData.activation}
          distanceThreshold={labelDistanceThreshold}
          fontSizeMultiplier={labelFontSize}
        />
      ))}
    </group>
  );
}
