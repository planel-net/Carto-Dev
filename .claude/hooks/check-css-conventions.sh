#!/bin/bash
# Hook: Remind CSS conventions before modifying CSS files
# Event: PreToolUse (Edit|Write)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only trigger for CSS files
if [[ "$FILE_PATH" != *.css ]]; then
  exit 0
fi

# Provide contextual reminders
cat <<'ENDJSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "RAPPEL CONVENTIONS CSS CartoExcel: Toujours utiliser les variables CSS Malakoff Humanis (--mh-bleu-fonce, --mh-bleu-clair, --mh-orange, --mh-gris-fonce, --mh-gris-moyen, --mh-gris-clair, --mh-vert-succes, --mh-rouge-erreur, --mh-jaune-warning). Utiliser les variables d'espacement (--spacing-xs/sm/md/lg/xl). Utiliser les variables de bordure, transition et ombres definies dans variables.css. Ne jamais coder les couleurs en dur."
  }
}
ENDJSON
