import { useEffect, useRef } from 'react';

import { useAppStore } from '../stores';
import { useLargeDataStore } from '../stores';
import { soundEngine } from './SoundEngine';

/**
 * Hook that maps feature activations to sound
 * - Updates drone intensity based on overall activation level
 * - Triggers pings when activations change
 */
export function useAudioMapping() {
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const activations = useAppStore((s) => s.activations);
  const nodes = useAppStore((s) => s.nodes);

  const prevActivationsRef = useRef<Map<string, number>>(new Map());
  const isInitializedRef = useRef(false);

  // Initialize sound engine when enabled
  useEffect(() => {
    if (soundEnabled && !isInitializedRef.current) {
      soundEngine.initialize().then(() => {
        isInitializedRef.current = true;
        soundEngine.startDrones();
      });
    } else if (!soundEnabled && isInitializedRef.current) {
      soundEngine.stopDrones();
    }

    return () => {
      if (isInitializedRef.current) {
        soundEngine.stopDrones();
      }
    };
  }, [soundEnabled]);

  // Map activations to sound
  useEffect(() => {
    if (!soundEnabled || !isInitializedRef.current) return;

    // Calculate overall activation intensity for drone modulation
    let totalActivation = 0;
    let maxActivation = 0;
    const newActivations: Array<{ nodeId: string; activation: number; position: [number, number, number] | null }> = [];

    for (const [nodeId, activation] of activations) {
      totalActivation += activation;
      maxActivation = Math.max(maxActivation, activation);

      // Check if this is a new or increased activation
      const prevActivation = prevActivationsRef.current.get(nodeId) ?? 0;
      if (activation > prevActivation + 0.5) {
        const node = nodes.get(nodeId);
        newActivations.push({
          nodeId,
          activation,
          position: node?.position ?? null,
        });
      }
    }

    // Update drone intensity
    const intensity = Math.min(totalActivation / 50, 1); // Normalize to 0-1
    soundEngine.setDroneIntensity(intensity);

    // Play pings for new activations
    if (newActivations.length > 0) {
      const positions = useLargeDataStore.getState().positions;

      // Sort by activation and take top 3
      const topActivations = newActivations
        .sort((a, b) => b.activation - a.activation)
        .slice(0, 3);

      for (const { nodeId, activation, position } of topActivations) {
        // Calculate pan from x position
        // Normalize to -1 to 1 based on typical UMAP range (-10 to 10)
        const panX = position ? position[0] / 10 : 0;
        soundEngine.playActivationPing(nodeId, activation, panX);
      }
    }

    // Store current activations for next comparison
    prevActivationsRef.current = new Map(activations);
  }, [soundEnabled, activations, nodes]);
}
