#!/bin/bash
# Check if README translations are out of sync with the main README.
# Used as a pre-commit / Claude Code hook to remind about translations.

MAIN="README.md"
TRANSLATIONS=("README.ko.md" "README.ja.md")

if ! git diff --cached --name-only | grep -q "^${MAIN}$" 2>/dev/null; then
  # README.md not staged — nothing to check
  exit 0
fi

OUTDATED=()
for t in "${TRANSLATIONS[@]}"; do
  if ! git diff --cached --name-only | grep -q "^${t}$" 2>/dev/null; then
    OUTDATED+=("$t")
  fi
done

if [ ${#OUTDATED[@]} -gt 0 ]; then
  echo "[vmux] README.md was modified but these translations were not updated:"
  for t in "${OUTDATED[@]}"; do
    echo "  - $t"
  done
  echo ""
  echo "Please update the translations before committing."
  echo "Tip: Ask Claude Code or Codex to translate the changes."
fi
