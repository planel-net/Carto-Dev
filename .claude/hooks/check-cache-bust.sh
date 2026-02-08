#!/bin/bash
# Hook: Verify cache bust version consistency across HTML files
# Event: Stop

INPUT=$(cat)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Avoid infinite loops
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/Users/jeremy/Documents/CartoExcel}"

# Check for cache bust version inconsistencies in HTML files
HTML_DIR="$PROJECT_DIR/html"
if [ ! -d "$HTML_DIR" ]; then
  exit 0
fi

# Extract all ?v= versions from script and link tags (macOS compatible)
VERSIONS=$(grep -oh '?v=[0-9.]*' "$HTML_DIR"/*.html 2>/dev/null | sort -u)
VERSION_COUNT=$(echo "$VERSIONS" | grep -c '?v=' 2>/dev/null || echo "0")

if [ "$VERSION_COUNT" -gt 1 ]; then
  VERSIONS_INLINE=$(echo "$VERSIONS" | tr '\n' ' ')
  echo "{\"systemMessage\": \"ATTENTION: Versions de cache bust inconsistantes dans les fichiers HTML: ${VERSIONS_INLINE}. Verifier que taskpane.html et app.html utilisent la meme version.\"}"
fi

exit 0
