# SAE Interpretability Concepts

## What Are Sparse Autoencoders?

Sparse Autoencoders (SAEs) decompose neural network activations into interpretable features. They address the **superposition hypothesis**: models encode more features than they have neurons by using non-orthogonal directions.

```
Input Activation → Encoder → Sparse Features → Decoder → Reconstructed Activation
      (x)         (W_enc)        (f)          (W_dec)         (x̂)
```

## Key Concepts

### Features

A **feature** is a learned direction in activation space that represents a concept.

```typescript
interface Feature {
  // Unique identifier
  id: string;                    // Format: modelId:layer:index

  // Location in model
  modelId: string;               // e.g., 'gemma-2-2b'
  layer: number;                 // 0-25 for Gemma-2-2B
  index: number;                 // 0-16383 for 16k SAE

  // Semantic info (from auto-interp)
  label?: string;                // Human-readable name
  explanations?: Explanation[];  // AI-generated descriptions

  // Decoder vector (the feature's "fingerprint")
  decoderVector?: Float32Array;  // d_model dimensions
}

interface Explanation {
  description: string;           // What this feature represents
  score: number;                 // Confidence (0-1)
}
```

### Activations

**Activations** measure how strongly each feature fires for a given input.

```typescript
interface TokenActivation {
  token: string;                 // The text token
  position: number;              // Token index in sequence
  features: FeatureActivation[]; // Which features activated
}

interface FeatureActivation {
  featureId: string;
  activation: number;            // Typically 0-10, can be higher
}

// Per token: ~50-100 features activate out of 16k+
// Most activations are 0 (sparse!)
```

### Activation Computation

```
f(x) = σ(W_enc · x + b_enc)
```

Where:
- `x`: Model's internal activation vector at layer/position
- `σ`: Activation function (ReLU, JumpReLU, or TopK)
- `f`: Sparse feature activation vector

**JumpReLU (Gemma Scope):**
```
σ(z) = z ⊙ H(z - θ)
```
Where `θ` is a learnable per-feature threshold.

**TopK:**
Only keep top-K activations per token (forces exact sparsity).

---

## Steering

**Steering** modifies model behavior by adding/subtracting feature decoder vectors during inference.

```
activation_steered = activation_original + Σ(strength_i × decoder_i)
```

```typescript
interface SteeringVector {
  features: Array<{
    featureId: string;
    strength: number;          // -2 to +2 typically safe
  }>;
  method: 'SIMPLE_ADDITIVE' | 'ORTHOGONAL_DECOMP';
}
```

### Steering Guidelines

| Strength | Effect |
|----------|--------|
| 0 | No change |
| 1-2 | Noticeable shift |
| 3-5 | Strong influence |
| 5-10 | Dominant effect |
| >10 | Often incoherent |

**Combining Features:**
- Effects are additive
- Opposing features may conflict
- Start conservative, adjust based on output

---

## Trajectories

A **trajectory** is the path text takes through feature space, token by token.

```typescript
interface TrajectoryPoint {
  position: number;              // Token index
  token: string;
  topFeatures: FeatureActivation[];
  coordinates: [number, number, number]; // UMAP position
}

interface Trajectory {
  id: string;
  text: string;
  points: TrajectoryPoint[];
  modelId: string;
}
```

### Trajectory Visualization

For HORUS, trajectories are visualized as:
1. **3D path** through the feature graph (ideaspace)
2. **Spectrogram** showing feature activations over time
3. **Animation** showing concepts lighting up in sequence

---

## Circuit Tracing

**Circuits** reveal how features causally influence each other.

```typescript
interface AttributionNode {
  id: string;
  type: 'output' | 'feature' | 'input' | 'error';
  featureId?: string;
  activation: number;
}

interface AttributionEdge {
  source: string;
  target: string;
  weight: number;                // Causal influence
  virtualWeight: number;         // decoder · encoder dot product
}
```

### Virtual Weights

The causal influence between features is computed as:
```
A_{s→t} = activation_s × (decoder_s · encoder_t)
```

This reveals which earlier features "write to" later features.

---

## Gemma-2-2B Configuration

```typescript
const GEMMA_2_2B = {
  modelId: 'gemma-2-2b',
  layers: 26,                    // 0-25
  featuresPerLayer: 16384,       // 16k SAE
  contextSize: 1024,

  // SAE locations per layer
  saeLocations: ['res', 'att', 'mlp'], // residual, attention, MLP

  // Source ID format for Neuronpedia
  getSourceId: (layer: number, width = '16k') =>
    `${layer}-gemmascope-res-${width}`,

  // SAE architecture
  architecture: 'JumpReLU',
  publisher: 'Google DeepMind',
};
```

---

## UMAP Positioning

Features are positioned in 3D space using UMAP dimensionality reduction on decoder vectors.

- **Similar features** cluster together
- **Distance** = semantic dissimilarity
- **Regions** emerge (emotions, syntax, topics, etc.)

HORUS displays this as the navigable **ideaspace graph**.

---

## Key Patterns for HORUS

### 1. Feature → Node Mapping
```typescript
function featureToNodeId(f: Feature): string {
  return `${f.modelId}:${f.layer}:${f.index}`;
}
```

### 2. Activation → Color Mapping
```typescript
function activationToColor(value: number): THREE.Color {
  // Inactive: dark blue-gray
  // Low: dim gold
  // High: bright gold
  const hue = 0.1; // Gold
  const saturation = 0.8;
  const lightness = 0.2 + Math.min(value / 5, 0.6); // Clamp
  return new THREE.Color().setHSL(hue, saturation, lightness);
}
```

### 3. Steering Vector → Dial Mapping
```typescript
function dialToSteering(dials: Map<string, Dial>): SteeringVector {
  return {
    features: Array.from(dials.values())
      .filter(d => d.value !== 0)
      .flatMap(d => d.features.map(f => ({
        featureId: f.id,
        strength: d.value * f.weight,
      }))),
    method: 'SIMPLE_ADDITIVE',
  };
}
```

### 4. Text → Trajectory
```typescript
async function textToTrajectory(
  text: string,
  modelId: string
): Promise<Trajectory> {
  const activations = await getActivations(text, modelId);
  return {
    id: crypto.randomUUID(),
    text,
    modelId,
    points: activations.tokens.map((token, i) => ({
      position: i,
      token,
      topFeatures: activations.activations[i].features,
      coordinates: lookupUMAPPosition(activations.activations[i]),
    })),
  };
}
```

---

## Mental Model

Think of SAE features as:
- **A vocabulary of concepts** the model has learned
- **Neurons you can read** (activations show what's "on")
- **Dials you can turn** (steering changes behavior)
- **A map of meaning** (UMAP positions reveal structure)

HORUS makes this tangible: see the concepts, steer the dials, watch the path.
