#!/bin/bash
# 從工作坊根目錄啟動靜態伺服器並開啟展示頁（macOS）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
PORT="${PORT:-8765}"
URL="http://127.0.0.1:${PORT}/showcase/"
echo "根目錄: $ROOT"
echo "展示網址: $URL"
echo "按 Ctrl+C 可停止伺服器。"
(sleep 0.6 && open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true) &
exec python3 -m http.server "$PORT"
