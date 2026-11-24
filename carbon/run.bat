@echo off
chcp 65001 >nul
rem 在 Antigravity 自带的终端里运行：一次开 4 个 Gemini 4 Carbon 对话，各做一版网页
set L="C:\Users\king\AppData\Local\Programs\Antigravity\resources\bin\language_server.exe"
for %%n in (12 13 14 15) do (
  %L% agentapi new-conversation --model=gemini-4-carbon --title="社团官网 v%%n" "请完整阅读 D:\desk\webip\carbon\brief-v%%n.md，严格照里面的要求做完这一版网页，做完按文中“交付”一节回报。"
)
echo.
echo 已经发出 4 个对话，去 Antigravity 左侧的对话列表里看进度。
pause
