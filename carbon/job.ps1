# 单个 Carbon 任务。用 Win32_Process 启动，脱离 Claude 会话，会话断了也继续跑。
param([string]$n, [string]$brief, [string]$dir)
$agy = "C:\Users\king\AppData\Local\agy\bin\agy.exe"
$prompt = "请完整阅读 D:/desk/webip/carbon/$brief，严格照里面的要求做完（目录 D:/desk/webip/web/$dir/）。注意：这个目录里已经有前几轮做到一半的文件（被意外中断），先读懂现有代码，在它基础上接着做完、补齐缺的文件，不要从头重写。自检截图看完要删掉，做完按要求回报。"
Set-Location "D:\desk\webip\web"
for ($try = 1; $try -le 3; $try++) {
  & $agy --model gemini-4-carbon-high --dangerously-skip-permissions -p $prompt > "D:\desk\webip\carbon\out\log-$n.txt" 2> "D:\desk\webip\carbon\out\err-$n.txt"
  if ((Get-Item "D:\desk\webip\carbon\out\log-$n.txt").Length -gt 300) { break }
  Start-Sleep 20
}
"done $(Get-Date -Format 'HH:mm')" | Set-Content "D:\desk\webip\carbon\out\done-$n.txt"
