#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3, then run this script again."
  exit 1
fi

URL="http://127.0.0.1:8000/"
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  fi
) &

echo "CodeType is available at $URL"
echo "Keep this terminal open while using the app. Press Ctrl+C to stop."
exec python3 -m http.server 8000 --bind 127.0.0.1
