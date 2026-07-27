# Media Downloader

A small browser extension and local helper that lets you download media with
[yt-dlp](https://github.com/yt-dlp/yt-dlp) from a Chromium browser's right-click menu.
It runs entirely on your computer: the extension talks only to a local service at
`127.0.0.1`.

Use it only for content you are allowed to download and in accordance with the
website's terms and applicable law.

## Install

Install the latest published release with one command. The installer starts the
local service and places the extension on your machine.

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/jaek187/media_downloader/main/install.ps1 | iex
```

**macOS and Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/jaek187/media_downloader/main/install.sh | bash
```

Then, in Chrome, Edge, or Brave:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `extension` folder printed by the installer.

Right-click a page, link, or video and choose **yt-dlp Options**. Open the
extension's settings to choose quality, audio-only downloads, metadata, and save behavior.

## Requirements

The one-line installers download a release built for Windows, Linux x86_64, macOS
Apple Silicon, or macOS Intel. They require an internet connection and permission
to create a per-user background service. No system-wide administrator access is needed.

For manual development, use Python 3.11+ and run:

```bash
python -m pip install -r requirements.txt
python server.py
```

Install `ffmpeg` separately for development (for example with `winget`, Homebrew,
or your Linux package manager). Release builds include it.

## Publish a release

Push a version tag to GitHub and the included workflow builds the release archives:

```bash
git tag v1.0.0
git push origin v1.0.0
```

After the GitHub Actions workflow finishes, the install commands above use that
release automatically.

## Uninstall

Remove the loaded extension from `chrome://extensions`, then remove the local app:

- Windows: unregister the `MediaDownloaderServer` scheduled task and delete `%LOCALAPPDATA%\MediaDownloader`.
- Linux: run `systemctl --user disable --now media-downloader.service`, remove
  `~/.config/systemd/user/media-downloader.service`, and delete
  `~/.local/share/media-downloader`.
- macOS: run `launchctl unload ~/Library/LaunchAgents/com.mediadownloader.server.plist`,
  remove that plist, and delete `~/.local/share/media-downloader`.

## Privacy

The extension sends the selected page URL and your chosen options to its local
helper only. yt-dlp then contacts the site hosting that URL. The project does not
operate a server or collect analytics.
