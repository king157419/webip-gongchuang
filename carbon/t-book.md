# 任务：教材网页计算器横竖屏
项目目录 `D:\desk\llm\book\`。先读 `HANDOFF.md`。问题：交互计算器的宽窄布局只在加载时判断，手机横竖屏切换后要刷新；拖动效果没人肉眼看过。
在计算器公共代码里加尺寸变化后的防抖重排（保留当前滑块数值）；跑 `tools\widgets\test.mjs` 等现有自检全过；用无头 Edge（`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new`）对 24 个计算器在窄屏和宽屏各截图（能模拟拖到前中后三个位置更好），拼成一张验收总览图放 `D:\desk\llm\book\_carbon验收\`。只改本机，不发布网站。
