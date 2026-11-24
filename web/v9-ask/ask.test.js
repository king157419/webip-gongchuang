// 运行：node web/v9-ask/ask.test.js    用真实的 shared/content.js 测小智的检索结果
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const Z = require('./ask-engine.js');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../shared/content.js'), 'utf8'), sandbox);
const docs = Z.buildDocs(sandbox.window.CLUB);
const idx = new Z.Index(docs);

function top(q) { return idx.query(q); }
function show(q) {
  const r = top(q);
  const d = r.ok ? docs[r.best] : null;
  console.log((r.ok ? 'OK ' : '-- ') + q.padEnd(16, '　') + ' → ' + (d ? d.mark + ' ' + d.short.slice(0, 22) : '没找到') +
    '  ' + r.ranked.map(x => docs[x.i].mark + x.s.toFixed(2)).join(' ') + (r.expanded.length ? '  +[' + r.expanded.join(',') + ']' : ''));
  return { r, d };
}

let fail = 0;
function expect(q, pred, why) {
  const { r, d } = show(q);
  try { assert.ok(pred(d, r), why); } catch (e) { fail++; console.log('   ✗ ' + why); }
}

console.log('资料数：' + docs.length);
expect('不会编程能来吗？', d => d && d.kind === 'faq' && /编程/.test(d.title), '零基础问题应命中 FAQ');
expect('活动在哪', d => d && (d.kind === 'place' || /在哪/.test(d.title)), '地点');
expect('最近办了什么？', d => d && d.kind === 'recent', '最近活动');
expect('怎么加入？', d => d && (d.kind === 'join' || d.kind === 'faq'), '加入');
expect('谁教焊接', d => d && (d.cat === 'weld' || d.kind === 'person'), '焊接相关');
expect('能学大模型吗', d => d && d.cat === 'course', '大模型课程');
expect('BERT', d => d && d.cat === 'course', 'BERT 课程');
expect('社长是谁', d => d && d.kind === 'person' && /社长/.test(d.title), '社长');
expect('有比赛吗', d => d && d.cat === 'contest', '比赛');
expect('不是通信学院的能加入吗', d => d && d.kind === 'faq' && /通信学院/.test(d.title), '外院 FAQ');
expect('去过华为吗', d => d && (d.cat === 'visit' || d.cat === 'course'), '华为');
expect('有哪些部门', d => d && d.kind === 'dept', '部门');
expect('指导老师是谁', d => d && /老师/.test(d.title), '老师');
expect('焊', d => d && d.cat === 'weld', '单字焊');
expect('论文怎么写', d => d && d.cat === 'talk', '论文分享');
expect('下一次活动什么时候', d => d && d.kind === 'recent', '下次活动');
expect('今天食堂吃什么', d => !d, '无关问题应该说没找到');
expect('明天天气怎么样', d => !d, '无关问题应该说没找到');
expect('你喜欢猫吗', d => !d, '无关问题应该说没找到');
expect('', d => !d, '空问题');

console.log(fail ? '\n失败 ' + fail + ' 条' : '\n全部通过');
process.exit(fail ? 1 : 0);
