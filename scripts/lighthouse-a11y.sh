#!/bin/bash
# Run Lighthouse accessibility tests in both light and dark mode
#
# This script runs lhci autorun twice, once for each color mode.
# The LIGHTHOUSE_COLOR_MODE env var is read by lighthouse-setup.cjs
# to set the appropriate theme before each audit.

set -e

case "${LIGHTHOUSE_COLOR_MODE}" in
  dark)
    echo "🌙 Running Lighthouse accessibility audit (dark mode)..."
    pnpx @lhci/cli autorun --upload.githubStatusContextSuffix="/dark"
    ;;
  light)
    echo "☀️ Running Lighthouse accessibility audit (light mode)..."
    pnpx @lhci/cli autorun --upload.githubStatusContextSuffix="/light"
    ;;
  *)
    echo "⚠️ Missing or invalid LIGHTHOUSE_COLOR_MODE. Use 'dark' or 'light'."
    exit 1
    ;;
esac

echo ""
echo "✅ Accessibility audit completed"
