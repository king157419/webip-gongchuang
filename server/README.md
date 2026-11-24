# 社团官网管理后台（club_admin）

上海大学人工智能社官网的内容后台。和求职罗盘跑在同一个 uvicorn 进程里（`dsh.service`），不新增进程、不新增数据库服务、不新增 Python 依赖（只用 fastapi / uvicorn 和标准库）。

## 它做了什么

- 网站内容存到服务器 `/workspace/clubdata/content.json`。`/shared/content.js` 不再是静态文件，而是后台按 content.json 现场生成的 `window.CLUB = {...};`，所有版本目录（v1…v7）不用改代码就能读到最新内容。
- `/admin/` 是后台页面：按栏目编辑新闻、活动类型、荣誉、人物、加入我们、社团信息；上传图片；查看历史版本并一键恢复；查看操作记录；查看只读的服务器状态。
- 管理员只能在服务器终端用命令创建，网页上没有注册入口。

### 路由

| 路径 | 说明 |
| --- | --- |
| `GET /shared/content.js` | 动态生成，`Cache-Control: no-cache` + ETag（支持 304）。响应头 `X-Content-Source` 标明来源：`current` / `last-good` / `history` / `static` |
| `GET /uploads/<随机名>` | 后台上传的图片；`/shared/img/uploads/<随机名>` 指向同一批文件（网站各版本会把图片字段拼成 `../shared/img/<字段>`） |
| `GET /admin/` | 后台页面（静态 HTML + 原生 JS） |
| `POST /admin/api/login`、`POST /admin/api/logout`、`GET /admin/api/me` | 登录 / 退出 / 当前用户 |
| `GET /admin/api/schema` | 各栏目字段定义（前端据此生成表单和校验） |
| `GET /admin/api/content` | 当前内容 + 版本号 |
| `PUT /admin/api/content/<栏目>` | 保存一个栏目，`{data, base_version}`；栏目是 news / programs / honors / people / join / meta |
| `POST /admin/api/uploads` | 上传图片（请求体就是图片本身，Content-Type 为 image/jpeg、png、webp） |
| `GET /admin/api/history`、`GET /admin/api/history/<名字>` | 历史版本列表 / 与当前内容的差异摘要 |
| `POST /admin/api/history/<名字>/restore` | 恢复，`{base_version}` |
| `GET /admin/api/audit` | 操作记录（最近 300 条） |
| `GET /admin/api/status` | 服务器状态（只读） |
| `GET /admin/api/board`、`GET /admin/api/board/<game>`、`DELETE /admin/api/board/<game>/<id>` | 排行榜：查看 / 删除一条记录（见下文「排行榜」） |
| `GET/POST /api/board/<game>` | 公开的排行榜接口，不需要登录 |

除 `/shared/content.js`、`/uploads/…`、`/admin/` 页面和登录接口外，所有 `/admin/api/*` 都要登录。

## 服务器上的目录

```
/workspace/dsh/                 求职罗盘 + 入口（WorkingDirectory）
  serve.py                      ← 用 server/serve.py 替换
  club_admin/                   ← 新增：server/club_admin/ 整个目录
  app/  static/  venv/  data/   求职罗盘原有，不动
/workspace/club/                网站静态文件（web/deploy.sh 上传的 shared、v1…v7）
  shared/content.js             打包时带的静态版本，只在后台出问题时兜底
/workspace/clubdata/            ← 新增：后台数据（CLUB_DATA_DIR）
  content.json                  网站内容（唯一的线上数据）
  admins.json                   管理员（scrypt 加盐哈希）
  admin.db                      SQLite：登录会话、登录失败计数、操作记录
  board.db                      SQLite：全社团排行榜（第一次启动自动建）
  history/                      保存前的旧版本，文件名 时间戳-用户名.json，保留最近 100 份
  uploads/                      上传的图片（随机文件名）
```

后台写的文件权限都是 600（只有 site_king 能读）。**`/workspace/clubdata` 需要纳入备份**，`web/deploy.sh` 不会也不应该碰它。

## 首次部署

以下命令不在本机自动执行，由部署的人逐条运行。服务器地址、端口按现在的 `web/deploy.sh`。

### 1. 本机：生成 content.json，打包后台代码

```bash
# Git Bash，在 D:/desk/webip 下
/d/nodejs/node server/scripts/content-convert.js js2json web/shared/content.js /tmp/content.json
tar czf /tmp/club-admin.tgz -C server --exclude=__pycache__ club_admin serve.py dsh.service
scp -P 2222 /tmp/content.json /tmp/club-admin.tgz site_king@43.143.67.155:/workspace/
```

### 2. 服务器：放代码、建数据目录、导入内容

```bash
ssh -p 2222 site_king@43.143.67.155
cd /workspace/dsh
cp serve.py serve.py.bak-$(date +%Y%m%d)           # 留一份旧入口，回滚用
mkdir -p /tmp/ca && tar xzf /workspace/club-admin.tgz -C /tmp/ca
rm -rf club_admin && cp -r /tmp/ca/club_admin /tmp/ca/serve.py .
mkdir -p /workspace/clubdata && chmod 700 /workspace/clubdata
CLUB_DATA_DIR=/workspace/clubdata venv/bin/python -m club_admin.cli import /workspace/content.json
```

不需要装新包。（`python-multipart` 也不需要：上传接口直接读请求体。）

### 3. 服务器：更新 dsh.service 并重启

`server/dsh.service` 只比原来多了 `CLUB_DATA_DIR`、`CLUB_SITE_DIR`、`CLUB_COOKIE_SECURE` 三行环境变量（都和默认值一样，不加也能跑，写出来是为了以后好找）。

```bash
systemctl --user cat dsh.service | head -1          # 看服务文件实际在哪，一般是 ~/.config/systemd/user/dsh.service
cp ~/.config/systemd/user/dsh.service ~/dsh.service.bak
cp /tmp/ca/dsh.service ~/.config/systemd/user/dsh.service
systemctl --user daemon-reload
systemctl --user restart dsh.service
journalctl --user -u dsh.service -n 30 --no-pager   # 应看到「管理后台已加载：数据目录 /workspace/clubdata」
curl -sI http://127.0.0.1:8000/shared/content.js | grep -i -E 'x-content-source|etag'   # 应为 current
```

### 4. 创建第一个管理员（社团负责人自己在 SSH 里执行）

```bash
cd /workspace/dsh
CLUB_DATA_DIR=/workspace/clubdata venv/bin/python -m club_admin.cli add <用户名>
```

密码只能交互输入两次（至少 10 位），不接受命令行参数。然后浏览器打开 `http://43.143.67.155/admin/` 登录。

### 回滚

```bash
cd /workspace/dsh && cp serve.py.bak-<日期> serve.py && systemctl --user restart dsh.service
```

回滚后 `/shared/content.js` 回到静态文件（`/workspace/club/shared/content.js`），网站照常；`/workspace/clubdata` 保留不动。

## 日常命令（服务器终端）

```bash
cd /workspace/dsh
export CLUB_DATA_DIR=/workspace/clubdata          # 默认就是这个，可以不设
venv/bin/python -m club_admin.cli list            # 列出管理员
venv/bin/python -m club_admin.cli add <用户名>     # 新建管理员
venv/bin/python -m club_admin.cli passwd <用户名>  # 改密码（该用户的登录会话全部作废）
venv/bin/python -m club_admin.cli remove <用户名>  # 删除管理员（会话全部作废）
venv/bin/python -m club_admin.cli import <文件>    # 用一份 content.json 覆盖线上内容（旧内容进历史）

systemctl --user status dsh.service
systemctl --user restart dsh.service             # 改了代码 / serve.py / 新增版本目录后
journalctl --user -u dsh.service -n 100 --no-pager
```

## 本机

```bash
bash server/pull-content.sh        # 线上 content.json → web/shared/content.js，上传的图片 → web/shared/img/uploads/
```

### 测试

```powershell
cd D:\desk\webip\server
D:\conda\miniconda3\python.exe -m venv .venv
.venv\Scripts\python.exe -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r <求职罗盘>\requirements.txt pytest
.venv\Scripts\python.exe -m pytest                                   # 替身 app.main
$env:DSH_APP_DIR="<求职罗盘代码目录>"; .venv\Scripts\python.exe -m pytest tests\test_serve.py   # 用真的 app.main
.venv\Scripts\python.exe tests\e2e_smoke.py <临时目录> [求职罗盘代码目录]   # 真起 uvicorn 走一遍，结束自动关闭
```

测试用的管理员账号密码只在 `tests/conftest.py` 里，只用于本机。

## 安全措施

- **密码**：`hashlib.scrypt`（n=2^14, r=8, p=1）+ 16 字节随机盐；验证用常量时间比较；用户不存在时也算一次哈希，防止按耗时猜用户名。
- **管理员只能终端创建**：网页没有任何创建/改密接口；CLI 密码只能 getpass 交互输入。改密码、删除管理员会立刻作废他的所有会话；会话每次请求都会确认用户还存在。
- **会话**：32 字节随机 token，数据库里只存 sha256；Cookie `HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`（12 小时绝对过期）；存在 SQLite，重启不丢。`CLUB_COOKIE_SECURE=1` 时加 `Secure`。
- **CSRF**：所有写操作（含登录、退出、上传）要求 `Origin`（没有则看 `Referer`）与请求的 Host 同源，否则 403；JSON 接口要求 `Content-Type: application/json`，上传要求图片类型，跨站表单发不出这些请求；外加 SameSite=Strict。
- **登录限流**：同一 IP 连续失败 5 次锁 10 分钟（存在 SQLite，重启不清零），锁定期间正确密码也拒绝。
- **内容校验**：前后端同一套字段定义；未知字段、类型错误、必填缺失、日期格式、`cat` 必须是已有活动类型、删除仍被新闻引用的活动类型都会被拒。链接字段只允许 `http(s)://`（挡住 `javascript:`），图片字段禁止 `..` 和绝对路径。单次请求最大 2 MB。
- **并发**：保存带 `base_version`，别人先保存过会返回 409，不会悄悄覆盖。
- **上传**：只按文件头魔数判断 JPG/PNG/WebP，不信任文件名和浏览器给的类型；最大 3 MB；文件名 `secrets.token_hex(16)`；读取时文件名必须匹配 `[0-9a-f]{32}.(jpg|png|webp)`，带 `nosniff` 和 `default-src 'none'`。
- **后台页面**：严格 CSP（只允许同源脚本和样式，无内联脚本）、`X-Frame-Options: DENY`、`no-store`；前端全部用 `textContent` 写数据，不拼 HTML。
- **状态页只读**：没有任何执行操作的接口；`systemctl` / `journalctl` 用固定参数列表、`shell=False`、5 秒超时；唯一可变的参数是 `systemctl show` 后的服务名，来自 systemctl 自己的输出并经正则过滤。
- **官网不受后台影响**：content.json 损坏时用内存里上一份好的；进程刚启动就坏了，用最新一份能通过校验的历史版本；再不行用 `/workspace/club/shared/content.js`。`club_admin` 整个加载失败时 serve.py 会记日志并跳过，静态目录照常提供 content.js。
- **HTTP 提醒**：后台每页顶部和登录框都提示当前是 HTTP、密码明文传输。

## 排行榜（全社团公用榜）

v17-slice-r2（切一刀，比得分）和 v24-fold-r2（纸飞机，比米数）两个页面共用的榜。代码在 `club_admin/board.py`，serve.py 里单独 try/except 接入：加载失败只是没有公用榜，官网和后台照常，两个页面自动退回只显示本机纪录。

### 接口

| 路径 | 说明 |
| --- | --- |
| `GET /api/board/<game>` | 前 10 名 `{game, unit, top:[{rank,name,score,time}], total, me}`；加 `?me=昵称` 时 `me` 里是这个昵称的 `{name,score,rank}` |
| `POST /api/board/<game>` | 提交 `{"name": 昵称, "score": 成绩, "key": 浏览器随机标识}`，返回同上 + `improved`、`kept` |

`game` 只能是 `slice` 或 `fold`，其它一律 404。所有响应 `Cache-Control: no-store`。

### 规则与防滥用

- **成绩范围**（从游戏代码推出来）：slice 是 1–50000 的整数（每切中 +1、每 5 连击 +5、一刀切 n 个 +n(n−1)，一趟不封顶，按极限节奏玩满 1 小时约 5 万分）；fold 是 0.6–20.7 米、最多 1 位小数（`simulate(power)` 在力度 0–1 上的落点是 0.65–20.67 米，页面四舍五入到 0.1 米）。成绩是浏览器算的，服务器只挡明显不合理的数，挡不住有心人伪造——这是图个乐的榜。
- **昵称**：NFKC 规范化、合并空格后 1–12 个字，只能用汉字、英文字母、数字、空格和 `_ - · .`；大小写不同算同一个昵称。
- **同一昵称**：每个游戏一个昵称只有一行，只留最高成绩（同分先达到的排前面）。昵称第一次上榜时记下提交浏览器的随机 key（库里只存 sha256），别的浏览器再用这个昵称提交返回 409，防止被人顶掉。用户清了浏览器数据就用不回原来的昵称了，需要的话负责人删掉那条记录即可。
- **限流**（按真实 IP，与登录限流一样取 uvicorn `--proxy-headers` 换好的地址）：同一 IP 5 分钟最多成功提交 20 次，超了 429 + `Retry-After`；同一 IP 24 小时最多新建 30 个昵称。校验没过、昵称被占的请求不计数。校园网出口 IP 可能很多人共用，所以数值放得比较宽，可在 `BoardStore(...)` 的参数里调。
- **其它**：请求体最大 1 KB；写操作必须同源（Origin / Referer，和后台同一个校验函数），且 `Content-Type: application/json`；每个游戏只保留前 500 名，多出来的自动删。

### 数据放在哪

`/workspace/clubdata/board.db`（SQLite，和 `admin.db` 分开，第一次启动自动建）。表 `scores`（game, name, name_key, score, owner, ip, created, updated；score 存整数，米数 ×10）和 `submits`（限流用，只留 24 小时）。这个文件和 clubdata 其它文件一起备份即可，删掉它就是清空排行榜。

### 怎么删不当昵称

- 后台左侧「排行榜」：切换游戏，看前 200 名（含 IP），点「删除」。删除记进「操作记录」。
- 服务器终端：

```bash
cd /workspace/dsh
venv/bin/python -m club_admin.cli board-list fold          # 列前 50 名（-n 200 列更多），含 IP
venv/bin/python -m club_admin.cli board-rm fold <昵称>      # 删除，记进操作记录
```

删掉后对方可以重新提交；反复出现时可以按 IP 在 nginx 里封。

### 前端

两个页面各多了一个 `club-board.js`（内容相同，负责接口、昵称和浏览器标识的 localStorage、5 秒超时），页面逻辑在各自 `app.js` 里。`file://` 打开、接口 404 / 超时时公用榜的入口一直不出现，只显示本机纪录。

## 以后上 HTTPS / 域名时

1. 在 dsh.service 里设 `CLUB_COOKIE_SECURE=1`，`daemon-reload` 后重启。
2. nginx 需要 `proxy_set_header Host $host;` 和 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`（前者用于同源校验，后者用于按真实 IP 限流）。如果对外域名和 nginx 转发来的 Host 不一致，用 `CLUB_ALLOWED_ORIGINS=https://你的域名` 补充允许的来源。
