# 第三批 6 个版本：独立进程启动 Carbon，会话断了也继续跑。输出各写到 carbon/out/log-vNN.txt
$agy = "C:\Users\king\AppData\Local\agy\bin\agy.exe"
$jobs = @(
  @{n='v20'; d='v20-desk'}, @{n='v21'; d='v21-sphere'}, @{n='v22'; d='v22-ticket'},
  @{n='v23'; d='v23-rings'}, @{n='v24'; d='v24-fold'}, @{n='v25'; d='v25-assemble'}
)
$pids = @()
foreach ($j in $jobs) {
  $n = $j.n; $d = $j.d
  $prompt = "请完整阅读 D:/desk/webip/carbon/brief-$n.md，严格照里面的要求做完 $d 这一版网页（目录 D:/desk/webip/web/$d/）。注意：这个目录里已经有你上一轮做到一半的文件（上一轮被意外中断），先读懂现有代码，在它基础上接着做完、补齐缺的文件，不要从头重写。自检截图看完要删掉，做完按文中「交付」一节回报。"
  $p = Start-Process -FilePath $agy -ArgumentList @('--model','gemini-4-carbon-high','--dangerously-skip-permissions','-p',"`"$prompt`"") `
        -WorkingDirectory "D:\desk\webip\web" -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput "D:\desk\webip\carbon\out\log-$n.txt" -RedirectStandardError "D:\desk\webip\carbon\out\err-$n.txt"
  $pids += $p.Id
}
$pids -join ',' | Set-Content -Encoding utf8 "D:\desk\webip\carbon\out\pids-b3.txt"
"started: " + ($pids -join ',')
