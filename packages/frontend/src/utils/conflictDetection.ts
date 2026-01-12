/**
 * Conflict Detection for Dials
 *
 * Detects when dials have opposing effects on the same features,
 * which can lead to cancellation or unpredictable behavior.
 */

import type { Dial, DialConflict } from '@horus/shared';
import { CONFLICT_THRESHOLDS as THRESHOLDS } from '@horus/shared';

/**
 * Internal structure for tracking feature contributions from multiple dials
 */
interface FeatureContributions {
  featureId: string;
  contributions: Map<string, number>; // dialId -> contribution
}

/**
 * Detects conflicts between dials
 *
 * A conflict occurs when two dials contribute to the same feature
 * with opposite signs (one positive, one negative). The severity
 * is based on how much cancellation occurs.
 *
 * @param dials - Map of dial IDs to Dial objects
 * @returns Array of detected conflicts
 */
export function detectConflicts(dials: Map<string, Dial>): DialConflict[] {
  // First, build a map of feature -> dial contributions
  const featureContributions = new Map<string, FeatureContributions>();

  for (const dial of dials.values()) {
    // Skip zero-value dials
    if (dial.value === 0) {
      continue;
    }

    for (const traceFeature of dial.trace.features) {
      const featureId = traceFeature.nodeId;
      const contribution = dial.value * traceFeature.weight;

      let fc = featureContributions.get(featureId);
      if (!fc) {
        fc = { featureId, contributions: new Map() };
        featureContributions.set(featureId, fc);
      }

      fc.contributions.set(dial.id, contribution);
    }
  }

  // Now find conflicts between dial pairs
  const conflicts: DialConflict[] = [];
  const processedPairs = new Set<string>();
  const dialArray = Array.from(dials.values()).filter((d) => d.value !== 0);

  // Check each pair of active dials
  for (let i = 0; i < dialArray.length; i++) {
    for (let j = i + 1; j < dialArray.length; j++) {
      const dialA = dialArray[i];
      const dialB = dialArray[j];

      // Skip if we've already processed this pair
      const pairKey = [dialA.id, dialB.id].sort().join(':');
      if (processedPairs.has(pairKey)) {
        continue;
      }
      processedPairs.add(pairKey);

      // Find conflicting features
      const conflictingFeatures: Array<{
        featureId: string;
        contributions: [number, number];
      }> = [];

      // Check all features that both dials contribute to
      for (const [featureId, fc] of featureContributions) {
        const contribA = fc.contributions.get(dialA.id);
        const contribB = fc.contributions.get(dialB.id);

        // Both dials must contribute to this feature
        if (contribA === undefined || contribB === undefined) {
          continue;
        }

        // Check for opposing signs (conflict)
        if (Math.sign(contribA) !== Math.sign(contribB)) {
          conflictingFeatures.push({
            featureId,
            contributions: [contribA, contribB],
          });
        }
      }

      // If there are conflicting features, calculate severity and add conflict
      if (conflictingFeatures.length > 0) {
        const severity = calculateSeverity(conflictingFeatures);
        conflicts.push({
          dialIds: [dialA.id, dialB.id],
          conflictingFeatures,
          severity,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Calculates the severity of a conflict based on cancellation magnitude
 *
 * The severity is determined by looking at how much the opposing
 * contributions cancel each other out. Higher cancellation = higher severity.
 *
 * @param conflictingFeatures - Array of features with opposing contributions
 * @returns Severity level
 */
function calculateSeverity(
  conflictingFeatures: Array<{
    featureId: string;
    contributions: [number, number];
  }>
): 'low' | 'medium' | 'high' {
  if (conflictingFeatures.length === 0) {
    return 'low';
  }

  // Calculate the average net cancellation ratio across all conflicting features
  // Cancellation = min(|a|, |b|) / max(|a|, |b|)
  // This gives us how much of the smaller contribution is "wasted"
  let totalCancellation = 0;

  for (const { contributions } of conflictingFeatures) {
    const [a, b] = contributions;
    const absA = Math.abs(a);
    const absB = Math.abs(b);

    // Calculate how much is cancelled out (normalized 0-1)
    const minContrib = Math.min(absA, absB);
    const maxContrib = Math.max(absA, absB);

    if (maxContrib > 0) {
      // Cancellation ratio: how much of the larger contribution is cancelled
      const cancelled = minContrib;
      const cancellationRatio = cancelled / (absA + absB);
      totalCancellation += cancellationRatio * 2; // Scale to 0-1 range
    }
  }

  // Average cancellation across all conflicting features
  const avgCancellation = totalCancellation / conflictingFeatures.length;

  // Determine severity based on thresholds
  if (avgCancellation > THRESHOLDS.medium) {
    return 'high';
  } else if (avgCancellation > THRESHOLDS.low) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Checks if two specific dials conflict
 *
 * @param dialA - First dial
 * @param dialB - Second dial
 * @returns Conflict info if they conflict, null otherwise
 */
export function checkDialPairConflict(dialA: Dial, dialB: Dial): DialConflict | null {
  const dials = new Map<string, Dial>([
    [dialA.id, dialA],
    [dialB.id, dialB],
  ]);

  const conflicts = detectConflicts(dials);
  return conflicts.length > 0 ? conflicts[0] : null;
}

/**
 * Gets all features affected by a set of dials (for debugging/visualization)
 */
export function getAffectedFeatures(dials: Map<string, Dial>): Map<string, number> {
  const features = new Map<string, number>();

  for (const dial of dials.values()) {
    if (dial.value === 0) continue;

    for (const traceFeature of dial.trace.features) {
      const current = features.get(traceFeature.nodeId) ?? 0;
      features.set(traceFeature.nodeId, current + dial.value * traceFeature.weight);
    }
  }

  return features;
}

/**
 * Filters conflicts by minimum severity
 */
export function filterConflictsBySeverity(
  conflicts: DialConflict[],
  minSeverity: 'low' | 'medium' | 'high'
): DialConflict[] {
  const severityOrder = { low: 0, medium: 1, high: 2 };
  const minOrder = severityOrder[minSeverity];

  return conflicts.filter((c) => severityOrder[c.severity] >= minOrder);
}
