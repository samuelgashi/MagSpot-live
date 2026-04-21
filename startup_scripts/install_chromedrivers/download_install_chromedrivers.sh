#!/usr/bin/env bash
set -euo pipefail

OUT_JSON="devices_chrome_versions.json"
REMOTE_JSON_URL="https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json"
DEST_DIR="$HOME/Documents/chromedriver"
TMPROOT="$(mktemp -d)"
REMOTE_FILE="$TMPROOT/remote.json"
WORKROOT="$TMPROOT/work"
CURL_OPTS="-sS"

cleanup() { rm -rf "$TMPROOT"; }
trap cleanup EXIT

# prerequisites
for cmd in jq curl wget unzip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' not found. Install it and re-run." >&2
    exit 1
  fi
done

if [ ! -f "$OUT_JSON" ]; then
  echo "Error: $OUT_JSON not found in current directory." >&2
  exit 1
fi

mkdir -p "$WORKROOT"
echo "Fetching remote index..."
curl $CURL_OPTS -o "$REMOTE_FILE" "$REMOTE_JSON_URL"

# Read unique prefixes (preserve order)
mapfile -t prefixes < <(jq -r '.chrome_versions[]' "$OUT_JSON" | awk '!seen[$0]++')

if [ "${#prefixes[@]}" -eq 0 ]; then
  echo "No chrome_versions found in $OUT_JSON"
  exit 0
fi

mkdir -p "$DEST_DIR"
echo "Installing chromedriver binaries to: $DEST_DIR"

for prefix in "${prefixes[@]}"; do
  echo
  echo "Processing version prefix: $prefix"

  # Find a full build string (X.Y.Z.W) that starts with the prefix
  build=$(jq -r --arg p "$prefix" '
    .. | scalars
    | select(type=="string" and test("^"+$p+"\\.[0-9]+$"))
  ' "$REMOTE_FILE" | head -n1 || true)

  if [ -z "$build" ]; then
    build=$(jq -r --arg p "$prefix" '
      .. | scalars
      | select(type=="string" and test($p) and test("\\.[0-9]+$"))
    ' "$REMOTE_FILE" | head -n1 || true)
  fi

  if [ -z "$build" ]; then
    echo "  No build version found that matches prefix $prefix — skipping."
    continue
  fi

  echo "  Selected full build: $build"

  # derive per-build name chromedriver_X_Y_Z
  IFS='.' read -r p1 p2 p3 _ <<< "$build"
  if [ -z "$p3" ]; then
    IFS='.' read -r p1 p2 p3 _ <<< "$prefix"
  fi
  p2=${p2:-0}; p3=${p3:-0}
  perbuild_name="chromedriver_${p1}_${p2}_${p3}"

  # Find chromedriver linux64 URL that references this build
  url=$(jq -r --arg b "$build" '
    .. | scalars
    | select(type=="string" and test($b) and test("/linux64/") and test("chromedriver"))
  ' "$REMOTE_FILE" | grep -Eo 'https?://[^"]+' | head -n1 || true)

  if [ -z "$url" ]; then
    url=$(jq -r --arg b "$build" '
      .. | scalars
      | select(type=="string" and test("/linux64/") and test("chromedriver") and test($b))
    ' "$REMOTE_FILE" | grep -Eo 'https?://[^"]+' | head -n1 || true)
  fi

  if [ -z "$url" ]; then
    url=$(jq -r '
      .. | scalars
      | select(type=="string" and test("/linux64/") and test("chromedriver"))
    ' "$REMOTE_FILE" | grep -Eo 'https?://[^"]+' | head -n1 || true)
  fi

  if [ -z "$url" ]; then
    echo "  Could not find linux64 chromedriver URL for build $build — skipping."
    continue
  fi

  echo "  Download URL: $url"

  # Per-build workdir
  iterdir="$WORKROOT/$build"
  rm -rf "$iterdir"
  mkdir -p "$iterdir"
  cd "$iterdir"

  zipname=$(basename "$url")
  echo "  Downloading $zipname..."
  if ! wget -q --show-progress "$url" -O "$zipname"; then
    echo "  Download failed for $url" >&2
    rm -rf "$iterdir"
    continue
  fi

  echo "  Unzipping $zipname..."
  if ! unzip -q "$zipname"; then
    echo "  Unzip failed for $zipname" >&2
    rm -rf "$iterdir"
    continue
  fi

  # Find chromedriver binary inside extracted files
  chromedriver_path="$(find "$iterdir" -type f -iname 'chromedriver' -print -quit || true)"
  if [ -z "$chromedriver_path" ]; then
    echo "  chromedriver binary not found after unzip — cleaning and skipping."
    rm -rf "$iterdir"
    continue
  fi

  echo "  Found chromedriver at $chromedriver_path"
  chmod 755 "$chromedriver_path"

  # Move into destination (keep per-build copy)
  mkdir -p "$DEST_DIR"
  perbuild="$DEST_DIR/${perbuild_name}"
  final="$DEST_DIR/chromedriver"

  echo "  Installing to $perbuild"
  mv "$chromedriver_path" "$perbuild"
  chmod 755 "$perbuild"

  # Copy to canonical name (do not remove per-build file)
  echo "  Updating canonical copy: $final"
  cp -f "$perbuild" "$final"
  chmod 755 "$final"

  echo "  Installed chromedriver for $build -> $final (per-build: $perbuild_name)"

  # cleanup iteration workdir
  rm -rf "$iterdir"
done

echo
echo "Done. Per-build files are in: $DEST_DIR"
echo "List them with: ls -la \"$DEST_DIR\""
