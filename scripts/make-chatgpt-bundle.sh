#!/usr/bin/env bash
# scripts/make-chatgpt-bundle.sh
set -euo pipefail

ROOT="${1:-.}"
OUT_DIR="${2:-/tmp/chatgpt_bundle}"
BUNDLE_NAME="${3:-repo-chatgpt-bundle}"

rm -rf "$OUT_DIR" && mkdir -p "$OUT_DIR"

# Ignore list (fixed-string patterns)
cat > "$OUT_DIR/.bundleignore" <<'IGN'
node_modules/
.build/
dist/
out/
coverage/
.next/
.vite/
pnpm-lock.yaml
package-lock.json
yarn.lock
.DS_Store
*.log
.env
.env.*
*.key
*.pem
*.p12
*.crt
*.der
*.sqlite
*.db
*.zip
*.tar.gz
IGN

# Collect tracked files
TMP_ALL="$OUT_DIR/all.txt"
git -C "$ROOT" ls-files > "$TMP_ALL"

# Exclude ignored paths (fixed strings)
TMP_KEEP="$OUT_DIR/keep.txt"
if [ -s "$OUT_DIR/.bundleignore" ]; then
  grep -Fv -f "$OUT_DIR/.bundleignore" "$TMP_ALL" > "$TMP_KEEP" || true
else
  cp "$TMP_ALL" "$TMP_KEEP"
fi

# Keep only code-ish files
TMP_CODE="$OUT_DIR/code.txt"
grep -E '\.(jsx?|tsx?|css|scss|json|md|ya?ml|html|tsconfig|eslintrc|prettierrc|cjs|mjs)$' "$TMP_KEEP" > "$TMP_CODE" || true

# Single mega markdown snapshot
MEGA="$OUT_DIR/repo-snapshot.md"
{
  echo "# Repository Snapshot"
  echo ""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    EXT="${f##*.}"
    LANG="$EXT"
    [[ "$f" =~ eslintrc|prettierrc ]] && LANG="json"
    echo ""
    echo "## \`$f\`"
    echo ""
    echo '```'"$LANG"
    sed -n '1,400p' "$ROOT/$f" || true
    echo '```'
  done < "$TMP_CODE"
} > "$MEGA"

# Include a simple file list
( cd "$ROOT" && git ls-files | sort ) > "$OUT_DIR/repo-tree.txt"

# Zip it to a temp bundle, then move to Desktop
( cd "$OUT_DIR" && zip -q -r "${BUNDLE_NAME}.zip" . )
DEST="${HOME}/Desktop/${BUNDLE_NAME}.zip"
mv "$OUT_DIR/${BUNDLE_NAME}.zip" "$DEST"
echo "Bundle ready: $DEST"

