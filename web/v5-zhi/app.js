/* 方案五 · 小智：内容全部来自 ../shared/content.js */
(function () {
  const C = window.CLUB;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const catName = Object.fromEntries(C.programs.map((p) => [p.id, p.name]));
  const SHORT = { weld: "焊接课", course: "昇腾 AI 课", visit: "企业参访", contest: "创新大赛", talk: "分享会" };
  const shortOf = (id, name) => SHORT[id] || name || "";
  const slogan = (t) => { const p = String(t).split(/\s*[|丨]\s*|\s*——\s*/); return (p.length > 1 ? p[0] : t).replace(/[“”"]/g, ""); };
  const dot = (d) => String(d).replaceAll("-", ".");
  const WX = String((C.meta.contact && C.meta.contact.wechat) || "上海大学通信学院（公众号）").replace(/（.*?）|\(.*?\)/g, "");

  // 菜单
  const mb = $(".menu-btn"), nav = $("#nav");
  mb.addEventListener("click", () => { const o = nav.classList.toggle("is-open"); mb.setAttribute("aria-expanded", o); mb.textContent = o ? "关闭" : "菜单"; });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("is-open"); mb.setAttribute("aria-expanded", "false"); mb.textContent = "菜单"; } });

  // 首屏眉题 + 最近一次活动
  $("#eyebrow").textContent = ["上海大学", C.meta.host, C.meta.founded ? C.meta.founded + " 年成立" : ""].filter(Boolean).join(" · ");
  const latest = C.news[0];
  if (latest) {
    const a = $("#latest");
    a.href = latest.source;
    a.innerHTML = `<span class="latest__k">最近活动</span><time>${dot(latest.date)}</time>` +
      `<span class="latest__t">${esc(slogan(latest.title))}</span><span class="latest__c">${esc(shortOf(latest.cat))}</span>` +
      `<span class="latest__go">学院官网原文 →</span>`;
  } else $(".latest").hidden = true;

  // 数字：都出自报道
  const first = C.news.length ? C.news[C.news.length - 1].date.slice(0, 4) : "";
  const numbers = [
    { n: "近 200", t: "人来听过一场 AI 论文分享会" },
    { n: "100+", t: "名同学一起去了 2024 华为全联接大会" },
    { n: "40+", t: "名同学入选 2026 年昇腾大模型实践课" },
    { n: String(C.news.length), t: "篇学院官网报道" + (first ? "，" + first + " 年至今" : "") }
  ];
  $("#numbers").innerHTML = numbers.map((x) => `<li><b>${esc(x.n)}</b><span>${esc(x.t)}</span></li>`).join("");

  // 活动：一行一项，序号 + 名称 + 说明 + 地点 + 相关报道
  $("#programs").innerHTML = C.programs.map((p, i) => {
    const n = C.news.filter((x) => x.cat === p.id).length;
    return `<li>
      <span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <div class="body"><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p></div>
      <span class="where">${esc(p.where)}</span>
      <a class="count" href="#news" data-jump="${p.id}">${n} 篇报道 →</a>
    </li>`;
  }).join("");

  // 一节焊接课（2026 年 10 月“焊动金秋”）
  const session = [
    { t: "先讲基础", d: "电烙铁怎么握、焊锡怎么送、好的焊点长什么样。" },
    { t: "看看作品", d: "学术部带来社团自己做的机器小车，讲它是怎么做出来的。" },
    { t: "安全第一", d: "烙铁怎么放、线头怎么处理、怎样不被烫到。" },
    { t: "上手焊", d: "先焊单个焊点，再焊导线，学长学姐在旁边一对一看着。" }
  ];
  $("#session").innerHTML = session.map((s, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(s.t)}</b><p>${esc(s.d)}</p></div></li>`).join("");

  // 动态：一行一条，日期 / 标题 / 类型 / 原文
  const PAGE = 5; let cat = "all", shown = PAGE;
  $("#chips").innerHTML = [{ id: "all", name: "全部" }, ...C.programs].map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === "all"}">${esc(c.id === "all" ? "全部" : shortOf(c.id, c.name))}</button>`).join("");
  function renderNews() {
    const list = C.news.filter((n) => cat === "all" || n.cat === cat);
    $("#news-list").innerHTML = list.slice(0, shown).map((n, i) => {
      const parts = n.title.split(/\s*[|丨]\s*/);
      const head = parts.length > 1 ? parts[1] : n.title;
      return `<li class="${i === 0 ? "is-top" : ""}"><a href="${esc(n.source)}" target="_blank" rel="noopener">
        <time>${dot(n.date)}</time>
        <div class="body"><h3>${esc(head)}</h3><p>${esc(n.summary)}</p></div>
        <span class="cat">${esc(shortOf(n.cat, catName[n.cat]))}</span>
        <span class="go" aria-hidden="true">原文 →</span></a></li>`;
    }).join("");
    const left = list.length - shown;
    $("#more").hidden = left <= 0;
    $("#more").textContent = `再看 ${Math.min(PAGE, left)} 条（共 ${list.length} 条）`;
  }
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    cat = b.dataset.cat; shown = PAGE;
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderNews();
  });
  $("#more").addEventListener("click", () => { shown += PAGE; renderNews(); });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-jump]"); if (a) document.querySelector(`#chips [data-cat="${a.dataset.jump}"]`)?.click(); });
  renderNews();

  // 承办协办
  $("#honors").innerHTML = C.honors.map((h) => `<li><span class="y">${esc(h.year)}</span><span>${esc(h.text)}</span><a href="${esc(h.source)}" target="_blank" rel="noopener">原文</a></li>`).join("");

  // 人物：社长带照片；老师没有照片就只放文字，不用字块冒充头像
  const person = (p, lead) => {
    const [r1, r2] = String(p.role).split(" · ");
    const av = p.photo ? `<div class="av"><img src="../shared/img/${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy"></div>` : "";
    return `<li class="${lead ? "is-lead" : ""}${av ? "" : " no-av"}">${av}<div class="who">
      <h3>${esc(p.name)}</h3><p class="role">${esc(r1)}${r2 ? `<span>${esc(r2)}</span>` : ""}</p>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ""}${p.awards ? `<ul>${p.awards.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}</div></li>`;
  };
  $("#people-list").innerHTML = C.people.leaders.map((p) => person(p, true)).join("") + C.people.teachers.map((p) => person(p, false)).join("");

  // 加入
  $("#join-steps").innerHTML = C.join.steps.map((s, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(s.t)}</b><p>${esc(s.d)}</p></div></li>`).join("");
  $("#depts").innerHTML = C.meta.departments.map((d, i) => `<button type="button" role="radio" aria-checked="false" data-i="${i}">${esc(d.name)}</button>`).join("");
  $("#depts").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#depts button").forEach((x) => x.setAttribute("aria-checked", x === b));
    const d = C.meta.departments[b.dataset.i];
    $("#dept-desc").textContent = `${d.name}：${d.desc}。`;
  });
  // 有报名问卷就直接去填；没有就让人去关注公众号（点一下复制公众号名），不放灰掉的按钮
  const box = $("#join-cta-box");
  if (C.join.formUrl) {
    box.innerHTML = `<a class="btn btn--yellow" href="${esc(C.join.formUrl)}" target="_blank" rel="noopener">填写报名问卷</a>` +
      (C.join.season ? `<span class="season">招新时间：${esc(C.join.season)}</span>` : "");
  } else {
    box.innerHTML = `<button type="button" class="btn btn--yellow" id="copy-wx">复制公众号名：${esc(WX)}</button>` +
      `<span class="season" id="wx-tip">${C.join.season ? "招新时间：" + esc(C.join.season) + "。" : ""}招新和活动预告都发在这个公众号上。</span>`;
    // 网站目前是 HTTP，navigator.clipboard 不可用，用老办法（选中隐藏文本框再复制）
    $("#copy-wx").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      let ok = false;
      try {
        const ta = document.createElement("textarea");
        ta.value = WX; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, WX.length);
        ok = document.execCommand("copy");
        ta.remove();
      } catch (_) { ok = false; }
      btn.textContent = ok ? "已复制，去微信搜索关注" : "微信里搜索：" + WX;
    });
  }
  $("#faq").innerHTML = C.join.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

  // 页脚：动态更新到哪天
  if (latest) $("#foot-src").textContent = `活动和动态均出自通信与信息工程学院官网公开报道，最近一条：${dot(latest.date)}。`;

  // 手机端：滚过首屏后出现“加入我们”，到了加入版块自动隐藏
  const fab = document.createElement("a");
  fab.className = "fab"; fab.href = "#join"; fab.textContent = "加入我们";
  document.body.appendChild(fab);
  const hero = $(".hero"), join = $("#join");
  if ("IntersectionObserver" in window && hero && join) {
    let past = false, atJoin = false;
    const sync = () => fab.classList.toggle("is-on", past && !atJoin);
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(hero);
    new IntersectionObserver(([e]) => { atJoin = e.isIntersecting; sync(); }, { threshold: 0.05 }).observe(join);
  }
})();
