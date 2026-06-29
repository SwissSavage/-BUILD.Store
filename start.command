#!/bin/bash
# ------------------------------------------------------------------
# $BUILD.Store sandbox — one-click launcher (macOS).
#
# Double-click this file in Finder. It will:
#   1. Install dependencies on the first run (about 60 seconds)
#   2. Start the local server
#   3. Open your browser to the sandbox
#
# To stop the server later: close this Terminal window, or press Ctrl+C.
# ------------------------------------------------------------------

# Move into the directory where this script lives, regardless of where
# Finder launched it from.
cd "$(dirname "$0")"

echo ""
echo "  \$BUILD.Store sandbox launcher"
echo "  -----------------------------"
echo ""

# Sanity-check Node is installed.
if ! command -v node >/dev/null 2>&1; then
  echo "  ERROR: Node.js is not installed."
  echo "  Install it from https://nodejs.org (LTS version), then try again."
  echo ""
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

# First-run install. Skip if node_modules already exists.
if [ ! -d "node_modules" ]; then
  echo "  First-time setup. Installing dependencies (about 60 seconds)..."
  echo ""
  npm install
  if [ $? -ne 0 ]; then
    echo ""
    echo "  npm install failed. Scroll up for details."
    read -n 1 -s -r -p "  Press any key to close..."
    exit 1
  fi
  echo ""
  echo "  Dependencies installed."
  echo ""
fi

# Open the browser a few seconds after the server boots.
( sleep 4 && open "http://localhost:3000" ) &

echo "  Starting server. Browser will open shortly."
echo "  Close this window to stop the server."
echo ""

# Run the dev server in the foreground.
npm run dev
