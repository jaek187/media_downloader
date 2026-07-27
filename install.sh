#!/usr/bin/env bash
# Media Downloader installer for Linux and macOS.
# Run: curl -fsSL https://raw.githubusercontent.com/jaek187/media_downloader/main/install.sh | bash
set -euo pipefail

REPO="jaek187/media_downloader"
APP_NAME="media-downloader"
OS="$(uname -s)"
ARCH="$(uname -m)"
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$APP_NAME"

case "$OS" in
  Linux) ASSET_NAME="media-downloader-linux-x86_64.tar.gz" ;;
  Darwin)
    case "$ARCH" in
      arm64) ASSET_NAME="media-downloader-macos-arm64.tar.gz" ;;
      x86_64) ASSET_NAME="media-downloader-macos-x86_64.tar.gz" ;;
      *) echo "Unsupported macOS architecture: $ARCH" >&2; exit 1 ;;
    esac ;;
  *) echo "Unsupported operating system: $OS" >&2; exit 1 ;;
esac

command -v curl >/dev/null || { echo "curl is required." >&2; exit 1; }
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
PLIST="$HOME/Library/LaunchAgents/com.mediadownloader.server.plist"

if [[ "$OS" == "Linux" ]] && command -v systemctl >/dev/null 2>&1; then
  systemctl --user stop "$APP_NAME.service" 2>/dev/null || true
elif [[ "$OS" == "Darwin" ]]; then
  launchctl unload "$PLIST" 2>/dev/null || true
fi

echo "Media Downloader installer ($OS/$ARCH)"
echo "Downloading the latest release..."
curl --fail --location --silent --show-error \
  "https://github.com/$REPO/releases/latest/download/$ASSET_NAME" \
  --output "$TEMP_DIR/$ASSET_NAME"

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf "$TEMP_DIR/$ASSET_NAME" -C "$INSTALL_DIR"
SERVER_BIN="$INSTALL_DIR/media-downloader-server"
chmod +x "$SERVER_BIN"

if [[ "$OS" == "Linux" ]] && command -v systemctl >/dev/null 2>&1; then
  SERVICE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  mkdir -p "$SERVICE_DIR"
  cat > "$SERVICE_DIR/$APP_NAME.service" <<EOF
[Unit]
Description=Media Downloader local service

[Service]
ExecStart=$SERVER_BIN
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now "$APP_NAME.service"
elif [[ "$OS" == "Darwin" ]]; then
  mkdir -p "$(dirname "$PLIST")"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.mediadownloader.server</string>
  <key>ProgramArguments</key><array><string>$SERVER_BIN</string></array>
  <key>WorkingDirectory</key><string>$INSTALL_DIR</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
</dict></plist>
EOF
  launchctl load "$PLIST"
else
  nohup "$SERVER_BIN" >"$INSTALL_DIR/server.log" 2>&1 &
fi

echo
echo "Installed successfully."
echo "In Chrome, Edge, or Brave: open chrome://extensions, enable Developer mode, then Load unpacked:"
echo "  $INSTALL_DIR/extension"
