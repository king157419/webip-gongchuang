param(
    [Parameter(Mandatory = $true, Position = 0, HelpMessage = "要打包的官网版本目录名，如 v5-zhi 或 v16-scope")]
    [Alias("版本", "版本目录名", "Ver")]
    [string]$Version,

    [Parameter(Mandatory = $true, Position = 1, HelpMessage = "队长姓名（个人参赛填本人姓名）")]
    [Alias("姓名", "队长姓名", "Name")]
    [string]$LeaderName,

    [Parameter(Mandatory = $true, Position = 2, HelpMessage = "队长学号（个人参赛填本人学号）")]
    [Alias("学号", "队长学号", "Id")]
    [string]$StudentId,

    [Parameter(Mandatory = $false, HelpMessage = "压缩包输出目录，默认放在 deliverables 目录下")]
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = $PSScriptRoot
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$Version    = $Version.Trim('/', '\', ' ')
$LeaderName = $LeaderName.Trim()
$StudentId  = $StudentId.Trim()

if ([string]::IsNullOrWhiteSpace($Version) -or [string]::IsNullOrWhiteSpace($LeaderName) -or [string]::IsNullOrWhiteSpace($StudentId)) {
    throw "版本目录名、队长姓名、学号均不能为空。"
}

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$WebRoot    = Join-Path $RepoRoot "web"
$VerSrcDir  = Join-Path $WebRoot $Version
$SharedSrc  = Join-Path $WebRoot "shared"
$IndexSrc   = Join-Path $WebRoot "index.html"
$ThumbSrc   = Join-Path (Join-Path $WebRoot "_thumbs") "$Version.png"
$DocSrc     = Join-Path $PSScriptRoot "Web赛道-作品说明.md"
$ThumbScript = Join-Path $PSScriptRoot "重拍缩略图.ps1"

if (-not (Test-Path -LiteralPath (Join-Path $VerSrcDir "index.html"))) {
    $avail = (Get-ChildItem -LiteralPath $WebRoot -Directory | Where-Object { $_.Name -match '^v\d+-' -and (Test-Path -LiteralPath (Join-Path $_.FullName "index.html")) } | Sort-Object { [int]($_.Name -replace '^v(\d+).*','$1') } | ForEach-Object { $_.Name }) -join ", "
    throw "找不到版本目录或缺少 index.html：$VerSrcDir`n可选版本：$avail"
}
if (-not (Test-Path -LiteralPath (Join-Path $SharedSrc "content.js"))) {
    throw "找不到公共资源目录：$SharedSrc"
}
if (-not (Test-Path -LiteralPath $DocSrc)) {
    throw "找不到作品说明文档：$DocSrc"
}

# 如果入口页或该版本的缩略图还没生成，自动调用重拍缩略图脚本补齐
if ((-not (Test-Path -LiteralPath $IndexSrc)) -or (-not (Test-Path -LiteralPath $ThumbSrc))) {
    if (Test-Path -LiteralPath $ThumbScript) {
        Write-Host "[准备] 未找到 $Version 缩略图或入口页，正在自动生成..."
        & $ThumbScript -Only $Version
    } else {
        throw "缺少入口页 $IndexSrc 或缩略图 $ThumbSrc"
    }
}

if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$ZipFileName = "赛道【Web】+$LeaderName+$StudentId.zip"
$ZipPath     = Join-Path $OutDir $ZipFileName

function Copy-CleanTree([string]$SourceDir, [string]$DestDir, [string[]]$ExcludePatterns) {
    if (-not (Test-Path -LiteralPath $DestDir)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }
    foreach ($item in Get-ChildItem -LiteralPath $SourceDir -Force) {
        $skip = $false
        foreach ($pat in $ExcludePatterns) {
            if ($item.Name -like $pat) { $skip = $true; break }
        }
        if ($skip) { continue }

        $target = Join-Path $DestDir $item.Name
        if ($item.PSIsContainer) {
            Copy-CleanTree -SourceDir $item.FullName -DestDir $target -ExcludePatterns $ExcludePatterns
            # 不保留空文件夹
            if ((Get-ChildItem -LiteralPath $target -Force | Measure-Object).Count -eq 0) {
                Remove-Item -LiteralPath $target -Force
            }
        } else {
            Copy-Item -LiteralPath $item.FullName -Destination $target -Force
        }
    }
}

function ConvertTo-HtmlEscaped([string]$Text) {
    if ($null -eq $Text) { return "" }
    return $Text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;")
}

$StageDir = Join-Path ([System.IO.Path]::GetTempPath()) ("webip-pkg-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

try {
    Write-Host "[1/4] 正在复制参评版本目录 $Version（自动过滤截图缓存与测试文件）..."
    $VerExclude = @("_shot*", "_test*", "*.test.js", "*-test.js", "*.log", ".omx*", ".env*", "__pycache__", ".DS_Store", "Thumbs.db")
    Copy-CleanTree -SourceDir $VerSrcDir -DestDir (Join-Path $StageDir $Version) -ExcludePatterns $VerExclude

    # 检查所选版本是否跨目录引用了 ../v11-kinetic/zhi-toy.webp，若有则一并带上该透明贴图避免断图
    if ($Version -ne "v11-kinetic") {
        $needToy = $false
        foreach ($f in Get-ChildItem -LiteralPath (Join-Path $StageDir $Version) -Recurse -File) {
            if ($f.Extension -in @(".html", ".js", ".css")) {
                $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
                if ($content -match 'v11-kinetic/zhi-toy\.webp') {
                    $needToy = $true
                    break
                }
            }
        }
        if ($needToy) {
            $toySrc = Join-Path (Join-Path $WebRoot "v11-kinetic") "zhi-toy.webp"
            if (Test-Path -LiteralPath $toySrc) {
                $toyDstDir = Join-Path $StageDir "v11-kinetic"
                New-Item -ItemType Directory -Path $toyDstDir -Force | Out-Null
                Copy-Item -LiteralPath $toySrc -Destination (Join-Path $toyDstDir "zhi-toy.webp") -Force
                Write-Host "  -> 检测到引用 ../v11-kinetic/zhi-toy.webp，已自动随包附带该素材"
            }
        }
    }

    Write-Host "[2/4] 正在复制公共资源目录 shared/（排除切字构建脚本与临时目录）..."
    $SharedExclude = @("build_fonts.py", "_inst*", "__pycache__", "*.pyc", "uploads", ".omx*", ".env*", ".DS_Store", "Thumbs.db")
    Copy-CleanTree -SourceDir $SharedSrc -DestDir (Join-Path $StageDir "shared") -ExcludePatterns $SharedExclude

    Write-Host "[3/4] 正在生成打包版入口页 index.html 与作品说明文档..."
    $StageThumbDir = Join-Path $StageDir "_thumbs"
    New-Item -ItemType Directory -Path $StageThumbDir -Force | Out-Null
    Copy-Item -LiteralPath $ThumbSrc -Destination (Join-Path $StageThumbDir "$Version.png") -Force

    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $rawIndex = [System.IO.File]::ReadAllText($IndexSrc, [System.Text.Encoding]::UTF8)

    # 提取当前所选版本的单张卡片，切换为单版本提交展示态，确保包内无任何断链或缺失缩略图
    $escapedVer = [regex]::Escape($Version)
    $cardPattern = "(?s)<a\s+class=""card""[^>]*data-dir=""$escapedVer"".*?</a>"
    $cardMatch = [regex]::Match($rawIndex, $cardPattern)
    if ($cardMatch.Success) {
        $singleCard = $cardMatch.Value
        $singleCard = [regex]::Replace($singleCard, '<span class="badge[^"]*">.*?</span>', '<span class="badge badge--primary">正式提交参评版</span>')
    } else {
        $ev = ConvertTo-HtmlEscaped $Version
        $singleCard = @"
      <a class="card" href="$ev/index.html" data-dir="$ev" data-group="main">
        <div class="card__thumb"><img src="_thumbs/$ev.png" alt="$ev 首屏预览" width="720" height="450"></div>
        <div class="card__body">
          <div class="card__head">
            <h3 class="card__title">上海大学人工智能社官网</h3>
            <code class="card__code">$ev</code>
            <span class="badge badge--primary">正式提交参评版</span>
            <span class="card__enter" aria-hidden="true">进入 →</span>
          </div>
          <p class="card__desc">点击卡片直接进入本次正式参评的社团官方网站页面。</p>
        </div>
      </a>
"@
    }

    $evHtml = ConvertTo-HtmlEscaped $Version
    $pkgLead = @"
<!-- __LEAD_START__ -->
      <p class="mast__lead">欢迎审阅上海大学人工智能社「共创计划」Web官网赛道参赛作品。本次正式提交参评版本为 <code>$evHtml</code>，无需安装任何软件或配置环境，点击下方按钮或预览卡片即可直接浏览完整网站（已适配电脑宽屏与 375px 手机窄屏）；详细栏目对照、AI 协作过程与素材声明见同目录 <code>Web赛道-作品说明.md</code>。</p>
      <!-- __LEAD_END__ -->
"@
    $pkgCta = @"
<!-- __PKG_CTA_START__ -->
      <div class="pkg-cta">
        <a class="pkg-btn" href="$evHtml/index.html">点击进入社团官网（$evHtml） →</a>
        <span class="pkg-hint">请先将压缩包完整解压到文件夹后再双击打开，确保本地字体与数据正常加载</span>
      </div>
      <!-- __PKG_CTA_END__ -->
"@

    $pkgIndex = $rawIndex -replace '<body>', '<body class="is-packaged">'
    $pkgIndex = [regex]::Replace($pkgIndex, '(?s)<!-- __LEAD_START__ -->.*?<!-- __LEAD_END__ -->', $pkgLead)
    $pkgIndex = [regex]::Replace($pkgIndex, '(?s)<!-- __PKG_CTA_START__ -->.*?<!-- __PKG_CTA_END__ -->', $pkgCta)
    $pkgIndex = [regex]::Replace($pkgIndex, '(?s)<!-- __MAIN_CARDS_START__ -->.*?<!-- __MAIN_CARDS_END__ -->', "<!-- __MAIN_CARDS_START__ -->`n$singleCard`n<!-- __MAIN_CARDS_END__ -->")
    $pkgIndex = [regex]::Replace($pkgIndex, '(?s)<!-- __ARCHIVE_CARDS_START__ -->.*?<!-- __ARCHIVE_CARDS_END__ -->', "<!-- __ARCHIVE_CARDS_START__ -->`n<!-- __ARCHIVE_CARDS_END__ -->")
    [System.IO.File]::WriteAllText((Join-Path $StageDir "index.html"), $pkgIndex, $Utf8NoBom)

    # 复制作品说明，并在打包副本中自动填入所选版本号与队长姓名学号（不改动 deliverables 下的原稿）
    $rawDoc = [System.IO.File]::ReadAllText($DocSrc, [System.Text.Encoding]::UTF8)
    $pkgDoc = $rawDoc.Replace("队长姓名【待确认】 · 学号【待确认】", "队长姓名：$LeaderName · 学号：$StudentId")
    $pkgDoc = $pkgDoc.Replace("【待定：v?】", $Version)
    [System.IO.File]::WriteAllText((Join-Path $StageDir "Web赛道-作品说明.md"), $pkgDoc, $Utf8NoBom)

    Write-Host "[4/4] 正在生成压缩包：$ZipPath ..."
    if (Test-Path -LiteralPath $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }

    # 使用正斜杠路径写入标准 ZIP，兼容 Windows / macOS / Linux 解压工具
    $zipStream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::Create)
    try {
        $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false, [System.Text.Encoding]::UTF8)
        try {
            $allStageFiles = Get-ChildItem -LiteralPath $StageDir -Recurse -File
            foreach ($file in $allStageFiles) {
                $relPath = $file.FullName.Substring($StageDir.Length).TrimStart('\', '/').Replace('\', '/')
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        } finally {
            $archive.Dispose()
        }
    } finally {
        $zipStream.Dispose()
    }

    $zipSizeMB = [math]::Round((Get-Item -LiteralPath $ZipPath).Length / 1MB, 2)
    Write-Host "[完成] 参赛压缩包已生成（只打包未发送）：$ZipPath （$zipSizeMB MB）"
} finally {
    if (Test-Path -LiteralPath $StageDir) {
        Remove-Item -LiteralPath $StageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
