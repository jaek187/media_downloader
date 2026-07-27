"""Local HTTP service used by the Media Downloader browser extension."""

from __future__ import annotations

import base64
import os
import platform
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from waitress import serve

APP_DIR = Path(tempfile.gettempdir()) / "media-downloader"
APP_DIR.mkdir(parents=True, exist_ok=True)
HOST = "127.0.0.1"
PORT = 5000

app = Flask(__name__)


def get_ffmpeg_path() -> str | None:
    """Return the bundled ffmpeg binary when the release provides one."""
    base_dir = Path(sys.executable if getattr(sys, "frozen", False) else __file__).parent
    executable = "ffmpeg.exe" if platform.system() == "Windows" else "ffmpeg"
    candidate = base_dir / executable
    return str(candidate) if candidate.is_file() else None


FFMPEG_PATH = get_ffmpeg_path()


@app.after_request
def add_cors_headers(response):
    """Permit only the local extension to call this loopback service."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def copy_to_clipboard(filepath: Path) -> None:
    """Copy a file reference in the most useful native form for each desktop OS."""
    system = platform.system()
    if system == "Windows":
        encoded_path = base64.b64encode(str(filepath).encode("utf-8")).decode("ascii")
        command = (
            "$path = [Text.Encoding]::UTF8.GetString("
            f"[Convert]::FromBase64String('{encoded_path}')); "
            "Set-Clipboard -LiteralPath $path"
        )
        subprocess.run(["powershell", "-NoProfile", "-Command", command], check=True)
    elif system == "Darwin":
        subprocess.run(
            ["osascript", "-e", f'set the clipboard to POSIX file "{filepath}"'],
            check=True,
        )
    elif system == "Linux":
        subprocess.run(
            ["xclip", "-selection", "clipboard", "-t", "text/uri-list"],
            input=f"{filepath.as_uri()}\n".encode(),
            check=True,
        )
    else:
        raise RuntimeError(f"Copying files is not supported on {system}.")


def requested_file(filename: str) -> Path:
    """Resolve a downloaded file without allowing paths outside APP_DIR."""
    candidate = (APP_DIR / filename).resolve()
    if candidate.parent != APP_DIR.resolve() or not candidate.is_file():
        raise FileNotFoundError(filename)
    return candidate


@app.route("/files/<path:filename>", methods=["GET"])
def serve_file(filename: str):
    try:
        return send_file(requested_file(filename), as_attachment=True)
    except FileNotFoundError:
        return jsonify({"error": "File not found."}), 404


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "ffmpeg": FFMPEG_PATH or "system-path"})


@app.route("/process", methods=["POST"])
def process_video():
    data = request.get_json(silent=True) or {}
    url = data.get("url")
    action = data.get("action", "download")
    resolution = str(data.get("resolution", "best"))
    audio_only = bool(data.get("audioOnly", False))
    embed_meta = bool(data.get("embedMeta", False))

    if not isinstance(url, str) or not url.startswith(("https://", "http://")):
        return jsonify({"error": "Please provide a valid HTTP(S) URL."}), 400
    if action not in {"download", "copy"}:
        return jsonify({"error": "Unknown action."}), 400
    if resolution != "best" and resolution not in {"144", "360", "480", "720", "1080", "1440", "2160"}:
        return jsonify({"error": "Unsupported resolution."}), 400

    output_template = str(APP_DIR / "%(title)s [%(id)s].%(ext)s")
    ydl_opts = {
        "outtmpl": output_template,
        "noplaylist": True,
        "merge_output_format": "mp4",
        "restrictfilenames": False,
    }
    if FFMPEG_PATH:
        ydl_opts["ffmpeg_location"] = FFMPEG_PATH

    if audio_only:
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}]
    else:
        # Twitter/X often exposes a single stream containing both video and
        # audio. Prefer separate streams when they exist, but always fall back
        # to a compatible combined stream instead of rejecting the post.
        ydl_opts["format"] = (
            f"bestvideo*[height<={resolution}]+bestaudio/best[height<={resolution}]/best"
            if resolution != "best"
            else "bestvideo*+bestaudio/best"
        )

    if embed_meta:
        ydl_opts.setdefault("postprocessors", []).extend(
            [{"key": "FFmpegMetadata"}, {"key": "EmbedThumbnail"}]
        )
        ydl_opts["writethumbnail"] = True

    try:
        import yt_dlp

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = Path(ydl.prepare_filename(info))
            if audio_only:
                filepath = filepath.with_suffix(".mp3")
            elif filepath.suffix.lower() != ".mp4":
                filepath = filepath.with_suffix(".mp4")

        if not filepath.is_file():
            raise RuntimeError("Download finished but the output file was not found.")

        if action == "copy":
            copy_to_clipboard(filepath)
            return jsonify({"status": "success", "file": filepath.name})

        return jsonify(
            {
                "status": "success",
                "downloadUrl": f"http://{HOST}:{PORT}/files/{urllib.parse.quote(filepath.name)}",
                "filename": filepath.name,
            }
        )
    except Exception as error:
        app.logger.exception("Unable to process URL")
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    serve(app, host=HOST, port=PORT, threads=4)
