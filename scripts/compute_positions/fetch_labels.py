"""
Neuronpedia Label Fetcher

Fetches feature explanations (labels) from Neuronpedia API.
Uses the hybrid approach: fetch top K labels per layer during precompute,
lazy-load the rest at runtime via the frontend.

Labels provide semantic meaning to the spatial positions computed by UMAP.
"""

import asyncio
import aiohttp
import json
import time
from pathlib import Path
from typing import Optional
from tqdm.asyncio import tqdm as atqdm

from config import MODELS, DEFAULT_NEURONPEDIA_CONFIG, NeuronpediaConfig


class NeuronpediaClient:
    """Async client for Neuronpedia API with rate limiting."""

    def __init__(self, config: Optional[NeuronpediaConfig] = None):
        self.config = config or DEFAULT_NEURONPEDIA_CONFIG
        self.base_url = self.config.base_url
        self.api_key = self.config.api_key
        self.rate_limit = self.config.requests_per_minute
        self.retry_attempts = self.config.retry_attempts
        self.retry_delay = self.config.retry_delay

        # Rate limiting state
        self._request_times: list[float] = []
        self._lock = asyncio.Lock()

    async def _wait_for_rate_limit(self):
        """Wait if we're exceeding rate limits."""
        async with self._lock:
            now = time.time()
            # Remove requests older than 1 minute
            self._request_times = [t for t in self._request_times if now - t < 60]

            if len(self._request_times) >= self.rate_limit:
                # Wait until the oldest request is 1 minute old
                sleep_time = 60 - (now - self._request_times[0]) + 0.1
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

            self._request_times.append(time.time())

    async def fetch_feature(
        self,
        session: aiohttp.ClientSession,
        model_id: str,
        source_id: str,
        feature_index: int,
    ) -> Optional[dict]:
        """
        Fetch a single feature from Neuronpedia.

        Args:
            session: aiohttp session
            model_id: e.g., "gemma-2-2b"
            source_id: e.g., "12-gemmascope-res-16k"
            feature_index: Feature index (0-16383)

        Returns:
            Feature data dict or None if not found
        """
        await self._wait_for_rate_limit()

        url = f"{self.base_url}/api/feature/{model_id}/{source_id}/{feature_index}"
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        for attempt in range(self.retry_attempts):
            try:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    elif response.status == 404:
                        return None  # Feature not found
                    elif response.status == 429:
                        # Rate limited, wait and retry
                        retry_after = response.headers.get("Retry-After", "60")
                        await asyncio.sleep(int(retry_after))
                    else:
                        if attempt == self.retry_attempts - 1:
                            return None
                        await asyncio.sleep(self.retry_delay * (2 ** attempt))
            except Exception as e:
                if attempt == self.retry_attempts - 1:
                    print(f"Error fetching feature {feature_index}: {e}")
                    return None
                await asyncio.sleep(self.retry_delay * (2 ** attempt))

        return None

    async def fetch_features_batch(
        self,
        model_id: str,
        layer: int,
        feature_indices: list[int],
        concurrency: int = 10,
    ) -> dict[int, dict]:
        """
        Fetch multiple features concurrently with rate limiting.

        Args:
            model_id: Model identifier
            layer: Layer number
            feature_indices: List of feature indices to fetch
            concurrency: Max concurrent requests

        Returns:
            Dict mapping feature index to feature data
        """
        model_config = MODELS.get(model_id)
        if not model_config:
            raise ValueError(f"Unknown model: {model_id}")

        source_id = model_config.get_source_id(layer)
        results = {}

        semaphore = asyncio.Semaphore(concurrency)

        async def fetch_one(session: aiohttp.ClientSession, idx: int):
            async with semaphore:
                data = await self.fetch_feature(session, model_id, source_id, idx)
                if data:
                    results[idx] = data

        async with aiohttp.ClientSession() as session:
            tasks = [fetch_one(session, idx) for idx in feature_indices]
            for task in atqdm(
                asyncio.as_completed(tasks),
                total=len(tasks),
                desc=f"Fetching labels for layer {layer}",
            ):
                await task

        return results


def extract_label(feature_data: dict) -> Optional[str]:
    """
    Extract the best label from feature data.

    Prefers auto-interp explanations, falls back to top logits.
    """
    # Try explanations first
    explanations = feature_data.get("explanations", [])
    if explanations:
        # Sort by score, take best
        sorted_exp = sorted(explanations, key=lambda x: x.get("score", 0), reverse=True)
        if sorted_exp and sorted_exp[0].get("description"):
            return sorted_exp[0]["description"]

    # Fallback: use top logits as label
    top_logits = feature_data.get("topLogits", [])
    if top_logits:
        tokens = [t.get("token", "") for t in top_logits[:5]]
        return "Top tokens: " + ", ".join(tokens)

    return None


async def fetch_layer_labels(
    model_id: str,
    layer: int,
    top_k: Optional[int] = None,
    feature_indices: Optional[list[int]] = None,
    cache_dir: str = "./cache",
    force_refetch: bool = False,
) -> dict[int, str]:
    """
    Fetch labels for a layer.

    Args:
        model_id: Model identifier
        layer: Layer number
        top_k: Number of features to fetch (default: from config)
        feature_indices: Specific indices to fetch (overrides top_k)
        cache_dir: Cache directory
        force_refetch: Ignore cache

    Returns:
        Dict mapping feature index to label string
    """
    config = DEFAULT_NEURONPEDIA_CONFIG
    config.validate()  # Ensure API key is set

    if top_k is None:
        top_k = config.top_k_labels

    # Check cache
    cache_path = Path(cache_dir) / model_id / f"layer_{layer}" / "labels.json"

    if not force_refetch and cache_path.exists():
        print(f"Loading cached labels from {cache_path}")
        with open(cache_path, "r") as f:
            cached = json.load(f)
            # Convert string keys back to int
            return {int(k): v for k, v in cached.items()}

    # Determine which features to fetch
    if feature_indices is None:
        # Default: fetch first top_k features
        # In future, could prioritize by activation frequency or other metrics
        model_config = MODELS.get(model_id)
        if not model_config:
            raise ValueError(f"Unknown model: {model_id}")

        max_features = model_config.features_per_layer
        feature_indices = list(range(min(top_k, max_features)))

    print(f"Fetching {len(feature_indices)} labels for {model_id} layer {layer}...")

    # Fetch features
    client = NeuronpediaClient()
    feature_data = await client.fetch_features_batch(
        model_id, layer, feature_indices
    )

    # Extract labels
    labels = {}
    for idx, data in feature_data.items():
        label = extract_label(data)
        if label:
            labels[idx] = label

    print(f"Got {len(labels)} labels out of {len(feature_indices)} requested")

    # Cache results
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(labels, f, indent=2)
    print(f"Cached labels to {cache_path}")

    return labels


def fetch_labels_sync(
    model_id: str,
    layer: int,
    top_k: Optional[int] = None,
    cache_dir: str = "./cache",
    force_refetch: bool = False,
) -> dict[int, str]:
    """Synchronous wrapper for fetch_layer_labels."""
    return asyncio.run(
        fetch_layer_labels(model_id, layer, top_k, None, cache_dir, force_refetch)
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fetch feature labels from Neuronpedia")
    parser.add_argument("--model", type=str, default="gemma-2-2b",
                        help="Model ID")
    parser.add_argument("--layer", type=int, default=12,
                        help="Layer number")
    parser.add_argument("--top-k", type=int, default=100,
                        help="Number of features to fetch (default 100 for testing)")
    parser.add_argument("--cache", type=str, default="./cache",
                        help="Cache directory")
    parser.add_argument("--force", action="store_true",
                        help="Force refetch even if cached")

    args = parser.parse_args()

    labels = fetch_labels_sync(
        args.model,
        args.layer,
        args.top_k,
        args.cache,
        args.force,
    )

    print(f"\n=== Sample labels for {args.model} layer {args.layer} ===")
    for idx, label in list(labels.items())[:10]:
        print(f"  Feature {idx}: {label[:80]}...")
