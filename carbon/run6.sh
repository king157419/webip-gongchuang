#!/bin/bash
AGY="/c/Users/king/AppData/Local/agy/bin/agy.exe"
run(){ ( cd "$2" && "$AGY" --model gemini-4-carbon-high --dangerously-skip-permissions -p "请完整执行任务文件 D:/desk/webip/carbon/$1 （先用读文件工具读它）。注意：上一次执行到一半电脑突然重启，任务被打断，目标目录里可能已有一部分成果——先检查现有文件接着做完，不要从头重来，也不要删已有成果。同时遵守 D:/desk/webip/carbon/rules-code.md 里的安全规则（不删文件、不提交、不发送、不抄密钥和身份证号等个人敏感信息）。$3 绝对不要碰 D:/desk/webip/web 目录。为了不让电脑过热，不要同时开多个浏览器或编译进程。做完用中文 150 字内回报。" > "D:/desk/webip/carbon/out/log3-$1.txt" 2>&1 ); }
# 两路并行，避免机器过载
( run t-ip.md "D:/desk/webip" ""; run t-cnexam.md "D:/desk/CN" "缺的是模拟卷B-解析.md 和 PDF。" ) &
( run t-jkb.md "D:/desk/claudex/12" "改动前的完整备份在 D:/desk/_carbon_backup_1117/jiankebiao/，可以对比看已经改了哪些。"; run t-intern.md "D:/desk/mindspore实习" "" ) &
wait
