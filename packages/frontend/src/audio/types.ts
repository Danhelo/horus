/**
 * Sound engine configuration
 */
export interface SoundConfig {
  enabled: boolean;
  masterVolume: number; // 0-1
  droneVolume: number;  // 0-1, relative to master
  pingVolume: number;   // 0-1, relative to master
}

/**
 * Drone frequencies in harmonic series (A2, E3, A3)
 */
export const DRONE_FREQUENCIES = [110, 165, 220] as const;

/**
 * Synth ping note frequencies (pentatonic scale rooted at A3)
 * A3, C4, D4, E4, G4
 */
export const PING_FREQUENCIES = [220, 261.63, 293.66, 329.63, 392] as const;

/**
 * Default sound configuration
 */
export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  enabled: false,
  masterVolume: 0.3,
  droneVolume: 0.4,
  pingVolume: 0.6,
};
