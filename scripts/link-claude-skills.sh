#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_ROOT="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SKILLS_DEST="$CLAUDE_ROOT/skills"

resolve_dir() {
  cd "$1" && pwd -P
}

ensure_safe_destination() {
  if [ -L "$SKILLS_DEST" ]; then
    resolved="$(resolve_dir "$SKILLS_DEST")"
    case "$resolved" in
      "$REPO"|"$REPO"/*)
        echo "error: $SKILLS_DEST is a symlink into this repo ($resolved)." >&2
        echo "Remove it and re-run; this script expects $SKILLS_DEST to be a real directory." >&2
        exit 1
        ;;
    esac
  fi
}

ensure_unique_names() {
  names_file="$(mktemp)"
  trap 'rm -f "$names_file"' EXIT

  find "$REPO/skills" -path '*/node_modules' -prune -o -name SKILL.md -print0 |
    while IFS= read -r -d '' skill_md; do
      basename "$(dirname "$skill_md")"
    done >"$names_file"

  duplicates="$(sort "$names_file" | uniq -d)"
  if [ -n "$duplicates" ]; then
    echo "error: duplicate skill names found under skills/. Claude Code skills are flat under $SKILLS_DEST." >&2
    echo "$duplicates" >&2
    exit 1
  fi
}

link_path() {
  src="$1"
  dest="$2"

  if [ -L "$dest" ]; then
    rm -f "$dest"
  elif [ -e "$dest" ]; then
    echo "error: refusing to replace existing non-symlink path: $dest" >&2
    echo "Remove or rename it, then re-run this script." >&2
    exit 1
  fi

  ln -s "$src" "$dest"
  echo "linked $(basename "$dest") -> $src"
}

link_skills() {
  mkdir -p "$CLAUDE_ROOT" "$SKILLS_DEST"

  find "$REPO/skills" -path '*/node_modules' -prune -o -name SKILL.md -print0 |
    while IFS= read -r -d '' skill_md; do
      src="$(dirname "$skill_md")"
      name="$(basename "$src")"
      dest="$SKILLS_DEST/$name"
      link_path "$src" "$dest"
    done
}

link_shared_support_dirs() {
  find "$REPO/skills" -mindepth 1 -maxdepth 1 -type d -print0 |
    while IFS= read -r -d '' category_dir; do
      find "$category_dir" -mindepth 1 -maxdepth 1 -print0 |
        while IFS= read -r -d '' entry; do
          name="$(basename "$entry")"

          if [ "$name" = "README.md" ]; then
            continue
          fi

          if [ -d "$entry" ] && [ -f "$entry/SKILL.md" ]; then
            continue
          fi

          dest="$CLAUDE_ROOT/$name"
          link_path "$entry" "$dest"
        done
    done
}

main() {
  ensure_safe_destination
  ensure_unique_names
  link_skills
  link_shared_support_dirs

  cat <<EOF

Claude Code docs expect personal skills at:
  $CLAUDE_ROOT/skills/<skill-name>/SKILL.md

If Claude Code was already running and $SKILLS_DEST did not exist when the session started,
restart Claude Code once so it begins watching the new directory.
EOF
}

main "$@"
