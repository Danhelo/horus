/**
 * Vicinity Graph Utilities
 *
 * Uses precomputed k-NN edges to find neighbors of a node.
 * Each node has ~25 neighbors (cosine similarity > 0.25 on decoder vectors).
 */

import type { GraphEdge } from '@horus/shared';

/**
 * Build an adjacency list from edges for fast neighbor lookup
 */
export function buildAdjacencyList(
  edges: Map<string, GraphEdge>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges.values()) {
    // Add forward edge
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    adjacency.get(edge.source)!.add(edge.target);

    // Add reverse edge (edges are bidirectional neighbors)
    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set());
    }
    adjacency.get(edge.target)!.add(edge.source);
  }

  return adjacency;
}

/**
 * Get vicinity of a node up to a given depth
 *
 * @param nodeId - The center node
 * @param adjacency - Pre-built adjacency list
 * @param depth - How many hops out (1 = direct neighbors, 2 = neighbors of neighbors)
 * @returns Map of nodeId -> depth (1 = closest, 2 = further)
 */
export function getVicinity(
  nodeId: string,
  adjacency: Map<string, Set<string>>,
  depth: number = 1
): Map<string, number> {
  const vicinity = new Map<string, number>();
  const visited = new Set<string>([nodeId]);
  let currentLevel = new Set<string>([nodeId]);

  for (let d = 1; d <= depth; d++) {
    const nextLevel = new Set<string>();

    for (const current of currentLevel) {
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          vicinity.set(neighbor, d);
          nextLevel.add(neighbor);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return vicinity;
}

/**
 * Get direct neighbors (depth 1) as a simple array
 */
export function getDirectNeighbors(
  nodeId: string,
  adjacency: Map<string, Set<string>>
): string[] {
  const neighbors = adjacency.get(nodeId);
  return neighbors ? [...neighbors] : [];
}

/**
 * Get neighbors with their edge weights
 */
export function getNeighborsWithWeights(
  nodeId: string,
  edges: Map<string, GraphEdge>
): Array<{ nodeId: string; weight: number }> {
  const neighbors: Array<{ nodeId: string; weight: number }> = [];

  for (const edge of edges.values()) {
    if (edge.source === nodeId) {
      neighbors.push({ nodeId: edge.target, weight: edge.weight });
    } else if (edge.target === nodeId) {
      neighbors.push({ nodeId: edge.source, weight: edge.weight });
    }
  }

  // Sort by weight descending (closest neighbors first)
  neighbors.sort((a, b) => b.weight - a.weight);

  return neighbors;
}
