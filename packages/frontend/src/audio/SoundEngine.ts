import { DRONE_FREQUENCIES, PING_FREQUENCIES, type SoundConfig } from './types';

/**
 * Sound engine for HORUS - ambient drones and activation-based synth pads
 *
 * Uses Web Audio API for low-latency sound generation.
 * - Drones: Continuous background based on overall activation level
 * - Pings: Triggered when features activate, with stereo panning
 */
export class SoundEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private pingGain: GainNode | null = null;

  // Drone oscillators (continuous background)
  private droneOscillators: OscillatorNode[] = [];
  private droneGainNodes: GainNode[] = [];

  // Ping pool (for activation sounds)
  private pingPool: Map<string, { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode }> = new Map();

  // State
  private isInitialized = false;
  private isDronesPlaying = false;

  // Debounce for activation pings
  private lastPingTime = 0;
  private minPingInterval = 100; // ms between pings

  /**
   * Initialize the audio context (must be called from user gesture)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();

      // Create master gain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioContext.destination);

      // Create drone submix
      this.droneGain = this.audioContext.createGain();
      this.droneGain.gain.value = 0.4;
      this.droneGain.connect(this.masterGain);

      // Create ping submix
      this.pingGain = this.audioContext.createGain();
      this.pingGain.gain.value = 0.6;
      this.pingGain.connect(this.masterGain);

      // Create drone oscillators (not started yet)
      for (const freq of DRONE_FREQUENCIES) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0; // Start silent

        osc.connect(gain);
        gain.connect(this.droneGain);

        this.droneOscillators.push(osc);
        this.droneGainNodes.push(gain);
      }

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log('[SoundEngine] Initialized');
    } catch (error) {
      console.error('[SoundEngine] Failed to initialize:', error);
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<SoundConfig>): void {
    if (config.masterVolume !== undefined && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        config.masterVolume,
        this.audioContext!.currentTime,
        0.1
      );
    }
    if (config.droneVolume !== undefined && this.droneGain) {
      this.droneGain.gain.setTargetAtTime(
        config.droneVolume,
        this.audioContext!.currentTime,
        0.1
      );
    }
    if (config.pingVolume !== undefined && this.pingGain) {
      this.pingGain.gain.setTargetAtTime(
        config.pingVolume,
        this.audioContext!.currentTime,
        0.1
      );
    }
  }

  /**
   * Start drone layer
   */
  startDrones(): void {
    if (!this.isInitialized || this.isDronesPlaying) return;

    const now = this.audioContext!.currentTime;

    // Start all drone oscillators
    for (let i = 0; i < this.droneOscillators.length; i++) {
      const osc = this.droneOscillators[i];
      const gain = this.droneGainNodes[i];

      // Start if not already started
      try {
        osc.start(now);
      } catch {
        // Already started, ignore
      }

      // Fade in over 2 seconds - use higher base volume for audibility
      gain.gain.setTargetAtTime(1.0 / this.droneOscillators.length, now, 0.5);
    }

    this.isDronesPlaying = true;
    console.log('[SoundEngine] Drones started');
  }

  /**
   * Stop drone layer
   */
  stopDrones(): void {
    if (!this.isInitialized || !this.isDronesPlaying) return;

    const now = this.audioContext!.currentTime;

    // Fade out all drones
    for (const gain of this.droneGainNodes) {
      gain.gain.setTargetAtTime(0, now, 0.5);
    }

    this.isDronesPlaying = false;
    console.log('[SoundEngine] Drones stopped');
  }

  /**
   * Update drone intensity based on overall activation level
   * @param intensity 0-1, higher = more harmonic richness
   */
  setDroneIntensity(intensity: number): void {
    if (!this.isInitialized || !this.isDronesPlaying) return;

    const now = this.audioContext!.currentTime;
    const baseVolume = 1.0 / this.droneGainNodes.length;

    // Lower harmonics always present, higher ones fade in with intensity
    for (let i = 0; i < this.droneGainNodes.length; i++) {
      const harmonicFactor = 1 - (i / this.droneGainNodes.length) * 0.5;
      const targetGain = baseVolume * (harmonicFactor + intensity * (1 - harmonicFactor));
      this.droneGainNodes[i].gain.setTargetAtTime(targetGain, now, 0.3);
    }
  }

  /**
   * Play an activation ping for a feature
   * @param featureId Unique feature identifier
   * @param activation Activation value (0-10 typically)
   * @param panX Stereo pan position (-1 = left, 1 = right)
   */
  playActivationPing(featureId: string, activation: number, panX: number = 0): void {
    if (!this.isInitialized || !this.pingGain || !this.audioContext) return;

    // Debounce - don't spam pings
    const now = Date.now();
    if (now - this.lastPingTime < this.minPingInterval) return;
    this.lastPingTime = now;

    // Map activation to volume and frequency
    const normalizedActivation = Math.min(activation / 10, 1);
    const volume = 0.1 + normalizedActivation * 0.4;

    // Pick frequency from pentatonic scale based on activation
    const freqIndex = Math.min(
      Math.floor(normalizedActivation * PING_FREQUENCIES.length),
      PING_FREQUENCIES.length - 1
    );
    const frequency = PING_FREQUENCIES[freqIndex];

    const audioNow = this.audioContext.currentTime;

    // Create oscillator + gain + pan for this ping
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const pan = this.audioContext.createStereoPanner();

    osc.type = 'sine';
    osc.frequency.value = frequency;

    // Add slight detune for warmth
    osc.detune.value = (Math.random() - 0.5) * 10;

    // ADSR envelope (attack: 10ms, decay: 200ms, sustain: 0.3, release: 500ms)
    gain.gain.setValueAtTime(0, audioNow);
    gain.gain.linearRampToValueAtTime(volume, audioNow + 0.01);
    gain.gain.linearRampToValueAtTime(volume * 0.3, audioNow + 0.2);
    gain.gain.linearRampToValueAtTime(0, audioNow + 0.7);

    // Stereo pan based on x position
    pan.pan.value = Math.max(-1, Math.min(1, panX));

    // Connect
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(this.pingGain);

    // Start and stop
    osc.start(audioNow);
    osc.stop(audioNow + 0.8);

    // Cleanup after sound finishes
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
  }

  /**
   * Play a chord ping for multiple activations
   * @param activations Array of { activation, panX }
   */
  playChord(activations: Array<{ activation: number; panX: number }>): void {
    if (!this.isInitialized || activations.length === 0) return;

    // Play up to 3 notes (chord)
    const sorted = [...activations].sort((a, b) => b.activation - a.activation);
    const topActivations = sorted.slice(0, 3);

    for (const { activation, panX } of topActivations) {
      this.playActivationPing(`chord-${Date.now()}`, activation, panX);
    }
  }

  /**
   * Enable/disable the entire sound engine
   */
  setEnabled(enabled: boolean): void {
    if (enabled) {
      this.startDrones();
    } else {
      this.stopDrones();
    }
  }

  /**
   * Check if audio is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopDrones();

    // Stop and disconnect oscillators
    for (const osc of this.droneOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore errors
      }
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isInitialized = false;
    this.isDronesPlaying = false;
    this.droneOscillators = [];
    this.droneGainNodes = [];
    console.log('[SoundEngine] Disposed');
  }
}

// Singleton instance
export const soundEngine = new SoundEngine();
