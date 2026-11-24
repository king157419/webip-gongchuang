param(
    [Parameter(Mandatory = $false, HelpMessage = "只重拍指定版本目录（如 v5-zhi,v16-scope）；不填则重拍全部已完成版本")]
    [Alias("版本")]
    [string[]]$Only = @(),

    [Parameter(Mandatory = $false, HelpMessage = "无头浏览器等待毫秒数")]
    [int]$WaitMs = 7000,

    [Parameter(Mandatory = $false, HelpMessage = "如果缩略图已存在且比网页源码新则跳过重拍，只刷新入口页")]
    [switch]$Incremental
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$RepoRoot  = Split-Path -Parent $PSScriptRoot
$WebRoot   = Join-Path $RepoRoot "web"
$ThumbDir  = Join-Path $WebRoot "_thumbs"
$IndexFile = Join-Path $WebRoot "index.html"

if (-not (Test-Path -LiteralPath $WebRoot)) {
    throw "找不到 web 目录：$WebRoot"
}
if (-not (Test-Path -LiteralPath $ThumbDir)) {
    New-Item -ItemType Directory -Path $ThumbDir -Force | Out-Null
}

# 查找本机 Microsoft Edge
$EdgeCandidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$EdgeExe = $EdgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $EdgeExe) {
    throw "未找到 Microsoft Edge 可执行文件，无法生成无头截图。"
}

# 各版本中文名称、标签、分组与一句话特点说明（新增未知版本会自动提取页面描述兜底）
$MetaTable = @{
    "v5-zhi"       = @{ Title = "小智·焦点版";       Tag = "当前线上默认"; Group = "main";    Order = 1;  Desc = "钴蓝首屏聚焦吉祥物小智与「怎么加入」主按钮，六大内容板块用清爽列表排开，一眼扫完。" }
    "v10-terrain"  = @{ Title = "损失曲面地形";       Tag = "三维曲面";     Group = "main";    Order = 10; Desc = "以模型训练的损失曲面三维地形作首屏背景，下滑时镜头俯冲入谷，五类活动卡片横向展开。" }
    "v11-kinetic"  = @{ Title = "弹性飞字与小智挂件"; Tag = "动态排版";     Group = "main";    Order = 11; Desc = "大标题逐字弹性拼合入场，配报道瀑布流、五年刻度盘和右下角可拖着甩的互动小智挂件。" }
    "v12-contour"  = @{ Title = "等高线薄膜";         Tag = "按压波纹";     Group = "main";    Order = 12; Desc = "浅灰胶片颗粒配彩虹薄膜等高线曲面，按住拖动会压出回弹波纹，滚屏俯冲转入深色分区。" }
    "v13-ink"      = @{ Title = "宣纸水墨";           Tag = "行笔晕染";     Group = "main";    Order = 13; Desc = "米白宣纸纹理配毛笔飞白、浓淡晕染与朱砂印章，每次下滑如行笔落墨，章节在留白处展开。" }
    "v14-toybox"   = @{ Title = "物理玩具盒";         Tag = "碰撞胶囊";     Group = "main";    Order = 14; Desc = "首屏掉落五类彩色活动胶囊与小智摆件，支持抓起甩出碰撞，下方配吸顶五年刻度尺与横向大卡。" }
    "v15-object"   = @{ Title = "立体小智摆件";       Tag = "三维摆件";     Group = "main";    Order = 15; Desc = "首屏悬浮手写三维渲染的小智桌面摆件，可拖动旋转并点按换表情，滚屏时停靠侧边陪伴导览。" }
    "v16-scope"    = @{ Title = "通信示波器";         Tag = "调频锁波";     Group = "main";    Order = 16; Desc = "整页化作通信学院本行的精密示波器面板，下滑如同拧旋钮切换频道，波形锁定后呈现各节实绩。" }
    "v17-slice"    = @{ Title = "一刀切开";           Tag = "滑动切物";     Group = "main";    Order = 17; Desc = "每滑一拍就有一道刀光切开抛起的芯片或电路板立体物件，两半飞开后从切口展开社团内容。" }
    "v18-solder"   = @{ Title = "电路板焊接";         Tag = "烙铁走线";     Group = "main";    Order = 18; Desc = "俯视一块精密电路板，下滑驱动电烙铁沿铜线焊亮焊点与元件，呼应社团招牌焊接实践课。" }
    "v19-denoise"  = @{ Title = "扩散去噪";           Tag = "逐步显影";     Group = "main";    Order = 19; Desc = "把下滑变成生成式画图的去噪过程，满屏颗粒噪点随滚屏一步步退去，清晰显影出小智与正文。" }
    "v1-blueprint" = @{ Title = "工程蓝图";           Tag = "早期方案";     Group = "archive"; Order = 101; Desc = "普鲁士蓝工程制图纸配白色尺寸标线，按年份比例排布历年活动时间轴与分类新闻登记表。" }
    "v2-sticker"   = @{ Title = "模切贴纸";           Tag = "早期方案";     Group = "archive"; Order = 102; Desc = "暖白纸面配模切白边硬投影与「元元」形象，突出招新导流卡片、焊接课四步图解与部门选择。" }
    "v3-riso"      = @{ Title = "通通社刊";           Tag = "早期方案";     Group = "archive"; Order = 103; Desc = "双色孔版印刷「通通快报」报纸版式，主打头版头条报道、按年份归档筛选与关键词高亮搜索。" }
    "v4-zhi"       = @{ Title = "小智卡片版";         Tag = "早期方案";     Group = "archive"; Order = 104; Desc = "沿用清晰卡片版式并换上小智天青钴蓝配色，首屏下方设三路按访客目的分流的快捷入口。" }
    "v6-teach"     = @{ Title = "手绘教学实验";       Tag = "早期实验";     Group = "archive"; Order = 106; Desc = "首屏内置画板让访客手绘正负样本、实时训练小智分类器的早期互动实验留档。" }
    "v7-boundary"  = @{ Title = "分界线实验";         Tag = "早期实验";     Group = "archive"; Order = 107; Desc = "首屏实时演示小型神经网络在二维平面动态弯曲划分数据点边界的早期互动实验留档。" }
    "v8-zhi"       = @{ Title = "小智识人实验";       Tag = "早期实验";     Group = "archive"; Order = 108; Desc = "结合近邻分类器互动实验与独立全量资料详情子页的早期探索版本。" }
    "v9-ask"       = @{ Title = "社团问答实验";       Tag = "早期实验";     Group = "archive"; Order = 109; Desc = "首屏支持点选或输入问题检索社团资料，并配独立完整详情子页的早期探索版本。" }
}

function ConvertTo-HtmlEscaped([string]$Text) {
    if ($null -eq $Text) { return "" }
    return $Text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;")
}

function Get-FallbackDesc([string]$HtmlPath) {
    try {
        $raw = [System.IO.File]::ReadAllText($HtmlPath, [System.Text.Encoding]::UTF8)
        if ($raw -match '<meta\s+name=["'']description["'']\s+content=["'']([^"'']+)["'']') {
            return $Matches[1].Trim()
        }
        if ($raw -match '<meta\s+content=["'']([^"'']+)["'']\s+name=["'']description["'']') {
            return $Matches[1].Trim()
        }
    } catch {}
    return "上海大学人工智能社官网候选页面版本，点击卡片查看完整排版与交互效果。"
}

function Save-ResizedPng([string]$SrcPath, [string]$DestPath, [int]$W, [int]$H) {
    $srcImg = [System.Drawing.Image]::FromFile($SrcPath)
    try {
        $bmp = New-Object System.Drawing.Bitmap($W, $H)
        try {
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            try {
                $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $g.DrawImage($srcImg, 0, 0, $W, $H)
            } finally {
                $g.Dispose()
            }
            $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $bmp.Dispose()
        }
    } finally {
        $srcImg.Dispose()
    }
}

# 扫描所有已完成的 v* 版本目录（必须含非空 index.html）
$ReadyVersions = @()
$AllDirs = Get-ChildItem -LiteralPath $WebRoot -Directory | Where-Object { $_.Name -match '^v(\d+)-' }
foreach ($d in $AllDirs) {
    $idxPath = Join-Path $d.FullName "index.html"
    if (-not (Test-Path -LiteralPath $idxPath)) {
        Write-Host "[跳过] $($d.Name)：缺少 index.html，尚未完成"
        continue
    }
    $idxItem = Get-Item -LiteralPath $idxPath
    if ($idxItem.Length -lt 500) {
        Write-Host "[跳过] $($d.Name)：index.html 小于 500 字节，尚未完成"
        continue
    }
    $verNum = [int]([regex]::Match($d.Name, '^v(\d+)-').Groups[1].Value)
    if ($MetaTable.ContainsKey($d.Name)) {
        $m = $MetaTable[$d.Name]
        $title = $m.Title
        $tag   = $m.Tag
        $group = $m.Group
        $order = $m.Order
        $desc  = $m.Desc
    } else {
        $title = $d.Name
        $tag   = "新增版本"
        $group = if ($verNum -ge 10 -or $verNum -eq 5) { "main" } else { "archive" }
        $order = if ($group -eq "main") { $verNum } else { 100 + $verNum }
        $desc  = Get-FallbackDesc $idxPath
    }
    $latestWrite = (Get-ChildItem -LiteralPath $d.FullName -File | Where-Object { $_.Name -notlike '_shot*' -and $_.Name -notlike '_test*' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
    $ReadyVersions += [PSCustomObject]@{
        Dir         = $d.Name
        Title       = $title
        Tag         = $tag
        Group       = $group
        Order       = $order
        Desc        = $desc
        LatestWrite = $latestWrite
    }
}

$ReadyVersions = @($ReadyVersions | Sort-Object Order, Dir)
if ($ReadyVersions.Count -eq 0) {
    throw "未找到任何已完成的版本目录。"
}

# 检测本机 8848 静态服务是否已在跑；若没跑则临时起一个本地 Python 静态服务以保证 WebGL 贴图和字体正常渲染
$BaseUrl = $null
$ServerProc = $null
try {
    $probe = Invoke-WebRequest -Uri "http://localhost:8848/shared/content.js" -Method Head -TimeoutSec 2 -UseBasicParsing
    if ($probe.StatusCode -eq 200) {
        $BaseUrl = "http://localhost:8848"
        Write-Host "[服务] 复用正在运行的 http://localhost:8848"
    }
} catch {}

$TempWork = Join-Path ([System.IO.Path]::GetTempPath()) ("webip-thumbs-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Path $TempWork -Force | Out-Null
$EdgeProfile = Join-Path $TempWork "edge-profile"
New-Item -ItemType Directory -Path $EdgeProfile -Force | Out-Null

try {
    if (-not $BaseUrl) {
        $PyCandidates = @("D:\conda\miniconda3\python.exe", "python.exe")
        $PyExe = $null
        foreach ($cand in $PyCandidates) {
            $cmd = Get-Command $cand -ErrorAction SilentlyContinue
            if ($cmd) { $PyExe = $cmd.Source; break }
        }
        if ($PyExe) {
            $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
            $listener.Start()
            $freePort = ($listener.LocalEndpoint).Port
            $listener.Stop()
            $ServerProc = Start-Process -FilePath $PyExe -ArgumentList @("-m", "http.server", "$freePort", "--bind", "127.0.0.1", "--directory", $WebRoot) -WindowStyle Hidden -PassThru
            for ($i = 0; $i -lt 20; $i++) {
                Start-Sleep -Milliseconds 250
                try {
                    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$freePort/shared/content.js" -Method Head -TimeoutSec 1 -UseBasicParsing
                    if ($r.StatusCode -eq 200) { $BaseUrl = "http://127.0.0.1:$freePort"; break }
                } catch {}
            }
            if ($BaseUrl) {
                Write-Host "[服务] 已启动临时静态服务 $BaseUrl"
            }
        }
    }

    $OnlySet = @{}
    foreach ($item in $Only) {
        foreach ($part in ($item -split ',')) {
            $clean = $part.Trim('/', '\', ' ')
            if ($clean) { $OnlySet[$clean] = $true }
        }
    }

    foreach ($v in $ReadyVersions) {
        $destThumb = Join-Path $ThumbDir "$($v.Dir).png"
        if ($OnlySet.Count -gt 0 -and -not $OnlySet.ContainsKey($v.Dir)) {
            continue
        }
        if ($Incremental -and (Test-Path -LiteralPath $destThumb)) {
            $thumbTime = (Get-Item -LiteralPath $destThumb).LastWriteTime
            if ($thumbTime -ge $v.LatestWrite) {
                Write-Host "[跳过重拍] $($v.Dir)（缩略图已是最新）"
                continue
            }
        }

        $rawShot = Join-Path $TempWork "$($v.Dir)-raw.png"
        if (Test-Path -LiteralPath $rawShot) { Remove-Item -LiteralPath $rawShot -Force }

        $url = if ($BaseUrl) {
            "$BaseUrl/$($v.Dir)/index.html"
        } else {
            ([System.Uri](Join-Path (Join-Path $WebRoot $v.Dir) "index.html")).AbsoluteUri
        }

        Write-Host "[截图] 正在拍摄 $($v.Dir) ($($v.Title)) ..."
        $edgeArgs = @(
            "--headless=new",
            "--disable-gpu-sandbox",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--hide-scrollbars",
            "--window-size=1440,900",
            "--virtual-time-budget=$WaitMs",
            "--user-data-dir=`"$EdgeProfile`"",
            "--screenshot=`"$rawShot`"",
            "`"$url`""
        )
        $proc = Start-Process -FilePath $EdgeExe -ArgumentList ($edgeArgs -join " ") -WindowStyle Hidden -Wait -PassThru
        if (-not (Test-Path -LiteralPath $rawShot) -or (Get-Item -LiteralPath $rawShot).Length -lt 2000) {
            Write-Warning "截图失败或文件过小：$($v.Dir)（退出码 $($proc.ExitCode)）"
            continue
        }

        Save-ResizedPng -SrcPath $rawShot -DestPath $destThumb -W 720 -H 450
        Remove-Item -LiteralPath $rawShot -Force -ErrorAction SilentlyContinue
        $kb = [math]::Round((Get-Item -LiteralPath $destThumb).Length / 1KB, 1)
        Write-Host "  -> 已保存 _thumbs/$($v.Dir).png ($($kb) KB)"
    }
} finally {
    if ($ServerProc -and -not $ServerProc.HasExited) {
        Stop-Process -Id $ServerProc.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $TempWork) {
        Remove-Item -LiteralPath $TempWork -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 只把确实存在缩略图的已完成版本写入入口页
$FinalVersions = @($ReadyVersions | Where-Object { Test-Path -LiteralPath (Join-Path $ThumbDir "$($_.Dir).png") })
$MainList    = @($FinalVersions | Where-Object { $_.Group -eq "main" })
$ArchiveList = @($FinalVersions | Where-Object { $_.Group -ne "main" })

function New-CardHtml($v) {
    $d    = ConvertTo-HtmlEscaped $v.Dir
    $t    = ConvertTo-HtmlEscaped $v.Title
    $tag  = ConvertTo-HtmlEscaped $v.Tag
    $desc = ConvertTo-HtmlEscaped $v.Desc
    $tagClass = if ($v.Dir -eq "v5-zhi") { "badge badge--primary" } elseif ($v.Group -eq "main") { "badge badge--new" } else { "badge" }
    return @"
      <a class="card" href="$d/index.html" data-dir="$d" data-group="$($v.Group)">
        <div class="card__thumb">
          <img src="_thumbs/$d.png" alt="$t（$d）首屏预览" width="720" height="450" loading="lazy">
        </div>
        <div class="card__body">
          <div class="card__head">
            <h3 class="card__title">$t</h3>
            <code class="card__code">$d</code>
            <span class="$tagClass">$tag</span>
            <span class="card__enter" aria-hidden="true">进入 →</span>
          </div>
          <p class="card__desc">$desc</p>
        </div>
      </a>
"@
}

$MainCardsHtml    = ($MainList    | ForEach-Object { New-CardHtml $_ }) -join "`n"
$ArchiveCardsHtml = ($ArchiveList | ForEach-Object { New-CardHtml $_ }) -join "`n"
$TotalCount   = $FinalVersions.Count
$MainCount    = $MainList.Count
$ArchiveCount = $ArchiveList.Count

$HtmlContent = @"
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>上海大学人工智能社 · 官网版本入口</title>
<meta name="description" content="上海大学人工智能社官方网站本地预览与参赛打包入口页，点击卡片直接进入对应版本。">
<link rel="icon" href="shared/img/ip/zhi-flat.webp">
<link rel="stylesheet" href="shared/fonts/fonts.css">
<style>
  :root {
    --bg: #f6f4ee;
    --surface: #ffffff;
    --ink: #161925;
    --ink-2: #444a5e;
    --muted: #6e7488;
    --line: #e2ddd1;
    --blue: #0b61bc;
    --blue-soft: #e8f2fc;
    --amber: #ffd75e;
    --radius: 14px;
    --serif: 'SHU Serif', 'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif;
    --sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "微软雅黑", sans-serif;
    --mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font: 400 15px/1.68 var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  a { color: inherit; }
  img { display: block; max-width: 100%; height: auto; }
  :focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; }

  .wrap { width: min(100% - 40px, 1320px); margin-inline: auto; }

  .mast {
    padding: 40px 0 24px;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(180deg, #fbfaf6 0%, var(--bg) 100%);
  }
  .mast__top {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }
  .mast__logo {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #fff;
    border: 1px solid var(--line);
    padding: 3px;
    flex-shrink: 0;
  }
  .mast__kicker {
    font-size: 13px;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  .mast h1 {
    margin: 0;
    font-family: var(--serif);
    font-weight: 900;
    font-size: clamp(1.85rem, 1.35rem + 1.8vw, 2.75rem);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
  .mast__lead {
    margin: 10px 0 0;
    max-width: 54em;
    color: var(--ink-2);
    font-size: 15px;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-top: 20px;
  }
  .toolbar button {
    font: 500 13.5px/1 var(--sans);
    padding: 9px 16px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-2);
    cursor: pointer;
    transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
  }
  .toolbar button:hover { border-color: var(--ink); color: var(--ink); }
  .toolbar button[aria-pressed="true"] {
    background: var(--ink);
    border-color: var(--ink);
    color: #fff;
  }
  .toolbar__note {
    margin-left: auto;
    font-size: 13px;
    color: var(--muted);
  }

  .sec { padding: 32px 0 20px; }
  .sec--archive { padding-top: 20px; padding-bottom: 56px; border-top: 1px dashed var(--line); margin-top: 16px; }
  .sec__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .sec__title {
    margin: 0;
    font-family: var(--serif);
    font-weight: 900;
    font-size: clamp(1.25rem, 1.1rem + 0.6vw, 1.55rem);
  }
  .sec__sub { margin: 0; font-size: 13.5px; color: var(--muted); }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 22px;
  }
  .card {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    text-decoration: none;
    transition: transform 180ms cubic-bezier(.2,.7,.2,1), box-shadow 180ms cubic-bezier(.2,.7,.2,1), border-color 180ms ease;
  }
  .card:hover {
    transform: translateY(-3px);
    border-color: var(--blue);
    box-shadow: 0 14px 32px rgba(16, 28, 64, 0.09);
  }
  .card__thumb {
    position: relative;
    aspect-ratio: 16 / 10;
    background: #eae6dc;
    border-bottom: 1px solid var(--line);
    overflow: hidden;
  }
  .card__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 260ms cubic-bezier(.2,.7,.2,1);
  }
  .card:hover .card__thumb img { transform: scale(1.02); }
  .card__body { padding: 14px 18px 16px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
  .card__head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .card__title {
    margin: 0;
    font-family: var(--serif);
    font-weight: 900;
    font-size: 1.12rem;
    line-height: 1.3;
  }
  .card__code {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    background: #f3f0e8;
    padding: 2px 7px;
    border-radius: 5px;
  }
  .badge {
    font-size: 11.5px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: #ece8dc;
    color: var(--ink-2);
  }
  .badge--primary { background: var(--blue); color: #fff; }
  .badge--new { background: var(--blue-soft); color: var(--blue); }
  .card__enter {
    margin-left: auto;
    font-size: 13px;
    font-weight: 700;
    color: var(--blue);
    white-space: nowrap;
  }
  .card__desc {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.62;
    color: var(--ink-2);
  }

  .pkg-cta { display: none; margin-top: 18px; gap: 12px; flex-wrap: wrap; align-items: center; }
  .pkg-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 28px;
    border-radius: 999px;
    background: var(--blue);
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(11, 97, 188, 0.25);
  }
  .pkg-btn:hover { background: #084c95; }
  .pkg-hint { font-size: 13.5px; color: var(--muted); }

  .foot {
    padding: 22px 0 36px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 13px;
  }
  .foot__in { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
  .foot__mark { height: 28px; width: auto; opacity: 0.78; }

  /* 单版本参赛压缩包模式（由打包脚本自动切换） */
  body.is-packaged .toolbar,
  body.is-packaged .sec--archive,
  body.is-packaged .sec__head { display: none !important; }
  body.is-packaged .pkg-cta { display: flex; }
  body.is-packaged .sec { padding: 36px 0 56px; }
  body.is-packaged .grid { grid-template-columns: minmax(0, 860px); justify-content: center; }
  body.is-packaged .card__title { font-size: 1.35rem; }
  body.is-packaged .card__desc { font-size: 15px; }

  @media (max-width: 640px) {
    .wrap { width: min(100% - 28px, 1320px); }
    .mast { padding: 26px 0 18px; }
    .grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
    .toolbar__note { flex-basis: 100%; margin-left: 0; margin-top: 4px; }
  }
</style>
</head>
<body>
  <header class="mast">
    <div class="wrap">
      <div class="mast__top">
        <img class="mast__logo" src="shared/img/ip/zhi-flat.webp" alt="社团吉祥物小智" width="44" height="44">
        <span class="mast__kicker">上海大学 · 通信与信息工程学院团委指导 · 2021 年成立</span>
      </div>
      <h1>上海大学人工智能社 · 官网入口</h1>
      <!-- __LEAD_START__ -->
      <p class="mast__lead">本页用于本地离线双击浏览与参赛打包导航（线上服务器根路径默认跳转至 <code>/v5-zhi/</code>）。下方收录当前已完成的全部版本首屏预览与一句话特点，点击任意卡片即可直接进入对应网页；全站共用同一份数据文件 <code>shared/content.js</code>。</p>
      <!-- __LEAD_END__ -->
      <!-- __PKG_CTA_START__ -->
      <!-- __PKG_CTA_END__ -->
      <div class="toolbar" role="group" aria-label="筛选版本范围">
        <button type="button" data-filter="all" aria-pressed="true">全部版本（$TotalCount）</button>
        <button type="button" data-filter="main" aria-pressed="false">主力与交互新版（$MainCount）</button>
        <button type="button" data-filter="archive" aria-pressed="false">早期方案与实验留档（$ArchiveCount）</button>
        <span class="toolbar__note">本地无需安装环境，点击卡片直接打开对应目录下的 <code>index.html</code></span>
      </div>
    </div>
  </header>

  <main class="wrap">
    <section class="sec" id="sec-main" aria-labelledby="h-main">
      <div class="sec__head">
        <h2 class="sec__title" id="h-main">主力与交互新版（v5-zhi、v10–v19）</h2>
        <p class="sec__sub">统一采用本地分片思源宋体（SHU Serif）与真实学院报道数据，适配电脑宽屏与手机窄屏</p>
      </div>
      <div class="grid">
<!-- __MAIN_CARDS_START__ -->
$MainCardsHtml
<!-- __MAIN_CARDS_END__ -->
      </div>
    </section>

    <section class="sec sec--archive" id="sec-archive" aria-labelledby="h-archive">
      <div class="sec__head">
        <h2 class="sec__title" id="h-archive">早期版式与互动实验留档（v1–v4、v6–v9）</h2>
        <p class="sec__sub">记录从早期三套主题版式到互动实验的完整演进过程</p>
      </div>
      <div class="grid">
<!-- __ARCHIVE_CARDS_START__ -->
$ArchiveCardsHtml
<!-- __ARCHIVE_CARDS_END__ -->
      </div>
    </section>
  </main>

  <footer class="foot">
    <div class="wrap foot__in">
      <span>上海大学人工智能社 · 日常更新只需修改 <code>shared/content.js</code></span>
      <img class="foot__mark" src="shared/img/brand/scie-wordmark.png" alt="上海大学通信与信息工程学院" width="176" height="37" loading="lazy">
    </div>
  </footer>

  <script>
    (function () {
      var btns = document.querySelectorAll('.toolbar button[data-filter]');
      var secMain = document.getElementById('sec-main');
      var secArch = document.getElementById('sec-archive');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mode = btn.getAttribute('data-filter');
          btns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
          if (secMain) secMain.hidden = (mode === 'archive');
          if (secArch) secArch.hidden = (mode === 'main');
        });
      });
    })();
  </script>
</body>
</html>
"@

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($IndexFile, $HtmlContent, $Utf8NoBom)
Write-Host "[完成] 已更新入口页 $IndexFile（共收录 $TotalCount 个版本：主力新版 $MainCount 个，早期留档 $ArchiveCount 个）"
