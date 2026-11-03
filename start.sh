#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/python -m pip install -r requirements.txt
fi
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  echo '请先安装FFmpeg。Mac可运行 brew install ffmpeg'
  exit 1
fi
echo '打开 http://127.0.0.1:8765 （退出用 Ctrl+C）'
exec .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8765
