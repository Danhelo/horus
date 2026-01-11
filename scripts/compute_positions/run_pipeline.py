#!/usr/bin/env python3
"""
HORUS Position Pipeline Orchestrator

Runs the complete pipeline to compute positions for SAE features:
1. Download decoder vectors from HuggingFace
2. Compute UMAP positions
3. Fetch labels from Neuronpedia
4. Export to JSON

Supports resumption - if a step fails, re-running will pick up where it left off.
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import Optional

from config import MODELS, DEFAULT_OUTPUT_CONFIG, OutputConfig
from download_sae import download_decoder_vectors
from compute_umap import compute_layer_positions
from fetch_labels import fetch_layer_labels
from export_layer import export_layer, export_manifest


def run_layer_pipeline(
    model_id: str,
    layer: int,
    cache_dir: str = "./cache",
    output_config: Optional[OutputConfig] = None,
    top_k_labels: int = 1000,
    skip_labels: bool = False,
    force: bool = False,
    verbose: bool = True,
) -> bool:
    """
    Run the complete pipeline for a single layer.

    Args:
        model_id: Model identifier
        layer: Layer number
        cache_dir: Directory for intermediate cache files
        output_config: Output configuration
        top_k_labels: Number of labels to fetch
        skip_labels: Skip label fetching (faster for testing)
        force: Force recomputation even if cached
        verbose: Print progress

    Returns:
        True if successful, False otherwise
    """
    if output_config is None:
        output_config = DEFAULT_OUTPUT_CONFIG

    layer_start = time.time()

    if verbose:
        print(f"\n{'='*60}")
        print(f"Processing {model_id} layer {layer}")
        print(f"{'='*60}")

    try:
        # Step 1: Download decoder vectors
        if verbose:
            print(f"\n[1/4] Downloading decoder vectors...")
        step_start = time.time()

        cache_path = Path(cache_dir) / model_id / f"layer_{layer}"
        vectors_path = cache_path / "decoder_vectors.npy"

        if force or not vectors_path.exists():
            download_decoder_vectors(model_id, layer, cache_dir)
        else:
            if verbose:
                print(f"  Using cached vectors from {vectors_path}")

        if verbose:
            print(f"  Done in {time.time() - step_start:.1f}s")

        # Step 2: Compute UMAP positions
        if verbose:
            print(f"\n[2/4] Computing UMAP positions...")
        step_start = time.time()

        positions_path = cache_path / "positions.npy"

        if force or not positions_path.exists():
            positions, edges = compute_layer_positions(
                model_id, layer, cache_dir, force_recompute=force
            )
        else:
            if verbose:
                print(f"  Using cached positions from {positions_path}")

        if verbose:
            print(f"  Done in {time.time() - step_start:.1f}s")

        # Step 3: Fetch labels (optional)
        if not skip_labels:
            if verbose:
                print(f"\n[3/4] Fetching labels from Neuronpedia...")
            step_start = time.time()

            labels_path = cache_path / "labels.json"

            if force or not labels_path.exists():
                # Run async function
                labels = asyncio.run(fetch_layer_labels(
                    model_id, layer, top_k_labels, None, cache_dir, force
                ))
                if verbose:
                    print(f"  Fetched {len(labels)} labels")
            else:
                if verbose:
                    print(f"  Using cached labels from {labels_path}")

            if verbose:
                print(f"  Done in {time.time() - step_start:.1f}s")
        else:
            if verbose:
                print(f"\n[3/4] Skipping label fetch")

        # Step 4: Export JSON
        if verbose:
            print(f"\n[4/4] Exporting JSON...")
        step_start = time.time()

        output_path = export_layer(
            model_id, layer, cache_dir, output_config, force
        )

        if verbose:
            print(f"  Done in {time.time() - step_start:.1f}s")

        layer_elapsed = time.time() - layer_start
        if verbose:
            print(f"\n✓ Layer {layer} complete in {layer_elapsed:.1f}s ({layer_elapsed/60:.1f}m)")

        return True

    except Exception as e:
        print(f"\n✗ Error processing layer {layer}: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_pipeline(
    model_id: str,
    layers: Optional[list[int]] = None,
    cache_dir: str = "./cache",
    output_dir: str = "./output",
    top_k_labels: int = 1000,
    skip_labels: bool = False,
    force: bool = False,
    compress: bool = True,
) -> dict:
    """
    Run the complete pipeline for multiple layers.

    Args:
        model_id: Model identifier
        layers: List of layers to process (None = all layers)
        cache_dir: Cache directory
        output_dir: Output directory
        top_k_labels: Labels per layer
        skip_labels: Skip label fetching
        force: Force recomputation
        compress: Gzip output files

    Returns:
        Dict with success/failure counts and timing
    """
    model_config = MODELS.get(model_id)
    if not model_config:
        raise ValueError(f"Unknown model: {model_id}. Available: {list(MODELS.keys())}")

    if layers is None:
        layers = list(range(model_config.num_layers))

    output_config = OutputConfig(
        output_dir=output_dir,
        compress=compress,
    )

    print(f"\n{'#'*60}")
    print(f"HORUS Position Pipeline")
    print(f"{'#'*60}")
    print(f"Model: {model_id} ({model_config.display_name})")
    print(f"Layers: {len(layers)} ({min(layers)}-{max(layers)})")
    print(f"Features/layer: {model_config.features_per_layer:,}")
    print(f"Labels/layer: {top_k_labels if not skip_labels else 'skipped'}")
    print(f"Output: {output_dir}")
    print(f"Compress: {compress}")
    print(f"{'#'*60}")

    pipeline_start = time.time()
    successful = []
    failed = []

    for i, layer in enumerate(layers):
        print(f"\n[{i+1}/{len(layers)}] Layer {layer}")

        success = run_layer_pipeline(
            model_id=model_id,
            layer=layer,
            cache_dir=cache_dir,
            output_config=output_config,
            top_k_labels=top_k_labels,
            skip_labels=skip_labels,
            force=force,
            verbose=True,
        )

        if success:
            successful.append(layer)
        else:
            failed.append(layer)

    # Export manifest
    if successful:
        print(f"\n\nExporting manifest...")
        export_manifest(model_id, successful, output_config)

    pipeline_elapsed = time.time() - pipeline_start

    # Summary
    print(f"\n\n{'='*60}")
    print(f"Pipeline Complete")
    print(f"{'='*60}")
    print(f"Total time: {pipeline_elapsed:.1f}s ({pipeline_elapsed/60:.1f}m)")
    print(f"Successful: {len(successful)}/{len(layers)}")
    if failed:
        print(f"Failed: {failed}")
    print(f"{'='*60}")

    return {
        "successful": successful,
        "failed": failed,
        "elapsed": pipeline_elapsed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="HORUS Position Pipeline - Compute UMAP positions for SAE features"
    )
    parser.add_argument(
        "--model", type=str, default="gemma-2-2b",
        choices=list(MODELS.keys()),
        help="Model ID"
    )
    parser.add_argument(
        "--layers", type=str, default=None,
        help="Layer(s) to process. Examples: '12', '0-5', '0,5,12'. Default: all"
    )
    parser.add_argument(
        "--cache", type=str, default="./cache",
        help="Cache directory for intermediate files"
    )
    parser.add_argument(
        "--output", type=str, default="./output",
        help="Output directory for JSON files"
    )
    parser.add_argument(
        "--top-k-labels", type=int, default=1000,
        help="Number of labels to fetch per layer"
    )
    parser.add_argument(
        "--skip-labels", action="store_true",
        help="Skip fetching labels from Neuronpedia"
    )
    parser.add_argument(
        "--no-compress", action="store_true",
        help="Disable gzip compression of output"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Force recomputation even if cached"
    )

    args = parser.parse_args()

    # Parse layers argument
    layers = None
    if args.layers:
        layers = []
        for part in args.layers.split(","):
            if "-" in part:
                start, end = part.split("-")
                layers.extend(range(int(start), int(end) + 1))
            else:
                layers.append(int(part))

    # Run pipeline
    result = run_pipeline(
        model_id=args.model,
        layers=layers,
        cache_dir=args.cache,
        output_dir=args.output,
        top_k_labels=args.top_k_labels,
        skip_labels=args.skip_labels,
        force=args.force,
        compress=not args.no_compress,
    )

    # Exit with error code if any layers failed
    if result["failed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
