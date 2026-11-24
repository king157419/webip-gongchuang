/* 官网后台前端：原生 JS，无框架、无 CDN。所有数据用 textContent 写进页面，不拼 HTML。 */
"use strict";
(function () {
  // ------------------------------------------------------------------ 工具
  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k === "value") el.value = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) kid.forEach((k) => append(el, k));
    else el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const todayStr = () => {
    const d = new Date(Date.now() + 8 * 3600 * 1000); // 北京时间
    return d.toISOString().slice(0, 10);
  };
  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  // ------------------------------------------------------------------ 状态
  const S = {
    user: null, schema: null, content: null, version: null, sites: [], loadError: null,
    route: null, work: null, dirty: false, mode: "form", jsonText: "",
    open: new WeakSet(), errors: [], saved: null,
  };
  const main = () => $("#main");

  // ------------------------------------------------------------------ 接口
  async function api(method, path, body) {
    const init = { method, headers: {}, credentials: "same-origin" };
    if (body !== undefined) {
      if (body instanceof Blob) {
        init.body = body;
        init.headers["Content-Type"] = body.type;
      } else {
        init.body = JSON.stringify(body);
        init.headers["Content-Type"] = "application/json";
      }
    }
    let r;
    try {
      r = await fetch("/admin/api" + path, init);
    } catch (e) {
      throw Object.assign(new Error("连不上服务器，请检查网络"), { status: 0 });
    }
    let data = null;
    try { data = await r.json(); } catch (e) { /* 非 JSON */ }
    if (r.status === 401 && path !== "/login") {
      const wasIn = !!S.user;
      S.user = null;
      showLogin(wasIn ? "登录已过期，请重新登录" : "");
    }
    if (!r.ok) {
      const err = new Error((data && data.detail) || "请求失败（" + r.status + "）");
      err.status = r.status;
      err.data = data || {};
      throw err;
    }
    return data;
  }

  // ------------------------------------------------------------------ 校验（与服务器 schema.py 同一套规则）
  const LIM = { STR: 300, TEXT: 5000, URL: 1000, LIST: 1000 };
  const RE = {
    slug: /^[a-z0-9_-]{1,32}$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    url: /^https?:\/\/[^\s"'<>\\]+$/,
    image: /^(?!\/)(?!.*\.\.)[A-Za-z0-9_\-./一-鿿]{1,200}\.(?:png|jpe?g|webp|gif|svg)$/i,
  };
  function validDate(s) {
    if (!RE.date.test(s)) return false;
    const d = new Date(s + "T00:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function checkValue(node, v, path, errs, ctx) {
    const where = path + "（" + node.label + "）";
    const add = (msg) => errs.push({ path, msg: where + " " + msg });
    if (v === null) { if (!node.nullable) add("不能为空"); return; }
    if (v === undefined) return;
    const t = node.type;
    if (["string", "text", "slug", "date", "url", "image", "ref"].includes(t)) {
      if (typeof v !== "string") return add("应该是文字");
      const lim = t === "text" ? LIM.TEXT : t === "url" ? LIM.URL : LIM.STR;
      if (v.length > lim) add("太长（最多 " + lim + " 字）");
      if (node.required && !v.trim()) return add("必填");
      if (!v) return;
      if (t === "slug" && !RE.slug.test(v)) add("只能用小写字母、数字、- 和 _");
      else if (t === "date" && !validDate(v)) add("日期格式应为 YYYY-MM-DD");
      else if (t === "url" && !RE.url.test(v)) add("链接必须以 http:// 或 https:// 开头，且不能含空格、引号、尖括号");
      else if (t === "image" && !RE.image.test(v)) add("图片路径不合法（例：renjie.png 或 uploads/xxxx.jpg）");
      else if (t === "ref") ctx.refs.push({ path, v, where });
    } else if (t === "int") {
      if (typeof v !== "number" || !Number.isInteger(v)) add("应该是整数");
      else if (v < 0 || v > 1000000) add("数值超出范围");
    } else if (t === "stringlist") {
      if (!Array.isArray(v)) return add("应该是文字列表");
      v.forEach((s, i) => { if (typeof s !== "string") errs.push({ path: path + "[" + i + "]", msg: path + "[" + i + "] 应该是文字" }); });
    } else if (t === "object") {
      checkObject(node.fields, v, path, errs, ctx);
    } else if (t === "list") {
      if (!Array.isArray(v)) return add("应该是列表");
      if (v.length > LIM.LIST) return add("条目太多");
      const seen = new Set();
      v.forEach((it, i) => {
        checkObject(node.item, it, path + "[" + i + "]", errs, ctx);
        if (node.unique && it && typeof it === "object") {
          const k = it[node.unique];
          if (seen.has(k)) errs.push({ path: path + "[" + i + "]." + node.unique, msg: path + "[" + i + "]." + node.unique + " 重复：" + k });
          seen.add(k);
        }
      });
    }
  }
  function checkObject(fields, v, path, errs, ctx) {
    if (!v || typeof v !== "object" || Array.isArray(v)) { errs.push({ path, msg: path + " 应该是对象 {…}" }); return; }
    const known = new Set(fields.map((f) => f.key));
    Object.keys(v).forEach((k) => { if (!known.has(k)) errs.push({ path: path + "." + k, msg: path + "." + k + " 是未知字段（允许：" + [...known].join("、") + "）" }); });
    fields.forEach((f) => {
      const p = path ? path + "." + f.key : f.key;
      if (!(f.key in v)) { if (f.required) errs.push({ path: p, msg: p + "（" + f.label + "）缺失" }); return; }
      checkValue(f, v[f.key], p, errs, ctx);
    });
  }
  function validateSection(sec, value) {
    const errs = [];
    const ctx = { refs: [] };
    checkValue(sec, value, sec.key, errs, ctx);
    const programs = (sec.key === "programs" ? value : S.content.programs) || [];
    const ids = new Set(programs.map((p) => p && p.id));
    ctx.refs.forEach((r) => { if (!ids.has(r.v)) errs.push({ path: r.path, msg: r.where + " 是 " + r.v + "，但「活动类型」里没有这个 id" }); });
    if (sec.key === "programs" && errs.length === 0) {
      const bad = [...new Set((S.content.news || []).map((n) => n.cat).filter((c) => !ids.has(c)))];
      if (bad.length) errs.push({ path: "programs", msg: "新闻还在用这些活动类型 id：" + bad.join("、") + "，不能删除或改名" });
    }
    return errs;
  }
  const errPath = (msg) => { const m = /^([A-Za-z0-9_.[\]]+)/.exec(msg); return m ? m[1] : ""; };

  // ------------------------------------------------------------------ 启动、登录
  function showHttpWarning() {
    const insecure = location.protocol === "http:";
    $("#http-warning").hidden = !insecure;
    $("#login-http-note").hidden = !insecure;
  }
  function showLogin(msg) {
    $("#app-view").hidden = true;
    $("#who").hidden = true;
    $("#login-view").hidden = false;
    $("#login-error").textContent = msg || "";
    S.dirty = false;
    const u = $("#login-form").elements.username;
    setTimeout(() => u.focus(), 0);
  }
  async function enterApp() {
    $("#login-view").hidden = true;
    $("#app-view").hidden = false;
    $("#who").hidden = false;
    $("#who-name").textContent = S.user;
    if (!S.schema) S.schema = (await api("GET", "/schema")).sections;
    await loadContent();
    route();
  }
  async function loadContent() {
    S.loadError = null;
    try {
      const r = await api("GET", "/content");
      S.content = r.data; S.version = r.version; S.sites = r.sites || [];
    } catch (e) {
      if (e.status === 401) throw e;
      S.content = null; S.version = null;
      S.loadError = e.message;
    }
  }
  $("#login-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    $("#login-error").textContent = "";
    try {
      const r = await api("POST", "/login", { username: f.elements.username.value.trim(), password: f.elements.password.value });
      f.elements.password.value = "";
      S.user = r.user;
      await enterApp();
    } catch (e) {
      $("#login-error").textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  });
  $("#logout").addEventListener("click", async () => {
    if (S.dirty && !confirm("有未保存的修改，确定退出吗？")) return;
    try { await api("POST", "/logout"); } catch (e) { /* 忽略 */ }
    S.user = null;
    showLogin("已退出");
  });
  window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ------------------------------------------------------------------ 路由
  let lastHash = location.hash;
  window.addEventListener("hashchange", () => {
    if (S.dirty && !confirm("当前栏目有未保存的修改，离开会丢失。确定离开吗？")) {
      history.replaceState(null, "", lastHash || "#/news");
      return;
    }
    S.dirty = false;
    route();
  });
  function route() {
    if (!S.user) return;
    lastHash = location.hash;
    const key = (location.hash.replace(/^#\/?/, "") || "news").split("/")[0];
    document.querySelectorAll(".sidenav a").forEach((a) => a.classList.toggle("active", a.dataset.route === key));
    S.route = key;
    const sec = S.schema.find((s) => s.key === key);
    if (sec) return openSection(sec);
    if (key === "history") return renderHistory();
    if (key === "audit") return renderAudit();
    if (key === "status") return renderStatus();
    if (key === "board") return renderBoard();
    location.hash = "#/news";
  }

  // ------------------------------------------------------------------ 栏目编辑
  function openSection(sec) {
    S.sec = sec;
    S.work = S.content ? clone(S.content[sec.key]) : null;
    S.dirty = false; S.mode = "form"; S.errors = []; S.saved = null; S.open = new WeakSet();
    draw();
    window.scrollTo(0, 0);
  }

  function markDirty() {
    S.dirty = true;
    const flag = $("#dirty-flag");
    if (flag) flag.hidden = false;
    const btn = $("#save-btn");
    if (btn) btn.disabled = false;
    const d = $("#discard-btn");
    if (d) d.disabled = false;
    S.saved = null;
    const sv = $("#saved-notice");
    if (sv) sv.remove();
  }

  function draw() {
    const sec = S.sec;
    const m = main();
    m.replaceChildren();
    m.appendChild(h("div", { class: "page-head" }, h("div", null, h("h1", { text: sec.label }), sec.help ? h("p", { class: "muted small", text: sec.help }) : null)));
    if (S.loadError) {
      m.appendChild(h("div", { class: "notice error", text: S.loadError }));
      return;
    }
    m.appendChild(h("div", { class: "toolbar" },
      h("div", { class: "seg", role: "group", "aria-label": "编辑方式" },
        h("button", { type: "button", class: S.mode === "form" ? "on" : "", onclick: () => switchMode("form") }, "表单"),
        h("button", { type: "button", class: S.mode === "json" ? "on" : "", onclick: () => switchMode("json") }, "JSON 文本")),
      h("span", { id: "dirty-flag", class: "dirty-flag", hidden: !S.dirty }, "● 有未保存的修改"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", id: "discard-btn", class: "btn", disabled: !S.dirty, onclick: discard }, "放弃修改"),
      h("button", { type: "button", id: "save-btn", class: "btn primary", disabled: !S.dirty, onclick: save }, "保存")));
    if (S.errors.length) {
      m.appendChild(h("div", { class: "notice error", role: "alert" }, "没有保存，请先改正下面的问题：",
        h("ul", null, S.errors.slice(0, 30).map((e) => h("li", { text: e.msg })))));
    }
    if (S.saved) m.appendChild(savedNotice(S.saved.changes, S.saved.sites));
    if (S.mode === "json") {
      const ta = h("textarea", { class: "json", spellcheck: "false", "aria-label": sec.label + " JSON", value: S.jsonText,
        oninput: (e) => { S.jsonText = e.target.value; markDirty(); } });
      m.appendChild(h("p", { class: "muted small", text: "直接编辑这个栏目的 JSON。保存前会检查格式和字段，结构不对不会保存。" }));
      m.appendChild(ta);
      return;
    }
    if (sec.type === "list") m.appendChild(listEditor(sec, S, "work", sec.key));
    else m.appendChild(objectEditor(sec.fields, S.work, sec.key));
  }

  function savedNotice(changes, sites) {
    const box = h("div", { class: "notice ok", id: "saved-notice", role: "status" }, h("strong", null, "已保存，网站已经读到新内容。"));
    if (changes && changes.length) box.appendChild(h("ul", null, changes.slice(0, 10).map((c) => h("li", { text: c }))));
    if (sites && sites.length) {
      box.appendChild(h("div", { class: "saved-links" }, "在网站上看看：",
        sites.map((s, i) => h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name + (i === 0 ? "（首页）" : "")))));
    }
    return box;
  }

  function switchMode(mode) {
    if (mode === S.mode) return;
    if (mode === "json") {
      S.jsonText = JSON.stringify(S.work, null, 2);
    } else {
      try { S.work = JSON.parse(S.jsonText); } catch (e) {
        S.errors = [{ path: "", msg: "JSON 格式错误：" + e.message }];
        return draw();
      }
      S.errors = [];
    }
    S.mode = mode;
    draw();
  }

  function discard() {
    if (!confirm("放弃这个栏目所有未保存的修改？")) return;
    openSection(S.sec);
  }

  async function save() {
    const sec = S.sec;
    if (S.mode === "json") {
      try { S.work = JSON.parse(S.jsonText); } catch (e) {
        S.errors = [{ path: "", msg: "JSON 格式错误：" + e.message }];
        draw(); return;
      }
    }
    S.errors = validateSection(sec, S.work);
    if (S.errors.length) { draw(); window.scrollTo(0, 0); return; }
    const btn = $("#save-btn");
    btn.disabled = true; btn.textContent = "保存中…";
    try {
      const r = await api("PUT", "/content/" + sec.key, { data: S.work, base_version: S.version });
      S.content[sec.key] = clone(S.work);
      S.version = r.version;
      S.sites = r.sites || S.sites;
      S.dirty = false;
      S.saved = { changes: r.changes, sites: S.sites };
      if (S.mode === "json") S.jsonText = JSON.stringify(S.work, null, 2);
      toast("已保存");
    } catch (e) {
      if (e.status === 401) return;
      const list = (e.data && e.data.errors) || [];
      S.errors = list.length ? list.map((msg) => ({ path: errPath(msg), msg })) : [{ path: "", msg: e.message }];
    }
    draw();
    window.scrollTo(0, 0);
  }

  // ---- 表单生成
  const SHORT = new Set(["date", "ref", "slug", "int"]);
  function hasErr(prefix) { return S.errors.some((e) => e.path === prefix || e.path.startsWith(prefix + ".") || e.path.startsWith(prefix + "[")); }
  function exactErr(path) { return S.errors.some((e) => e.path === path); }

  function makeDefault(fields) {
    const o = {};
    fields.forEach((f) => {
      if (f.type === "list") o[f.key] = [];
      else if (f.type === "object") o[f.key] = makeDefault(f.fields);
      else if (f.type === "stringlist") { /* 可选，不预置 */ }
      else if (f.type === "date") o[f.key] = todayStr();
      else if (f.type === "ref") o[f.key] = ((S.content.programs || [])[0] || {}).id || "";
      else if (f.nullable) o[f.key] = null;
      else if (f.type === "int") o[f.key] = 0;
      else o[f.key] = "";
    });
    return o;
  }

  function summaryOf(node, item) {
    const keys = node.summary || [];
    const span = h("span", { class: "item-summary" });
    if (!item || typeof item !== "object") { span.textContent = JSON.stringify(item); return span; }
    if (keys.length > 1) {
      span.appendChild(h("span", { class: "sub", text: String(item[keys[0]] ?? "") }));
      span.appendChild(document.createTextNode(String(item[keys[1]] ?? "") || "（未填写）"));
    } else {
      span.textContent = String(item[keys[0]] ?? "") || "（未填写）";
    }
    return span;
  }

  // holder[key] 是数组；数组不存在时，新增第一条才挂上去，避免凭空多出空字段
  function listEditor(node, holder, key, path) {
    const arr = Array.isArray(holder[key]) ? holder[key] : [];
    const wrap = h("div");
    const atTop = path === "news";
    const addBtn = h("button", { type: "button", class: "btn small list-add", onclick: () => {
      const it = makeDefault(node.item);
      if (!Array.isArray(holder[key])) holder[key] = arr;
      if (atTop) arr.unshift(it); else arr.push(it);
      S.open.add(it);
      markDirty(); draw();
    } }, "+ 新增" + (node.itemLabel || "一条") + (atTop ? "（放在最前）" : ""));
    wrap.appendChild(addBtn);
    const list = h("div", { class: "list" });
    if (!arr.length) list.appendChild(h("p", { class: "muted small", text: "还没有内容。" }));
    arr.forEach((item, i) => {
      const p = path + "[" + i + "]";
      const err = hasErr(p);
      if (err && item && typeof item === "object") S.open.add(item);
      const isOpen = item && typeof item === "object" && S.open.has(item);
      const toggle = () => { if (isOpen) S.open.delete(item); else S.open.add(item); draw(); };
      const move = (d) => {
        const j = i + d;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        markDirty(); draw();
      };
      const head = h("div", { class: "item-head" },
        h("span", { class: "item-index", text: String(i + 1) }),
        Object.assign(summaryOf(node, item), { onclick: toggle, title: "点击展开 / 收起" }),
        h("span", { class: "item-actions" },
          h("button", { type: "button", class: "btn small", title: "上移", "aria-label": "上移第 " + (i + 1) + " 条", disabled: i === 0, onclick: () => move(-1) }, "↑"),
          h("button", { type: "button", class: "btn small", title: "下移", "aria-label": "下移第 " + (i + 1) + " 条", disabled: i === arr.length - 1, onclick: () => move(1) }, "↓"),
          h("button", { type: "button", class: "btn small", "aria-expanded": isOpen ? "true" : "false", onclick: toggle }, isOpen ? "收起" : "编辑"),
          h("button", { type: "button", class: "btn small danger", onclick: () => {
            const label = (summaryOf(node, item).textContent || "").slice(0, 40);
            if (!confirm("删除这条" + (node.itemLabel || "") + "？\n" + label + "\n（保存后生效；保存前可以「放弃修改」）")) return;
            arr.splice(i, 1);
            markDirty(); draw();
          } }, "删除")));
      const card = h("div", { class: "item" + (err ? " has-error" : "") }, head);
      if (isOpen) card.appendChild(h("div", { class: "item-body" }, objectEditor(node.item, item, p)));
      list.appendChild(card);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function objectEditor(fields, obj, path) {
    const box = h("div");
    let row = null;
    fields.forEach((f) => {
      const el = fieldEditor(f, obj, path + "." + f.key);
      if (SHORT.has(f.type)) {
        if (!row) { row = h("div", { class: "grid-2" }); box.appendChild(row); }
        row.appendChild(el);
        if (row.children.length === 2) row = null;
      } else {
        row = null;
        box.appendChild(el);
      }
    });
    return box;
  }

  function labelFor(f) {
    return h("span", null, f.label, f.required ? h("span", { class: "req", "aria-hidden": "true" }, "*") : null);
  }

  function setVal(obj, f, raw) {
    if (raw === "") obj[f.key] = f.nullable ? null : "";
    else obj[f.key] = raw;
    markDirty();
  }

  function fieldEditor(f, obj, path) {
    const k = f.key;
    if (f.type === "list") {
      return h("fieldset", { class: "nested" }, h("legend", { text: f.label }), listEditor(f, obj, k, path));
    }
    if (f.type === "object") {
      if (!obj[k] || typeof obj[k] !== "object") obj[k] = {};
      return h("fieldset", { class: "nested" }, h("legend", { text: f.label }), objectEditor(f.fields, obj[k], path));
    }
    const invalid = exactErr(path) ? "invalid" : null;
    const id = "f-" + path.replace(/[^A-Za-z0-9]/g, "-");
    const cur = obj[k];
    let input;
    const clearInvalid = (e) => e.target.classList.remove("invalid");
    if (f.type === "text") {
      input = h("textarea", { id, class: invalid, rows: String(Math.min(10, Math.max(3, Math.ceil(String(cur || "").length / 48)))),
        value: cur ?? "", oninput: (e) => { clearInvalid(e); setVal(obj, f, e.target.value); } });
    } else if (f.type === "stringlist") {
      input = h("textarea", { id, class: invalid, rows: String(Math.max(3, (cur || []).length + 1)), value: (cur || []).join("\n"),
        oninput: (e) => { clearInvalid(e); obj[k] = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); markDirty(); } });
    } else if (f.type === "ref") {
      const progs = S.content.programs || [];
      input = h("select", { id, class: invalid, onchange: (e) => { clearInvalid(e); setVal(obj, f, e.target.value); } },
        progs.map((p) => h("option", { value: p.id, text: p.name + "（" + p.id + "）" })));
      if (cur && !progs.some((p) => p.id === cur)) input.appendChild(h("option", { value: cur, text: cur + "（不存在）" }));
      input.value = cur ?? "";
    } else if (f.type === "int") {
      input = h("input", { id, class: invalid, type: "number", inputmode: "numeric", min: "0", step: "1", value: cur ?? "",
        oninput: (e) => {
          clearInvalid(e);
          const v = e.target.value.trim();
          if (v === "") obj[k] = f.nullable ? null : 0;
          else obj[k] = /^\d+$/.test(v) ? parseInt(v, 10) : v;
          markDirty();
        } });
    } else if (f.type === "image") {
      return imageField(f, obj, path, id, invalid);
    } else {
      const type = f.type === "date" ? "date" : f.type === "url" ? "url" : "text";
      input = h("input", { id, class: invalid, type, value: cur ?? "", maxlength: f.type === "url" ? "1000" : "300",
        placeholder: f.type === "url" ? "https://…" : null,
        oninput: (e) => { clearInvalid(e); setVal(obj, f, e.target.value.trim() === "" ? "" : e.target.value); } });
    }
    return h("label", { class: "field", for: id }, labelFor(f), input, f.help ? h("div", { class: "help", text: f.help }) : null);
  }

  function imgSrc(v) { return v ? "/shared/img/" + v.split("/").map(encodeURIComponent).join("/") : ""; }

  function imageField(f, obj, path, id, invalid) {
    const k = f.key;
    const thumb = h("img", { class: "thumb", alt: "", src: imgSrc(obj[k]) || null, hidden: !obj[k] });
    thumb.addEventListener("error", () => { thumb.hidden = true; });
    const text = h("input", { id, class: invalid, type: "text", value: obj[k] ?? "", placeholder: "例：renjie.png",
      oninput: (e) => { e.target.classList.remove("invalid"); setVal(obj, f, e.target.value.trim()); thumb.src = imgSrc(obj[k]); thumb.hidden = !obj[k]; } });
    const status = h("div", { class: "help" });
    const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", "aria-label": "上传" + f.label,
      onchange: async (e) => {
        const fl = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!fl) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(fl.type)) { status.textContent = "只支持 JPG、PNG、WebP"; return; }
        if (fl.size > 3 * 1024 * 1024) { status.textContent = "图片不能超过 3 MB，请先压缩"; return; }
        status.textContent = "上传中…";
        try {
          const r = await api("POST", "/uploads", fl);
          obj[k] = r.value;
          text.value = r.value;
          thumb.src = imgSrc(r.value); thumb.hidden = false;
          status.textContent = "已上传，记得点「保存」";
          markDirty();
        } catch (err) {
          status.textContent = "上传失败：" + err.message;
        }
      } });
    const clear = h("button", { type: "button", class: "btn small", onclick: () => { text.value = ""; setVal(obj, f, ""); thumb.hidden = true; } }, "清除");
    return h("div", { class: "field" },
      h("label", { for: id }, labelFor(f)),
      h("div", { class: "image-field" }, thumb,
        h("div", { class: "img-input" }, text,
          h("div", { class: "btn-row", style: null }, h("span", { class: "btn small upload-btn" }, "上传图片", file), clear),
          status, f.help ? h("div", { class: "help", text: f.help + "（JPG / PNG / WebP，不超过 3 MB）" }) : null)));
  }

  // ------------------------------------------------------------------ 历史版本
  async function renderHistory() {
    const m = main();
    m.replaceChildren(h("h1", { text: "历史版本" }), h("p", { class: "muted", text: "读取中…" }));
    let r;
    try { r = await api("GET", "/history"); } catch (e) { if (e.status !== 401) m.appendChild(h("div", { class: "notice error", text: e.message })); return; }
    m.replaceChildren(h("h1", { text: "历史版本" }),
      h("p", { class: "muted", text: "每次保存前，服务器会把保存前的内容存一份，保留最近 " + r.keep + " 份。恢复某一份时，当前内容也会先存一份，所以恢复本身也可以撤销。" }));
    if (S.saved && S.route === "history") m.appendChild(savedNotice(null, S.sites));
    if (!r.items.length) { m.appendChild(h("p", { class: "muted", text: "还没有历史版本。" })); return; }
    const tbody = h("tbody");
    r.items.forEach((it) => {
      const diffRow = h("tr", { hidden: true }, h("td", { colspan: "4", class: "diff-box" }));
      const showDiff = async () => {
        if (!diffRow.hidden) { diffRow.hidden = true; return; }
        const cell = diffRow.firstChild;
        cell.replaceChildren(h("span", { class: "muted", text: "比较中…" }));
        diffRow.hidden = false;
        try {
          const d = await api("GET", "/history/" + encodeURIComponent(it.name));
          cell.replaceChildren();
          if (d.diff.same) { cell.appendChild(h("p", { text: "和当前网站内容完全一样。" })); return; }
          cell.appendChild(h("p", { class: "muted small", text: "如果恢复这一份，网站内容会发生这些变化（当前 → 这份）：" }));
          d.diff.sections.forEach((s) => {
            cell.appendChild(h("h3", { text: s.label }));
            cell.appendChild(h("ul", null, s.lines.map((ln) => h("li", { text: ln }))));
          });
        } catch (e) { cell.replaceChildren(h("span", { class: "notice error", text: e.message })); }
      };
      const restore = async () => {
        if (!confirm("把网站内容恢复成「" + it.user + " 在 " + it.time + " 保存之前」的版本？\n当前内容会先备份，可以再恢复回来。")) return;
        try {
          await api("POST", "/history/" + encodeURIComponent(it.name) + "/restore", { base_version: r.current_version });
          await loadContent();
          S.saved = { changes: null, sites: S.sites };
          toast("已恢复");
          renderHistory();
        } catch (e) { if (e.status !== 401) alert(e.message); }
      };
      tbody.appendChild(h("tr", null,
        h("td", { class: "nowrap", text: it.time }),
        h("td", { text: it.user + " 保存之前" }),
        h("td", { class: "nowrap", text: (it.size / 1024).toFixed(1) + " KB" }),
        h("td", { class: "nowrap" }, h("span", { class: "btn-row" },
          h("button", { type: "button", class: "btn small", onclick: showDiff }, "查看差异"),
          h("button", { type: "button", class: "btn small danger", onclick: restore }, "恢复这份")))));
      tbody.appendChild(diffRow);
    });
    m.appendChild(h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, h("th", { text: "时间（北京时间）" }), h("th", { text: "版本" }), h("th", { text: "大小" }), h("th", { text: "操作" }))),
      tbody)));
    S.saved = null;
  }

  // ------------------------------------------------------------------ 操作记录
  async function renderAudit() {
    const m = main();
    m.replaceChildren(h("h1", { text: "操作记录" }), h("p", { class: "muted", text: "读取中…" }));
    let r;
    try { r = await api("GET", "/audit"); } catch (e) { if (e.status !== 401) m.appendChild(h("div", { class: "notice error", text: e.message })); return; }
    m.replaceChildren(h("h1", { text: "操作记录" }), h("p", { class: "muted", text: "最近 300 条，时间为北京时间。「cli」表示在服务器终端执行的操作。" }));
    if (!r.items.length) { m.appendChild(h("p", { class: "muted", text: "还没有记录。" })); return; }
    m.appendChild(h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, ["时间", "操作人", "操作", "栏目", "详情", "IP"].map((t) => h("th", { text: t })))),
      h("tbody", null, r.items.map((it) => h("tr", null,
        h("td", { class: "nowrap", text: it.time }), h("td", { text: it.user }), h("td", { class: "nowrap", text: it.action }),
        h("td", { text: it.section || "" }), h("td", { class: "detail", text: it.detail || "" }), h("td", { class: "nowrap muted", text: it.ip || "" })))))));
  }

  // ------------------------------------------------------------------ 排行榜（只能看和删）
  async function renderBoard(gameKey) {
    const m = main();
    const head = () => [h("h1", { text: "排行榜" }),
      h("p", { class: "muted", text: "两个游戏网页的全社团公用榜。每个昵称只留最好成绩。看到不当昵称就删掉；删掉后对方可以重新提交，频繁出现可以在服务器终端查 IP。" })];
    m.replaceChildren(...head(), h("p", { class: "muted", text: "读取中…" }));
    let games;
    try { games = (await api("GET", "/board")).games; } catch (e) { if (e.status !== 401) m.appendChild(h("div", { class: "notice error", text: e.message })); return; }
    const cur = games.find((g) => g.key === gameKey) || games[0];
    let r;
    try { r = await api("GET", "/board/" + encodeURIComponent(cur.key)); } catch (e) { if (e.status !== 401) m.appendChild(h("div", { class: "notice error", text: e.message })); return; }
    if (S.route !== "board") return;
    const tabs = h("div", { class: "btn-row" }, games.map((g) => h("button", {
      type: "button", class: "btn small" + (g.key === cur.key ? " primary" : ""),
      onclick: () => renderBoard(g.key),
    }, g.label + "（" + g.total + " 条）")));
    m.replaceChildren(...head(), tabs,
      h("p", { class: "muted small", text: "最多保留前 " + cur.keep + " 名；这里列出前 200 名。时间为北京时间。" }));
    if (!r.items.length) { m.appendChild(h("p", { class: "muted", text: "还没有记录。" })); return; }
    m.appendChild(h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, ["名次", "昵称", "成绩", "最近刷新", "IP", "操作"].map((t) => h("th", { text: t })))),
      h("tbody", null, r.items.map((it) => h("tr", null,
        h("td", { class: "nowrap", text: String(it.rank) }), h("td", { text: it.name }),
        h("td", { class: "nowrap", text: it.score + " " + r.unit }), h("td", { class: "nowrap", text: it.updated }),
        h("td", { class: "nowrap muted", text: it.ip }),
        h("td", null, h("button", {
          type: "button", class: "btn small danger",
          onclick: async () => {
            if (!confirm("删除「" + it.name + "」的这条记录（" + it.score + " " + r.unit + "）？删除后不能恢复。")) return;
            try { await api("DELETE", "/board/" + encodeURIComponent(cur.key) + "/" + it.id); toast("已删除"); renderBoard(cur.key); }
            catch (e) { if (e.status !== 401) alert(e.message); }
          },
        }, "删除")))))))));
  }

  // ------------------------------------------------------------------ 服务器状态（只读，没有任何操作按钮）
  function stat(k, v, d) { return h("div", { class: "stat" }, h("div", { class: "k", text: k }), h("div", { class: "v", text: v || "—" }), d ? h("div", { class: "d", text: d }) : null); }
  function pill(text, cls) { return h("span", { class: "pill " + cls, text }); }

  async function renderStatus() {
    const m = main();
    m.replaceChildren(h("h1", { text: "服务器状态" }), h("p", { class: "muted", text: "读取中…" }));
    let r;
    try { r = await api("GET", "/status"); } catch (e) { if (e.status !== 401) m.appendChild(h("div", { class: "notice error", text: e.message })); return; }
    m.replaceChildren(h("h1", { text: "服务器状态" }),
      h("p", { class: "muted", text: "只读页面，读取于 " + r.generated + "（北京时间）。刷新浏览器即可重新读取。" }));

    // 服务
    const sv = r.services;
    const sBlock = h("section", { class: "block" }, h("h2", { text: "用户级 systemd 服务" }));
    if (!sv.available) sBlock.appendChild(h("div", { class: "notice warn", text: sv.message || "本机没有 systemd" }));
    else {
      if (sv.message) sBlock.appendChild(h("div", { class: "notice warn", text: sv.message }));
      sBlock.appendChild(h("div", { class: "table-wrap" }, h("table", null,
        h("thead", null, h("tr", null, ["服务", "开机启动", "运行状态", "已运行", "内存"].map((t) => h("th", { text: t })))),
        h("tbody", null, sv.units.map((u) => h("tr", { class: u.main ? "main-unit" : null },
          h("td", null, h("strong", { text: u.name }), u.main ? " ← 网站主服务" : null, u.description ? h("div", { class: "muted small", text: u.description }) : null),
          h("td", null, u.autostart ? pill("开机启动", "ok") : pill(u.enabled || "未设置", "off")),
          h("td", null, u.running ? pill("运行中", "ok") : u.active === "failed" ? pill("失败", "bad") : pill(u.active + " / " + u.sub, "off")),
          h("td", { class: "nowrap", text: u.running_for || "—" }),
          h("td", { class: "nowrap", text: u.memory ? u.memory + (u.memory_note === "主进程 RSS" ? "（主进程）" : "") : "—" })))))));
    }
    m.appendChild(sBlock);

    // 系统
    const sy = r.system;
    const mem = sy.memory;
    const stats = h("div", { class: "stats" });
    if (mem) stats.appendChild(stat("内存", (mem.used_pct != null ? mem.used_pct + "% 已用" : ""), "总 " + mem.total + "，可用 " + mem.available + (mem.cgroup_current ? "；容器 " + mem.cgroup_current + " / " + mem.cgroup_max : "")));
    else stats.appendChild(stat("内存", "—", "本机没有 /proc"));
    if (sy.disk) stats.appendChild(stat("磁盘 " + sy.disk.path, sy.disk.used_pct + "% 已用", "已用 " + sy.disk.used + " / 共 " + sy.disk.total + "，剩 " + sy.disk.free));
    stats.appendChild(stat("负载（1 / 5 / 15 分钟）", sy.load, "CPU " + (sy.cpu_count || "?") + " 核"));
    stats.appendChild(stat("开机时长", sy.uptime));
    m.appendChild(h("section", { class: "block" }, h("h2", { text: "系统" }), stats));

    // 网站目录
    m.appendChild(h("section", { class: "block" }, h("h2", { text: "网站版本目录" }),
      r.sites.length ? h("div", { class: "table-wrap" }, h("table", null,
        h("thead", null, h("tr", null, ["目录", "目录内最新文件时间", "目录修改时间"].map((t) => h("th", { text: t })))),
        h("tbody", null, r.sites.map((d) => h("tr", null,
          h("td", null, h("a", { href: d.url, target: "_blank", rel: "noopener", text: d.name })),
          h("td", { class: "nowrap", text: d.newest_file }), h("td", { class: "nowrap", text: d.dir_mtime })))))) :
        h("p", { class: "muted", text: "没有找到网站目录。" })));

    // 日志
    m.appendChild(h("section", { class: "block" }, h("h2", { text: "dsh.service 最近 50 行日志" }),
      h("pre", { class: "log", text: r.journal.text || "（空）" })));

    // 命令
    m.appendChild(h("section", { class: "block" }, h("h2", { text: "修改请在服务器终端操作" }),
      h("p", { class: "muted", text: "这个页面只显示状态，不能执行任何操作。需要重启、看日志、部署时，SSH 登录服务器后运行：" }),
      h("ul", { class: "cmds" }, r.commands.map((c) => h("li", null, c.label, h("code", { text: c.cmd }))))));
  }

  // ------------------------------------------------------------------ 启动
  showHttpWarning();
  (async function boot() {
    try {
      const me = await api("GET", "/me");
      S.user = me.user;
      await enterApp();
    } catch (e) {
      if (e.status !== 401) showLogin(e.message);
    }
  })();
})();
