#!/bin/bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: npm run model:convert -- <input.fbx> <output.glb>"
  exit 1
fi

INPUT_PATH="$1"
OUTPUT_PATH="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLENDER_SCRIPT="${SCRIPT_DIR}/blender-fbx-to-glb.py"
BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"

mkdir -p "$(dirname "$OUTPUT_PATH")"

echo "[model:convert] input: ${INPUT_PATH}"
echo "[model:convert] output: ${OUTPUT_PATH}"

env BLENDER_SYSTEM_GPU_BACKEND=OPENGL "${BLENDER_BIN}" --background --python "${BLENDER_SCRIPT}" -- "${INPUT_PATH}" "${OUTPUT_PATH}"

echo "[model:convert] done via Blender"
