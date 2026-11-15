#!/bin/bash
# Full render of the short (software WebGL; ~5 s per frame on 4 CPU cores). Usage: scripts/render.sh out/kopenick/v1_silent.mp4
set -e
export TMPDIR=${REMOTION_TMP:-$PWD/.remotion-tmp}; mkdir -p "$TMPDIR"
npx remotion render src/index.ts KopenickShort "$1" --codec h264 --crf 17 --gl=swangle \
  --browser-executable=${CHROME_PATH:-/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell} \
  --props='{"post":{"msaa":2}}' --concurrency=1 --timeout=600000 ${@:2}
