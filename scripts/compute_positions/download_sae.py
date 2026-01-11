"""
SAE Weight Downloader

Downloads SAE decoder vectors from HuggingFace for UMAP positioning.
The decoder vectors encode "what a feature writes to the residual stream" -
similar decoder vectors = semantically related features.
"""

import os
import numpy as np
from pathlib import Path
from typing import Optional
from huggingface_hub import hf_hub_download, HfApi
from safetensors import safe_open
from tqdm import tqdm

from config import MODELS, ModelConfig


def get_sae_file_path(model_config: ModelConfig, layer: int, width: str = "16k") -> str:
    """
    Construct the file path within the HuggingFace repo.

    Gemma Scope structure:
    layer_{N}/width_{W}k/average_l0_{X}/params.npz

    We need to find the actual path since average_l0 varies.
    """
    # Base path pattern
    return f"layer_{layer}/width_{width}"


def find_sae_path(model_config: ModelConfig, layer: int, width: str = "16k") -> str:
    """
    Find the actual SAE path in the HuggingFace repo.

    Gemma Scope uses different average_l0 values for different layers.
    We need to query the repo to find the available paths.
    """
    api = HfApi()

    # List files in the layer directory
    base_path = f"layer_{layer}/width_{width}"

    try:
        # Get repo info
        files = api.list_repo_files(model_config.huggingface_repo)

        # Find paths matching our layer/width
        matching = [f for f in files if f.startswith(base_path) and f.endswith("params.npz")]

        if not matching:
            raise FileNotFoundError(
                f"No SAE weights found for {model_config.model_id} layer {layer} width {width}"
            )

        # Take the first matching path (usually there's only one per layer/width combo)
        # Extract the directory path (remove /params.npz)
        return matching[0].rsplit("/", 1)[0]

    except Exception as e:
        raise RuntimeError(f"Error querying HuggingFace repo: {e}")


def download_decoder_vectors(
    model_id: str,
    layer: int,
    output_dir: str = "./cache",
    width: str = "16k",
    normalize: bool = True,
) -> np.ndarray:
    """
    Download SAE decoder vectors from HuggingFace.

    Args:
        model_id: Model identifier (e.g., "gemma-2-2b")
        layer: Layer number (0-25 for 2B, 0-41 for 9B)
        output_dir: Directory to cache downloaded files
        width: SAE width (default "16k")
        normalize: Whether to L2-normalize vectors (default True)

    Returns:
        np.ndarray of shape (num_features, d_model) - decoder vectors
    """
    if model_id not in MODELS:
        raise ValueError(f"Unknown model: {model_id}. Available: {list(MODELS.keys())}")

    model_config = MODELS[model_id]

    # Validate layer
    if layer < 0 or layer >= model_config.num_layers:
        raise ValueError(
            f"Layer {layer} out of range for {model_id} (0-{model_config.num_layers - 1})"
        )

    # Create cache directory
    cache_dir = Path(output_dir) / model_id / f"layer_{layer}"
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Check if we already have cached decoder vectors
    cached_path = cache_dir / "decoder_vectors.npy"
    if cached_path.exists():
        print(f"Loading cached decoder vectors from {cached_path}")
        return np.load(cached_path)

    print(f"Downloading SAE weights for {model_id} layer {layer}...")

    # Find the actual path in the repo
    sae_path = find_sae_path(model_config, layer, width)
    print(f"Found SAE at: {sae_path}")

    # Download the params.npz file
    local_path = hf_hub_download(
        repo_id=model_config.huggingface_repo,
        filename=f"{sae_path}/params.npz",
        cache_dir=str(cache_dir / "hf_cache"),
    )

    print(f"Downloaded to: {local_path}")

    # Load the NPZ file and extract decoder weights
    with np.load(local_path) as data:
        # Gemma Scope uses 'W_dec' for decoder weights
        # Shape: (num_features, d_model) = (16384, 2304) for 2B
        if "W_dec" in data:
            decoder_vectors = data["W_dec"]
        elif "w_dec" in data:
            decoder_vectors = data["w_dec"]
        else:
            # List available keys for debugging
            available_keys = list(data.keys())
            raise KeyError(
                f"Could not find decoder weights. Available keys: {available_keys}"
            )

    print(f"Decoder vectors shape: {decoder_vectors.shape}")

    # Verify shape
    expected_features = model_config.features_per_layer
    expected_dim = model_config.decoder_dim

    if decoder_vectors.shape[0] != expected_features:
        print(f"Warning: Expected {expected_features} features, got {decoder_vectors.shape[0]}")

    if decoder_vectors.shape[1] != expected_dim:
        print(f"Warning: Expected d_model={expected_dim}, got {decoder_vectors.shape[1]}")

    # L2 normalize vectors (makes cosine similarity = dot product)
    if normalize:
        print("L2-normalizing decoder vectors...")
        norms = np.linalg.norm(decoder_vectors, axis=1, keepdims=True)
        # Avoid division by zero for dead features
        norms = np.maximum(norms, 1e-8)
        decoder_vectors = decoder_vectors / norms

    # Cache for future use
    np.save(cached_path, decoder_vectors)
    print(f"Cached decoder vectors to {cached_path}")

    return decoder_vectors


def download_all_layers(
    model_id: str,
    output_dir: str = "./cache",
    layers: Optional[list[int]] = None,
) -> dict[int, Path]:
    """
    Download decoder vectors for multiple layers.

    Args:
        model_id: Model identifier
        output_dir: Cache directory
        layers: Specific layers to download, or None for all

    Returns:
        Dict mapping layer number to cached file path
    """
    if model_id not in MODELS:
        raise ValueError(f"Unknown model: {model_id}")

    model_config = MODELS[model_id]

    if layers is None:
        layers = list(range(model_config.num_layers))

    results = {}

    for layer in tqdm(layers, desc=f"Downloading {model_id} layers"):
        try:
            download_decoder_vectors(model_id, layer, output_dir)
            cached_path = Path(output_dir) / model_id / f"layer_{layer}" / "decoder_vectors.npy"
            results[layer] = cached_path
        except Exception as e:
            print(f"Error downloading layer {layer}: {e}")
            continue

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Download SAE decoder vectors")
    parser.add_argument("--model", type=str, default="gemma-2-2b",
                        help="Model ID (gemma-2-2b or gemma-2-9b)")
    parser.add_argument("--layer", type=int, default=12,
                        help="Layer number to download")
    parser.add_argument("--all-layers", action="store_true",
                        help="Download all layers")
    parser.add_argument("--output", type=str, default="./cache",
                        help="Output directory")

    args = parser.parse_args()

    if args.all_layers:
        results = download_all_layers(args.model, args.output)
        print(f"\nDownloaded {len(results)} layers")
    else:
        vectors = download_decoder_vectors(args.model, args.layer, args.output)
        print(f"\nDecoder vectors shape: {vectors.shape}")
        print(f"Sample vector norm (should be ~1.0): {np.linalg.norm(vectors[0]):.4f}")
