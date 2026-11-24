#!/bin/bash
AGY="/c/Users/king/AppData/Local/agy/bin/agy.exe"
run(){ ( cd "$2" && "$AGY" --model gemini-4-carbon-high --dangerously-skip-permissions -p "请完整执行任务文件 D:/desk/webip/carbon/$1 （先用读文件工具读它）。同时遵守 D:/desk/webip/carbon/rules-code.md 里的安全规则（不删文件、不提交、不发送、不抄密钥和身份证号等个人敏感信息）。绝对不要碰 D:/desk/webip/web 目录。做完用中文 150 字内回报。" > "D:/desk/webip/carbon/out/log2-$1.txt" 2>&1 ); }
run t-cnexam.md "D:/desk/CN" &
run t-rlcheck.md "D:/desk/rl设计" &
run t-intern.md "D:/desk/mindspore实习" &
wait
