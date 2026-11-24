#!/bin/bash
AGY="/c/Users/king/AppData/Local/agy/bin/agy.exe"
run(){ ( cd "$2" && "$AGY" --model gemini-4-carbon-high --dangerously-skip-permissions -p "请完整执行任务文件 D:/desk/webip/carbon/$1 （先用读文件工具读它）。同时遵守 D:/desk/webip/carbon/rules-code.md 里的安全规则（不删文件、不提交、不发送、不抄密钥）。另外：同时有别的任务在改 D:/desk/webip/web/ 下的版本目录，绝对不要碰 web 目录。做完用中文 150 字内回报。" > "D:/desk/webip/carbon/out/log2-$1.txt" 2>&1 ); }
run t-ip.md "D:/desk/webip" &



wait
