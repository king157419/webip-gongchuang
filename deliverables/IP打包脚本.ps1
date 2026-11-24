<#
  社团IP赛道打包脚本（固定打包方案「小智」）
  用法（在 PowerShell 里）：
      .\IP打包脚本.ps1 -队长姓名 张三 -学号 20240001
  或者按位置：
      .\IP打包脚本.ps1 张三 20240001
  生成：deliverables\赛道【IP】+队长姓名+队长学号.zip（例：赛道【IP】+张三+12345678.zip；只打包，不发送）

  包里放：
    IP赛道-作品说明.md     （自动填入队长姓名、学号；deliverables 下的原稿不动）
    IP提案_小智*.pdf       （优先 IP提案_小智_v2.pdf；没有就找文件名带 v2 / -含来源 的最新一份；再没有才用原版）
    高清原图\              （定稿图，不含被否掉的过程稿）
    扁平版\flat.png
    3D模型\                （默认第 5 轮定稿 zhi_C.stl + 预览图；要换回 zhi_v2，改下面 $模型）
#>
param(
    [Parameter(Mandatory = $true, Position = 0, HelpMessage = "队长姓名（个人参赛填本人姓名）")]
    [Alias("姓名", "队长姓名", "Name")]
    [string]$LeaderName,

    [Parameter(Mandatory = $true, Position = 1, HelpMessage = "队长学号（个人参赛填本人学号）")]
    [Alias("学号", "队长学号", "Id")]
    [string]$StudentId,

    [Parameter(Mandatory = $false, HelpMessage = "压缩包输出目录，默认放在 deliverables 目录下")]
    [string]$OutDir = ""
)

# ===== 可改的设置 =====
# 提案册 v2 的定稿造型是第 5 轮「小鸭尾」，对应 zhi_C；要换回早期的 zhi_v2 就改这里
$模型 = "zhi_C"
# ======================

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$LeaderName = $LeaderName.Trim()
$StudentId  = $StudentId.Trim()
if ([string]::IsNullOrWhiteSpace($LeaderName) -or [string]::IsNullOrWhiteSpace($StudentId)) {
    throw "队长姓名和学号都不能为空。"
}
# 文件名里不能出现的字符
$bad = [System.IO.Path]::GetInvalidFileNameChars()
if ($LeaderName.IndexOfAny($bad) -ge 0 -or $StudentId.IndexOfAny($bad) -ge 0) {
    throw "姓名或学号里有不能用在文件名里的字符（如 \ / : * ? `" < > |）。"
}
if ([string]::IsNullOrWhiteSpace($OutDir)) { $OutDir = $PSScriptRoot }

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ZhiDir   = Join-Path $RepoRoot "ip\A_zhi"
$ModelDir = Join-Path $RepoRoot "ip\3d"
$DocSrc   = Join-Path $PSScriptRoot "IP赛道-作品说明.md"

# ---- 1. 选提案 PDF ----
$PdfSrc = $null
$preferred = Join-Path $PSScriptRoot "IP提案_小智_v2.pdf"
if (Test-Path -LiteralPath $preferred) {
    $PdfSrc = Get-Item -LiteralPath $preferred
} else {
    $cands = Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter "*.pdf" |
        Where-Object { $_.Name -like "IP提案_小智*" -and ($_.Name -match "v2" -or $_.Name -like "*-含来源*") } |
        Sort-Object LastWriteTime -Descending
    if ($cands) { $PdfSrc = $cands[0] }
}
$usingOldPdf = $false
if (-not $PdfSrc) {
    $orig = Join-Path $PSScriptRoot "IP提案_小智.pdf"
    if (-not (Test-Path -LiteralPath $orig)) { throw "找不到任何小智提案 PDF：$orig" }
    $PdfSrc = Get-Item -LiteralPath $orig
    $usingOldPdf = $true
}

# ---- 2. 文件清单（包内路径 => 源文件） ----
$images = @(
    "main.png", "turnaround.png", "expressions.png",
    "scene_poster_v2.png", "scene_merch.png", "merch_keychain.png",
    "desk_bot.png", "family.png",
    "lenti_1.png", "lenti_2.png", "lenti_3.png", "lenti_4.png"
)
if ($模型 -eq "zhi_C") {
    # 第 5 轮造型对应的正交三视图，换掉第 1 轮的旧三视图
    $images = @($images | Where-Object { $_ -ne "turnaround.png" }) + @("C_front.png", "C_left.png", "C_back.png")
}

$plan = [ordered]@{}
$plan["IP赛道-作品说明.md"] = $DocSrc
$DocPdf = Join-Path $PSScriptRoot "IP赛道-作品说明.pdf"
if (Test-Path -LiteralPath $DocPdf) { $plan["IP赛道-作品说明.pdf"] = $DocPdf }
$plan[$PdfSrc.Name] = $PdfSrc.FullName
foreach ($img in $images) { $plan["高清原图/$img"] = Join-Path $ZhiDir $img }
$plan["扁平版/flat.png"] = Join-Path $ZhiDir "flat.png"
$plan["3D模型/$模型.stl"] = Join-Path $ModelDir "$模型.stl"
$plan["3D模型/${模型}_preview.png"] = Join-Path $ModelDir "${模型}_preview.png"

$missing = @($plan.Values | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -gt 0) { throw "缺少文件：`n  " + ($missing -join "`n  ") }

if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
# 比赛推文原文：社团 IP 赛道 赛道【IP】+队长姓名+队长学号.zip，例：赛道【Web】+张三+12345678.zip（加号是真的要写）
$ZipName = "赛道【IP】+$LeaderName+$StudentId.zip"
$ZipPath = Join-Path $OutDir $ZipName
if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

Write-Host "[1/3] 提案册：$($PdfSrc.Name)"
if ($usingOldPdf) {
    Write-Host "      注意：没找到新版 IP提案_小智_v2.pdf，用的是 11-08 的原版（第 3、7 页还是被否掉的 zhi_v3 造型）。" -ForegroundColor Yellow
}
Write-Host "      3D 模型：$模型.stl"

# ---- 3. 作品说明填入姓名学号（只改包里那份） ----
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$docText = [System.IO.File]::ReadAllText($DocSrc, [System.Text.Encoding]::UTF8)
$docText = $docText.Replace("队长姓名【待确认】 · 学号【待确认】", "队长姓名：$LeaderName · 学号：$StudentId")
$docBytes = $Utf8NoBom.GetBytes($docText)

# ---- 4. 写 ZIP（文件名用 UTF-8 并打上 UTF-8 标记，Windows 资源管理器 / 7-Zip / macOS 都不会乱码） ----
Write-Host "[2/3] 正在生成压缩包..."
$fs = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::Create)
try {
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false, [System.Text.Encoding]::UTF8)
    try {
        foreach ($entryName in $plan.Keys) {
            if ($entryName -eq "IP赛道-作品说明.md") {
                $e = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
                $s = $e.Open()
                try { $s.Write($docBytes, 0, $docBytes.Length) } finally { $s.Dispose() }
            } else {
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $plan[$entryName], $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        }
    } finally { $zip.Dispose() }
} finally { $fs.Dispose() }

# ---- 5. 自检：重新打开数一遍 ----
$check = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try { $n = $check.Entries.Count } finally { $check.Dispose() }
if ($n -ne $plan.Count) { throw "自检失败：应有 $($plan.Count) 个文件，压缩包里只有 $n 个。" }

$sizeMB = [math]::Round((Get-Item -LiteralPath $ZipPath).Length / 1MB, 1)
Write-Host "[3/3] 完成（只打包，没有发送）：$ZipPath"
Write-Host "      共 $n 个文件，$sizeMB MB"
if ($sizeMB -gt 45) {
    Write-Host "      提醒：压缩包超过 45 MB，邮箱可能会转成「超大附件」（有有效期的下载链接），发之前留意。" -ForegroundColor Yellow
}
