#!/bin/bash
# Hook: Verify manifest.xml URLs match the environment before git push
# Event: PreToolUse (Bash) - triggers on git push commands

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger for git push commands
if ! echo "$COMMAND" | grep -q 'git push'; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/Users/jeremy/Documents/CartoExcel}"
MANIFEST="$PROJECT_DIR/manifest.xml"

if [ ! -f "$MANIFEST" ]; then
  exit 0
fi

# Detect environment from git remote
REMOTE_URL=$(cd "$PROJECT_DIR" && git remote get-url origin 2>/dev/null || echo "")
IS_DEV=false
if echo "$REMOTE_URL" | grep -qi 'dev'; then
  IS_DEV=true
fi

# Check manifest URLs consistency
MANIFEST_URLS=$(grep -o 'https://[^"]*' "$MANIFEST" 2>/dev/null | sort -u)

# Check all URLs point to the same base
BASE_URLS=$(echo "$MANIFEST_URLS" | sed 's|/html/.*||;s|/assets/.*||' | sort -u)
BASE_COUNT=$(echo "$BASE_URLS" | wc -l | tr -d ' ')

WARNINGS=""

if [ "$BASE_COUNT" -gt 1 ]; then
  WARNINGS="ATTENTION manifest.xml: URLs pointent vers des bases differentes: $(echo "$BASE_URLS" | tr '\n' ' '). "
fi

# Check dev/prod consistency
if [ "$IS_DEV" = "true" ]; then
  if echo "$MANIFEST_URLS" | grep -qv 'Dev'; then
    WARNINGS="${WARNINGS}ATTENTION: Le repo semble etre DEV mais certaines URLs manifest ne contiennent pas 'Dev'. "
  fi
fi

# Check DisplayName matches environment
DISPLAY_NAME=$(grep 'DisplayName' "$MANIFEST" | head -1)
if [ "$IS_DEV" = "true" ] && ! echo "$DISPLAY_NAME" | grep -q 'DEV'; then
  WARNINGS="${WARNINGS}ATTENTION: Repo DEV mais DisplayName ne contient pas '(DEV)'. "
fi

if [ -n "$WARNINGS" ]; then
  cat <<ENDJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "$WARNINGS Verifier manifest.xml avant de push."
  }
}
ENDJSON
fi

exit 0
