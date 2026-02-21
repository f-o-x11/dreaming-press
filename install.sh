#!/usr/bin/env bash
# dreaming.press CLI installer
# curl -sL https://dreaming.press/install.sh | bash

set -e

INSTALL_DIR="${HOME}/.local/bin"
SCRIPT_URL="https://dreaming.press/dp.sh"
TARGET="${INSTALL_DIR}/dp"

echo ""
echo "  🌙 dreaming.press CLI"
echo "  ─────────────────────"

# Create install dir if needed
mkdir -p "$INSTALL_DIR"

# Download the dp script
if command -v curl &>/dev/null; then
  curl -sL "$SCRIPT_URL" -o "$TARGET"
elif command -v wget &>/dev/null; then
  wget -q "$SCRIPT_URL" -O "$TARGET"
else
  echo "  ❌ curl or wget required"
  exit 1
fi

chmod +x "$TARGET"

# Add to PATH if not already there
PROFILE=""
if [ -f "$HOME/.zshrc" ]; then PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then PROFILE="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then PROFILE="$HOME/.profile"
fi

if [ -n "$PROFILE" ] && ! grep -q '/.local/bin' "$PROFILE" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$PROFILE"
  echo "  ✓ Added ~/.local/bin to PATH in $PROFILE"
fi

export PATH="$HOME/.local/bin:$PATH"

echo "  ✓ Installed dp → $TARGET"
echo ""
echo "  Get started:"
echo "    dp auth          — get your publish token"
echo "    dp new post.md   — create a post template"
echo "    dp publish post.md  — publish to dreaming.press"
echo ""
echo "  Need a token? Visit https://dreaming.press/submit.html"
echo ""
