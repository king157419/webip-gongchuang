#!/usr/bin/env node
/*
 * content.js <-> content.json 互转（只用 Node 自带模块）。
 *
 *   node server/scripts/content-convert.js js2json web/shared/content.js content.json
 *       把现有的 content.js（JS 对象字面量，带注释）在沙箱里执行，取出 window.CLUB 写成 JSON。
 *       用于首次部署：生成 content.json，再上传到服务器用 club_admin.cli import 导入。
 *
 *   node server/scripts/content-convert.js json2js content.json web/shared/content.js
 *       把服务器上的 content.json 写回 content.js，方便本地预览（pull-content.sh 会调用）。
 */
"use strict";
const fs = require("fs");
const vm = require("vm");

function loadContentJs(file) {
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file, timeout: 2000 });
  if (!sandbox.window.CLUB || typeof sandbox.window.CLUB !== "object") {
    throw new Error(file + " 里没有找到 window.CLUB");
  }
  // 经过一次 JSON 往返，去掉沙箱对象的原型差异
  return JSON.parse(JSON.stringify(sandbox.window.CLUB));
}

function renderJs(data) {
  return "/* 由 server/scripts/content-convert.js 从服务器 content.json 生成。\n" +
    " * 线上内容以后台 /admin/ 为准；这里改了不会同步到服务器。 */\n" +
    "window.CLUB = " + JSON.stringify(data, null, 1) + ";\n";
}

function main() {
  const [mode, src, dst] = process.argv.slice(2);
  if (!mode || !src) {
    console.error("用法: node content-convert.js js2json <content.js> [out.json]\n" +
                  "      node content-convert.js json2js <content.json> [out.js]");
    process.exit(2);
  }
  let out;
  if (mode === "js2json") {
    out = JSON.stringify(loadContentJs(src), null, 2) + "\n";
  } else if (mode === "json2js") {
    out = renderJs(JSON.parse(fs.readFileSync(src, "utf8")));
  } else {
    console.error("未知模式: " + mode);
    process.exit(2);
  }
  if (dst) {
    fs.writeFileSync(dst, out, "utf8");
    console.error("已写入 " + dst);
  } else {
    process.stdout.write(out);
  }
}

if (require.main === module) main();
module.exports = { loadContentJs, renderJs };
