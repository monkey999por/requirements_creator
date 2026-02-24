#!/bin/zsh
set -euo pipefail

DOTFILES_REPO="${DOTFILES_REPO:-git@github.com:monkey999por/dotfiles_zsh.git}"
DOTFILES_DIR="$HOME/.dotfiles_zsh"

# Idempotency guard
if [ -f "$DOTFILES_DIR/.installed" ]; then
  echo "[dotfiles] Already installed, skipping."
  exit 0
fi

echo "[dotfiles] Cloning $DOTFILES_REPO ..."
rm -rf "$DOTFILES_DIR"
git clone --depth 1 "$DOTFILES_REPO" "$DOTFILES_DIR"

echo "[dotfiles] Running install.sh ..."
cd "$DOTFILES_DIR"
zsh install.sh

# Create Homebrew-compatible symlinks for zsh plugins (macOS paths referenced in dotfiles)
echo "[dotfiles] Creating Homebrew-compatible symlinks ..."
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
sudo mkdir -p /opt/homebrew/share/zsh-autosuggestions
sudo ln -sf "$ZSH_CUSTOM/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh" \
  /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh

touch "$DOTFILES_DIR/.installed"
echo "[dotfiles] Done."
