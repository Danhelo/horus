"""
HORUS Position Pipeline Configuration

Model configurations, UMAP parameters, and API settings.
"""

from dataclasses import dataclass
from typing import Optional
import os


# =============================================================================
# Model Configurations
# =============================================================================

@dataclass
class ModelConfig:
    """Configuration for a supported model."""
    model_id: str
    display_name: str
    huggingface_repo: str
    neuronpedia_model_id: str
    neuronpedia_source_set: str
    num_layers: int
    features_per_layer: int
    decoder_dim: int  # d_model dimension

    def get_source_id(self, layer: int) -> str:
        """Get Neuronpedia source ID for a layer."""
        return f"{layer}-{self.neuronpedia_source_set}"

    def get_hf_path(self, layer: int, width: str = "16k") -> str:
        """Get HuggingFace path for SAE weights."""
        # Format: layer_{N}/width_{W}k/average_l0_{X}/
        # We use the canonical path structure
        return f"layer_{layer}/width_{width}/canonical"


MODELS = {
    "gemma-2-2b": ModelConfig(
        model_id="gemma-2-2b",
        display_name="Gemma 2 2B",
        huggingface_repo="google/gemma-scope-2b-pt-res",
        neuronpedia_model_id="gemma-2-2b",
        neuronpedia_source_set="gemmascope-res-16k",
        num_layers=26,
        features_per_layer=16384,
        decoder_dim=2304,
    ),
    "gemma-2-9b": ModelConfig(
        model_id="gemma-2-9b",
        display_name="Gemma 2 9B",
        huggingface_repo="google/gemma-scope-9b-pt-res",
        neuronpedia_model_id="gemma-2-9b",
        neuronpedia_source_set="gemmascope-9b-res-16k",
        num_layers=42,
        features_per_layer=16384,
        decoder_dim=3584,  # Larger model
    ),
}


# =============================================================================
# UMAP Parameters
# =============================================================================

@dataclass
class UMAPParams:
    """UMAP hyperparameters for position computation."""
    n_neighbors: int = 40       # Balance local/global for 16k points
    min_dist: float = 0.02      # Tight clusters, clear neighborhoods
    metric: str = "cosine"       # Normalized vectors, angle matters
    n_components: int = 3        # 3D visualization
    spread: float = 1.0
    repulsion_strength: float = 1.5
    random_state: int = 42       # Reproducibility

    # Performance tuning
    n_jobs: int = -1             # Use all CPU cores
    low_memory: bool = False     # Trade memory for speed

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "n_neighbors": self.n_neighbors,
            "min_dist": self.min_dist,
            "metric": self.metric,
            "n_components": self.n_components,
            "spread": self.spread,
            "repulsion_strength": self.repulsion_strength,
            "random_state": self.random_state,
        }


DEFAULT_UMAP_PARAMS = UMAPParams()


# =============================================================================
# Edge Computation Parameters
# =============================================================================

@dataclass
class EdgeParams:
    """Parameters for edge computation."""
    top_k: int = 25              # Top-K neighbors per feature
    min_similarity: float = 0.25  # Minimum cosine similarity threshold
    deduplicate: bool = True      # Remove bidirectional duplicates


DEFAULT_EDGE_PARAMS = EdgeParams()


# =============================================================================
# Neuronpedia API Configuration
# =============================================================================

@dataclass
class NeuronpediaConfig:
    """Neuronpedia API configuration."""
    base_url: str = "https://www.neuronpedia.org"
    api_key: Optional[str] = None

    # Rate limiting
    requests_per_minute: int = 100  # Be conservative
    retry_attempts: int = 3
    retry_delay: float = 1.0

    # Label fetching
    top_k_labels: int = 1000      # How many features to fetch labels for

    def __post_init__(self):
        # Try to get API key from environment if not provided
        if self.api_key is None:
            self.api_key = os.environ.get("NEURONPEDIA_API_KEY")


# Default API key (from user input)
DEFAULT_NEURONPEDIA_CONFIG = NeuronpediaConfig(
    api_key="sk-np-kmAMMWifzhzcij0WQEXMAIr4036aLJzMyey2hzcGYtA0"
)


# =============================================================================
# Output Configuration
# =============================================================================

@dataclass
class OutputConfig:
    """Output file configuration."""
    output_dir: str = "./output"

    # Position normalization
    position_range: tuple = (-50.0, 50.0)  # Normalize to this range

    # Compression
    compress: bool = True        # gzip output

    # File naming
    def get_layer_filename(self, model_id: str, layer: int) -> str:
        """Get filename for a layer's position data."""
        ext = ".json.gz" if self.compress else ".json"
        return f"layer-{layer:02d}{ext}"

    def get_manifest_filename(self) -> str:
        """Get manifest filename."""
        return "manifest.json"


DEFAULT_OUTPUT_CONFIG = OutputConfig()


# =============================================================================
# Pipeline Version
# =============================================================================

PIPELINE_VERSION = "1.0.0"
