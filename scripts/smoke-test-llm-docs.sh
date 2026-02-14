#!/usr/bin/env bash
#
# Smoke test all llm-docs routes (llms.txt, llms_full.txt, .md)
# Usage: ./scripts/smoke-test-llm-docs.sh http://localhost:3333

set -euo pipefail

BASE="${1:?Usage: $0 <base-url>}"
BASE="${BASE%/}" # strip trailing slash

PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expect_status="${3:-200}"

  status=$(curl -s -o /dev/null -w "%{http_code}" -L "$url")

  if [ "$status" = "$expect_status" ]; then
    echo "  PASS  GET $url $status $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  GET $url $status $label (expected $expect_status)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Root ==="
check "Root llms.txt" "$BASE/llms.txt"

echo ""
echo "=== Unscoped package (latest) ==="
check "llms.txt"      "$BASE/package/nuxt/llms.txt"
check "llms_full.txt" "$BASE/package/nuxt/llms_full.txt"
check ".md"           "$BASE/package/nuxt.md"

echo ""
echo "=== Unscoped package (versioned) ==="
check "llms.txt"      "$BASE/package/nuxt/v/3.16.2/llms.txt"
check "llms_full.txt" "$BASE/package/nuxt/v/3.16.2/llms_full.txt"

echo ""
echo "=== Scoped package (latest) ==="
check "llms.txt"      "$BASE/package/@nuxt/kit/llms.txt"
check "llms_full.txt" "$BASE/package/@nuxt/kit/llms_full.txt"
check ".md"           "$BASE/package/@nuxt/kit.md"

echo ""
echo "=== Scoped package (versioned) ==="
check "llms.txt"      "$BASE/package/@nuxt/kit/v/4.3.1/llms.txt"
check "llms_full.txt" "$BASE/package/@nuxt/kit/v/4.3.1/llms_full.txt"

echo ""
echo "=== Org-level ==="
check "Org llms.txt"  "$BASE/package/@nuxt/llms.txt"

echo ""
echo "=== Shorthand redirects (follow → 200) ==="
check "Unscoped .md redirect"           "$BASE/nuxt.md"
check "Scoped .md redirect"             "$BASE/@nuxt/kit.md"
check "Unscoped llms.txt redirect"      "$BASE/nuxt/llms.txt"
check "Scoped llms.txt redirect"        "$BASE/@nuxt/kit/llms.txt"

echo ""
echo "=== Results ==="
echo "  $PASS passed, $FAIL failed"
exit $FAIL
