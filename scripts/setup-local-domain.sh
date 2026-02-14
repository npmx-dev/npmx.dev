#!/bin/bash
set -e

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[0;34m' NC='\033[0m'

error_exit() {
    echo -e "\n${R}✗ $1${NC}" >&2
    [ -n "$2" ] && echo -e "${Y}→ $2${NC}" >&2
    exit 1
}

# Detect operating system
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "macos"
            ;;
        Linux*)
            if grep -qi microsoft /proc/version 2>/dev/null; then
                echo "wsl"
            else
                echo "linux"
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

OS_TYPE=$(detect_os)

echo -e "\n🌐 Configure npmx.test domain for local development"

# Check for unsupported platforms
if [ "$OS_TYPE" = "windows" ]; then
    error_exit "Windows is not supported by Localias" \
        "Please use WSL2 instead: https://learn.microsoft.com/windows/wsl/install"
fi

if [ "$OS_TYPE" = "unknown" ]; then
    error_exit "Unsupported operating system" "Localias supports macOS, Linux, and WSL2"
fi

# Check prerequisites with platform-specific instructions
if ! command -v localias &>/dev/null; then
    case "$OS_TYPE" in
        macos)
            error_exit "Localias not installed" "brew install peterldowns/tap/localias"
            ;;
        linux|wsl)
            error_exit "Localias not installed" "go install github.com/peterldowns/localias/cmd/localias@latest"
            ;;
    esac
fi

[ -f ".localias.yml" ] || error_exit ".localias.yml not found" "Run from project root"

# Linux/WSL: Check and configure privileged port capability
if [ "$OS_TYPE" = "linux" ] || [ "$OS_TYPE" = "wsl" ]; then
    LOCALIAS_PATH=$(which localias)
    if ! getcap "$LOCALIAS_PATH" 2>/dev/null | grep -q "cap_net_bind_service"; then
        echo -e "${Y}⚙ Configuring privileged port access for Localias${NC}"
        echo "This allows Localias to bind to ports 80 and 443 without sudo"
        sudo setcap CAP_NET_BIND_SERVICE=+eip "$LOCALIAS_PATH" || \
            error_exit "Failed to set capabilities" "Run: sudo setcap CAP_NET_BIND_SERVICE=+eip \$(which localias)"
        echo -e "${G}✓ Capabilities configured${NC}"
    fi
fi

# Check if already configured
if localias list 2>/dev/null | grep -q "npmx.test"; then
    echo -e "${Y}⚠ npmx.test already configured${NC}"
    if localias status &>/dev/null; then
        echo -e "${G}✓ Daemon running${NC} - visit ${B}https://npmx.test${NC}"
        exit 0
    fi
    echo "Restarting daemon..."
else
    echo "Configuring npmx.test → localhost:3000 (requires sudo)"
    read -p "Press Enter to continue or Ctrl+C to cancel... "
    localias set npmx.test 3000 || error_exit "Failed to configure alias" "Check sudo access"
fi

# Start daemon
echo "Starting localias daemon (requires sudo)..."
sudo localias stop 2>/dev/null || true
if ! sudo localias start; then
    error_exit "Failed to start daemon" "Check ports 80/443 or run: sudo localias start"
fi

# Verify
sleep 1
if ! localias status &>/dev/null; then
    error_exit "Daemon not running" "Run manually: sudo localias start"
fi

echo -e "\n${G}✓ Setup complete${NC}"
echo -e "  Start dev server: ${B}pnpm dev${NC}"
echo -e "  Visit: ${B}https://npmx.test${NC}"
echo -e "  Remove: ${B}pnpm setup:local:uninstall${NC}"

# Platform-specific notes
if [ "$OS_TYPE" = "wsl" ]; then
    echo -e "\n${Y}ℹ WSL2 Note:${NC}"
    echo -e "  - SSL certificates work in WSL browsers"
    echo -e "  - For Windows browsers, manually install cert from:"
    echo -e "    ~/.localias/certs/npmx.test.crt"
fi

# AtProto OAuth caveat
echo -e "\n${Y}⚠ AtProto OAuth Note:${NC}"
echo -e "  When using Bluesky login, the OAuth callback will redirect to"
echo -e "  ${B}http://127.0.0.1:3000${NC} instead of ${B}npmx.test${NC}"
echo -e "  This is required per AtProto spec for localhost development."
echo -e "  Your session will work correctly after the redirect."
echo -e "  See: ${B}https://atproto.com/specs/oauth#localhost-client-development${NC}"

echo ""
