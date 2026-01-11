"""
UMAP Position Computation

Computes 3D positions for SAE features using UMAP dimensionality reduction.
Features with similar decoder vectors (= similar semantic effects) end up
positioned close together in 3D space.

This is the core of "ideaspace navigation" - position encodes meaning.
"""

import numpy as np
from pathlib import Path
from typing import Optional, Tuple
from sklearn.neighbors import NearestNeighbors
import umap
from tqdm import tqdm

from config import (
    MODELS,
    DEFAULT_UMAP_PARAMS,
    DEFAULT_EDGE_PARAMS,
    DEFAULT_OUTPUT_CONFIG,
    UMAPParams,
    EdgeParams,
)


def compute_umap_positions(
    decoder_vectors: np.ndarray,
    params: Optional[UMAPParams] = None,
    verbose: bool = True,
) -> np.ndarray:
    """
    Compute 3D positions using UMAP dimensionality reduction.

    Args:
        decoder_vectors: Shape (num_features, d_model), L2-normalized
        params: UMAP hyperparameters
        verbose: Print progress

    Returns:
        np.ndarray of shape (num_features, 3) - 3D positions
    """
    if params is None:
        params = DEFAULT_UMAP_PARAMS

    if verbose:
        print(f"Computing UMAP for {decoder_vectors.shape[0]} features...")
        print(f"Parameters: n_neighbors={params.n_neighbors}, min_dist={params.min_dist}, metric={params.metric}")

    # Initialize UMAP
    reducer = umap.UMAP(
        n_neighbors=params.n_neighbors,
        min_dist=params.min_dist,
        n_components=params.n_components,
        metric=params.metric,
        spread=params.spread,
        repulsion_strength=params.repulsion_strength,
        random_state=params.random_state,
        n_jobs=params.n_jobs,
        low_memory=params.low_memory,
        verbose=verbose,
    )

    # Fit and transform
    positions = reducer.fit_transform(decoder_vectors)

    if verbose:
        print(f"UMAP complete. Output shape: {positions.shape}")

    return positions


def normalize_positions(
    positions: np.ndarray,
    target_range: Tuple[float, float] = (-50.0, 50.0),
) -> np.ndarray:
    """
    Normalize positions to a target range while preserving relative distances.

    Centers the positions and scales to fit within the target range.

    Args:
        positions: Shape (N, 3)
        target_range: (min, max) for each dimension

    Returns:
        Normalized positions
    """
    # Center at origin
    positions = positions - positions.mean(axis=0)

    # Scale to fit within target range
    max_abs = np.abs(positions).max()
    if max_abs > 0:
        target_max = target_range[1]
        positions = positions * (target_max / max_abs)

    return positions


def compute_edges(
    decoder_vectors: np.ndarray,
    positions: np.ndarray,
    params: Optional[EdgeParams] = None,
    verbose: bool = True,
) -> list[dict]:
    """
    Compute edges between features based on cosine similarity.

    Uses k-NN on the original high-dimensional decoder vectors,
    not the UMAP-reduced positions, to ensure semantic accuracy.

    Args:
        decoder_vectors: Shape (num_features, d_model), L2-normalized
        positions: Shape (num_features, 3) - for reference
        params: Edge computation parameters

    Returns:
        List of edge dicts: {source: int, target: int, weight: float}
    """
    if params is None:
        params = DEFAULT_EDGE_PARAMS

    num_features = decoder_vectors.shape[0]

    if verbose:
        print(f"Computing top-{params.top_k} edges for {num_features} features...")

    # Use NearestNeighbors with cosine metric
    # Since vectors are L2-normalized, cosine similarity = dot product
    # cosine distance = 1 - cosine similarity
    nn = NearestNeighbors(
        n_neighbors=params.top_k + 1,  # +1 because each point is its own neighbor
        metric="cosine",
        algorithm="auto",
        n_jobs=-1,
    )
    nn.fit(decoder_vectors)

    # Find neighbors
    distances, indices = nn.kneighbors(decoder_vectors)

    # Convert distances to similarities
    # cosine_distance = 1 - cosine_similarity
    similarities = 1 - distances

    edges = []
    seen_pairs = set() if params.deduplicate else None

    for i in tqdm(range(num_features), desc="Building edges", disable=not verbose):
        for j_idx in range(1, params.top_k + 1):  # Skip self (index 0)
            j = indices[i, j_idx]
            similarity = similarities[i, j_idx]

            # Apply threshold
            if similarity < params.min_similarity:
                continue

            # Deduplicate bidirectional edges
            if params.deduplicate:
                pair = (min(i, j), max(i, j))
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)

            edges.append({
                "source": int(i),
                "target": int(j),
                "weight": float(similarity),
            })

    if verbose:
        print(f"Created {len(edges)} edges (threshold={params.min_similarity})")

    return edges


def compute_layer_positions(
    model_id: str,
    layer: int,
    cache_dir: str = "./cache",
    umap_params: Optional[UMAPParams] = None,
    edge_params: Optional[EdgeParams] = None,
    force_recompute: bool = False,
) -> Tuple[np.ndarray, list[dict]]:
    """
    Compute positions and edges for a single layer.

    Args:
        model_id: Model identifier
        layer: Layer number
        cache_dir: Directory with cached decoder vectors
        umap_params: UMAP hyperparameters
        edge_params: Edge computation parameters
        force_recompute: Ignore cached results

    Returns:
        Tuple of (positions, edges)
    """
    cache_path = Path(cache_dir) / model_id / f"layer_{layer}"

    # Check for cached positions
    positions_path = cache_path / "positions.npy"
    edges_path = cache_path / "edges.npy"

    if not force_recompute and positions_path.exists() and edges_path.exists():
        print(f"Loading cached positions from {positions_path}")
        positions = np.load(positions_path)
        edges = np.load(edges_path, allow_pickle=True).tolist()
        return positions, edges

    # Load decoder vectors
    vectors_path = cache_path / "decoder_vectors.npy"
    if not vectors_path.exists():
        raise FileNotFoundError(
            f"Decoder vectors not found at {vectors_path}. Run download_sae.py first."
        )

    print(f"Loading decoder vectors from {vectors_path}")
    decoder_vectors = np.load(vectors_path)

    # Compute UMAP positions
    positions = compute_umap_positions(decoder_vectors, umap_params)

    # Normalize to target range
    output_config = DEFAULT_OUTPUT_CONFIG
    positions = normalize_positions(positions, output_config.position_range)

    # Compute edges
    edges = compute_edges(decoder_vectors, positions, edge_params)

    # Cache results
    np.save(positions_path, positions)
    np.save(edges_path, np.array(edges, dtype=object))
    print(f"Cached positions to {positions_path}")

    return positions, edges


def compute_bounds(positions: np.ndarray) -> dict:
    """Compute bounding box for positions."""
    return {
        "min": positions.min(axis=0).tolist(),
        "max": positions.max(axis=0).tolist(),
    }


if __name__ == "__main__":
    import argparse
    import time

    parser = argparse.ArgumentParser(description="Compute UMAP positions")
    parser.add_argument("--model", type=str, default="gemma-2-2b",
                        help="Model ID")
    parser.add_argument("--layer", type=int, default=12,
                        help="Layer number")
    parser.add_argument("--cache", type=str, default="./cache",
                        help="Cache directory")
    parser.add_argument("--force", action="store_true",
                        help="Force recompute even if cached")

    args = parser.parse_args()

    start = time.time()
    positions, edges = compute_layer_positions(
        args.model,
        args.layer,
        args.cache,
        force_recompute=args.force,
    )
    elapsed = time.time() - start

    print(f"\n=== Results for {args.model} layer {args.layer} ===")
    print(f"Positions shape: {positions.shape}")
    print(f"Number of edges: {len(edges)}")
    print(f"Position bounds: {compute_bounds(positions)}")
    print(f"Computation time: {elapsed:.1f}s ({elapsed/60:.1f}m)")

    # Sample statistics
    if len(edges) > 0:
        weights = [e["weight"] for e in edges]
        print(f"Edge weight range: [{min(weights):.3f}, {max(weights):.3f}]")
        print(f"Mean edge weight: {np.mean(weights):.3f}")
