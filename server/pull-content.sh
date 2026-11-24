#!/usr/bin/env bash
# 把服务器上的线上内容拉回本机，方便本地预览：
#   /workspace/clubdata/content.json  →  web/shared/content.js   （原文件先备份成 content.js.bak）
#   /workspace/clubdata/uploads/      →  web/shared/img/uploads/ （后台上传的图片，图片字段写的是 uploads/xxx）
# 用法：在 Git Bash 里运行  bash server/pull-content.sh
# 只读服务器，不改服务器上的任何东西。
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$HERE/../web"
REMOTE="site_king@43.143.67.155"
PORT=2222
DATA=/workspace/clubdata

NODE_BIN="${NODE:-}"
if [ -z "$NODE_BIN" ]; then
  if command -v node >/dev/null 2>&1; then NODE_BIN=node
  elif [ -x /d/nodejs/node ]; then NODE_BIN=/d/nodejs/node
  else echo "找不到 node，请设置 NODE=/path/to/node" >&2; exit 1; fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "下载 content.json …"
scp -o BatchMode=yes -P "$PORT" "$REMOTE:$DATA/content.json" "$TMP/content.json"
"$NODE_BIN" "$HERE/scripts/content-convert.js" json2js "$TMP/content.json" "$TMP/content.js"

if [ -f "$WEB/shared/content.js" ]; then
  cp "$WEB/shared/content.js" "$WEB/shared/content.js.bak"
fi
mv "$TMP/content.js" "$WEB/shared/content.js"
echo "已更新 web/shared/content.js（旧文件在 content.js.bak）"

echo "下载上传的图片 …"
mkdir -p "$WEB/shared/img/uploads"
ssh -o BatchMode=yes -p "$PORT" "$REMOTE" "cd $DATA/uploads 2>/dev/null && tar cf - . || tar cf - --files-from /dev/null" \
  | tar xf - -C "$WEB/shared/img/uploads"
echo "图片在 web/shared/img/uploads/（$(ls "$WEB/shared/img/uploads" | wc -l) 个文件）"
echo "本地预览：python -m http.server 8848 --directory web  然后打开 http://localhost:8848/v5-zhi/"
