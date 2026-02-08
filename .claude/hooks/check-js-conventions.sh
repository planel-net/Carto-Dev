#!/bin/bash
# Hook: Remind JS conventions before modifying JS files
# Event: PreToolUse (Edit|Write)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only trigger for JS files
if [[ "$FILE_PATH" != *.js ]]; then
  exit 0
fi

# Provide contextual reminders as additionalContext
cat <<'ENDJSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "RAPPEL CONVENTIONS JS CartoExcel: Utiliser vanilla JS uniquement (pas de frameworks). Suivre le pattern Excel.run(async (context) => {...}) pour les operations Excel. Utiliser context.sync() avec parcimonie. Charger uniquement les proprietes necessaires avec load(). Ne pas utiliser de modules ES6 (pas d'import/export)."
  }
}
ENDJSON
