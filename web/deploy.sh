#!/usr/bin/env bash
# 把社团网站上传到服务器（2222 端口的容器，文件放 /workspace/club，由求职罗盘同一个进程提供）。
# 用法：在 Git Bash 里运行  bash web/deploy.sh      上传后立即生效：http://43.143.67.155/
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 线上内容以后台（/admin/）为准，本地改 shared/content.js 不会生效；这里传上去的 content.js 只在后台出故障时兜底。
# 部署前先跑 bash server/pull-content.sh，让兜底用的 content.js 和线上一致。/workspace/clubdata 永远不要动。
cd "$HERE"
VERSIONS=$(ls -d v[0-9]*-*/ | tr -d /)
# _home 里是线上主页（index.html + 六张缩略图），解包后落在 /workspace/club 根目录
tar czf "$TMP/club.tgz" --exclude=shared/img/uploads --exclude=shared/fonts/build_fonts.py shared $VERSIONS -C _home index.html _thumbs
scp -o BatchMode=yes -P 2222 "$TMP/club.tgz" site_king@43.143.67.155:/workspace/club.tgz
ssh -o BatchMode=yes -p 2222 site_king@43.143.67.155 \
  'set -e; rm -rf /workspace/club.new; mkdir /workspace/club.new; tar xzf /workspace/club.tgz -C /workspace/club.new; rm /workspace/club.tgz;
   rm -rf /workspace/club.old; mv /workspace/club /workspace/club.old; mv /workspace/club.new /workspace/club; rm -rf /workspace/club.old;
   systemctl --user restart dsh.service'
echo "已上传：http://43.143.67.155/   （首页是 web/_home/index.html，六个版本的入口）"
