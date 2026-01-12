import { useEffect, useRef } from 'react';

import { useAppStore } from '../stores';
import { loadVicinityLabels, getCachedLabel, hasLabel } from '../services/labelLoader';
import type { FeatureId } from '@horus/shared';

/**
 * Hook that automatically loads labels for vicinity nodes
 * Updates the store with loaded labels as they become available
 */
export function useVicinityLabels() {
  const vicinityNodeIds = useAppStore((s) => s.vicinityNodeIds);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const nodes = useAppStore((s) => s.nodes);

  // Track loading state
  const loadingRef = useRef(false);
  const lastVicinityRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Skip if no vicinity or same as last load
    if (vicinityNodeIds.size === 0) {
      lastVicinityRef.current = new Map();
      return;
    }

    // Check if vicinity changed
    const vicinityKey = [...vicinityNodeIds.keys()].sort().join(',');
    const lastKey = [...lastVicinityRef.current.keys()].sort().join(',');
    if (vicinityKey === lastKey) return;

    // Skip if already loading
    if (loadingRef.current) return;

    lastVicinityRef.current = new Map(vicinityNodeIds);
    loadingRef.current = true;

    // Get feature ID from node ID
    const getFeatureId = (nodeId: string): FeatureId | null => {
      const node = nodes.get(nodeId);
      return node?.featureId ?? null;
    };

    // Collect nodes that need labels loaded
    const nodesToLoad = new Map<string, number>();
    for (const [nodeId, depth] of vicinityNodeIds) {
      const node = nodes.get(nodeId);
      if (!node) continue;

      // Skip if node already has a label
      if (node.label) continue;

      // Skip if we already cached this label
      if (hasLabel(node.featureId)) {
        // Update node with cached label
        const cachedLabel = getCachedLabel(node.featureId);
        if (cachedLabel !== undefined) {
          updateNodeLabel(nodeId, cachedLabel);
        }
        continue;
      }

      nodesToLoad.set(nodeId, depth);
    }

    // Also load selected node labels
    for (const nodeId of selectedNodeIds) {
      const node = nodes.get(nodeId);
      if (!node || node.label) continue;

      if (hasLabel(node.featureId)) {
        const cachedLabel = getCachedLabel(node.featureId);
        if (cachedLabel !== undefined) {
          updateNodeLabel(nodeId, cachedLabel);
        }
        continue;
      }

      nodesToLoad.set(nodeId, 0);
    }

    if (nodesToLoad.size === 0) {
      loadingRef.current = false;
      return;
    }

    // Load labels asynchronously
    loadVicinityLabels(nodesToLoad, getFeatureId)
      .then((labels) => {
        // Update store with loaded labels
        for (const [nodeId, label] of labels) {
          if (label) {
            updateNodeLabel(nodeId, label);
          }
        }
      })
      .catch((error) => {
        console.warn('[useVicinityLabels] Failed to load labels:', error);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [vicinityNodeIds, selectedNodeIds, nodes]);
}

/**
 * Update a single node's label in the store
 */
function updateNodeLabel(nodeId: string, label: string | null): void {
  const { nodes } = useAppStore.getState();
  const node = nodes.get(nodeId);
  if (!node || node.label) return; // Don't overwrite existing labels

  // Create updated node with label
  const updatedNode = { ...node, label: label ?? undefined };
  const updatedNodes = new Map(nodes);
  updatedNodes.set(nodeId, updatedNode);

  // Update store
  useAppStore.setState({ nodes: updatedNodes });
}
