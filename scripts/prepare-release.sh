#!/bin/bash
# HORUS Release Preparation Script
# Bundles code and data for GitHub releases

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.0.0"
    exit 1
fi

# Remove leading 'v' for filenames if present
VERSION_NUM="${VERSION#v}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
DATA_DIR="$ROOT_DIR/scripts/compute_positions/output"

echo "=== HORUS Release Preparation ==="
echo "Version: $VERSION"
echo "Root: $ROOT_DIR"
echo ""

# Clean and create release directory
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# --- Source Code Bundle ---
echo "Creating source code bundle..."

# Create temp directory for source
TEMP_SRC="$RELEASE_DIR/horus-$VERSION"
mkdir -p "$TEMP_SRC"

# Copy relevant files (excluding node_modules, cache, etc.)
rsync -av --progress "$ROOT_DIR/" "$TEMP_SRC/" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='release' \
    --exclude='coverage' \
    --exclude='.cache' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='scripts/compute_positions/cache' \
    --exclude='scripts/compute_positions/output' \
    --exclude='*.tsbuildinfo' \
    --exclude='dist' \
    --exclude='.turbo' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='!.env.example'

# Create tarball
cd "$RELEASE_DIR"
tar -czf "horus-$VERSION.tar.gz" "horus-$VERSION"
rm -rf "horus-$VERSION"
echo "  Created: horus-$VERSION.tar.gz"

# --- Data Bundle ---
echo ""
echo "Creating data bundle..."

if [ -d "$DATA_DIR" ]; then
    TEMP_DATA="$RELEASE_DIR/horus-data-$VERSION"
    mkdir -p "$TEMP_DATA"

    # Copy all model data directories
    for model_dir in "$DATA_DIR"/*/; do
        if [ -d "$model_dir" ]; then
            model_name=$(basename "$model_dir")
            echo "  Including model: $model_name"
            mkdir -p "$TEMP_DATA/$model_name"

            # Copy layer files and manifest
            cp -v "$model_dir"/*.json* "$TEMP_DATA/$model_name/" 2>/dev/null || true
        fi
    done

    # Create tarball
    cd "$RELEASE_DIR"
    tar -czf "horus-data-$VERSION.tar.gz" "horus-data-$VERSION"
    rm -rf "horus-data-$VERSION"
    echo "  Created: horus-data-$VERSION.tar.gz"
else
    echo "  Warning: No data directory found at $DATA_DIR"
    echo "  Skipping data bundle."
fi

# --- Checksums ---
echo ""
echo "Generating checksums..."

cd "$RELEASE_DIR"
sha256sum *.tar.gz > checksums.txt 2>/dev/null || shasum -a 256 *.tar.gz > checksums.txt
echo "  Created: checksums.txt"
cat checksums.txt

# --- Summary ---
echo ""
echo "=== Release artifacts ready ==="
ls -lh "$RELEASE_DIR"
echo ""
echo "To test locally:"
echo "  tar -tzf release/horus-$VERSION.tar.gz | head"
echo "  tar -tzf release/horus-data-$VERSION.tar.gz | head"
