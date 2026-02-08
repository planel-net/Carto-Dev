#!/bin/bash
# Hook: Warn about config.js impacts after modification
# Event: PostToolUse (Edit|Write)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only trigger for config.js
if [[ "$FILE_PATH" != */config.js ]]; then
  exit 0
fi

# Warn Claude about potential impacts
cat <<'ENDJSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "ATTENTION: config.js a ete modifie. Verifier les impacts sur: 1) Les noms de tables (TABLE_NAMES) utilises dans excel-utils.js et toutes les pages. 2) Les noms de feuilles (SHEETS) references dans auth.js et excel-bridge.js. 3) Les relations entre tables (RELATIONS) utilisees dans les modales et formulaires. 4) La coherence des cache bust versions si des fichiers JS ont ete ajoutes/renommes."
  }
}
ENDJSON
