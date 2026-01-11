"""
Layer JSON Exporter

Combines UMAP positions, edges, and labels into the final JSON format
that the frontend can consume. Outputs gzipped JSON for efficient transfer.

This is the bridge between Python computation and TypeScript consumption.
"""

import gzip
import json
import numpy as np
from pathlib import Path
from typing import Optional
from datetime import datetime

try:
    import orjson
    USE_ORJSON = True
except ImportError:
    USE_ORJSON = False

from config import (
    MODELS,
    DEFAULT_UMAP_PARAMS,
    DEFAULT_OUTPUT_CONFIG,
    OutputConfig,
    PIPELINE_VERSION,
)


def load_cached_data(
    model_id: str,
    layer: int,
    cache_dir: str = "./cache",
) -> tuple[np.ndarray, list[dict], dict[int, str]]:
    """
    Load all cached data for a layer.

    Returns:
        Tuple of (positions, edges, labels)
    """
    cache_path = Path(cache_dir) / model_id / f"layer_{layer}"

    # Load positions
    positions_path = cache_path / "positions.npy"
    if not positions_path.exists():
        raise FileNotFoundError(f"Positions not found at {positions_path}")
    positions = np.load(positions_path)

    # Load edges
    edges_path = cache_path / "edges.npy"
    if edges_path.exists():
        edges = np.load(edges_path, allow_pickle=True).tolist()
    else:
        edges = []

    # Load labels (optional)
    labels_path = cache_path / "labels.json"
    if labels_path.exists():
        with open(labels_path, "r") as f:
            labels_raw = json.load(f)
            # Convert string keys back to int
            labels = {int(k): v for k, v in labels_raw.items()}
    else:
        labels = {}

    return positions, edges, labels


def build_layer_json(
    model_id: str,
    layer: int,
    positions: np.ndarray,
    edges: list[dict],
    labels: dict[int, str],
) -> dict:
    """
    Build the JSON structure for a layer.

    Matches the GraphJSONSchema expected by the frontend.
    """
    model_config = MODELS.get(model_id)
    if not model_config:
        raise ValueError(f"Unknown model: {model_id}")

    source_id = model_config.get_source_id(layer)
    num_features = positions.shape[0]

    # Compute bounds
    bounds_min = positions.min(axis=0).tolist()
    bounds_max = positions.max(axis=0).tolist()

    # Build nodes array
    nodes = []
    for idx in range(num_features):
        node = {
            "id": f"{model_id}:{layer}:{idx}",
            "featureId": {
                "modelId": model_id,
                "layer": layer,
                "index": idx,
            },
            "position": [
                round(float(positions[idx, 0]), 4),
                round(float(positions[idx, 1]), 4),
                round(float(positions[idx, 2]), 4),
            ],
        }

        # Add label if available
        if idx in labels:
            node["label"] = labels[idx]

        nodes.append(node)

    # Build edges array with IDs
    edges_with_ids = []
    for i, edge in enumerate(edges):
        edges_with_ids.append({
            "id": f"edge-{layer}-{i}",
            "source": f"{model_id}:{layer}:{edge['source']}",
            "target": f"{model_id}:{layer}:{edge['target']}",
            "weight": round(float(edge["weight"]), 4),
            "type": "coactivation",
        })

    # Build final structure
    result = {
        "metadata": {
            "modelId": model_id,
            "layers": [layer],  # Array format for frontend schema
            "sourceId": source_id,
            "featureCount": num_features,
            "edgeCount": len(edges_with_ids),
            "labeledCount": len(labels),
            "bounds": {
                "min": bounds_min,
                "max": bounds_max,
            },
            "umapParams": DEFAULT_UMAP_PARAMS.to_dict(),
            "pipelineVersion": PIPELINE_VERSION,
            "computedAt": datetime.utcnow().isoformat() + "Z",
        },
        "nodes": nodes,
        "edges": edges_with_ids,
    }

    return result


def export_layer(
    model_id: str,
    layer: int,
    cache_dir: str = "./cache",
    output_config: Optional[OutputConfig] = None,
    force_reexport: bool = False,
) -> Path:
    """
    Export a layer's position data to JSON.

    Args:
        model_id: Model identifier
        layer: Layer number
        cache_dir: Directory with cached computation results
        output_config: Output configuration
        force_reexport: Overwrite existing output

    Returns:
        Path to the exported file
    """
    if output_config is None:
        output_config = DEFAULT_OUTPUT_CONFIG

    # Determine output path
    output_dir = Path(output_config.output_dir) / model_id
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = output_config.get_layer_filename(model_id, layer)
    output_path = output_dir / filename

    # Check if already exists
    if output_path.exists() and not force_reexport:
        print(f"Output already exists: {output_path}")
        return output_path

    print(f"Exporting {model_id} layer {layer}...")

    # Load cached data
    positions, edges, labels = load_cached_data(model_id, layer, cache_dir)

    print(f"  Positions: {positions.shape}")
    print(f"  Edges: {len(edges)}")
    print(f"  Labels: {len(labels)}")

    # Build JSON structure
    layer_data = build_layer_json(model_id, layer, positions, edges, labels)

    # Serialize
    if USE_ORJSON:
        json_bytes = orjson.dumps(layer_data, option=orjson.OPT_INDENT_2)
    else:
        json_bytes = json.dumps(layer_data, indent=2).encode("utf-8")

    # Write (with optional compression)
    if output_config.compress:
        with gzip.open(output_path, "wb") as f:
            f.write(json_bytes)
    else:
        with open(output_path, "wb") as f:
            f.write(json_bytes)

    # Report size
    file_size = output_path.stat().st_size
    size_mb = file_size / (1024 * 1024)
    print(f"  Exported to: {output_path} ({size_mb:.2f} MB)")

    return output_path


def export_manifest(
    model_id: str,
    layers: list[int],
    output_config: Optional[OutputConfig] = None,
) -> Path:
    """
    Export a manifest file listing all available layers.

    Args:
        model_id: Model identifier
        layers: List of layer numbers that were exported
        output_config: Output configuration

    Returns:
        Path to the manifest file
    """
    if output_config is None:
        output_config = DEFAULT_OUTPUT_CONFIG

    model_config = MODELS.get(model_id)
    if not model_config:
        raise ValueError(f"Unknown model: {model_id}")

    output_dir = Path(output_config.output_dir) / model_id

    # Build layer info
    layer_info = []
    for layer in sorted(layers):
        filename = output_config.get_layer_filename(model_id, layer)
        file_path = output_dir / filename

        if file_path.exists():
            file_size = file_path.stat().st_size
            layer_info.append({
                "layer": layer,
                "filePath": filename,
                "fileSize": file_size,
                "sourceId": model_config.get_source_id(layer),
            })

    manifest = {
        "modelId": model_id,
        "displayName": model_config.display_name,
        "totalLayers": model_config.num_layers,
        "featuresPerLayer": model_config.features_per_layer,
        "layers": layer_info,
        "neuronpediaModelId": model_config.neuronpedia_model_id,
        "neuronpediaSourceSet": model_config.neuronpedia_source_set,
        "pipelineVersion": PIPELINE_VERSION,
        "generatedAt": datetime.utcnow().isoformat() + "Z",
    }

    manifest_path = output_dir / output_config.get_manifest_filename()

    if USE_ORJSON:
        json_bytes = orjson.dumps(manifest, option=orjson.OPT_INDENT_2)
        with open(manifest_path, "wb") as f:
            f.write(json_bytes)
    else:
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)

    print(f"Manifest exported to: {manifest_path}")
    return manifest_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Export layer position data to JSON")
    parser.add_argument("--model", type=str, default="gemma-2-2b",
                        help="Model ID")
    parser.add_argument("--layer", type=int, default=12,
                        help="Layer number")
    parser.add_argument("--cache", type=str, default="./cache",
                        help="Cache directory")
    parser.add_argument("--output", type=str, default="./output",
                        help="Output directory")
    parser.add_argument("--no-compress", action="store_true",
                        help="Disable gzip compression")
    parser.add_argument("--force", action="store_true",
                        help="Force re-export even if exists")

    args = parser.parse_args()

    output_config = OutputConfig(
        output_dir=args.output,
        compress=not args.no_compress,
    )

    output_path = export_layer(
        args.model,
        args.layer,
        args.cache,
        output_config,
        args.force,
    )

    print(f"\n=== Export complete ===")
    print(f"Output: {output_path}")

    # Also export manifest for this single layer
    export_manifest(args.model, [args.layer], output_config)
