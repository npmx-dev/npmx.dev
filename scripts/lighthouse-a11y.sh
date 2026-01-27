#!/bin/bash
# Run Lighthouse accessibility tests in both light and dark mode
#
# This script runs lhci autorun twice, once for each color mode.
# The LIGHTHOUSE_COLOR_MODE env var is read by lighthouse-setup.cjs
# to set the appropriate theme before each audit.

set -e

echo "🌙 Running Lighthouse accessibility audit (dark mode)..."
LIGHTHOUSE_COLOR_MODE=dark pnpx @lhci/cli autorun

echo ""
echo "☀️  Running Lighthouse accessibility audit (light mode)..."
LIGHTHOUSE_COLOR_MODE=light pnpx @lhci/cli autorun

echo ""
echo "✅ Accessibility audits completed for both color modes"
