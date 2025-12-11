#!/bin/bash
# Launch a test browser with the Derigo extension loaded
# Usage: ./scripts/test-browser.sh [chrome|brave|canary]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
PROFILE_DIR="/tmp/derigo-test-profile-$$"

# Default browser
BROWSER="${1:-chrome}"

# Build the extension first
echo "Building extension..."
cd "$PROJECT_DIR"
npm run build --silent

echo "Extension built in $DIST_DIR"
echo "Using temporary profile: $PROFILE_DIR"

# Determine browser path
case "$BROWSER" in
  chrome)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      BROWSER_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    else
      BROWSER_PATH="google-chrome"
    fi
    ;;
  brave)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      BROWSER_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    else
      BROWSER_PATH="brave-browser"
    fi
    ;;
  canary)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      BROWSER_PATH="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
    else
      BROWSER_PATH="google-chrome-canary"
    fi
    ;;
  *)
    echo "Unknown browser: $BROWSER"
    echo "Usage: $0 [chrome|brave|canary]"
    exit 1
    ;;
esac

# Check if browser exists
if [[ "$OSTYPE" == "darwin"* ]]; then
  if [[ ! -f "$BROWSER_PATH" ]]; then
    echo "Browser not found: $BROWSER_PATH"
    exit 1
  fi
else
  if ! command -v "$BROWSER_PATH" &> /dev/null; then
    echo "Browser not found: $BROWSER_PATH"
    exit 1
  fi
fi

echo "Launching $BROWSER with extension..."
echo ""
echo "============================================"
echo "  Extension loaded from: $DIST_DIR"
echo "  Profile: $PROFILE_DIR (temporary)"
echo ""
echo "  The extension should appear in the toolbar."
echo "  Visit any news site to test classification."
echo ""
echo "  Press Ctrl+C to stop and clean up."
echo "============================================"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo "Cleaning up temporary profile..."
  rm -rf "$PROFILE_DIR"
  echo "Done."
}
trap cleanup EXIT

# Launch browser with extension
"$BROWSER_PATH" \
  --user-data-dir="$PROFILE_DIR" \
  --load-extension="$DIST_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-default-apps \
  "https://news.ycombinator.com"
