#!/bin/bash
set -euo pipefail
if [ "$#" -lt 2 ]; then
  echo "usage: optimize_images.sh OUTPUT_DIR INPUT..." >&2
  exit 2
fi
out=$1
shift
mkdir -p "$out"
for src in "$@"; do
  name=$(basename "${src%.*}").jpg
  convert "$src" -resize '1200x1200>' -strip -quality 76 "$out/$name"
  echo "$out/$name"
done
