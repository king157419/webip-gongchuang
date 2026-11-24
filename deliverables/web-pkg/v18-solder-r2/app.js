/* v18-solder 焊接版：滚动驱动吸顶舞台。调试：?beat=0..4 / ?p=1.25 / ?at=像素 / ?flat */
(function () {
'use strict';
var C = window.CLUB, d = document, root = d.documentElement, M = Math;

function $(s, el) { return (el || d).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)); }
function esc(v) {
	return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function seg(v, a, b) { return b - a < 1e-6 ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a), 0, 1); }
function bell(t) { return M.sin(clamp(t, 0, 1) * M.PI); }
function dist(a, b) { return M.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)); }
function rng(a) {
	return function () {
		a = (a + 0x6D2B79F5) | 0;
		var t = M.imul(a ^ (a >>> 15), 1 | a);
		t = (t + M.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hash2(x, y) {
	var n = M.imul(x | 0, 374761393) ^ M.imul(y | 0, 668265263) ^ 0x5bd1e995;
	n = M.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
	var xi = M.floor(x), yi = M.floor(y), u = sm(x - xi), v = sm(y - yi);
	return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function cs(gr, a) { for (var i = 0; i < a.length; i += 2) gr.addColorStop(a[i], a[i + 1]); return gr; }
function infl(r, p) { return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p }; }
function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

/* 内容渲染（双模式共用） */
var PROG = {
	weld: '从焊好一个点到焊好一根线，学长学姐一对一带。',
	course: '和华为合作的实践课：MindSpore、Transformer、BERT 微调。',
	visit: '华为全联接大会、鸿蒙生态学堂、鲲鹏开发者众测。',
	contest: '协办上海大学人工智能创新大赛，从报名到决赛答辩。',
	talk: '学长学姐讲科研、讲论文、讲保研与项目经验。'
};
var PICK = [
	['2026-05-11', '昇腾 AI 大模型创新实践课', '四十余名同学经限额报名入选'],
	['2026-04-13', '2025 年人工智能创新大赛决赛', '社团协办 · 翔英大楼 T608'],
	['2025-11-06', '创新技能大赛焊接专项赛', '社团协办 · 报名百余人'],
	['2024-12-09', 'AI 论文分享会', '近 200 名同学参加'],
	['2024-09-24', '2024 华为全联接大会', '组织百余名同学参观']
];
var LEAD = { '任捷': '电子信息工程专业。2026 年秋季的焊接课上，就是他给新同学讲焊接基础和安全规范。' };
var KIND = ['rnet', 'tant', 'ind', 'xtal4', 'soic6'];
var NAMES = [['社团', '社团是什么'], ['日常', '平时做什么'], ['做过', '做过的事'], ['带队', '谁在带大家'], ['通电', '怎么加入']];
var WX = '上海大学通信学院';
var onCelebrate = null, onSurge = null;

function ym(s) { return String(s).slice(0, 7).replace('-', '.'); }
function ymd(s) { return String(s).replace(/-/g, '.'); }
function firstClause(s) { return String(s || '').split(/[；。]/)[0]; }
function fill(id, html) { var el = d.getElementById(id); if (el) el.innerHTML = html; return el; }

/* 中文断行：按词组包成不可拆的小段（.nw），数字和量词不拆开，末行至少留 3 个字。
   浏览器没有分词器时只做末行保护。 */
var HAN = /[\u3400-\u9fff\uf900-\ufaff]/g, PUNC_C = /^[，。、；：！？）」』”》％%…]+$/, PUNC_O = /^[（「『“《]+$/;
/* 本站常用词：分词器认不全的专名先保护起来 */
var DICT = ('人工智能 上海大学 通信学院 创新大赛 参访 华为 全联接 开发者 众测 昇腾 鸿蒙 鲲鹏 生态学堂 翔英大楼 创客空间 宝山校区 实验室 学长学姐 新同学 公众号 ' +
	'蓝桥杯 集成电路 嵌入式 大模型 实践课 分享会 焊接 专项赛 一对一 零基础 电子信息 技术课程 指导老师 学术部 组织部 宣传部 办公部 ' +
	'一等奖 三等奖 优秀奖 总决赛 决赛答辩 分赛区 四十余名 百余名 百余人 限额 报名 招新 预告 论文 保研 科研 项目经验 安全规范 全板导通 小智 社团').split(' ')
	.sort(function (a, b) { return b.length - a.length; });
var DICT_RE = new RegExp(DICT.join('|'), 'g');
var SUF = '者的们性化部课赛奖届场次名件年月日号个位人会', PRE = '第每各';
var SEGR = null;
try { if (window.Intl && Intl.Segmenter) SEGR = new Intl.Segmenter('zh', { granularity: 'word' }); } catch (e) { SEGR = null; }
function hanN(s) { var m = s.match(HAN); return m ? m.length : 0; }
function one(t) { return t && t.s.length === 1 && hanN(t.s) === 1; }
function isWord(t) { return t && !t.sp && !PUNC_C.test(t.s) && !PUNC_O.test(t.s); }
function rawSeg(text) {
	var out = [], last = 0, m;
	function plain(s) {
		if (!s) return;
		if (SEGR) Array.from(SEGR.segment(s), function (x) { out.push({ s: x.segment }); });
		else s.split(/(\s+)/).filter(Boolean).forEach(function (x) { out.push({ s: x, plain: true }); });
	}
	DICT_RE.lastIndex = 0;
	while (SEGR && (m = DICT_RE.exec(text))) { plain(text.slice(last, m.index)); out.push({ s: m[0], dict: true }); last = m.index + m[0].length; }
	plain(text.slice(last));
	out.forEach(function (t) { t.sp = /^\s+$/.test(t.s); });
	return out;
}
function tokens(text) {
	var T = rawSeg(text), i, a, b;
	if (SEGR) {
		/* 后缀字（者、部、奖、名……）贴前，前缀字（第、每）贴后 */
		for (i = 0; i < T.length; i++) {
			if (!one(T[i])) continue;
			a = T[i - 1]; b = T[i + 1];
			if (SUF.indexOf(T[i].s) >= 0 && isWord(a) && hanN(a.s) && hanN(a.s) < 6) { a.s += T[i].s; T.splice(i, 1); i--; }
			else if (PRE.indexOf(T[i].s) >= 0 && isWord(b)) { b.s = T[i].s + b.s; T.splice(i, 1); i--; }
		}
	}
	/* 数字 + 空格 + 量词/短词（16 次、2024 华为）连成一体 */
	for (i = 1; i < T.length - 1; i++) {
		a = T[i - 1]; b = T[i + 1];
		if (T[i].sp && /\d$/.test(a.s) && /^[\u3400-\u9fff]/.test(b.s) && hanN(b.s) <= 3) { a.s += '\u00a0' + b.s; a.plain = false; T.splice(i, 2); i--; }
	}
	if (SEGR) {
		/* 连续单字并成一组（最多 3 字），剩下的单字贴前一个词，贴不上贴后一个词 */
		for (i = 1; i < T.length; i++) {
			a = T[i - 1]; b = T[i];
			if (one(b) && a.run !== false && a.s.length === hanN(a.s) && hanN(a.s) < 3 && (a.run || one(a))) { a.s += b.s; a.run = true; T.splice(i, 1); i--; }
		}
		for (i = 0; i < T.length; i++) {
			if (!one(T[i])) continue;
			a = T[i - 1]; b = T[i + 1];
			if (isWord(a) && hanN(a.s) && hanN(a.s) < 5) { a.s += T[i].s; T.splice(i, 1); i--; }
			else if (isWord(b) && hanN(b.s) < 5) { b.s = T[i].s + b.s; T.splice(i, 1); i--; }
		}
	}
	/* 标点：句读跟前一个词，开括号跟后一个词 */
	for (i = 0; i < T.length; i++) {
		if (PUNC_C.test(T[i].s) && i > 0 && !T[i - 1].sp) { T[i - 1].s += T[i].s; T.splice(i, 1); i--; }
		else if (PUNC_O.test(T[i].s) && i < T.length - 1 && !T[i + 1].sp) { T[i + 1].s = T[i].s + T[i + 1].s; T.splice(i, 1); i--; }
	}
	/* 末行保护：最后一组不足 3 个字就往前连（连起来最多 6 字） */
	var L = T.length - 1;
	while (L > 0 && T[L].sp) L--;
	if (SEGR) {
		while (L > 0 && hanN(T[L].s) && hanN(T[L].s) < 3 && !T[L - 1].sp && hanN(T[L - 1].s + T[L].s) <= 6) { T[L - 1].s += T[L].s; T.splice(L, 1); L--; }
	} else if (L >= 0 && hanN(T[L].s) > 3) {
		var s = T[L].s, cut = s.length, n = 0;
		while (cut > 0 && n < 3) { cut--; if (hanN(s[cut])) n++; }
		T.splice(L, 1, { s: s.slice(0, cut), plain: true }, { s: s.slice(cut) });
	}
	return T;
}
function typeset(el) {
	if (!el || el.getAttribute('data-ts')) return;
	el.setAttribute('data-ts', '1');
	var w = d.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false), list = [], n;
	while ((n = w.nextNode())) if (hanN(n.nodeValue) && !(n.parentNode.classList && n.parentNode.classList.contains('nw'))) list.push(n);
	list.forEach(function (node) {
		var frag = d.createDocumentFragment();
		tokens(node.nodeValue).forEach(function (t) {
			if (t.sp || t.plain || t.s.length < 2) { frag.appendChild(d.createTextNode(t.s)); return; }
			var sp = d.createElement('span'); sp.className = 'nw'; sp.textContent = t.s; frag.appendChild(sp);
		});
		node.parentNode.replaceChild(frag, node);
	});
}
var TYPESET = '.hero-lead, .sub, .prog h3, .prog p, .c-t, .c-f, .lead-desc, .awards li, .fact dd, .disp-cap span, .jl, .zhi-d, .steps strong, .steps span, .led-msg, .faq dt, .faq dd, .info li > span + span, .nlist span, .dlg-src, .foot-bot p';

function renderContent() {
	if (!C) return;
	var meta = C.meta || {}, news = C.news || [], ppl = C.people || {}, join = C.join || {};
	var depts = meta.departments || [];
	if (meta.contact && meta.contact.wechat) WX = String(meta.contact.wechat).replace(/（[^）]*）|\([^)]*\)/g, '').trim() || WX;

	fill('progs', (C.programs || []).map(function (p, i) {
		return '<li class="prog"><div class="comp ko" data-kind="' + KIND[i % KIND.length] + '" aria-hidden="true"></div>' +
			'<h3 class="ink ko">' + esc(p.name) + '</h3><p class="ink ko">' + esc(PROG[p.id] || firstClause(p.desc)) + '</p></li>';
	}).join(''));

	var picks = [];
	PICK.forEach(function (pk) {
		var n = news.filter(function (x) { return x.date === pk[0]; })[0];
		if (n) picks.push({ n: n, t: pk[1], f: pk[2] });
	});
	for (var i = 0; picks.length < 4 && i < news.length; i++) {
		if (!picks.some(function (p) { return p.n === news[i]; })) picks.push({ n: news[i], t: String(news[i].title).slice(0, 16), f: '' });
	}
	fill('chips', picks.map(function (p) {
		return '<li><a class="chip ko" href="' + esc(p.n.source) + '" target="_blank" rel="noopener" aria-label="' +
			esc(ymd(p.n.date) + ' ' + p.n.title + '（学院官网原文，新窗口打开）') + '">' +
			'<span class="ink c-date">' + esc(ym(p.n.date)) + '</span><span class="ink c-t">' + esc(p.t) + '</span>' +
			(p.f ? '<span class="ink c-f">' + esc(p.f) + '</span>' : '') + '<i class="glint" aria-hidden="true"></i></a></li>';
	}).join(''));
	fill('news-sub', '学院官网报道过 ' + news.length + ' 次，将芯片压入插座点亮其中 ' + picks.length + ' 件。');
	fill('btn-all', '全部 ' + news.length + ' 篇报道');
	fill('dlg-h', '全部 ' + news.length + ' 篇报道');
	fill('nlist', news.map(function (n) {
		return '<li><a href="' + esc(n.source) + '" target="_blank" rel="noopener"><time datetime="' + esc(n.date) + '">' +
			esc(ymd(n.date)) + '</time><span>' + esc(n.title) + '</span><b>原文 ↗</b></a></li>';
	}).join(''));

	var L = (ppl.leaders || [])[0], T = ppl.teachers || [], img = $('#lead-photo');
	if (L) {
		fill('lead-a', '<p class="lead-role ink ko">' + esc(L.role) + '</p><p class="lead-name ink ko">' + esc(L.name) + '</p>' +
			'<p class="lead-desc ink ko">' + esc(LEAD[L.name] || firstClause(L.desc)) + '</p>');
		if (L.photo && img) { img.src = '../shared/img/' + L.photo; img.alt = L.role + L.name + '的照片'; }
	}
	var capHtml = '';
	if (L) capHtml += '<strong>' + esc(L.role + ' · ' + L.name) + '</strong>';
	if (T.length) capHtml += '<span>指导老师：<span class="nw">' + T.map(function (t) { return esc(t.name); }).join(' · ') + '</span></span>';
	fill('disp-cap', capHtml);

	var b = '';
	if (L && L.awards && L.awards.length) b += '<ul class="awards ink ko">' + L.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
	var facts = '';
	if (T.length) facts += '<div class="fact ink ko"><dt>指导老师</dt><dd>' + T.map(function (t) { return esc(t.name); }).join(' · ') + '</dd></div>';
	if (depts.length) facts += '<div class="fact depts ink ko"><dt>' + depts.length + ' 个部门</dt><dd>' + depts.map(function (x) { return '<b>' + esc(x.name) + '</b>'; }).join('') + '</dd></div>';
	if (facts) b += '<dl class="facts">' + facts + '</dl>';
	fill('lead-b', b);

	fill('steps', (join.steps || []).map(function (s, n) {
		return '<li><b>' + (n + 1) + '</b><div><strong>' + esc(s.t) + '</strong><span>' + esc(s.d) + '</span></div></li>';
	}).join(''));
	var bwx = $('#btn-wx');
	if (bwx) { bwx.textContent = '复制公众号名：' + WX; bwx.setAttribute('aria-label', '复制公众号名：' + WX); }

	fill('faq', (join.faq || []).map(function (f) { return '<dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd>'; }).join(''));
	var info = [['挂靠', meta.host], ['类型', meta.type], ['成立', meta.founded ? meta.founded + ' 年' : ''],
		['部门', depts.map(function (x) { return x.name; }).join(' / ')], ['面向', meta.audience], ['活动地点', meta.location], ['公众号', WX]];
	fill('info', info.filter(function (x) { return x[1]; }).map(function (x) {
		return '<li><span>' + esc(x[0]) + '</span><span>' + esc(x[1]) + '</span></li>';
	}).join(''));

	var tps = $('#tps');
	if (tps) tps.innerHTML = NAMES.map(function (n, i) {
		return '<button class="tp" type="button" data-b="' + i + '" aria-label="TP' + (i + 1) + ' ' + n[1] + '"><span class="nm">' + n[0] +
			'</span><span class="lb">TP' + (i + 1) + '</span><span class="ring"></span></button>';
	}).join('') + '<span class="tpn" aria-hidden="true"></span>';
	$$(TYPESET).forEach(typeset);
}

function copyWX(btn) {
	var ok = false, ta = d.createElement('textarea'), msg = $('#led-msg');
	ta.value = WX; ta.setAttribute('readonly', '');
	ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
	d.body.appendChild(ta);
	try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
	ta.select();
	try { ta.setSelectionRange(0, ta.value.length); ok = d.execCommand('copy'); } catch (e) { ok = false; }
	d.body.removeChild(ta);
	if (btn) { try { btn.focus({ preventScroll: true }); } catch (e) {} btn.classList.remove('blink'); void btn.offsetWidth; btn.classList.add('blink'); }
	if (msg) msg.textContent = ok ? '已复制「' + WX + '」，去微信里搜索关注即可' : '微信里搜索：' + WX;
	if (onCelebrate) onCelebrate();
}

var go = function (b) { var el = d.getElementById('s' + b); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

function wire() {
	var bwx = $('#btn-wx'), sw = $('#sw-btn'), dlg = $('#dlg');
	if (bwx) bwx.addEventListener('click', function () { copyWX(bwx); });
	if (sw) sw.addEventListener('click', function () { if (onSurge) onSurge(); else go(4); });
	$$('[data-go]').forEach(function (el) { el.addEventListener('click', function () { go(+el.getAttribute('data-go')); }); });
	var tps = $('#tps');
	if (tps) tps.addEventListener('click', function (e) { var t = e.target.closest('.tp'); if (t) go(+t.getAttribute('data-b')); });
	var all = $('#btn-all');
	if (all && dlg) {
		all.addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
		var close = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
		$('#dlg-x').addEventListener('click', close);
		dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
	}
}

function splitInk(el) {
	var n = 0;
	(function walk(node) {
		Array.prototype.slice.call(node.childNodes).forEach(function (c) {
			if (c.nodeType === 3) {
				if (!c.nodeValue.trim()) return;
				var frag = d.createDocumentFragment();
				Array.from(c.nodeValue).forEach(function (ch) {
					if (/\s/.test(ch)) { frag.appendChild(d.createTextNode(ch)); return; }
					var s = d.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', n++); s.textContent = ch; frag.appendChild(s);
				});
				node.replaceChild(frag, c);
			} else if (c.nodeType === 1 && !c.classList.contains('glint')) walk(c);
		});
	})(el);
	el.style.setProperty('--n', n);
}

/* 吸顶舞台 */
function initLive() {
	var stage = $('#stage'), world = $('#world'), track = $('#track');
	var cvB = $('#cv-board'), cvF = $('#cv-fx'), cvZ = $('#cv-zhi');
	var gB = cvB.getContext('2d'), gF = cvF.getContext('2d'), gZ = cvZ ? cvZ.getContext('2d') : null;
	if (!gB || !gF) throw new Error('2d context');
	var sts = $$('.st', world).map(function (el) { return { el: el }; });
	if (sts.length !== 5) throw new Error('stations');
	$$('.ink', world).forEach(splitInk);

	var CO = { bench: '#0f1211', sub: '#09241a', pour: '#123b2b', cu: '#1f5d44', cuHi: 'rgba(180,245,205,0.09)', silk: 'rgba(238,236,227,0.9)', silkD: 'rgba(238,236,227,0.5)' };
	var RIB_COL = ['#7c4d3a', '#c9483b', '#dc7d34', '#dbb546', '#4d9e5d', '#3e7cb9', '#795da8', '#8b9298', '#dedfd9', '#2b2f32'];
	var A0 = 0.32;
	var W, H, k, mob, vertP, dpr, mrg, boardW, boardH, ovScale;
	var PW = null, HUB = null, SMDS = [], DRAG = null, CHIPS = [], RIB = null, SW = null, TM = null;
	var TRp = [], TRm = [], TRd = [], TRall = [], NET = [], VIA = [], PART = [], SEGB = [], KO = [], MH = [], FID = [], TPM = [];
	var TILES_R = [], tiles = {}, boardLo = null, tileQ = 0, noisePat = null, silkLogo = null, smokeDot = null, logoImg = null, logoRect = null;
	var beats = [], total = 0, trackTop = 0, refN = 0;
	var sT = 0, sD = 0, raf = 0, lastT = 0, lastTf = '', curB = -1, powerT0 = -1e9, cheerT0 = -1e9, surgeT0 = -1e9, greetDone = false, greetT0 = -1e9;
	var ptr = { x: -1e4, y: -1e4, heat: 0, t: 0 }, aOff = 0;
	var binds = [], tpBtns = $$('.tp'), tpNum = $('.tpn'), railLis = $$('#rails li'), swPanel = $('#sw-panel'), swBtn = $('#sw-btn');
	var zhiSay = $('#zhi-t');
	/* 镜头推拉时，任何一段字只要碰到屏幕边（或右侧进度条），就整段淡出；完全回到画面里才显示 */
	var VF = [], TPS = null, opR = null, opOcc = 0, PROGX = 0;
	var VF_SEL = '.hero-title .l1, .hero-title .l2, .hero-lead, .hero-act, .pwr-lab, .logo > span, .st h2, .sub, .prog h3, .prog p, ' +
		'.c-date, .c-t, .c-f, .btn-all, .lead-role, .lead-name, .lead-desc, .awards li, .fact, .disp-cap, .jl, .sw-stat, .term-hd, .zhi-hi, .steps li, .term-act';
	var VF_BOX = '.hero-act, .btn-all, .fact, .disp-cap, .sw-stat, .term-hd, .steps li, .term-act';

	/* 几何小工具 */
	function cumul(p) { var c = [0]; for (var i = 1; i < p.length; i++) c.push(c[i - 1] + dist(p[i - 1], p[i])); return c; }
	function along(p, c, L) {
		if (L <= 0) return p[0];
		for (var i = 1; i < p.length; i++) if (c[i] >= L) {
			var u = (L - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
			return { x: lerp(p[i - 1].x, p[i].x, u), y: lerp(p[i - 1].y, p[i].y, u) };
		}
		return p[p.length - 1];
	}
	function tr(p, w) {
		var c = cumul(p), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
		p.forEach(function (q) { x0 = M.min(x0, q.x); x1 = M.max(x1, q.x); y0 = M.min(y0, q.y); y1 = M.max(y1, q.y); });
		return { p: p, w: w, cum: c, len: c[c.length - 1] || 1, x0: x0 - w, x1: x1 + w, y0: y0 - w, y1: y1 + w };
	}
	function octo(p) {
		var q = [p[0]], i;
		for (i = 1; i < p.length; i++) { var l = q[q.length - 1]; if (M.abs(p[i].x - l.x) + M.abs(p[i].y - l.y) > 0.5) q.push(p[i]); }
		for (i = q.length - 2; i > 0; i--) {
			var a = q[i - 1], b = q[i], c = q[i + 1];
			if (M.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 0.5) q.splice(i, 1);
		}
		var out = [q[0]];
		for (i = 1; i < q.length - 1; i++) {
			var A = q[i - 1], B = q[i], Cc = q[i + 1], l1 = dist(A, B), l2 = dist(B, Cc), ch = M.min(18 * k, l1 / 2, l2 / 2);
			out.push({ x: B.x + (A.x - B.x) / l1 * ch, y: B.y + (A.y - B.y) / l1 * ch });
			out.push({ x: B.x + (Cc.x - B.x) / l2 * ch, y: B.y + (Cc.y - B.y) / l2 * ch });
		}
		out.push(q[q.length - 1]);
		return out;
	}
	function nrm(a, b) { var dx = b.x - a.x, dy = b.y - a.y, l = M.sqrt(dx * dx + dy * dy) || 1; return { x: -dy / l, y: dx / l }; }
	function offsetLine(p, o) {
		return p.map(function (b, i) {
			var n1 = i > 0 ? nrm(p[i - 1], b) : nrm(b, p[i + 1]), n2 = i < p.length - 1 ? nrm(b, p[i + 1]) : n1;
			var mx = n1.x + n2.x, my = n1.y + n2.y, ml = M.sqrt(mx * mx + my * my) || 1; mx /= ml; my /= ml;
			var dd = clamp(o / ((mx * n1.x + my * n1.y) || 1), -Math.abs(o) * 2.4, Math.abs(o) * 2.4);
			return { x: b.x + mx * dd, y: b.y + my * dd };
		});
	}

	/* 2D 主板布局与五拍电路拓扑 */
	function build() {
		W = stage.clientWidth || window.innerWidth; H = stage.clientHeight || window.innerHeight;
		if (W < 200 || H < 200) throw new Error('stage too small');
		mob = W < 760; vertP = W < 960;
		k = mob ? 0.72 : W < 1100 ? 0.86 : 1;
		dpr = mob ? 1 : M.min(window.devicePixelRatio || 1, 1.5);
		mrg = mob ? 8 : 16;
		world.style.transform = 'none'; lastTf = '';
		world.classList.add('msr');

		sts.forEach(function (s) {
			s.el.style.width = W + 'px'; s.el.style.minHeight = H + 'px';
			s.el.style.left = '0px'; s.el.style.top = '0px';
			s.h = M.max(H, M.ceil(s.el.offsetHeight));
		});

		var bPad = M.round((mob ? 18 : 34) * k), padX = M.round(W * (mob ? 0.1 : 0.08)), padY = M.round(H * (mob ? 0.08 : 0.1));
		var colX, rowY, gx1, gx2, gy1, gy2;
		if (!mob) {
			var rH0 = M.max(sts[0].h, sts[1].h, sts[2].h), rH1 = M.max(sts[3].h, sts[4].h);
			colX = [bPad, bPad + W + padX, bPad + 2 * (W + padX)];
			rowY = [bPad, bPad + rH0 + padY];
			boardW = colX[2] + W + bPad; boardH = rowY[1] + rH1 + bPad;
			sts[0].x = colX[0]; sts[0].y = rowY[0];
			sts[1].x = colX[1]; sts[1].y = rowY[0];
			sts[2].x = colX[2]; sts[2].y = rowY[0];
			sts[3].x = colX[2]; sts[3].y = rowY[1];
			sts[4].x = colX[1]; sts[4].y = rowY[1];
			HUB = { x: colX[0], y: rowY[1], w: W, h: rH1 };
			gx1 = colX[1] - padX / 2; gx2 = colX[2] - padX / 2; gy1 = rowY[1] - padY / 2;
			var xs = [0, M.round(gx1), M.round(gx2), boardW], ys = [0, M.round(gy1), boardH];
			TILES_R = [];
			for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) TILES_R.push({ x: xs[c], y: ys[r], w: xs[c + 1] - xs[c], h: ys[r + 1] - ys[r] });
		} else {
			var mH0 = M.max(sts[0].h, sts[1].h), mH1 = sts[2].h, mH2 = M.max(sts[3].h, sts[4].h);
			colX = [bPad, bPad + W + padX];
			rowY = [bPad, bPad + mH0 + padY, bPad + mH0 + mH1 + 2 * padY];
			boardW = colX[1] + W + bPad; boardH = rowY[2] + mH2 + bPad;
			sts[0].x = colX[0]; sts[0].y = rowY[0];
			sts[1].x = colX[1]; sts[1].y = rowY[0];
			sts[2].x = colX[1]; sts[2].y = rowY[1];
			sts[3].x = colX[1]; sts[3].y = rowY[2];
			sts[4].x = colX[0]; sts[4].y = rowY[2];
			HUB = { x: colX[0], y: rowY[1], w: W, h: mH1 };
			gx1 = colX[1] - padX / 2; gy1 = rowY[1] - padY / 2; gy2 = rowY[2] - padY / 2;
			var mxs = [0, M.round(gx1), boardW], mys = [0, M.round(gy1), M.round(gy2), boardH];
			TILES_R = [];
			for (var mr = 0; mr < 3; mr++) for (var mc = 0; mc < 2; mc++) TILES_R.push({ x: mxs[mc], y: mys[mr], w: mxs[mc + 1] - mxs[mc], h: mys[mr + 1] - mys[mr] });
		}

		sts.forEach(function (s) {
			s.el.style.left = s.x + 'px'; s.el.style.top = s.y + 'px';
			s.extra = M.max(0, s.h - H);
		});
		ovScale = M.min((W - (mob ? 14 : 32)) / boardW, (H - (mob ? 56 : 32)) / boardH);

		var wr = world.getBoundingClientRect();
		function R(el) { var r = el.getBoundingClientRect(); return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height }; }
		KO = $$('.ko', world).map(function (el) { return infl(R(el), 13 * k); });
		TRp = []; TRm = []; NET = [];

		var P = R($('[data-part=pwr]'));
		var u1 = { x: P.x + P.w * 0.3, y: P.y + P.h * 0.38 }, r1 = { x: P.x + P.w * 0.5, y: P.y + P.h * 0.62 };
		var d1 = { x: P.x + P.w * 0.66, y: r1.y }, j0 = { x: P.x + P.w * 0.88, y: r1.y };
		var usb = !mob && W >= 1280;
		PW = {
			u1: u1, r1: r1, d1: d1, j0: j0, usb: usb, P: P,
			inp: usb ? { x: u1.x, y: mrg } : { x: P.x + 10 * k, y: u1.y },
			c1: { x: u1.x - 30 * k, y: u1.y + 2 * k }, c2: { x: u1.x + 30 * k, y: u1.y + 2 * k }
		};
		if (usb) { TRp.push(tr([{ x: u1.x, y: mrg + 24 * k }, { x: u1.x, y: u1.y - 12 * k }], 4.2 * k)); KO.push({ x: u1.x - 30 * k, y: 0, w: 60 * k, h: mrg + 42 * k }); }
		else TRp.push(tr(octo([{ x: PW.inp.x + 8 * k, y: u1.y }, { x: PW.inp.x + 18 * k, y: u1.y }, { x: PW.inp.x + 18 * k, y: u1.y - 22 * k }, { x: u1.x, y: u1.y - 22 * k }, { x: u1.x, y: u1.y - 12 * k }]), 4 * k));
		TRp.push(tr(octo([{ x: u1.x, y: u1.y + 12 * k }, { x: u1.x, y: r1.y }, { x: r1.x - 7 * k, y: r1.y }]), 3.5 * k));
		TRp.push(tr([{ x: r1.x + 7 * k, y: r1.y }, { x: d1.x - 8 * k, y: r1.y }], 3.2 * k));
		TRp.push(tr([{ x: d1.x + 8 * k, y: r1.y }, { x: j0.x, y: j0.y }], 3.2 * k));

		var hx = HUB.x + HUB.w * 0.52, hy = HUB.y + HUB.h * 0.48;
		HUB.f1 = { x: hx - 86 * k, y: hy - 34 * k };
		HUB.l1 = { x: hx, y: hy - 34 * k };
		HUB.c10 = { x: hx - 34 * k, y: hy + 34 * k };
		HUB.c11 = { x: hx + 34 * k, y: hy + 34 * k };
		HUB.box = { x: hx - 135 * k, y: hy - 86 * k, w: 270 * k, h: 176 * k };
		KO.push(infl(HUB.box, 20 * k));

		PROGX = R($('#progs')).x;
		var swR = R($('#sw-btn')), tmR = R($('#term'));
		SW = { r: swR, inP: { x: swR.x - 12 * k, y: swR.y + swR.h * 0.72 }, outP: { x: swR.x - 12 * k, y: swR.y + swR.h * 0.28 } };
		TM = { r: tmR, topIn: { x: tmR.x + tmR.w * 0.62, y: tmR.y - 10 * k }, leftIn: { x: tmR.x - 10 * k, y: tmR.y + tmR.h * 0.5 } };
		KO.push(infl(swR, 18 * k), infl(tmR, 18 * k));

		var stbyPts = octo([
			j0, { x: j0.x + 24 * k, y: j0.y }, { x: j0.x + 24 * k, y: HUB.f1.y }, HUB.f1, HUB.l1,
			{ x: HUB.l1.x + 68 * k, y: HUB.l1.y }, { x: HUB.l1.x + 68 * k, y: SW.inP.y }, SW.inP
		]);
		TRp.push(tr(stbyPts, 3.8 * k));

		SMDS = $$('.comp', world).map(function (el, n) {
			var r = R(el), cx = r.x + r.w * (vertP ? 0.38 : 0.42), cy = r.y + r.h * 0.52;
			var lex = vertP ? r.x + r.w * 0.82 : r.x + r.w * 0.83;
			var pads = [], i;
			if (!vertP) {
				for (i = 0; i < 4; i++) pads.push({ x: cx + (i - 1.5) * 8.5 * k, y: cy + 12 * k, w: 5.2 * k, h: 9.5 * k });
			} else {
				for (i = 0; i < 3; i++) pads.push({ x: cx - 14 * k, y: cy + (i - 1) * 7.5 * k, w: 9 * k, h: 4.8 * k });
			}
			return { idx: n, kind: el.getAttribute('data-kind'), r: r, cx: cx, cy: cy, lex: lex, pads: pads };
		});
		if (!vertP) {
			var dy = SMDS[0].cy + 12 * k;
			DRAG = { a: { x: SMDS[0].pads[0].x - 16 * k, y: dy }, b: { x: SMDS[SMDS.length - 1].pads[3].x + 16 * k, y: dy }, vert: false };
		} else {
			var dx = SMDS[0].cx - 14 * k;
			DRAG = { a: { x: dx, y: SMDS[0].pads[0].y - 14 * k }, b: { x: dx, y: SMDS[SMDS.length - 1].pads[2].y + 14 * k }, vert: true };
		}

		CHIPS = $$('.chip', world).map(function (el, n) {
			var q = R(el), cnt = clamp(M.round(q.w / (17 * k)), 6, 14), x0 = q.x + 12 * k, x1 = q.x + q.w - 12 * k, pins = [];
			for (var i = 0; i < cnt; i++) pins.push(lerp(x0, x1, i / (cnt - 1)));
			return { idx: n, q: q, pins: pins, inP: { x: pins[0], y: q.y - 9 * k }, outP: { x: pins[pins.length - 1], y: q.y - 9 * k } };
		});

		var D = R($('#disp'));
		var jw = (mob ? 13 : 18) * k, jh = (mob ? 52 : 76) * k;
		var jx = D.x + D.w + (mob ? 4 : 8) * k, jy = D.y + D.h * 0.45;
		RIB = {
			D: D, jx: jx, jy: jy, jw: jw, jh: jh,
			travel: mob ? 56 * k : M.max(150 * k, boardW - (jx + jw) + 20 * k),
			inP: { x: D.x + D.w * 0.5, y: D.y - 8 * k },
			outP: { x: D.x + D.w * 0.25, y: D.y + D.h + 8 * k }
		};
		KO.push({ x: jx - 6 * k, y: jy - jh * 0.8, w: boardW - jx + 40, h: jh * 1.6 });

		function addBus(pts, wMain, nComp) {
			var clean = octo(pts), main = tr(clean, wMain), subs = [];
			TRm.push(main);
			for (var s = 1; s <= (nComp || 0); s++) {
				var off = (s % 2 ? 1 : -1) * M.ceil(s / 2) * 8.5 * k;
				var sp = tr(offsetLine(clean, off), 2 * k);
				TRm.push(sp); subs.push(sp);
			}
			return { main: main, subs: subs };
		}

		/* 竖排时这条总线从列表上方的空当进来，不横穿第一条小标题 */
		var PGq = R($('#progs')), yTop = PGq.y - 14 * k;
		var p0 = !vertP
			? [SW.outP, { x: gx1, y: SW.outP.y }, { x: gx1, y: DRAG.a.y }, DRAG.a]
			: [SW.outP, { x: gx1, y: SW.outP.y }, { x: gx1, y: yTop }, { x: DRAG.a.x, y: yTop }, DRAG.a];
		NET.push([addBus(p0, 4.2 * k, 2)]);

		var seg1 = [addBus([DRAG.a, DRAG.b], 3.8 * k, 0)];
		SMDS.forEach(function (sm0) {
			var a = !vertP ? { x: sm0.cx + 12 * k, y: DRAG.a.y } : { x: DRAG.a.x, y: sm0.cy };
			var b2 = { x: sm0.lex, y: sm0.cy };
			seg1.push(addBus([a, b2], 2.6 * k, 0));
		});
		var c0In = CHIPS[0].inP;
		var p1to2 = !mob
			? [DRAG.b, { x: gx2, y: DRAG.b.y }, { x: gx2, y: c0In.y - 22 * k }, { x: c0In.x, y: c0In.y - 22 * k }, c0In]
			: [DRAG.b, { x: DRAG.b.x, y: gy1 }, { x: c0In.x, y: gy1 }, c0In];
		seg1.push(addBus(p1to2, 4 * k, 1));
		NET.push(seg1);

		var seg2 = [];
		for (var ci = 0; ci < CHIPS.length; ci++) {
			var ch = CHIPS[ci];
			seg2.push(addBus([ch.inP, ch.outP], 3.4 * k, 0));
			if (ci < CHIPS.length - 1) {
				var nx = CHIPS[ci + 1];
				var midY = ch.outP.y - 16 * k;
				seg2.push(addBus(!vertP
					? [ch.outP, { x: ch.outP.x, y: midY }, { x: nx.inP.x, y: midY }, nx.inP]
					: [{ x: ch.q.x + ch.q.w - 14 * k, y: ch.q.y + ch.q.h + 9 * k }, { x: nx.inP.x, y: nx.inP.y }], 3.4 * k, 0));
			}
		}
		var lastC = CHIPS[CHIPS.length - 1], rLaneX = boardW - (mob ? 18 : 30) * k;
		var p2to3 = [
			{ x: lastC.outP.x, y: lastC.outP.y },
			{ x: rLaneX, y: lastC.outP.y },
			{ x: rLaneX, y: RIB.inP.y - 18 * k },
			{ x: RIB.inP.x, y: RIB.inP.y - 18 * k },
			RIB.inP
		];
		seg2.push(addBus(p2to3, 4 * k, 1));
		NET.push(seg2);

		var gMidX = !mob ? gx2 : gx1;
		/* 这条总线横穿第 3 站，走在整段文字下方，不压字 */
		var LBq = R($('#lead-b')), busY = M.max(RIB.outP.y + 22 * k, LBq.y + LBq.h + 30 * k);
		/* 手机上副屏下面就是文字，改从右侧留白下行 */
		var xr = sts[3].x + W - 18;
		var p3to4 = !mob ? [
			{ x: RIB.jx, y: RIB.jy },
			{ x: D.x + D.w, y: RIB.jy },
			RIB.outP,
			{ x: RIB.outP.x, y: busY },
			{ x: gMidX, y: busY }
		] : [
			{ x: RIB.jx + RIB.jw * 0.5, y: RIB.jy + RIB.jh * 0.5 + 4 * k },
			{ x: xr, y: RIB.jy + RIB.jh * 0.5 + 4 * k },
			{ x: xr, y: busY },
			{ x: gMidX, y: busY }
		];
		NET.push([addBus(p3to4, 3.8 * k, 1)]);

		var pRightIn = [
			{ x: gMidX, y: busY },
			{ x: gMidX, y: TM.topIn.y - 22 * k },
			{ x: TM.topIn.x, y: TM.topIn.y - 22 * k },
			TM.topIn
		];
		var pLeftIn = [
			SW.outP,
			{ x: SW.outP.x, y: TM.leftIn.y },
			TM.leftIn
		];
		NET.push([addBus(pRightIn, 4.2 * k, 2), addBus(pLeftIn, 4.4 * k, 1)]);

		SEGB = [];
		TRm.concat(TRp).forEach(function (t) {
			for (var n = 1; n < t.p.length; n++) {
				var q0 = t.p[n - 1], q1 = t.p[n], pad = 9 * k + t.w;
				SEGB.push({ x: M.min(q0.x, q1.x) - pad, y: M.min(q0.y, q1.y) - pad, w: M.abs(q1.x - q0.x) + 2 * pad, h: M.abs(q1.y - q0.y) + 2 * pad });
			}
		});

		logoRect = R($('[data-part=logo]'));
		TPM = ['#t0', '#t1', '#t2', '#t3', '#t4'].map(function (sel, n) { var r = R($(sel)); return { x: r.x + 7 * k, y: r.y - 26 * k, n: n + 1 }; });
		decor();
		TRall = TRd.concat(TRm, TRp);

		/* 文字安全区：记下每段字在板面上的实际范围（只量字本身，不量整行盒子） */
		VF = $$(VF_SEL, world).map(function (el) {
			var r;
			if (el.matches(VF_BOX)) r = R(el);
			else {
				var rg = d.createRange(); rg.selectNodeContents(el);
				var q = rg.getBoundingClientRect(); r = { x: q.left - wr.left, y: q.top - wr.top, w: q.width, h: q.height };
			}
			el.setAttribute('data-vf', '');
			return { el: el, x: r.x, y: r.y, w: r.w, h: r.h, v: -1, bd: null, f: 1 };
		}).filter(function (v) { return v.w > 0 && v.h > 0; });
		var tq = $('#tps').getBoundingClientRect(), sq = stage.getBoundingClientRect();
		TPS = { l: tq.left - sq.left, t: tq.top - sq.top, r: tq.right - sq.left, b: tq.bottom - sq.top };
		world.classList.remove('msr');
		opR = null;
	}

	/* 板面装饰元件、总线束、安装孔与过孔 */
	function decor() {
		var rnd = rng(2026), occ = KO.slice(), x, y;
		TRd = []; VIA = []; PART = []; MH = []; FID = []; refN = 0;
		var BX = [mrg + 12 * k, boardW - mrg - 12 * k, mrg + 12 * k, boardH - mrg - 12 * k];
		function fits(bb) {
			if (bb.x < BX[0] || bb.x + bb.w > BX[1] || bb.y < BX[2] || bb.y + bb.h > BX[3]) return false;
			for (var n = 0; n < occ.length; n++) if (hit(bb, occ[n])) return false;
			for (n = 0; n < SEGB.length; n++) if (hit(bb, SEGB[n])) return false;
			return true;
		}
		var mr = (mob ? 9 : 13) * k, mi = mr * 2.1;
		[[BX[0] + mi, BX[2] + mi], [BX[1] - mi, BX[2] + mi], [BX[0] + mi, BX[3] - mi], [BX[1] - mi, BX[3] - mi]].forEach(function (p) {
			var bb = { x: p[0] - mr * 2.2, y: p[1] - mr * 2.2, w: mr * 4.4, h: mr * 4.4 };
			MH.push({ x: p[0], y: p[1], r: mr }); occ.push(bb);
		});
		[[BX[0] + mi * 2.8, BX[2] + mi * 0.8], [BX[1] - mi * 2.8, BX[3] - mi * 0.8], [BX[1] - mi * 2.8, BX[2] + mi * 0.8]].forEach(function (p) {
			var bb = { x: p[0] - 8 * k, y: p[1] - 8 * k, w: 16 * k, h: 16 * k };
			if (fits(bb)) { FID.push({ x: p[0], y: p[1] }); occ.push(bb); }
		});
		if (!mob) {
			[BX[0] + 5 * k, BX[1] - 5 * k].forEach(function (fx) {
				for (var fy = BX[2] + 74 * k; fy < BX[3] - 74 * k; fy += 18 * k) VIA.push({ x: fx, y: fy, r: 2 * k, st: 1 });
			});
			[BX[2] + 5 * k, BX[3] - 5 * k].forEach(function (fy) {
				for (var fx = BX[0] + 74 * k; fx < BX[1] - 74 * k; fx += 18 * k) {
					var vb = { x: fx - 4 * k, y: fy - 4 * k, w: 8 * k, h: 8 * k };
					if (!KO.some(function (o) { return hit(vb, o); })) VIA.push({ x: fx, y: fy, r: 2 * k, st: 1 });
				}
			});
		}
		function bbOf(pts) {
			var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
			pts.forEach(function (q) { x0 = M.min(x0, q.x); y0 = M.min(y0, q.y); x1 = M.max(x1, q.x); y1 = M.max(y1, q.y); });
			return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
		}
		function bundle(cell) {
			var n = 3 + M.floor(rnd() * (mob ? 2 : 4)), sp = 7.5 * k, hz = rnd() < 0.65, i;
			var d1 = hz ? { x: rnd() < 0.5 ? 1 : -1, y: 0 } : { x: 0, y: 1 }, pr = { x: -d1.y, y: d1.x }, sg = rnd() < 0.5 ? -1 : 1;
			var l1 = (40 + rnd() * (mob ? 65 : 170)) * k, l2 = (40 + rnd() * (mob ? 65 : 170)) * k, dg = (16 + rnd() * 32) * k;
			var P0 = { x: cell.x + 24 * k + rnd() * (cell.w - 48 * k), y: cell.y + 24 * k + rnd() * (cell.h - 48 * k) };
			var P1 = { x: P0.x + d1.x * l1, y: P0.y + d1.y * l1 };
			var P2 = { x: P1.x + (d1.x + pr.x * sg) * dg, y: P1.y + (d1.y + pr.y * sg) * dg };
			var P3 = { x: P2.x + d1.x * l2, y: P2.y + d1.y * l2 }, c = [P0, P1, P2, P3], lines = [], all = [];
			for (i = 0; i < n; i++) { var L = offsetLine(c, (i - (n - 1) / 2) * sp); lines.push(L); all = all.concat(L); }
			var bb = infl(bbOf(all), 11 * k);
			if (!fits(bb)) return false;
			lines.forEach(function (L, q) {
				var s0 = (q % 2) * 8 * k, s1 = ((q + 1) % 2) * 8 * k;
				var a = { x: L[0].x + d1.x * s0, y: L[0].y + d1.y * s0 }, b = { x: L[3].x - d1.x * s1, y: L[3].y - d1.y * s1 };
				TRd.push(tr([a, L[1], L[2], b], 1.8 * k));
				VIA.push({ x: a.x, y: a.y, r: 2.5 * k }, { x: b.x, y: b.y, r: 2.5 * k });
			});
			occ.push(bb); return true;
		}
		function mkPart(t, px, py, o) {
			var dm = { r: [17, 9], c: [17, 9], c8: [21, 12], sot: [14, 18], so8: [27, 31], qfp: [54, 54] }[t];
			var w = dm[0] * k, h = dm[1] * k; if (o) { var tw = w; w = h; h = tw; }
			return { t: t, x: px, y: py, o: o, bb: { x: px - w / 2, y: py - h / 2 - 10 * k, w: w, h: h + 10 * k } };
		}
		function cluster(type, cell) {
			var cx = cell.x + 30 * k + rnd() * (cell.w - 60 * k), cy = cell.y + 30 * k + rnd() * (cell.h - 60 * k), ps = [], i, t;
			if (type === 'array') { var cnt = 4 + M.floor(rnd() * 3); t = rnd() < 0.6 ? 'r' : 'c'; for (i = 0; i < cnt; i++) ps.push(mkPart(t, cx + i * 10 * k, cy, 1)); }
			else if (type === 'ic') ps.push(mkPart('so8', cx, cy, 0), mkPart('c', cx - 22 * k, cy, 1), mkPart('c', cx + 22 * k, cy, 1), mkPart('r', cx, cy + 26 * k, 0));
			else if (type === 'qfp') ps.push(mkPart('qfp', cx, cy, 0), mkPart('c', cx - 41 * k, cy - 10 * k, 1), mkPart('c', cx + 41 * k, cy + 10 * k, 1), mkPart('c8', cx + 8 * k, cy - 43 * k, 0));
			else ps.push(mkPart(['r', 'c', 'c8', 'sot'][M.floor(rnd() * 4)], cx, cy, rnd() < 0.5 ? 0 : 1));
			var bb = ps.reduce(function (a, p) { var b = p.bb, x0 = M.min(a.x, b.x), y0 = M.min(a.y, b.y); return { x: x0, y: y0, w: M.max(a.x + a.w, b.x + b.w) - x0, h: M.max(a.y + a.h, b.y + b.h) - y0 }; }, ps[0].bb);
			if (!fits(infl(bb, 8 * k))) return false;
			ps.forEach(function (p, n) {
				p.ref = (n === 0 || (type !== 'array' && rnd() < 0.3)) ? ({ r: 'R', c: 'C', c8: 'C', sot: 'Q', so8: 'U', qfp: 'U' })[p.t] + (21 + refN++) : null;
				PART.push(p);
			});
			occ.push(infl(bb, 6 * k)); return true;
		}
		TILES_R.forEach(function (cell) {
			var plan = mob ? [['b', 2], ['ic', 1], ['array', 1], ['one', 3]] : [['b', 4], ['qfp', 1], ['ic', 2], ['array', 2], ['one', 5]];
			plan.forEach(function (pl) {
				for (var got = 0, t = 0; got < pl[1] && t < 50; t++) if (pl[0] === 'b' ? bundle(cell) : cluster(pl[0], cell)) got++;
			});
		});
		var st = (mob ? 26 : 30) * k;
		for (y = BX[2] + st; y < BX[3] - st; y += st) for (x = BX[0] + st; x < BX[1] - st; x += st) {
			var xx = x + (M.round(y / st) % 2 ? st / 2 : 0);
			if (vnoise(xx / (200 * k), y / (200 * k)) < 0.7) continue;
			var vb = { x: xx - 5 * k, y: y - 5 * k, w: 10 * k, h: 10 * k };
			if (fits(vb)) VIA.push({ x: xx, y: y, r: 2.4 * k, st: 1 });
		}
	}

	/* 基础元件绘制 */
	function rr(g, x, y, w, h, r) {
		if (w <= 0 || h <= 0) { g.beginPath(); return; }
		r = M.max(0, M.min(r, w / 2, h / 2));
		g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
		g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
	}
	function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, M.max(0.1, r), 0, M.PI * 2); }
	function poly(g, p) { g.beginPath(); g.moveTo(p[0].x, p[0].y); for (var i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y); }
	function line(g, x0, y0, x1, y1) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
	function txt(g, s, x, y, sz, col) { g.font = '500 ' + (sz || 8 * k).toFixed(1) + 'px "Geist Mono", ui-monospace, monospace'; g.fillStyle = col || CO.silkD; g.fillText(s, x, y); }
	function gold(g, x, y, r) {
		var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
		cs(gr, [0, '#f2da93', 0.6, '#c9a24c', 1, '#94722b']); g.fillStyle = gr; circ(g, x, y, r); g.fill();
	}
	function goldRect(g, x, y, w, h) {
		var gr = g.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
		cs(gr, [0, '#efd58b', 0.55, '#c49d48', 1, '#94722b']); g.fillStyle = gr; rr(g, x - w / 2, y - h / 2, w, h, 1.2 * k); g.fill();
	}
	function solderRect(g, x, y, w, h) {
		var gr = g.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
		cs(gr, [0, '#f1f3f4', 0.45, '#adb4ba', 1, '#646d75']); g.fillStyle = gr; rr(g, x - w / 2, y - h / 2, w, h, M.min(w, h) * 0.32); g.fill();
		g.fillStyle = 'rgba(255,255,255,0.52)'; rr(g, x - w * 0.36, y - h * 0.36, w * 0.24, h * 0.55, w * 0.1); g.fill();
	}
	function clear(g, x, y, w, h) { g.fillStyle = CO.sub; g.fillRect(x - w / 2, y - h / 2, w, h); }
	function smd(g, t, x, y, vert, die) {
		var L = (t === 'c8' ? 19 : t === 'led' ? 14 : 15) * k, Wd = (t === 'c8' ? 10 : t === 'led' ? 8 : 7.5) * k, pl = L * 0.3;
		g.save(); g.translate(x, y); if (vert) g.rotate(M.PI / 2);
		clear(g, 0, 0, L + 4 * k, Wd + 5 * k);
		solderRect(g, -L / 2 + pl / 2, 0, pl * 1.08, Wd * 1.16); solderRect(g, L / 2 - pl / 2, 0, pl * 1.08, Wd * 1.16);
		var bw = L * 0.62, gr = g.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
		if (t === 'r') cs(gr, [0, '#2a2b2c', 0.5, '#141515', 1, '#0c0c0d']);
		else if (t === 'led') cs(gr, [0, '#fbf6e6', 0.6, '#e6dec4', 1, '#bdb498']);
		else cs(gr, [0, '#cdb084', 0.5, '#a88a5e', 1, '#7a6242']);
		g.fillStyle = gr; g.fillRect(-bw / 2, -Wd / 2, bw, Wd);
		g.fillStyle = 'rgba(205,210,214,0.9)'; g.fillRect(-L / 2 + pl * 0.45, -Wd / 2, pl * 0.5, Wd); g.fillRect(L / 2 - pl * 0.95, -Wd / 2, pl * 0.5, Wd);
		if (die) { g.fillStyle = die; g.fillRect(-1.6 * k, -1.6 * k, 3.2 * k, 3.2 * k); }
		g.restore();
	}
	function part(g, p) {
		var t = p.t, i, gr;
		if (t === 'r' || t === 'c' || t === 'c8') { smd(g, t, p.x, p.y, !!p.o); if (p.ref) txt(g, p.ref, p.bb.x, p.bb.y + 7 * k, 7 * k); return; }
		g.save(); g.translate(p.x, p.y); if (p.o) g.rotate(M.PI / 2);
		if (t === 'sot') {
			clear(g, 0, 0, 16 * k, 20 * k);
			[[-3.8, 6], [3.8, 6], [0, -6]].forEach(function (q) { solderRect(g, q[0] * k, q[1] * k, 3.6 * k, 4.8 * k); });
			g.fillStyle = '#161717'; g.fillRect(-6 * k, -3.4 * k, 12 * k, 6.8 * k);
		} else if (t === 'so8') {
			clear(g, 0, 0, 25 * k, 29 * k);
			for (i = 0; i < 4; i++) [-1, 1].forEach(function (s) { solderRect(g, (-5.7 + i * 3.8) * k, s * 11 * k, 2.4 * k, 5.6 * k); });
			gr = g.createLinearGradient(0, -7.5 * k, 0, 7.5 * k); cs(gr, [0, '#262728', 1, '#0e0f0f']); g.fillStyle = gr; g.fillRect(-10 * k, -7.5 * k, 20 * k, 15 * k);
			g.fillStyle = '#0a0a0a'; circ(g, -7 * k, 4.5 * k, 1.1 * k); g.fill();
		} else if (t === 'qfp') {
			var S = 32 * k, pitch = 3.5 * k;
			clear(g, 0, 0, S + 22 * k, S + 22 * k);
			for (i = 0; i < 8; i++) {
				var o = (i - 3.5) * pitch;
				solderRect(g, o, -S / 2 - 5 * k, 1.9 * k, 6 * k); solderRect(g, o, S / 2 + 5 * k, 1.9 * k, 6 * k);
				solderRect(g, -S / 2 - 5 * k, o, 6 * k, 1.9 * k); solderRect(g, S / 2 + 5 * k, o, 6 * k, 1.9 * k);
			}
			gr = g.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2); cs(gr, [0, '#26282a', 1, '#0d0e0f']); g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
			g.fillStyle = '#090909'; circ(g, -S / 2 + 4.5 * k, -S / 2 + 4.5 * k, 1.6 * k); g.fill();
		}
		g.restore();
		if (p.ref) txt(g, p.ref, p.bb.x, p.bb.y + 7 * k, 7 * k);
	}

	/* 五拍专属硬件静态底图 */
	var REF1 = ['RN1', 'C4', 'L2', 'Y1', 'U3'];
	function drawSmdTarget(g, s0) {
		var cx = s0.cx, cy = s0.cy, q = k * (mob ? 0.95 : 1.15), gr;
		s0.pads.forEach(function (pd) {
			clear(g, pd.x, pd.y, pd.w + 3.4 * k, pd.h + 3.4 * k);
			goldRect(g, pd.x, pd.y, pd.w, pd.h);
			var ox = !vertP ? pd.x : cx + 14 * k, oy = !vertP ? cy - 12 * k : pd.y;
			clear(g, ox, oy, pd.w + 3 * k, pd.h + 3 * k);
			solderRect(g, ox, oy, pd.w * 0.96, pd.h * 0.96);
		});
		var bw = (!vertP ? 34 : 22) * q, bh = (!vertP ? 17 : 24) * q;
		if (s0.kind === 'rnet') {
			gr = g.createLinearGradient(cx, cy - bh / 2, cx, cy + bh / 2); cs(gr, [0, '#2b2e30', 1, '#121415']);
			g.fillStyle = gr; rr(g, cx - bw / 2, cy - bh / 2, bw, bh, 2 * k); g.fill();
			txt(g, '103', cx - 7 * q, cy + 3 * q, 7.5 * q, 'rgba(235,235,230,0.75)');
		} else if (s0.kind === 'tant') {
			gr = g.createLinearGradient(cx, cy - bh / 2, cx, cy + bh / 2); cs(gr, [0, '#e6b84c', 0.6, '#c9932c', 1, '#966918']);
			g.fillStyle = gr; rr(g, cx - bw / 2, cy - bh / 2, bw, bh, 2.2 * k); g.fill();
			g.fillStyle = '#6e4219'; g.fillRect(cx - bw / 2 + 2 * k, cy - bh / 2 + 1 * k, 4.5 * q, bh - 2 * k);
			txt(g, '106C', cx - 4 * q, cy + 3 * q, 7 * q, '#4a2c0f');
		} else if (s0.kind === 'ind') {
			bw = bh = 22 * q;
			gr = g.createLinearGradient(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2); cs(gr, [0, '#3a3e42', 0.5, '#222528', 1, '#141618']);
			g.fillStyle = gr; rr(g, cx - bw / 2, cy - bh / 2, bw, bh, 3 * k); g.fill();
			g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; circ(g, cx, cy, bw * 0.38); g.stroke();
			txt(g, '4R7', cx - 7 * q, cy + 3 * q, 7 * q, 'rgba(235,235,230,0.75)');
		} else if (s0.kind === 'xtal4') {
			gr = g.createLinearGradient(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2); cs(gr, [0, '#f2f4f6', 0.48, '#b8c0c7', 1, '#7d868e']);
			g.fillStyle = gr; rr(g, cx - bw / 2, cy - bh / 2, bw, bh, 2.6 * k); g.fill();
			g.strokeStyle = '#c9a24c'; g.lineWidth = 1.1 * k; rr(g, cx - bw / 2 + 1.5 * k, cy - bh / 2 + 1.5 * k, bw - 3 * k, bh - 3 * k, 2 * k); g.stroke();
			txt(g, '24M0', cx - 9 * q, cy + 2.8 * q, 6.8 * q, '#2a3035');
		} else {
			gr = g.createLinearGradient(cx, cy - bh / 2, cx, cy + bh / 2); cs(gr, [0, '#26282a', 1, '#0e1011']);
			g.fillStyle = gr; rr(g, cx - bw * 0.44, cy - bh / 2, bw * 0.88, bh, 2 * k); g.fill();
			g.fillStyle = '#c9cec7'; circ(g, cx - bw * 0.3, cy + bh * 0.25, 1.4 * k); g.fill();
		}
		smd(g, 'led', s0.lex, cy, vertP, '#e2a24a');
		txt(g, REF1[s0.idx] || 'U9', cx - bw / 2, cy - bh / 2 - 5 * k, 7.5 * k);
	}

	function drawSocket(g, ch) {
		var q = ch.q, sx = q.x - 3 * k, sy = q.y - 10 * k, sw = q.w + 6 * k, sh = q.h + 20 * k, pr = 3.2 * k;
		g.fillStyle = 'rgba(0,0,0,0.42)'; rr(g, sx + 2 * k, sy + 4 * k, sw, sh, 3.5 * k); g.fill();
		var gr = g.createLinearGradient(sx, sy, sx, sy + sh); cs(gr, [0, '#262a28', 0.5, '#171a19', 1, '#0f1211']);
		g.fillStyle = gr; rr(g, sx, sy, sw, sh, 3.5 * k); g.fill();
		g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.stroke();
		var cw = sw * 0.68, ch2 = sh * 0.48, cx0 = sx + (sw - cw) / 2, cy0 = sy + (sh - ch2) / 2;
		g.fillStyle = CO.pour; rr(g, cx0, cy0, cw, ch2, 2.5 * k); g.fill();
		g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2 * k; g.stroke();
		smd(g, 'c', sx + sw / 2, sy + sh / 2, false);
		g.fillStyle = '#090b0b'; g.beginPath(); g.arc(sx + 1.5 * k, sy + sh / 2, 6 * k, -M.PI / 2, M.PI / 2); g.fill();
		ch.pins.forEach(function (px) {
			[sy + 5.2 * k, sy + sh - 5.2 * k].forEach(function (py) {
				gold(g, px, py, pr);
				g.fillStyle = '#050807'; circ(g, px, py, pr * 0.54); g.fill();
			});
		});
		txt(g, 'U' + (11 + ch.idx) + ' · SOCKET', sx + 2 * k, sy + sh + 11 * k, 7.5 * k);
	}

	function drawSubDisplay(g) {
		var D = RIB.D, jx = RIB.jx, jy = RIB.jy, jw = RIB.jw, jh = RIB.jh;
		g.fillStyle = 'rgba(0,0,0,0.38)'; rr(g, D.x + 3 * k, D.y + 6 * k, D.w, D.h, 6 * k); g.fill();
		var gr = g.createLinearGradient(D.x, D.y, D.x + D.w, D.y + D.h); cs(gr, [0, '#1e2327', 1, '#101315']);
		g.fillStyle = gr; rr(g, D.x, D.y, D.w, D.h, 6 * k); g.fill();
		g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.stroke();
		var ins = 7.5 * k;
		[[D.x + ins, D.y + ins], [D.x + D.w - ins, D.y + ins], [D.x + ins, D.y + D.h - ins], [D.x + D.w - ins, D.y + D.h - ins]].forEach(function (p) {
			gold(g, p[0], p[1], 3.8 * k); g.fillStyle = '#050606'; circ(g, p[0], p[1], 2.1 * k); g.fill();
		});
		clear(g, jx + jw / 2, jy, jw + 8 * k, jh + 12 * k);
		for (var i = 0; i < 10; i++) {
			var py = jy - jh * 0.4 + i * (jh * 0.8 / 9);
			solderRect(g, jx - 2 * k, py, 6 * k, 2.5 * k);
		}
		g.fillStyle = '#191d20'; rr(g, jx, jy - jh / 2, jw, jh, 2 * k); g.fill();
		g.fillStyle = '#090b0c'; g.fillRect(jx + 3 * k, jy - jh * 0.43, jw - 3 * k, jh * 0.86);
		for (i = 0; i < 10; i++) {
			py = jy - jh * 0.38 + i * (jh * 0.76 / 9);
			g.fillStyle = '#e5c36b'; g.fillRect(jx + 4 * k, py - 1 * k, jw * 0.65, 2 * k);
		}
		txt(g, 'J3', jx, jy - jh / 2 - 8 * k, 8 * k);
	}

	function drawMainTermStatic(g) {
		var T0 = TM.r, sr = SW.r, i;
		for (i = 0; i < 10; i++) {
			var fx = T0.x + T0.w * 0.46 + i * 11 * k;
			clear(g, fx, T0.y - 5 * k, 7 * k, 12 * k); goldRect(g, fx, T0.y - 5 * k, 5.2 * k, 10 * k);
		}
		for (i = 0; i < 6; i++) {
			var fy = T0.y + T0.h * 0.36 + i * 11 * k;
			clear(g, T0.x - 5 * k, fy, 12 * k, 7 * k); goldRect(g, T0.x - 5 * k, fy, 10 * k, 5.2 * k);
		}
		[SW.inP, SW.outP].forEach(function (p) { clear(g, p.x, p.y, 16 * k, 12 * k); solderRect(g, p.x, p.y, 13 * k, 9 * k); });
		txt(g, 'SW1', sr.x, sr.y - 8 * k, 8.5 * k);
		txt(g, 'OLED1 · ZHI-HMI', T0.x + 8 * k, T0.y - 8 * k, 8.5 * k);
	}

	function drawPowerAndHub(g) {
		var P = PW, u = P.u1, H0 = HUB;
		if (P.usb) {
			var w = 36 * k, h = 26 * k, y = mrg - 3 * k, i;
			for (i = 0; i < 12; i++) solderRect(g, u.x - 13.2 * k + i * 2.4 * k, y + h + 3.4 * k, 1.5 * k, 4.8 * k);
			var gr = g.createLinearGradient(u.x - w / 2, 0, u.x + w / 2, 0);
			cs(gr, [0, '#858c92', 0.16, '#e4e7e9', 0.5, '#b1b7bc', 0.84, '#e7e9eb', 1, '#848b91']);
			g.fillStyle = gr; rr(g, u.x - w / 2, y, w, h, 3 * k); g.fill();
			txt(g, 'J1 · USB-C', u.x + w / 2 + 8 * k, y + h + 4 * k);
		} else {
			var jx = P.inp.x, jy = P.inp.y;
			solderRect(g, jx - 2.6 * k, jy + 8 * k, 3 * k, 5 * k); solderRect(g, jx + 2.6 * k, jy + 8 * k, 3 * k, 5 * k);
			g.fillStyle = '#e6dfd0'; rr(g, jx - 9 * k, jy - 7 * k, 18 * k, 13 * k, 1.5 * k); g.fill();
			txt(g, 'J1', jx - 9 * k, jy - 10 * k);
		}
		clear(g, u.x, u.y, 34 * k, 40 * k);
		solderRect(g, u.x, u.y - 10 * k, 21 * k, 8 * k);
		[-1, 0, 1].forEach(function (s) { solderRect(g, u.x + s * 8 * k, u.y + 11.5 * k, 4.8 * k, 7.5 * k); });
		g.fillStyle = '#1d1f20'; g.fillRect(u.x - 13 * k, u.y - 7 * k, 26 * k, 14 * k);
		smd(g, 'c', P.c1.x, P.c1.y, true); smd(g, 'c', P.c2.x, P.c2.y, true);
		smd(g, 'r', P.r1.x, P.r1.y, false); smd(g, 'led', P.d1.x, P.d1.y, false, '#6fcf8a');
		gold(g, P.j0.x, P.j0.y, 7 * k); solderRect(g, P.j0.x, P.j0.y, 10 * k, 10 * k);
		txt(g, 'U1', u.x + 16 * k, u.y - 10 * k); txt(g, 'D1', P.d1.x - 6 * k, P.d1.y - 9 * k);

		var bx = H0.box;
		g.strokeStyle = CO.silkD; g.lineWidth = 1.2 * k; rr(g, bx.x, bx.y, bx.w, bx.h, 5 * k); g.stroke();
		clear(g, H0.f1.x, H0.f1.y, 34 * k, 16 * k);
		goldRect(g, H0.f1.x - 11 * k, H0.f1.y, 7 * k, 11 * k); goldRect(g, H0.f1.x + 11 * k, H0.f1.y, 7 * k, 11 * k);
		g.fillStyle = '#f2efe6'; g.fillRect(H0.f1.x - 8 * k, H0.f1.y - 4.5 * k, 16 * k, 9 * k);
		txt(g, 'F1 · 5V', H0.f1.x - 14 * k, H0.f1.y - 10 * k, 7.5 * k);
		clear(g, H0.l1.x, H0.l1.y, 38 * k, 38 * k);
		solderRect(g, H0.l1.x - 15 * k, H0.l1.y, 7 * k, 22 * k); solderRect(g, H0.l1.x + 15 * k, H0.l1.y, 7 * k, 22 * k);
		g.fillStyle = '#25282b'; rr(g, H0.l1.x - 14 * k, H0.l1.y - 14 * k, 28 * k, 28 * k, 4 * k); g.fill();
		txt(g, '100', H0.l1.x - 7 * k, H0.l1.y + 3 * k, 8.5 * k, CO.silk);
		[H0.c10, H0.c11].forEach(function (cp, idx) {
			var cr = 16 * k;
			clear(g, cp.x, cp.y, cr * 2.4, cr * 2.4);
			g.fillStyle = '#222629'; rr(g, cp.x - cr, cp.y - cr, cr * 2, cr * 2, 3 * k); g.fill();
			var gr2 = g.createRadialGradient(cp.x - cr * 0.25, cp.y - cr * 0.25, 1, cp.x, cp.y, cr * 0.85);
			cs(gr2, [0, '#f0f3f5', 0.65, '#adb5bc', 1, '#717980']); g.fillStyle = gr2; circ(g, cp.x, cp.y, cr * 0.84); g.fill();
			g.fillStyle = '#181a1c'; g.beginPath(); g.arc(cp.x, cp.y, cr * 0.84, -0.7, 0.7); g.closePath(); g.fill();
			txt(g, 'C1' + idx, cp.x - 8 * k, cp.y + cr + 10 * k, 7.5 * k);
		});
		g.font = '900 ' + (13 * k).toFixed(1) + 'px "SHU Serif", serif'; g.fillStyle = CO.silk;
		g.fillText('上海大学人工智能社 · 主控载板', bx.x + 14 * k, bx.y + bx.h - 24 * k);
		txt(g, 'SHU-AICLUB REV 2.0 · XIANGYING T406', bx.x + 14 * k, bx.y + bx.h - 10 * k, 7.8 * k);
	}

	/* 静态底板按区块切瓦片 + 全览缩略缓存 */
	function drawStatic(g, rx0, ry0, rx1, ry1) {
		var bx = mrg, by = mrg, bw = boardW - 2 * mrg, bh = boardH - 2 * mrg, rad = 14 * k, pi = 7 * k;
		g.fillStyle = CO.bench; g.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
		g.save(); rr(g, bx, by, bw, bh, rad); g.clip();
		g.fillStyle = CO.sub; g.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
		rr(g, bx + pi, by + pi, bw - 2 * pi, bh - 2 * pi, rad * 0.65); g.fillStyle = CO.pour; g.fill();
		g.fillStyle = noisePat; g.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);

		var vis = TRall.filter(function (t) { return t.x1 >= rx0 - 24 && t.x0 <= rx1 + 24 && t.y1 >= ry0 - 24 && t.y0 <= ry1 + 24; });
		g.lineCap = 'round'; g.lineJoin = 'round';
		g.strokeStyle = CO.sub; vis.forEach(function (t) { g.lineWidth = t.w + 4.6 * k; poly(g, t.p); g.stroke(); });
		g.strokeStyle = CO.cu; vis.forEach(function (t) { g.lineWidth = t.w; poly(g, t.p); g.stroke(); });
		g.save(); g.translate(-0.45, -0.55); g.strokeStyle = CO.cuHi;
		vis.forEach(function (t) { g.lineWidth = M.max(0.7, t.w * 0.35); poly(g, t.p); g.stroke(); }); g.restore();

		VIA.forEach(function (v) {
			if (v.x < rx0 - 10 || v.x > rx1 + 10 || v.y < ry0 - 10 || v.y > ry1 + 10) return;
			if (!v.st) { g.fillStyle = CO.sub; circ(g, v.x, v.y, v.r + 2 * k); g.fill(); }
			g.fillStyle = v.st ? '#1b5640' : '#215f47'; circ(g, v.x, v.y, v.r); g.fill();
			g.fillStyle = '#06150f'; circ(g, v.x, v.y, v.r * 0.46); g.fill();
		});
		TPM.forEach(function (t) {
			if (t.x < rx0 - 60 || t.x > rx1 + 30 || t.y < ry0 - 30 || t.y > ry1 + 30) return;
			g.fillStyle = CO.sub; circ(g, t.x, t.y, 7 * k); g.fill(); gold(g, t.x, t.y, 4.4 * k);
			g.strokeStyle = CO.silkD; g.lineWidth = 1; circ(g, t.x, t.y, 8.6 * k); g.stroke();
			txt(g, 'TP' + t.n, t.x + 14 * k, t.y + 3.2 * k, 9.5 * k);
		});
		FID.forEach(function (f) { g.fillStyle = CO.sub; circ(g, f.x, f.y, 6.5 * k); g.fill(); gold(g, f.x, f.y, 3 * k); });
		PART.forEach(function (p) {
			if (p.bb.x + p.bb.w > rx0 - 20 && p.bb.x < rx1 + 20 && p.bb.y + p.bb.h > ry0 - 20 && p.bb.y < ry1 + 20) part(g, p);
		});

		SMDS.forEach(function (s0) {
			if (s0.r.x + s0.r.w > rx0 - 40 && s0.r.x < rx1 + 40 && s0.r.y + s0.r.h > ry0 - 40 && s0.r.y < ry1 + 40) drawSmdTarget(g, s0);
		});
		CHIPS.forEach(function (ch) {
			if (ch.q.x + ch.q.w > rx0 - 40 && ch.q.x < rx1 + 40 && ch.q.y + ch.q.h > ry0 - 40 && ch.q.y < ry1 + 40) drawSocket(g, ch);
		});
		if (RIB.D.x + RIB.D.w + 60 > rx0 && RIB.D.x - 20 < rx1 && RIB.D.y + RIB.D.h + 30 > ry0 && RIB.D.y - 30 < ry1) drawSubDisplay(g);
		if (TM.r.x + TM.r.w + 30 > rx0 && SW.r.x - 40 < rx1 && TM.r.y + TM.r.h + 30 > ry0 && TM.r.y - 30 < ry1) drawMainTermStatic(g);
		if (silkLogo && logoRect && logoRect.x + logoRect.w > rx0 && logoRect.x < rx1 && logoRect.y + logoRect.h > ry0 && logoRect.y < ry1) {
			g.globalAlpha = 0.92; g.drawImage(silkLogo, logoRect.x, logoRect.y, logoRect.w, logoRect.h); g.globalAlpha = 1;
		}
		drawPowerAndHub(g);
		g.restore();

		MH.forEach(function (h) {
			if (h.x < rx0 - 40 || h.x > rx1 + 40 || h.y < ry0 - 40 || h.y > ry1 + 40) return;
			g.fillStyle = CO.sub; circ(g, h.x, h.y, h.r * 1.95); g.fill();
			gold(g, h.x, h.y, h.r * 1.45);
			for (var i = 0; i < 8; i++) { var an = i * M.PI / 4; g.fillStyle = '#5c4718'; circ(g, h.x + M.cos(an) * h.r * 1.2, h.y + M.sin(an) * h.r * 1.2, h.r * 0.12); g.fill(); }
			g.fillStyle = CO.bench; circ(g, h.x, h.y, h.r); g.fill();
		});
		rr(g, bx + 0.5, by + 0.5, bw - 1, bh - 1, rad); g.strokeStyle = 'rgba(205,222,180,0.18)'; g.lineWidth = 1.2; g.stroke();
	}

	function buildTile(i) {
		var r = TILES_R[i], c = d.createElement('canvas');
		c.width = M.max(1, M.round(r.w * dpr)); c.height = M.max(1, M.round(r.h * dpr));
		var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -r.x * dpr, -r.y * dpr);
		drawStatic(g, r.x, r.y, r.x + r.w, r.y + r.h);
		return c;
	}
	function tile(i) { return tiles[i] || (tiles[i] = buildTile(i)); }
	function getBoardLo() {
		if (boardLo) return boardLo;
		var sc = M.min(0.55, ovScale * dpr * 1.2), c = d.createElement('canvas');
		c.width = M.max(1, M.round(boardW * sc)); c.height = M.max(1, M.round(boardH * sc));
		var g = c.getContext('2d'); g.setTransform(sc, 0, 0, sc, 0, 0);
		drawStatic(g, 0, 0, boardW, boardH);
		boardLo = c; return c;
	}
	function dropTiles() {
		for (var key in tiles) tiles[key].width = 0;
		tiles = {};
		if (boardLo) { boardLo.width = 0; boardLo = null; }
	}
	function prefetch() {
		if (tileQ) return;
		var want = [];
		for (var i = 0; i < TILES_R.length; i++) if (!tiles[i]) want.push(i);
		if (want.length) tileQ = setTimeout(function () { tileQ = 0; if (!tiles[want[0]]) tiles[want[0]] = buildTile(want[0]); }, 60);
		else if (!boardLo) tileQ = setTimeout(function () { tileQ = 0; getBoardLo(); }, 90);
	}

	function makeNoise() {
		var c = d.createElement('canvas'); c.width = c.height = 128;
		var x = c.getContext('2d'), id = x.createImageData(128, 128), p = id.data, r = rng(7);
		for (var i = 0; i < p.length; i += 4) { var v = r(); p[i] = p[i + 1] = p[i + 2] = v > 0.5 ? 255 : 0; p[i + 3] = M.abs(v - 0.5) * 40; }
		x.putImageData(id, 0, 0); return gB.createPattern(c, 'repeat');
	}
	function makeDot() {
		var c = d.createElement('canvas'); c.width = c.height = 64;
		var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
		cs(gr, [0, 'rgba(232,238,234,1)', 0.5, 'rgba(232,238,234,0.35)', 1, 'rgba(232,238,234,0)']); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
	}
	function makeSilk(img) {
		var n = M.round(M.max(64, (logoRect ? logoRect.w : 90) * dpr * 1.5)), c = d.createElement('canvas'); c.width = c.height = n;
		var x = c.getContext('2d'); x.drawImage(img, 0, 0, n, n);
		var id = x.getImageData(0, 0, n, n), p = id.data;
		for (var i = 0; i < p.length; i += 4) {
			var l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
			p[i + 3] = clamp((86 - l) / 30, 0, 1) * 235; p[i] = 238; p[i + 1] = 236; p[i + 2] = 227;
		}
		x.putImageData(id, 0, 0); return c;
	}

	/* 时间线：每拍 40% 动作 → 45% 停住可读 → 15% 过渡；第 4 拍（合闸通电）给足篇幅 */
	function timeline() {
		var u = H, s = 0;
		beats = [];
		var b0 = { start: 0, aEnd: 0, rStart: 0, rEnd: 0.08 * u + sts[0].extra, end: 0 };
		b0.end = b0.rEnd + 0.24 * u;
		beats.push(b0); s = b0.end;

		var lens = [0, 1.75 * u, 2.05 * u, 1.95 * u, 3.1 * u];
		for (var b = 1; b < 5; b++) {
			var L = lens[b] + sts[b].extra, A = (b === 4 ? 0.5 : 0.4) * L, Rl = (b === 4 ? 0.36 : 0.45) * L + sts[b].extra * 0.55, T = b < 4 ? 0.15 * L : 0;
			var B = { start: s, aEnd: s + A, rStart: s + A, rEnd: s + A + Rl, end: s + A + Rl + T };
			beats.push(B); s = B.end;
		}
		total = s;
	}
	function actU(b, s) { return seg(s, beats[b].start, beats[b].aEnd); }
	function readPos(b) { var B = beats[b]; return b === 0 ? 0 : B.rStart + 0.12 * (B.rEnd - B.rStart); }

	/* 各拍内部动作曲线（全可逆，只由滚动位置决定）
	   ① 拖焊：一笔连续长拖，镜头推近跟拍
	   ② 插件 + 点焊：芯片依次砸进插座，烙铁逐颗跳点补焊（断奏）
	   ③ 插排线 + 测通断：斜机位跟着排线滑入，锁扣咔哒，万用表表笔确认导通，副屏开机
	   ④ 合闸：特写拨开关 → 急速拉远俯瞰全板 → 电流跑完五段、各模块依次活过来 → 全板泛光 → 推进主屏，小智醒来 */
	function dragU(s) { return seg(actU(1, s), 0.16, 0.88); }
	function smdM(idx, s) { var d = dragU(s), t0 = idx / 5 * 0.78; return seg(d, t0, t0 + 0.22); }

	var TP0 = 0.52, TD = 0.08;
	function chipM(idx, s) { return seg(actU(2, s), 0.08 + idx * 0.055, 0.28 + idx * 0.055); }
	function tapM(idx, s) { return seg(seg(actU(2, s), TP0 + idx * TD, TP0 + (idx + 1) * TD), 0.42, 0.8); }
	function seatCurve(m) {
		if (m <= 0) return 0;
		if (m < 0.56) return 0.86 * sm(m / 0.56);
		if (m < 0.66) return 0.86 + 0.03 * ((m - 0.56) / 0.1);
		return 0.89 + 0.11 * sm(seg(m, 0.66, 0.78));
	}

	function ribInsert(s) {
		var u = actU(3, s);
		if (u < 0.5) return 0.88 * sm(seg(u, 0.12, 0.5));
		return 0.88 + 0.12 * sm(seg(u, 0.5, 0.6));
	}
	function probeU(s) { return seg(actU(3, s), 0.6, 0.86); }
	function ribLit(s) { return sm(seg(actU(3, s), 0.74, 0.97)); }

	function swFlip(s) { return sm(seg(actU(4, s), 0.12, 0.19)); }
	function powerWave(s, now) {
		if (surgeT0 > 0 && now - surgeT0 < 1500 && s >= beats[4].aEnd - 2) return 5 * sm((now - surgeT0) / 1350);
		return 5 * seg(actU(4, s), 0.2, 0.56);
	}
	function zhiWake(s) { return seg(actU(4, s), 0.78, 0.98); }

	/* 镜头：中心 + 缩放 + 机位侧倾（rot），每拍运镜方式不同 */
	function C0(cx, cy, sc, rot) { return { cx: cx, cy: cy, sc: sc, rot: rot || 0 }; }
	function stStartCam(b) { return C0(sts[b].x + W / 2, sts[b].y + H / 2, 1, 0); }
	function stEndCam(b) { return C0(sts[b].x + W / 2, sts[b].y + sts[b].extra + H / 2, 1, 0); }
	function lerpCam(A, B, t) {
		return { cx: lerp(A.cx, B.cx, t), cy: lerp(A.cy, B.cy, t), sc: M.exp(lerp(M.log(A.sc), M.log(B.sc), t)), rot: lerp(A.rot || 0, B.rot || 0, t) };
	}
	function easeOut3(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); }
	function camMat(c) {
		var a = M.cos(c.rot) * c.sc, b = M.sin(c.rot) * c.sc;
		return { a: a, b: b, c: -b, d: a, e: W / 2 - (a * c.cx - b * c.cy), f: H / 2 - (b * c.cx + a * c.cy), sc: c.sc, rot: c.rot };
	}
	function toS(m, x, y) { return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }
	function toW(m, X, Y) {
		var det = m.a * m.d - m.b * m.c, dx = X - m.e, dy = Y - m.f;
		return { x: (m.d * dx - m.c * dy) / det, y: (-m.b * dx + m.a * dy) / det };
	}

	function dragCam(dp) {
		var p = { x: lerp(DRAG.a.x, DRAG.b.x, dp), y: lerp(DRAG.a.y, DRAG.b.y, dp) }, s1 = sts[1];
		if (!vertP) return C0(lerp(s1.x + W / 2, p.x + 110 * k, 0.82), p.y + 58 * k, 1.42, -0.035);
		/* 竖排时镜头往左让一点，保证左侧整列文字留在画面里 */
		var vs = mob ? 1.1 : 1.3, vx = M.min(s1.x + W / 2 + (mob ? 6 : 16) * k, PROGX + (W / 2 - (mob ? 16 : 26)) / vs);
		return C0(vx, p.y + 24 * k, vs, 0.028);
	}
	function tapPt(i) { var q = CHIPS[i].q; return { x: q.x + q.w * 0.5, y: q.y + q.h + 4.8 * k }; }
	function tapCam(i) {
		var ch = CHIPS[i].q, st = sts[2];
		return C0(lerp(st.x + W / 2, ch.x + ch.w / 2, mob ? 0.15 : 0.5), lerp(st.y + H / 2, ch.y + ch.h / 2 + 24 * k, mob ? 0.75 : 0.45), mob ? 1.08 : 1.17, 0);
	}
	function ribCam(ins) {
		if (mob) return C0(RIB.D.x + RIB.D.w * 0.5 + 10 * k + (1 - ins) * RIB.travel * 0.22, RIB.jy + 14 * k, 1.12, -0.03);
		return C0(RIB.jx - 210 * k + (1 - ins) * RIB.travel * 0.14, RIB.jy + 14 * k, 1.3, -0.052);
	}
	function swCam() { return C0(SW.r.x + SW.r.w / 2 + (mob ? 70 : 118) * k, SW.r.y + SW.r.h / 2 + (mob ? 10 : 0) * k, mob ? 1.45 : 1.75, 0.04); }
	function ovCam() { return C0(boardW / 2, boardH / 2, ovScale, 0); }
	function entryCam(b) {
		if (b === 1) return dragCam(0);
		if (b === 2) { var c = stStartCam(2); c.sc = mob ? 0.95 : 0.9; c.cy -= 24 * k; return c; }
		if (b === 3) return ribCam(0);
		return swCam();
	}

	function camAt(s) {
		var b = 4; while (b > 0 && s < beats[b].start) b--;
		var B = beats[b], u = actU(b, s), i, c;
		if (b === 0) {
			if (s <= B.rEnd) return lerpCam(stStartCam(0), stEndCam(0), seg(s, 0, B.rEnd));
			return lerpCam(stEndCam(0), entryCam(1), 0.26 * sm(seg(s, B.rEnd, B.end)));
		}
		if (s >= B.aEnd) {
			if (s <= B.rEnd || b === 4) return lerpCam(stStartCam(b), stEndCam(b), seg(s, B.rStart, B.rEnd));
			return lerpCam(stEndCam(b), entryCam(b + 1), 0.26 * sm(seg(s, B.rEnd, B.end)));
		}
		var cIn = lerpCam(stEndCam(b - 1), entryCam(b), 0.26);
		if (b === 1) {
			if (u < 0.16) return lerpCam(cIn, dragCam(0), sm(u / 0.16));
			if (u < 0.88) return dragCam(dragU(s));
			return lerpCam(dragCam(1), stStartCam(1), sm(seg(u, 0.88, 1)));
		}
		if (b === 2) {
			if (u < 0.16) return lerpCam(cIn, entryCam(2), sm(u / 0.16));
			var thud = 0;
			for (i = 0; i < 5; i++) thud += bell(seg(chipM(i, s), 0.68, 0.82));
			if (u < TP0 - 0.06) { c = entryCam(2); c.cy += thud * 3.2 * k; return c; }
			if (u < TP0) { c = lerpCam(entryCam(2), tapCam(0), sm(seg(u, TP0 - 0.06, TP0))); c.cy += thud * 3.2 * k; return c; }
			if (u < TP0 + 5 * TD) {
				var f = (u - TP0) / TD, n = M.min(4, M.floor(f)), t = f - n;
				c = n === 0 ? tapCam(0) : lerpCam(tapCam(n - 1), tapCam(n), sm(seg(t, 0, 0.32)));
				c.cy += 1.8 * k * bell(seg(t, 0.36, 0.5));
				return c;
			}
			return lerpCam(tapCam(4), stStartCam(2), sm(seg(u, TP0 + 5 * TD, 1)));
		}
		if (b === 3) {
			if (u < 0.12) return lerpCam(cIn, ribCam(0), sm(u / 0.12));
			if (u < 0.62) { c = ribCam(ribInsert(s)); c.cx -= 3 * k * bell(seg(u, 0.5, 0.6)); c.rot += 0.012 * bell(seg(u, 0.5, 0.62)); return c; }
			var pc = ribCam(1); pc.rot = mob ? -0.02 : -0.03; pc.cy += 16 * k;
			/* 量完通断稍早拉回（0.76→0.9），给左侧文字留出完整显示的时间 */
			if (u < 0.76) return lerpCam(ribCam(1), pc, sm(seg(u, 0.62, 0.72)));
			return lerpCam(pc, stStartCam(3), sm(seg(u, 0.76, 0.9)));
		}
		var sw = swCam(), ov = ovCam();
		if (u < 0.1) return lerpCam(cIn, sw, sm(u / 0.1));
		if (u < 0.2) { c = C0(sw.cx, sw.cy, sw.sc, sw.rot); c.cy += 3 * k * bell(seg(u, 0.14, 0.2)); return c; }
		if (u < 0.34) return lerpCam(sw, ov, easeOut3(seg(u, 0.2, 0.34)));
		var ov2 = C0(ov.cx, ov.cy, ov.sc * 1.04, 0);
		if (u < 0.66) return lerpCam(ov, ov2, sm(seg(u, 0.34, 0.66)));
		if (u < 0.84) return lerpCam(ov2, stStartCam(4), sm(seg(u, 0.66, 0.84)));
		return stStartCam(4);
	}

	/* 烙铁轨迹：第 0 拍待命（锡珠反光 + 轻烟）→ 第 1 拍连续拖焊 → 退场 → 第 2 拍逐颗跳点补焊 → 退场 */
	var HIDE = { x: 0, y: 0, lift: 1, ang: A0, show: 0 };
	function ironAt(s) {
		var p0 = { x: PW.j0.x, y: PW.j0.y };
		if (s <= beats[0].rEnd) return { x: p0.x, y: p0.y, lift: 0.2, ang: A0, show: 1, idle: true };
		if (s < beats[1].start) {
			var t0 = sm(seg(s, beats[0].rEnd, beats[1].start));
			return { x: lerp(p0.x, DRAG.a.x, t0 * 0.45), y: lerp(p0.y, DRAG.a.y, t0 * 0.45), lift: 0.2 + 0.35 * M.sin(t0 * M.PI * 0.5), ang: A0, show: 1 };
		}
		if (s < beats[1].aEnd) {
			var u = actU(1, s), pMid = { x: lerp(p0.x, DRAG.a.x, 0.45), y: lerp(p0.y, DRAG.a.y, 0.45) };
			var dragAng = DRAG.vert ? A0 + 0.18 : A0 - 0.26;
			if (u < 0.16) {
				var e = sm(u / 0.16);
				return { x: lerp(pMid.x, DRAG.a.x, e), y: lerp(pMid.y, DRAG.a.y, e), lift: lerp(0.55, 0.03, e), ang: lerp(A0, dragAng, e), show: 1 };
			}
			if (u < 0.88) {
				var dd = dragU(s);
				return { x: lerp(DRAG.a.x, DRAG.b.x, dd), y: lerp(DRAG.a.y, DRAG.b.y, dd), lift: 0.02, ang: dragAng, show: 1, drag: true };
			}
			var ex = sm(seg(u, 0.88, 1));
			return { x: DRAG.b.x + ex * 130 * k, y: DRAG.b.y + ex * 80 * k, lift: 0.02 + 0.75 * ex, ang: lerp(dragAng, A0, ex), show: 1 - ex };
		}
		if (s >= beats[2].start && s < beats[2].aEnd) {
			var v = actU(2, s), tA = TP0 - 0.1, tE = TP0 + 5 * TD, off = { x: 210 * k, y: -160 * k };
			if (v < tA || v > tE + 0.07) return HIDE;
			if (v < TP0) {
				var q0 = tapPt(0), e1 = sm(seg(v, tA, TP0));
				return { x: q0.x + off.x * (1 - e1), y: q0.y + off.y * (1 - e1), lift: 0.5, ang: A0 + 0.08, show: e1 };
			}
			if (v > tE) {
				var q4 = tapPt(4), e2 = sm(seg(v, tE, tE + 0.07));
				return { x: q4.x + off.x * e2, y: q4.y + off.y * e2, lift: 0.5 + 0.3 * e2, ang: A0 + 0.08, show: 1 - e2 };
			}
			var f = (v - TP0) / TD, n = M.min(4, M.floor(f)), t = f - n, pa = tapPt(n > 0 ? n - 1 : 0), pb = tapPt(n);
			var mv = sm(seg(t, 0, 0.3));
			var lift = t < 0.3 ? 0.5 + 0.28 * bell(mv) : t < 0.42 ? lerp(0.5, 0.02, sm(seg(t, 0.3, 0.42))) : t < 0.8 ? 0.02 : lerp(0.02, 0.5, sm(seg(t, 0.8, 1)));
			return { x: lerp(pa.x, pb.x, mv), y: lerp(pa.y, pb.y, mv) - 10 * k * bell(mv), lift: lift, ang: A0 + 0.08, show: 1, tap: t >= 0.42 && t < 0.8 ? n + 1 : 0 };
		}
		return HIDE;
	}

	/* DOM 属性绑定 */
	function bind(el, f, kind, off) { if (el) binds.push({ el: el, f: f, kind: kind || 'r', off: !!off, v: -1 }); }
	function bindAll() {
		binds = [];
		bind($('#t1'), function (s) { return sm(seg(actU(1, s), 0.02, 0.24)); });
		$$('.prog', world).forEach(function (li, n) {
			bind($('h3', li), function (s) { return seg(smdM(n, s), 0.2, 0.85); });
			bind($('p', li), function (s) { return seg(smdM(n, s), 0.4, 1); });
		});
		bind($('#t2'), function (s) { return sm(seg(actU(2, s), 0.02, 0.22)); });
		bind($('#news-sub'), function (s) { return sm(seg(actU(2, s), 0.06, 0.26)); });
		$$('.chip', world).forEach(function (el, n) {
			bind(el, function (s) { return seatCurve(chipM(n, s)); }, 'seat');
			bind(el, function (s) { return sm(seg(tapM(n, s), 0.15, 1)); }, 'r', true);
			bind($('.glint', el), function (s) { return seg(tapM(n, s), 0.3, 1); }, 'glint');
		});
		bind($('#btn-all'), function (s) { return seg(actU(2, s), 0.9, 1); }, 'op', true);
		/* 第 3 站的字等镜头拉回、整段进了画面再写出来，到"停住可读"位置（readPos）时写完 */
		var q3 = function (s) { return seg(s, beats[3].start + 0.84 * (beats[3].aEnd - beats[3].start), readPos(3)); };
		bind($('#t3'), function (s) { return sm(seg(q3(s), 0, 0.4)); });
		$$('#lead-a .ink').forEach(function (el, n) { bind(el, function (s) { return seg(q3(s), 0.12 + n * 0.1, 0.5 + n * 0.1); }); });
		$$('#lead-b .ink').forEach(function (el, n) { bind(el, function (s) { return seg(q3(s), 0.4 + n * 0.1, 0.78 + n * 0.1); }); });
		bind($('#disp .glass'), ribLit, 'var:--rv');
		bind($('#disp-cap'), function (s) { return sm(seg(actU(3, s), 0.86, 1)); });
		/* 第 4 站标题在开关特写时不在画面里，改成镜头推回主屏时写出 */
		bind($('#t4'), function (s) { return sm(seg(actU(4, s), 0.76, 0.86)); });
		bind($('#s4 .jl'), function (s) { return sm(seg(actU(4, s), 0.8, 0.9)); });
		bind(swPanel, swFlip, 'sw');
		bind(world, function (s) { return sm(seg(actU(4, s), 0.55, 0.66)); }, 'var:--glow');
		var scr = $('#term-scr'), bl = $('.boot-line', scr);
		bind(scr, function (s) { return sm(seg(actU(4, s), 0.54, 0.64)); }, 'var:--on');
		bind(scr, function (s) { return sm(seg(actU(4, s), 0.8, 0.88)); }, 'var:--hi');
		bind(scr, function (s) { return sm(seg(actU(4, s), 0.85, 0.94)); }, 'var:--st');
		bind(scr, function (s) { return sm(seg(actU(4, s), 0.9, 1)); }, 'cta', true);
		bind(bl, function (s) { return bell(seg(actU(4, s), 0.54, 0.64)) + bell(seg(actU(4, s), 0.78, 0.86)); }, 'boot');
		VF.forEach(function (v) {
			var host = v.el.closest('.chip') || v.el;
			v.bd = null; v.v = -1;
			for (var i = 0; i < binds.length; i++) if (binds[i].el === host && (binds[i].kind === 'r' || binds[i].kind === 'op')) { v.bd = binds[i]; break; }
		});
	}

	/* 文字安全区：按当前镜头把每段字换算到屏幕上，离屏幕边（手机还要让开底部进度条，桌面让开右侧进度条）
	   不足一个缓冲带就按距离淡出，碰边即完全隐藏；顺便算出工序卡是否压住了正在显示的字 */
	function vfUpdate(m) {
		var sl = mob ? 6 : 14, st = 8, sr = W - sl, sb = H - 8, band = mob ? 10 : 22, occ = 0;
		if (mob && TPS) sb = M.min(sb, TPS.t - 2);
		if (!opR && opEl && opA > 0.01) {
			var oq = opEl.getBoundingClientRect(), sq = stage.getBoundingClientRect();
			opR = { l: oq.left - sq.left - 6, t: oq.top - sq.top - 6, r: oq.right - sq.left + 6, b: oq.bottom - sq.top + 6 };
		}
		for (var i = 0; i < VF.length; i++) {
			var v = VF[i], x0 = v.x, y0 = v.y, x1 = v.x + v.w, y1 = v.y + v.h;
			var ax0 = m.a * x0, ax1 = m.a * x1, bx0 = m.b * x0, bx1 = m.b * x1, cy0 = m.c * y0, cy1 = m.c * y1, dy0 = m.d * y0, dy1 = m.d * y1;
			var l = M.min(ax0 + cy0, ax1 + cy0, ax0 + cy1, ax1 + cy1) + m.e, r = M.max(ax0 + cy0, ax1 + cy0, ax0 + cy1, ax1 + cy1) + m.e;
			var t = M.min(bx0 + dy0, bx1 + dy0, bx0 + dy1, bx1 + dy1) + m.f, b = M.max(bx0 + dy0, bx1 + dy0, bx0 + dy1, bx1 + dy1) + m.f;
			var dd = M.min(l - sl, sr - r, t - st, sb - b);
			if (!mob && TPS && b > TPS.t - 10 && t < TPS.b + 10 && l < TPS.r) dd = M.min(dd, TPS.l - 10 - r);
			var f = dd >= band ? 1 : dd <= 0 ? 0 : sm(dd / band);
			f = M.round(f * 50) / 50;
			v.f = f;
			if (f !== v.v) { v.v = f; v.el.style.setProperty('--vf', f); v.el.classList.toggle('vf0', f < 0.35); }
			if (opR && f > 0.05) {
				var ov = M.min(r - opR.l, opR.r - l, b - opR.t, opR.b - t);
				if (ov > 0) occ = M.max(occ, M.min(1, ov / 14) * f * (v.bd ? M.max(0, v.bd.v) : 1));
			}
		}
		opOcc = occ;
	}

	/* 工序卡：告诉访客这一拍在做哪道工序 */
	var OPS = [
		['00', '烙铁预热 · 上锡', '待机电源已接通，往下滑开始焊'],
		['01', '拖焊', '一笔拖过五个贴片焊盘'],
		['02', '插件 · 点焊', '芯片压进插座，逐颗补焊'],
		['03', '插排线 · 测通断', '排线锁紧，万用表确认导通'],
		['04', '合闸 · 全板通电', '电流跑遍你焊好的每一段']
	];
	var opEl = $('#op'), opN = $('#op-n'), opT = $('#op-t'), opD = $('#op-d'), opB = -1, opA = -1, opTxt = '';
	function opUpdate(s) {
		if (!opEl) return;
		var b = 4; while (b > 0 && s < beats[b].start) b--;
		var u = actU(b, s), a = b === 0 ? 1 - sm(seg(s, beats[0].rEnd * 0.6, beats[0].end)) : sm(seg(u, 0, 0.06)) * (1 - sm(seg(u, 0.94, 1)));
		if (b === 4) a *= 1 - sm(seg(u, 0.7, 0.8));
		a *= 1 - opOcc;
		if (b !== opB) { opB = b; opN.textContent = '工序 ' + OPS[b][0]; opT.textContent = OPS[b][1]; opR = null; }
		var dTxt = OPS[b][2];
		if (b === 3) {
			var pu = probeU(s);
			if (pu > 0.28 && pu < 1) dTxt = pu < 0.42 ? '万用表 · 通断档  ‒‒‒‒ Ω' : '万用表 · 000.2 Ω  ✓ 导通';
		}
		if (dTxt !== opTxt) { opTxt = dTxt; opD.textContent = dTxt; opR = null; }
		a = M.round(a * 100) / 100;
		if (a !== opA) { opA = a; opEl.style.opacity = a; opEl.style.transform = 'translateY(' + ((1 - a) * 8).toFixed(1) + 'px)'; }
	}

	function applyBinds(s) {
		for (var i = 0; i < binds.length; i++) {
			var b = binds[i], v = M.round(b.f(s) * 1000) / 1000;
			if (v === b.v) continue;
			b.v = v;
			if (b.kind === 'r') b.el.style.setProperty('--r', v);
			else if (b.kind === 'seat') b.el.style.setProperty('--seat', v);
			else if (b.kind === 'op') b.el.style.setProperty('--op', v);
			else if (b.kind === 'sw') {
				b.el.style.setProperty('--sw', v);
				b.el.classList.toggle('on', v > 0.6);
				if (swBtn) swBtn.setAttribute('aria-pressed', v > 0.6 ? 'true' : 'false');
			} else if (b.kind.indexOf('var:') === 0) b.el.style.setProperty(b.kind.slice(4), v);
			else if (b.kind === 'cta') {
				b.el.style.setProperty('--cta', v);
				var wxB = $('#btn-wx'); if (wxB) wxB.classList.toggle('off', v < 0.5);
			} else if (b.kind === 'boot') {
				b.el.style.opacity = v.toFixed(3);
				b.el.style.transform = 'scaleY(' + (1 + v * 28).toFixed(1) + ')';
			} else {
				b.el.style.opacity = (0.95 * bell(v)).toFixed(3);
				b.el.style.transform = 'translateX(' + (v * (b.el.parentNode.clientWidth + 3)).toFixed(1) + 'px)';
			}
			if (b.off && b.kind !== 'cta') b.el.classList.toggle('off', v < 0.5);
		}
	}

	function tpUpdate(s, pw) {
		var c = 0; for (var b = 1; b < 5; b++) if (s >= beats[b].start - 0.5) c = b;
		if (c !== curB) {
			curB = c;
			tpBtns.forEach(function (el, i) { if (i === c) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
			if (tpNum) tpNum.textContent = (c + 1) + ' / 5';
		}
		tpBtns.forEach(function (el, i) { var dn = i === 0 || s >= beats[i].aEnd - 0.5; if (el._dn !== dn) { el._dn = dn; el.classList.toggle('done', dn); } });
		var th = [1.5, 2.5, 3.5, 4.7];
		railLis.forEach(function (li, i) { var on = pw >= th[i]; if (li._on !== on) { li._on = on; li.classList.toggle('lit', on); } });
	}

	/* 小智终端脸部绘制（匹配 zhi-flat / zhi-expressions 像素面罩） */
	function drawZhi(wake, now) {
		if (!gZ || !cvZ) return false;
		var cw = cvZ.width, ch = cvZ.height, g = gZ;
		g.clearRect(0, 0, cw, ch);
		if (wake <= 0.01) return false;

		var cheer = now - cheerT0 < 1700, greet = now - greetT0 < 1250;
		var busy = cheer || greet;
		var cx = cw * 0.5, cy = ch * 0.56, R = ch * 0.36;
		var on = sm(seg(wake, 0.02, 0.35)), perk = sm(seg(wake, 0.22, 0.65));
		var waveAmt = bell(seg(wake, 0.66, 0.98)) + (greet ? bell((now - greetT0) / 1250) : 0) + (cheer ? bell((now - cheerT0) / 1700) : 0);
		var wave = waveAmt > 0.01 ? M.sin(now * 0.014) * M.min(1, waveAmt) : 0;

		g.save();
		g.globalAlpha = sm(seg(wake, 0, 0.2));
		if (cheer) g.translate(0, -M.abs(M.sin((now - cheerT0) * 0.01)) * 5);

		[-1, 1].forEach(function (s0) {
			g.save(); g.translate(cx + s0 * R * 0.38, cy - R * 0.78);
			g.rotate(s0 * (0.42 - 0.14 * perk) + wave * 0.08 * s0);
			g.fillStyle = '#1259c4'; g.strokeStyle = '#091f4d'; g.lineWidth = 2.4;
			rr(g, -5, -18, 10, 20, 3); g.fill(); g.stroke();
			circ(g, 0, -22, 9.5); g.fill(); g.stroke();
			if (on > 0.3) { g.fillStyle = 'rgba(80,238,255,' + (0.45 * on).toFixed(2) + ')'; circ(g, -2.5, -24.5, 3.2); g.fill(); }
			g.restore();
		});

		[-1, 1].forEach(function (s0) {
			var ex = cx + s0 * R * 0.96, ey = cy - R * 0.06;
			g.fillStyle = '#1259c4'; g.strokeStyle = '#091f4d'; g.lineWidth = 2.5;
			rr(g, ex - 10, ey - 22, 20, 44, 9); g.fill(); g.stroke();
			g.fillStyle = 'rgba(28,242,255,' + (0.2 + 0.8 * on).toFixed(2) + ')';
			g.beginPath(); g.ellipse(ex + s0 * 3, ey, 4.2, 11, 0, 0, M.PI * 2); g.fill();
		});

		var bg = g.createRadialGradient(cx - R * 0.25, cy - R * 0.35, R * 0.1, cx, cy, R * 1.15);
		cs(bg, [0, '#62ceff', 0.65, '#35a8f2', 1, '#1b79c9']);
		g.fillStyle = bg; g.strokeStyle = '#091f4d'; g.lineWidth = 2.8;
		rr(g, cx - R * 0.92, cy - R * 0.86, R * 1.84, R * 1.66, R * 0.78); g.fill(); g.stroke();

		g.fillStyle = 'rgba(28,242,255,' + (0.25 + 0.75 * on).toFixed(2) + ')';
		circ(g, cx, cy + R * 0.46, 7.2); g.fill(); g.stroke();

		[[-1, -0.35 - 0.95 * sm(seg(wake, 0.65, 0.82)) + wave * 0.38], [1, 0.25 + (cheer ? 0.95 - wave * 0.3 : 0)]].forEach(function (a) {
			g.save(); g.translate(cx + a[0] * R * 0.86, cy + R * 0.26); g.rotate(a[1]);
			g.fillStyle = '#47b8f8'; g.strokeStyle = '#091f4d'; g.lineWidth = 2.4;
			rr(g, -9, -6, 18, 28, 9); g.fill(); g.stroke(); g.restore();
		});

		var vw = R * 1.5, vh = R * 0.82, vx = cx - vw / 2, vy = cy - R * 0.54;
		g.fillStyle = '#1462cc'; rr(g, vx - 3.5, vy - 3.5, vw + 7, vh + 7, 16); g.fill(); g.stroke();
		g.fillStyle = '#0b163d'; rr(g, vx, vy, vw, vh, 13); g.fill();

		var px = 5.4, blink = (wake > 0.54 && wake < 0.66) || (greet && ((now - greetT0) % 600 < 95));
		g.fillStyle = '#1cf2ff'; g.shadowColor = '#1cf2ff'; g.shadowBlur = 7 * on;
		function dotP(gx0, gy0, wP, hP) { rr(g, gx0 - (wP || px) / 2, gy0 - (hP || px) / 2, wP || px, hP || px, 1.6); g.fill(); }

		var lx = cx - vw * 0.23, rx = cx + vw * 0.23, ey0 = vy + vh * 0.46;
		if (wake < 0.28 || blink) {
			dotP(lx, ey0 + 2, px * 3.1, px * 0.95);
			dotP(rx, ey0 + 2, px * 3.1, px * 0.95);
		} else if (cheer) {
			[lx, rx].forEach(function (ex) {
				dotP(ex, ey0 - px * 1.15); dotP(ex, ey0 + px * 1.15);
				dotP(ex - px * 1.15, ey0); dotP(ex + px * 1.15, ey0);
			});
		} else if (wake < 0.56) {
			[lx, rx].forEach(function (ex) { dotP(ex, ey0, px * 1.9, px * 2.1); });
		} else {
			[lx, rx].forEach(function (ex) {
				dotP(ex, ey0 - px * 0.95);
				dotP(ex - px * 0.95, ey0); dotP(ex + px * 0.95, ey0);
				dotP(ex - px * 1.55, ey0 + px * 0.85, px * 0.85, px * 0.85);
				dotP(ex + px * 1.55, ey0 + px * 0.85, px * 0.85, px * 0.85);
			});
			dotP(lx - px * 1.5, vy + vh * 0.78, px * 0.85, px * 0.85);
			dotP(rx + px * 1.5, vy + vh * 0.78, px * 0.85, px * 0.85);
		}
		g.restore();
		return busy;
	}

	/* 动态特效绘制：拖焊锡浪、插座锁紧、彩色排线、全板通电与烙铁 */
	var IR = [
		[0, 9, 2.4, 5.4, '#7c848b', '#fbfcfd', '#c4cacf'],
		[9, 40, 5.4, 9.6, '#16181b', '#7b838a', '#373c42'],
		[40, 112, 9.6, 10.4, '#545b62', '#f1f3f5', '#a9b0b6'],
		[112, 134, 21, 21, '#434950', '#e0e4e7', '#9aa1a7'],
		[134, 206, 15, 15, '#4f565c', '#eceef0', '#a1a8ae'],
		[206, 219, 19, 19, '#101214', '#4f555b', '#26292d'],
		[219, 304, 23, 30, '#0c0d0f', '#454b52', '#1e2125'],
		[304, 2600, 30, 30, '#101215', '#4c535a', '#23272c']
	];
	function drawIron(g, x, y, a, lift, alpha, z, hot, now) {
		if (alpha <= 0.01) return;
		var s = k * (mob ? 1 : 1.16) * (1 + 0.035 * lift) * (z || 1), ca = M.cos(-a), sa = M.sin(-a), Lx = 0.5 * ca - 0.86 * sa, Ly = 0.5 * sa + 0.86 * ca;
		var o = (2.5 + 34 * lift) * k, sh = 0.12 + 0.04 * lift, i;
		g.save(); g.globalAlpha = alpha;
		g.save(); g.translate(-9000, 0); g.translate(x, y); g.rotate(a);
		g.transform(1 + sh * Lx, sh * Ly, 0, 1, o * Lx, o * Ly);
		g.beginPath(); g.moveTo(0, -IR[0][2] * s / 2);
		IR.forEach(function (q) { g.lineTo(q[0] * s, -q[2] * s / 2); g.lineTo(q[1] * s, -q[3] * s / 2); });
		for (i = IR.length - 1; i >= 0; i--) { var q2 = IR[i]; g.lineTo(q2[1] * s, q2[3] * s / 2); g.lineTo(q2[0] * s, q2[2] * s / 2); }
		g.closePath();
		g.shadowColor = 'rgba(0,0,0,' + (0.48 * alpha).toFixed(3) + ')';
		g.shadowBlur = (4 + 15 * lift) * k * dpr; g.shadowOffsetX = 9000 * dpr; g.fillStyle = '#000'; g.fill();
		g.restore();

		g.translate(x, y); g.rotate(a);
		for (i = 0; i < IR.length; i++) {
			var q = IR[i], x0 = q[0] * s, x1 = q[1] * s, h0 = q[2] * s / 2, h1 = q[3] * s / 2, hm = M.max(h0, h1);
			var gr = g.createLinearGradient(0, -hm, 0, hm);
			cs(gr, [0, q[4], 0.3, q[5], 0.56, q[6], 1, q[4]]); g.fillStyle = gr;
			g.beginPath(); g.moveTo(x0, -h0); g.lineTo(x1, -h1); g.lineTo(x1, h1); g.lineTo(x0, h0); g.closePath(); g.fill();
		}
		g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.ellipse(3.6 * s, -0.7 * s, 2.8 * s, 0.8 * s, 0, 0, M.PI * 2); g.fill();
		if (hot > 0.01) {
			/* 烙铁头上的一颗熔锡：银色球面 + 跑动的高光 + 橙色热晕 */
			var br = 3.1 * s, wob = M.sin((now || 0) * 0.006) * 0.25;
			g.globalCompositeOperation = 'lighter';
			var hg = g.createRadialGradient(0.4 * s, 0, 0, 0.4 * s, 0, br * 3.2);
			cs(hg, [0, 'rgba(255,190,110,' + (0.55 * hot).toFixed(3) + ')', 1, 'rgba(255,140,60,0)']);
			g.fillStyle = hg; circ(g, 0.4 * s, 0, br * 3.2); g.fill();
			g.globalCompositeOperation = 'source-over';
			var bg = g.createRadialGradient(-br * 0.35, -br * (0.45 + wob * 0.3), br * 0.08, 0, 0, br);
			cs(bg, [0, '#ffffff', 0.25, '#e9edf0', 0.7, '#9aa3ab', 1, '#5b636a']);
			g.globalAlpha = alpha * M.min(1, hot * 1.4); g.fillStyle = bg; circ(g, 0.2 * s, 0, br); g.fill();
			g.fillStyle = 'rgba(255,255,255,0.95)'; circ(g, 0.2 * s - br * 0.38, -br * (0.42 + wob * 0.3), br * 0.22); g.fill();
		}
		g.restore();
	}
	function bead(g, x, y, r, hot) {
		if (r <= 0.2) return;
		var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.06, x, y, r);
		cs(gr, [0, '#ffffff', 0.22, '#eef1f3', 0.62, '#a2abb2', 1, '#5c656c']);
		g.fillStyle = gr; circ(g, x, y, r); g.fill();
		if (hot > 0.01) { g.fillStyle = 'rgba(255,196,120,' + (0.5 * hot).toFixed(3) + ')'; circ(g, x, y, r * 1.08); g.fill(); }
	}

	function smoke(g, x, y, amt, seed, now) {
		for (var w = 0; w < 3; w++) for (var i = 0; i < 8; i++) {
			var p = (i / 8 + now * 0.00034 + w * 0.31 + seed * 0.17) % 1;
			var ph = now * 0.0011 + seed * 1.7 + w * 2.1;
			var yy = y - (6 + p * 74) * k, xx = x + (M.sin(ph + p * 3.1) * (2 + p * 14) + (w - 1) * 5 * p) * k;
			var r = (3 + p * 12) * k, a = amt * 0.11 * bell(p) * (1 - p * 0.5);
			if (a > 0.002) { g.globalAlpha = a; g.drawImage(smokeDot, xx - r, yy - r, 2 * r, 2 * r); }
		}
		g.globalAlpha = 1;
	}
	function spatter(g, x, y, m, seed) {
		var t = seg(m, 0.18, 0.72); if (t <= 0 || t >= 1) return;
		var r = rng(seed * 97 + 13);
		for (var i = 0; i < 7; i++) {
			var an = -M.PI * (0.15 + 0.7 * r()), sp = (12 + r() * 24) * k, d0 = sp * M.sqrt(t), fall = 16 * k * t * t;
			g.fillStyle = 'rgba(255,236,200,' + ((1 - t) * 0.85).toFixed(3) + ')';
			circ(g, x + M.cos(an) * d0 * (r() < 0.5 ? -1 : 1), y + M.sin(an) * d0 + fall, (0.8 + r() * 0.9) * k); g.fill();
		}
	}
	function glow(g, x, y, r, rgb, a) {
		if (a <= 0.003) return;
		var gr = g.createRadialGradient(x, y, 0, x, y, r);
		cs(gr, [0, 'rgba(255,255,255,' + M.min(1, 0.9 * a).toFixed(3) + ')', 0.1, 'rgba(' + rgb + ',' + M.min(1, 0.75 * a).toFixed(3) + ')', 0.34, 'rgba(' + rgb + ',' + M.min(1, 0.22 * a).toFixed(3) + ')', 1, 'rgba(' + rgb + ',0)']);
		g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
	}
	function strokePart(g, t, frac) {
		if (frac >= 0.999) { poly(g, t.p); g.stroke(); return; }
		var L = frac * t.len, c = t.cum, p = t.p;
		g.beginPath(); g.moveTo(p[0].x, p[0].y);
		for (var i = 1; i < p.length; i++) {
			if (c[i] >= L) { var u = (L - c[i - 1]) / ((c[i] - c[i - 1]) || 1); g.lineTo(lerp(p[i - 1].x, p[i].x, u), lerp(p[i - 1].y, p[i].y, u)); break; }
			g.lineTo(p[i].x, p[i].y);
		}
		g.stroke();
	}
	function litTrace(g, t, frac, a) {
		if (frac <= 0 || a <= 0.003) return;
		g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = a;
		g.strokeStyle = 'rgba(255,165,75,0.18)'; g.lineWidth = t.w * 4; strokePart(g, t, frac);
		g.strokeStyle = '#f2b168'; g.lineWidth = t.w * 1.05; strokePart(g, t, frac);
		g.strokeStyle = 'rgba(255,244,220,0.85)'; g.lineWidth = M.max(0.8, t.w * 0.36); strokePart(g, t, frac);
		g.globalAlpha = 1;
	}

	function drawRibbonCable(g, s) {
		var ins = ribInsert(s), u3 = actU(3, s);
		var jx = RIB.jx, jy = RIB.jy, jw = RIB.jw, jh = RIB.jh;
		var slide = (1 - ins) * RIB.travel, px = jx + 5 * k + slide, pw = 22 * k, ph = jh * 0.88;
		var endX = M.max(boardW + 1600, px + 1600), slack = (1 - ins) * 18 * k;

		var latchAng = (1 - sm(seg(u3, 0.5, 0.64))) * 0.48;
		[-1, 1].forEach(function (dir) {
			g.save(); g.translate(jx + jw * 0.55, jy + dir * (jh / 2 + 2 * k));
			g.rotate(dir * latchAng);
			g.fillStyle = '#9aa2a8'; rr(g, -3 * k, dir < 0 ? -9 * k : 0, 11 * k, 9 * k, 1.5 * k); g.fill();
			g.restore();
		});

		var wireH = ph * 0.9 / 10;
		g.save();
		g.shadowColor = 'rgba(0,0,0,0.42)'; g.shadowBlur = (8 + (1 - ins) * 10) * k; g.shadowOffsetY = (4 + (1 - ins) * 6) * k;
		g.fillStyle = '#181b1d'; g.fillRect(px + pw - 2 * k, jy - ph * 0.45, 4 * k, ph * 0.9);
		g.restore();

		for (var i = 0; i < 10; i++) {
			var wy = jy - ph * 0.45 + (i + 0.5) * wireH;
			g.lineCap = 'butt';
			g.strokeStyle = RIB_COL[i]; g.lineWidth = wireH * 0.94;
			g.beginPath(); g.moveTo(px + pw, wy);
			g.bezierCurveTo(px + pw + 60 * k, wy + slack, px + pw + 130 * k, wy - slack * 0.6, endX, wy + slack * 0.3);
			g.stroke();
			g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = wireH * 0.24;
			g.beginPath(); g.moveTo(px + pw, wy - wireH * 0.2);
			g.bezierCurveTo(px + pw + 60 * k, wy + slack - wireH * 0.2, px + pw + 130 * k, wy - slack * 0.6 - wireH * 0.2, endX, wy + slack * 0.3 - wireH * 0.2);
			g.stroke();
		}

		g.save();
		g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8 * k; g.shadowOffsetY = 3 * k;
		var pgr = g.createLinearGradient(px, jy - ph / 2, px + pw, jy + ph / 2);
		cs(pgr, [0, '#2d3236', 0.5, '#1b1e21', 1, '#101214']);
		g.fillStyle = pgr; rr(g, px, jy - ph / 2, pw, ph, 2.2 * k); g.fill();
		g.restore();
		g.fillStyle = '#3a4045'; g.fillRect(px + pw * 0.62, jy - ph * 0.48, 3.2 * k, ph * 0.96);
		g.fillStyle = '#e5c36b'; g.beginPath();
		g.moveTo(px + 4 * k, jy - ph * 0.36); g.lineTo(px + 9 * k, jy - ph * 0.32); g.lineTo(px + 9 * k, jy - ph * 0.4); g.closePath(); g.fill();
	}

	/* 通电后走线上流动的电流光点 */
	var glowDot = null, lastInput = 0, mvOn = false, lastMove = 0;
	function makeGlowDot() {
		var c = d.createElement('canvas'); c.width = c.height = 48;
		var x = c.getContext('2d'), gr = x.createRadialGradient(24, 24, 0, 24, 24, 24);
		cs(gr, [0, 'rgba(255,255,246,1)', 0.16, 'rgba(255,228,168,0.95)', 0.42, 'rgba(255,172,74,0.34)', 1, 'rgba(255,140,50,0)']);
		x.fillStyle = gr; x.fillRect(0, 0, 48, 48); return c;
	}
	function flowOn(g, t, now, a, speed, gap, zf, vb) {
		if (a <= 0.01) return false;
		if (t.x1 < vb[0] || t.x0 > vb[2] || t.y1 < vb[1] || t.y0 > vb[3]) return false;
		var sp = (gap || 74) * k, off = (now * (speed || 0.2) * k) % sp, r = M.max(5 * k, t.w * 2.5) * zf;
		g.globalAlpha = a;
		for (var L = off; L < t.len; L += sp) { var p = along(t.p, t.cum, L); g.drawImage(glowDot, p.x - r, p.y - r, 2 * r, 2 * r); }
		g.globalAlpha = 1;
		return true;
	}

	/* 万用表表笔（世界坐标，跟着镜头一起缩放侧倾） */
	function drawProbe(g, x, y, ang, red, a) {
		if (a <= 0.01) return;
		var s = k * (mob ? 0.92 : 1.06), i;
		g.save(); g.globalAlpha = a; g.translate(x, y); g.rotate(ang);
		g.save(); g.translate(5 * s, 9 * s); g.fillStyle = 'rgba(0,0,0,0.32)'; rr(g, 22 * s, -6 * s, 150 * s, 12 * s, 6 * s); g.fill(); g.restore();
		var ng = g.createLinearGradient(0, -1.5 * s, 0, 1.5 * s); cs(ng, [0, '#7f878e', 0.38, '#f6f8f9', 1, '#5f676e']);
		g.fillStyle = ng; g.beginPath(); g.moveTo(0, 0); g.lineTo(5 * s, -1.3 * s); g.lineTo(27 * s, -1.5 * s); g.lineTo(27 * s, 1.5 * s); g.lineTo(5 * s, 1.3 * s); g.closePath(); g.fill();
		g.fillStyle = '#25282b'; rr(g, 27 * s, -3.4 * s, 8 * s, 6.8 * s, 1.5 * s); g.fill();
		var hg = g.createLinearGradient(0, -7 * s, 0, 7 * s);
		cs(hg, red ? [0, '#6e1210', 0.3, '#e6493d', 0.55, '#b92b22', 1, '#560c0b'] : [0, '#060707', 0.3, '#50565c', 0.55, '#24282c', 1, '#050606']);
		g.fillStyle = hg; rr(g, 35 * s, -7.6 * s, 7 * s, 15.2 * s, 2.5 * s); g.fill();
		rr(g, 42 * s, -5.3 * s, 112 * s, 10.6 * s, 4.2 * s); g.fill();
		g.fillStyle = 'rgba(0,0,0,0.24)'; for (i = 0; i < 6; i++) g.fillRect((54 + i * 7) * s, -5.3 * s, 2.2 * s, 10.6 * s);
		g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(44 * s, -3.6 * s, 106 * s, 1.4 * s);
		g.strokeStyle = red ? '#9e231c' : '#141618'; g.lineWidth = 4.6 * s; g.lineCap = 'round';
		g.beginPath(); g.moveTo(154 * s, 0); g.bezierCurveTo(210 * s, 8 * s, 270 * s, -12 * s, 460 * s, 26 * s); g.stroke();
		g.restore();
	}

	/* 俯瞰时各模块“活过来”的标注（屏幕坐标） */
	function callouts(g, m, pw, u4) {
		var fade = 1 - sm(seg(u4, 0.68, 0.73));
		if (fade <= 0.01 || pw < 1.6) return;
		var cm = { x: 0, y: 0 };
		CHIPS.forEach(function (ch) { cm.x += ch.q.x + ch.q.w / 2; cm.y += ch.q.y; });
		cm.x /= CHIPS.length; cm.y /= CHIPS.length;
		var L = [
			[1.7, { x: (DRAG.a.x + DRAG.b.x) / 2, y: (DRAG.a.y + DRAG.b.y) / 2 }, '平时做什么', SMDS.length + ' 个贴片灯亮了'],
			[2.7, cm, '做过的事', CHIPS.length + ' 颗芯片上电'],
			[3.65, { x: RIB.D.x + RIB.D.w / 2, y: RIB.D.y + RIB.D.h * 0.3 }, '谁在带大家', '社长的屏幕亮了'],
			[4.7, { x: TM.r.x + TM.r.w * 0.5, y: TM.r.y + TM.r.h * 0.25 }, '怎么加入', '小智正在开机']
		];
		var fs1 = mob ? 13.5 : 16, fs2 = mob ? 11 : 12.5, padX = mob ? 9 : 12, maxX = mob || !TPS ? W - 8 : TPS.l - 14;
		L.forEach(function (c) {
			var a = sm(seg(pw, c[0], c[0] + 0.28)) * fade;
			if (a <= 0.01) return;
			var p = toS(m, c[1].x, c[1].y);
			g.font = '900 ' + fs1 + 'px "SHU Serif", serif'; var w1 = g.measureText(c[2]).width;
			g.font = '500 ' + fs2 + 'px ' + 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'; var w2 = g.measureText(c[3]).width;
			var bw = M.max(w1, w2) + padX * 2, bh = fs1 + fs2 + (mob ? 16 : 20);
			var bx = clamp(p.x + 16, 8, maxX - bw), by = clamp(p.y - bh - 30 + (1 - a) * 10, 8, (mob && TPS ? TPS.t - 6 : H - 8) - bh);
			g.globalAlpha = a;
			g.strokeStyle = 'rgba(242,190,99,0.75)'; g.lineWidth = 1;
			g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 10, by + bh); g.lineTo(bx + 10, by + bh); g.stroke();
			g.fillStyle = 'rgba(7,20,15,0.9)'; rr(g, bx, by, bw, bh, 4); g.fill();
			g.strokeStyle = 'rgba(242,190,99,0.45)'; g.stroke();
			g.fillStyle = '#f7d48e'; g.fillRect(bx, by + 6, 2, bh - 12);
			g.font = '900 ' + fs1 + 'px "SHU Serif", serif'; g.fillStyle = '#f2f1ea'; g.fillText(c[2], bx + padX, by + fs1 + 6);
			g.font = '500 ' + fs2 + 'px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'; g.fillStyle = '#f2be63'; g.fillText(c[3], bx + padX, by + fs1 + fs2 + (mob ? 10 : 12));
			g.globalCompositeOperation = 'lighter';
			var gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
			cs(gr, [0, 'rgba(255,250,230,' + a.toFixed(3) + ')', 0.3, 'rgba(255,200,110,' + (0.6 * a).toFixed(3) + ')', 1, 'rgba(255,170,70,0)']);
			g.fillStyle = gr; g.fillRect(p.x - 16, p.y - 16, 32, 32);
			g.globalCompositeOperation = 'source-over';
		});
		g.globalAlpha = 1;
	}

	function powerOn(now) { return powerT0 < 0 ? 1 : sm((now - powerT0 - 340) / 240); }

	/* 主渲染帧 */
	function draw(s, now, dt) {
		var u2 = actU(2, s), u3 = actU(3, s), u4 = actU(4, s);
		if (u4 >= 0.97 && !greetDone) { greetDone = true; greetT0 = now; }
		else if (u4 < 0.5) greetDone = false;

		var ir = ironAt(s), cam = camAt(s), m = camMat(cam), sc = m.sc, busy = false, i;
		var tf = 'matrix(' + m.a.toFixed(5) + ',' + m.b.toFixed(5) + ',' + m.c.toFixed(5) + ',' + m.d.toFixed(5) + ',' + m.e.toFixed(2) + ',' + m.f.toFixed(2) + ')';
		if (tf !== lastTf) {
			world.style.transform = tf; lastTf = tf; lastMove = now;
			if (!mvOn) { mvOn = true; world.classList.add('mv'); }
		} else if (mvOn && now - lastMove > 260) { mvOn = false; world.classList.remove('mv'); }
		if (mvOn) busy = true;
		var ovNow = sc < 0.6;
		if (ovNow !== stage._ov) { stage._ov = ovNow; stage.classList.toggle('ov', ovNow); }

		var idleT = now - lastInput, flowA = 1 - sm(seg(idleT, 14000, 16000));
		var pw = powerWave(s, now);
		if (surgeT0 > 0 && now - surgeT0 < 1520) busy = true;
		applyBinds(s); tpUpdate(s, pw); vfUpdate(m); opUpdate(s);
		if (drawZhi(zhiWake(s), now)) busy = true;

		var cn = [toW(m, 0, 0), toW(m, W, 0), toW(m, 0, H), toW(m, W, H)];
		var vx0 = M.min(cn[0].x, cn[1].x, cn[2].x, cn[3].x) - 40, vx1 = M.max(cn[0].x, cn[1].x, cn[2].x, cn[3].x) + 40;
		var vy0 = M.min(cn[0].y, cn[1].y, cn[2].y, cn[3].y) - 40, vy1 = M.max(cn[0].y, cn[1].y, cn[2].y, cn[3].y) + 40;
		var VB = [vx0, vy0, vx1, vy1], zf = 1 / M.max(0.42, M.sqrt(sc));
		var g = gB;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.fillStyle = CO.bench; g.fillRect(0, 0, W, H);
		g.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * m.e, dpr * m.f);

		if (sc < 0.72) {
			var lo = getBoardLo();
			g.drawImage(lo, 0, 0, boardW, boardH);
		} else {
			for (i = 0; i < TILES_R.length; i++) {
				var tr0 = TILES_R[i];
				if (tr0.x + tr0.w < vx0 || tr0.x > vx1 || tr0.y + tr0.h < vy0 || tr0.y > vy1) continue;
				var tc = tile(i); g.drawImage(tc, tr0.x, tr0.y, tr0.w, tr0.h);
			}
			prefetch();
		}

		var pOn = powerOn(now); if (pOn < 1) busy = true;
		/* 合闸前整块板压暗，电流走到哪亮到哪，跑完一圈全板恢复亮度 */
		var dim = 0.34 * sm(seg(u4, 0.02, 0.14)) * (1 - sm(seg(u4, 0.56, 0.66)));
		if (dim > 0.004) { g.fillStyle = 'rgba(4,10,8,' + dim.toFixed(3) + ')'; g.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }
		TRp.forEach(function (t) { litTrace(g, t, 1, pOn * 0.85); });

		if (pw > 0.001) {
			for (var stg = 0; stg < 5; stg++) {
				var sf = seg(pw, stg, stg + 1);
				if (sf <= 0) continue;
				NET[stg].forEach(function (bus) {
					litTrace(g, bus.main, sf, 1);
					bus.subs.forEach(function (sb) { litTrace(g, sb, sf, 0.78); });
				});
			}
		}

		/* ① 拖焊：焊盘依次被熔锡吃满 */
		var dProg = dragU(s);
		if (dProg > 0) {
			SMDS.forEach(function (s0, idx) {
				var mm = smdM(idx, s); if (mm <= 0) return;
				s0.pads.forEach(function (pd, pi) {
					var pm = seg(mm, pi * 0.14, 0.55 + pi * 0.14); if (pm <= 0) return;
					var molten = bell(seg(pm, 0.15, 0.9));
					if (molten > 0.02) {
						g.fillStyle = 'rgba(210,155,60,' + (0.24 * pm).toFixed(3) + ')';
						rr(g, pd.x - pd.w * 0.8, pd.y - pd.h * 0.72, pd.w * 1.6, pd.h * 1.44, 3 * k); g.fill();
					}
					solderRect(g, pd.x, pd.y, pd.w * (0.7 + 0.38 * sm(pm)), pd.h * (0.7 + 0.38 * sm(pm)));
					if (molten > 0.02) {
						g.fillStyle = 'rgba(255,255,255,' + (0.55 * molten).toFixed(3) + ')';
						rr(g, pd.x - pd.w * 0.54, pd.y - pd.h * 0.54, pd.w * 1.08, pd.h * 1.08, 2.5 * k); g.fill();
					}
				});
			});
		}


		if (RIB.D.x - 40 < vx1 && boardW + 160 * k > vx0 && RIB.D.y - 60 < vy1 && RIB.D.y + RIB.D.h + 60 > vy0) {
			drawRibbonCable(g, s);
		}

		g.globalCompositeOperation = 'lighter';
		glow(g, PW.d1.x, PW.d1.y, 26 * k, '110,235,145', pOn);
		glow(g, PW.d1.x, PW.d1.y, 78 * k, '110,235,145', 0.2 * pOn);

		/* 通电后的流动电流：待机电源慢流，各段导通后快流 */
		var anyFlow = false;
		if (pOn > 0.5) TRp.forEach(function (t) { if (flowOn(g, t, now, 0.55 * flowA, 0.06, 96, zf, VB)) anyFlow = true; });
		if (pw > 0.001) {
			for (var st2 = 0; st2 < 5; st2++) {
				if (pw < st2 + 1) break;
				NET[st2].forEach(function (bus) {
					if (flowOn(g, bus.main, now, 0.95 * flowA, 0.22, 70, zf, VB)) anyFlow = true;
					bus.subs.forEach(function (sb) { flowOn(g, sb, now + 400, 0.5 * flowA, 0.18, 88, zf, VB); });
				});
			}
		}
		if (anyFlow && flowA > 0) busy = true;

		/* 贴片灯：焊好时闪一下；通电后跑起流水灯 */
		SMDS.forEach(function (s0, idx) {
			var mm = smdM(idx, s), flash = bell(seg(mm, 0.35, 0.95));
			var pLit = sm(seg(pw, 1.05 + idx * 0.16, 1.35 + idx * 0.16));
			var chase = pLit > 0.5 ? M.pow(M.max(0, M.cos(now * 0.0042 - idx * 0.95)), 6) * flowA : 0;
			var L = flash * 0.85 + pLit * (0.8 + 0.6 * chase);
			if (L > 0.01) {
				glow(g, s0.lex, s0.cy, 24 * k * (1 + 0.25 * chase), '255,180,75', L);
				glow(g, s0.lex, s0.cy, 68 * k, '255,170,65', 0.22 * L);
			}
			if (flash > 0.02) glow(g, s0.cx, s0.cy + (!vertP ? 12 * k : 0), 22 * k, '255,235,200', 0.55 * flash);
		});

		CHIPS.forEach(function (ch, idx) {
			var mm = chipM(idx, s), snap = bell(seg(mm, 0.66, 0.88));
			if (snap > 0.01) {
				var q = ch.q, ex = (1 - snap) * 10 * k;
				g.strokeStyle = 'rgba(255,232,175,' + (0.55 * snap).toFixed(3) + ')'; g.lineWidth = 1.8 * k;
				rr(g, q.x - 5 * k - ex, q.y - 11 * k - ex, q.w + 10 * k + 2 * ex, q.h + 22 * k + 2 * ex, 5 * k); g.stroke();
			}
			var tm = tapM(idx, s);
			var cPow = sm(seg(pw, 2.05 + idx * 0.16, 2.35 + idx * 0.16));
			if (cPow > 0.01) {
				glow(g, ch.inP.x, ch.inP.y, 20 * k, '255,190,95', 0.65 * cPow);
				if (cPow > 0.6 && flowA > 0.05) {
					var tick = M.floor(now / 110);
					for (var j = 0; j < 2; j++) {
						var pi = M.floor(hash2(tick + j * 31, idx * 7) * ch.pins.length);
						glow(g, ch.pins[pi], ch.q.y - 5.2 * k, 9 * k, '140,230,255', 0.8 * flowA);
					}
				}
			}
		});

		var rSnap = bell(seg(u3, 0.5, 0.64)), rOn = ribLit(s) + 0.35 * sm(seg(pw, 3.2, 3.8));
		if (rSnap > 0.01) glow(g, RIB.jx + 4 * k, RIB.jy, 34 * k, '255,230,170', 0.8 * rSnap);
		if (rOn > 0.01) glow(g, RIB.D.x + RIB.D.w / 2, RIB.D.y + RIB.D.h / 2, RIB.D.w * 0.9, '140,210,255', 0.12 * M.min(1.2, rOn));
		var pu = probeU(s), cont = bell(seg(pu, 0.32, 0.74));
		if (cont > 0.01) {
			for (i = 0; i < 10; i++) glow(g, RIB.jx - 2 * k, RIB.jy - RIB.jh * 0.4 + i * (RIB.jh * 0.8 / 9), 9 * k, '120,255,170', 0.8 * cont);
		}

		var swF = bell(seg(u4, 0.12, 0.28));
		if (swF > 0.01) { glow(g, SW.outP.x + 18 * k, SW.outP.y, 46 * k, '120,255,175', 0.85 * swF); glow(g, SW.r.x + SW.r.w / 2, SW.r.y + SW.r.h / 2, 90 * k, '120,255,175', 0.35 * swF); }
		if (pw > 0.02 && pw < 4.98) {
			var curStg = M.min(4, M.floor(pw)), curFrac = pw - curStg;
			NET[curStg].forEach(function (bus) {
				var hp = along(bus.main.p, bus.main.cum, curFrac * bus.main.len);
				glow(g, hp.x, hp.y, 38 * k * zf, '255,220,140', 0.95);
				glow(g, hp.x, hp.y, 95 * k * zf, '255,175,80', 0.38);
			});
		}
		/* 全板泛光：电流跑完最后一段，一圈光从主屏扫过整块板 */
		var blm = seg(u4, 0.56, 0.74);
		if (blm > 0 && blm < 1) {
			var bcx = TM.r.x + TM.r.w / 2, bcy = TM.r.y + TM.r.h / 2, Rm = M.sqrt(boardW * boardW + boardH * boardH);
			var r0 = 40 * k + easeOut3(blm) * Rm, band = 260 * k, ba = (1 - blm);
			var rg = g.createRadialGradient(bcx, bcy, M.max(0, r0 - band), bcx, bcy, r0 + 30 * k);
			cs(rg, [0, 'rgba(255,200,120,0)', 0.6, 'rgba(255,196,110,' + (0.07 * ba).toFixed(3) + ')', 0.9, 'rgba(255,246,222,' + (0.55 * ba).toFixed(3) + ')', 1, 'rgba(255,240,210,0)']);
			g.fillStyle = rg; g.save(); rr(g, mrg, mrg, boardW - 2 * mrg, boardH - 2 * mrg, 14 * k); g.clip(); g.fillRect(M.max(0, vx0), M.max(0, vy0), M.min(boardW, vx1) - M.max(0, vx0), M.min(boardH, vy1) - M.max(0, vy0)); g.restore();
		}
		var tmOn = sm(seg(u4, 0.54, 0.7));
		if (tmOn > 0.01) glow(g, TM.r.x + TM.r.w / 2, TM.r.y + TM.r.h / 2, TM.r.w * 0.72, '90,225,245', 0.13 * tmOn);
		if (ir.drag || ir.tap) glow(g, ir.x, ir.y, 28 * k, '255,210,150', 0.85);
		if (ir.idle && ir.show > 0) glow(g, ir.x, ir.y, 22 * k, '255,190,120', 0.45 * pOn);
		g.globalCompositeOperation = 'source-over';

		if (ptr.heat > 0.003) {
			busy = true;
			var pwp = toW(m, ptr.x, ptr.y), wx = pwp.x, wy = pwp.y, R = 145 * k, h = ptr.heat;
			var hg = g.createRadialGradient(wx, wy, 0, wx, wy, R);
			cs(hg, [0, 'rgba(255,176,100,' + (0.68 * h).toFixed(3) + ')', 0.5, 'rgba(255,140,70,' + (0.18 * h).toFixed(3) + ')', 1, 'rgba(255,120,60,0)']);
			g.strokeStyle = hg; g.lineCap = 'round'; g.lineJoin = 'round';
			TRall.forEach(function (t) { if (t.x1 < wx - R || t.x0 > wx + R || t.y1 < wy - R || t.y0 > wy + R) return; g.lineWidth = t.w * 1.3; poly(g, t.p); g.stroke(); });
			if (now - ptr.t > 140) ptr.heat = M.max(0, ptr.heat - dt / 1500);
		}

		/* 前景层：烟、锡溅、表笔（世界坐标）→ 烙铁、标注（屏幕坐标） */
		var f = gF, ip = toS(m, ir.x, ir.y), tgt = 0;
		f.setTransform(dpr, 0, 0, dpr, 0, 0); f.clearRect(0, 0, W, H);
		f.setTransform(dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * m.e, dpr * m.f);
		if (ir.drag) {
			smoke(f, ir.x, ir.y, 1.05, 3, now); busy = true;
			f.globalCompositeOperation = 'lighter';
			SMDS.forEach(function (s0, idx) { spatter(f, s0.cx, s0.cy + (!vertP ? 12 * k : 0), smdM(idx, s), idx + 1); });
			f.globalCompositeOperation = 'source-over';
		}
		if (u2 > 0 && u2 < 1) {
			CHIPS.forEach(function (ch, idx) {
				var tm = tapM(idx, s); if (tm <= 0 || tm >= 1) return;
				var tp = tapPt(idx);
				smoke(f, tp.x, tp.y, 0.95 * bell(tm), idx + 11, now); busy = true;
				f.globalCompositeOperation = 'lighter'; spatter(f, tp.x, tp.y, tm, idx + 21); f.globalCompositeOperation = 'source-over';
			});
		}
		if (ir.idle && ir.show > 0 && flowA > 0.01) { smoke(f, ir.x, ir.y, 0.42 * flowA, 7, now); busy = true; }
		/* ② 点焊：每颗芯片底排引脚从烙铁落点向两边长出锡珠（画在前景层，盖在芯片引脚上） */
		if (u2 > TP0 - 0.02 && sts[2].y - H < vy1 && sts[2].y + sts[2].h + H > vy0) {
			CHIPS.forEach(function (ch, idx) {
				var tm = tapM(idx, s); if (tm <= 0) return;
				var q = ch.q, tp = tapPt(idx), hot = ir.tap === idx + 1 ? 1 - tm : 0, by = q.y + q.h + 3 * k;
				for (var px = q.x + 12; px < q.x + q.w - 10; px += 15) {
					var dn = M.abs(px - tp.x) / (q.w * 0.5), pm = sm(seg(tm, dn * 0.5, dn * 0.5 + 0.4));
					if (pm > 0) bead(f, px, by, 3.1 * (0.5 + 0.5 * pm), hot * (1 - dn * 0.6));
				}
				if (tm < 1) { f.globalCompositeOperation = 'lighter'; glow(f, tp.x, by, 30 * k, '255,205,140', 0.9 * bell(tm)); f.globalCompositeOperation = 'source-over'; }
			});
		}
		if (pu > 0 && pu < 1) {
			var pe = sm(seg(pu, 0, 0.28)), pr = sm(seg(pu, 0.74, 1)), pd = (1 - pe + pr) * 120 * k, pa = M.min(1, pe * 3) * (1 - pr);
			var tT = { x: RIB.jx - 3 * k, y: RIB.jy - RIB.jh * 0.4 }, tB = { x: RIB.jx - 3 * k, y: RIB.jy + RIB.jh * 0.4 };
			var aR = -0.82, aB = 0.82;
			drawProbe(f, tB.x + M.cos(aB) * pd, tB.y + M.sin(aB) * pd, aB, false, pa);
			drawProbe(f, tT.x + M.cos(aR) * pd, tT.y + M.sin(aR) * pd, aR, true, pa);
			if (cont > 0.01) {
				f.globalCompositeOperation = 'lighter';
				[tT, tB].forEach(function (tp) {
					for (var w = 0; w < 2; w++) {
						var rp = (seg(pu, 0.36, 0.72) * 2.2 + w * 0.5) % 1;
						f.strokeStyle = 'rgba(130,255,180,' + (0.7 * (1 - rp) * cont).toFixed(3) + ')'; f.lineWidth = 1.6 * k;
						circ(f, tp.x, tp.y, (4 + rp * 26) * k); f.stroke();
					}
					glow(f, tp.x, tp.y, 16 * k, '170,255,200', 0.9 * cont);
				});
				f.globalCompositeOperation = 'source-over';
			}
		}
		if (swF > 0.01) { f.globalCompositeOperation = 'lighter'; spatter(f, SW.outP.x + 4 * k, SW.outP.y, seg(u4, 0.12, 0.26), 41); f.globalCompositeOperation = 'source-over'; }

		f.setTransform(dpr, 0, 0, dpr, 0, 0);
		var flashA = 0.15 * bell(seg(u4, 0.555, 0.61));
		if (flashA > 0.005) { f.globalCompositeOperation = 'lighter'; f.fillStyle = 'rgba(255,236,200,' + flashA.toFixed(3) + ')'; f.fillRect(0, 0, W, H); f.globalCompositeOperation = 'source-over'; }
		if (u4 > 0.3 && u4 < 0.74) callouts(f, m, pw, u4);

		if (ptr.heat > 0 && ir.show > 0) {
			var df = M.atan2(ip.y - ptr.y, ip.x - ptr.x) - ir.ang - m.rot;
			df = M.atan2(M.sin(df), M.cos(df)); tgt = clamp(df, -1.3, 1.3) * 0.075 * ptr.heat;
		}
		aOff += (tgt - aOff) * (1 - M.exp(-dt / 200));
		if (M.abs(tgt - aOff) > 0.0005 && ir.show > 0) busy = true;
		var hot = ir.idle ? pOn : (ir.drag || ir.tap) ? 1 : 0.55;
		if (ir.show > 0.01) drawIron(f, ip.x, ip.y, ir.ang + m.rot + aOff, ir.lift, ir.show, clamp(sc, 0.7, 1.6), hot, now);
		return busy;
	}

	function offstage() { return (window.scrollY || window.pageYOffset) > trackTop + total + H + 40; }
	var lastFrame = 0, fbT = 0;
	function frame(now) {
		raf = 0; lastFrame = performance.now();
		if (offstage()) { sD = sT; lastT = 0; return; }
		var dt = lastT ? M.min(64, now - lastT) : 16; lastT = now;
		var diff = sT - sD;
		if (M.abs(diff) < 0.4) sD = sT; else sD += diff * (1 - M.exp(-dt / 68));
		var busy = draw(sD, now, dt) || sD !== sT;
		if (busy) raf = requestAnimationFrame(frame); else lastT = 0;
	}
	function kick() { if (!raf) raf = requestAnimationFrame(frame); }

	onCelebrate = function () {
		cheerT0 = lastInput = performance.now();
		if (zhiSay) zhiSay.textContent = '收到！公众号名已复制，我们在翔英大楼等你！';
		kick();
	};
	onSurge = function () {
		if (sT < beats[4].aEnd - 4) { go(4); return; }
		surgeT0 = cheerT0 = lastInput = performance.now(); kick();
	};

	var virt = null;
	function curS() { return virt != null ? virt : clamp((window.scrollY || window.pageYOffset) - trackTop, 0, total); }
	function sizeAll() {
		track.style.height = M.round(total + H) + 'px';
		trackTop = track.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
		[cvB, cvF].forEach(function (c) { c.width = M.round(W * dpr); c.height = M.round(H * dpr); });
	}
	function logical(s) { for (var b = 4; b > 0; b--) if (s >= beats[b].start) break; var B = beats[b]; return [b, (s - B.start) / ((B.end - B.start) || 1)]; }
	function relayout() { try { relayout0(); } catch (e) { fallback(e); } }
	function relayout0() {
		var pos = beats.length ? logical(sT) : [0, 0];
		build(); timeline(); sizeAll(); dropTiles(); bindAll();
		if (logoImg && logoImg.complete && logoImg.naturalWidth) silkLogo = makeSilk(logoImg);
		var B = beats[pos[0]], s = clamp(B.start + pos[1] * (B.end - B.start), 0, total);
		if (virt != null) virt = s; else window.scrollTo(0, trackTop + s);
		sT = sD = s; lastTf = ''; curB = -1;
		draw(sD, performance.now(), 16);
	}

	/* 启动与事件 */
	noisePat = makeNoise(); smokeDot = makeDot(); glowDot = makeGlowDot(); lastInput = performance.now();
	build(); timeline(); sizeAll(); bindAll();
	root.classList.add('ready');

	var qa = /[?&]at=(\d+)/.exec(location.search), qb = /[?&]beat=(\d)/.exec(location.search), qp = /[?&]p=(\d)(\.\d+)?/.exec(location.search);
	var dbg = null;
	if (qp) { var pb = beats[clamp(+qp[1], 0, 4)]; qb = qp; dbg = pb.start + (+(qp[2] || 0)) * (pb.end - pb.start); }
	else if (qa) dbg = +qa[1] - trackTop; else if (qb) dbg = readPos(clamp(+qb[1], 0, 4));
	if (dbg != null) { if (/Headless/i.test(navigator.userAgent)) virt = clamp(dbg, 0, total); else window.scrollTo(0, trackTop + dbg); }
	sT = sD = curS();
	powerT0 = (qa || qb || sT > 0) ? -1 : performance.now();
	draw(sD, performance.now(), 16); kick();

	go = function (b) { window.scrollTo({ top: trackTop + readPos(b), behavior: 'smooth' }); };
	window.addEventListener('scroll', function () {
		sT = curS(); lastInput = performance.now();
		if (d.hidden) { sD = sT; draw(sD, performance.now(), 16); return; }
		kick();
		clearTimeout(fbT);
		fbT = setTimeout(function () { if (performance.now() - lastFrame > 120 && !offstage()) { sD = sT; draw(sD, performance.now(), 16); } }, 140);
	}, { passive: true });

	var rT = 0, headless = /Headless/i.test(navigator.userAgent);
	window.addEventListener('resize', function () {
		var fn = function () { if (stage.clientWidth !== W || M.abs(stage.clientHeight - H) > 1) relayout(); };
		clearTimeout(rT);
		if (headless) fn(); else rT = setTimeout(fn, 160);
	});
	function onPtr(cx, cy) { var r = stage.getBoundingClientRect(); ptr.x = cx - r.left; ptr.y = cy - r.top; ptr.heat = 1; ptr.t = lastInput = performance.now(); kick(); }
	stage.addEventListener('pointermove', function (e) { onPtr(e.clientX, e.clientY); }, { passive: true });
	stage.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) onPtr(t.clientX, t.clientY); }, { passive: true });
	stage.addEventListener('scroll', function () { stage.scrollTop = 0; stage.scrollLeft = 0; });
	world.addEventListener('focusin', function (e) {
		stage.scrollTop = 0; stage.scrollLeft = 0;
		var el = e.target.closest('.st'), b = sts.map(function (x) { return x.el; }).indexOf(el);
		if (b < 0) return;
		var B = beats[b];
		if (b === 0 ? sT > B.end : (sT < B.aEnd - 1 || sT > B.end - 1)) go(b);
	});
	setTimeout(function () { powerT0 = -1; sT = sD = curS(); draw(sD, performance.now(), 16); }, 2500);
	if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { relayout(); });
	logoImg = new Image();
	logoImg.onload = function () {
		try { silkLogo = makeSilk(logoImg); dropTiles(); draw(sD, performance.now(), 16); } catch (e) {}
	};
	logoImg.src = window.ZHI_FLAT_SRC || '../shared/img/ip/zhi-flat.webp';
}

function fallback(err) {
	root.classList.remove('live', 'ready');
	$$('.st').forEach(function (s) { s.style.left = ''; s.style.top = ''; s.style.width = ''; s.style.minHeight = ''; });
	var w = $('#world'), t = $('#track');
	if (w) w.style.transform = '';
	if (t) t.style.height = '';
	go = function (b) { var el = d.getElementById('s' + b); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
	if (window.console) console.warn('[v18] 舞台初始化失败，退回普通页面：', err);
}

renderContent();
wire();
if (root.classList.contains('live')) { try { initLive(); } catch (e) { fallback(e); } }
})();
