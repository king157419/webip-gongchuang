/* 方案四 · 小智：内容全部来自 ../shared/content.js */
(function () {
  const C = window.CLUB;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TBD = '<span class="tbd">待社团补充</span>';
  const catName = Object.fromEntries(C.programs.map((p) => [p.id, p.name]));
  const short = (n) => n.replace(/教学实践|技术课程|与开发者活动|系列分享会/g, "");

  // menu
  const mb = $(".menu-btn"), nav = $("#nav");
  mb.addEventListener("click", () => { const o = nav.classList.toggle("is-open"); mb.setAttribute("aria-expanded", o); mb.textContent = o ? "关闭" : "菜单"; });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("is-open"); mb.setAttribute("aria-expanded", "false"); mb.textContent = "菜单"; } });

  // 数字：全部出自报道或社团基本信息
  const facts = [
    { fig: C.meta.founded, cap: "年成立" },
    { fig: C.meta.departments.length, cap: "个部门：" + C.meta.departments.map((d) => d.name.replace("部", "")).join("、") },
    { fig: "200", pre: "近", cap: "人来听过一场 AI 论文分享会" },
    { fig: "100+", cap: "名同学一起去了 2024 华为全联接大会" },
    { fig: "40+", cap: "名同学入选 2026 年昇腾大模型实践课" }
  ];
  $("#facts").innerHTML = facts.map((f) => `<li><span class="fig">${f.pre ? `<small>${f.pre}</small>` : ""}${esc(f.fig)}</span><span class="cap">${esc(f.cap)}</span></li>`).join("");

  // 活动
  $("#programs").innerHTML = C.programs.map((p) => {
    const n = C.news.filter((x) => x.cat === p.id).length;
    return `<li><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><span class="where">${esc(p.where)}</span><a class="count" href="#news" data-jump="${p.id}">${n} 篇报道</a></li>`;
  }).join("") + `<li class="cards__join"><h3>有想办的活动？</h3><p>学术部和组织部都欢迎新点子，下一场活动可以由你来张罗。</p><a href="#join">去报名</a></li>`;

  // 一节焊接课（2026 年 10 月“焊动金秋”）
  const session = [
    { t: "先讲基础", d: "电烙铁怎么握、焊锡怎么送、好的焊点长什么样。" },
    { t: "看看作品", d: "学术部带来社团自己做的机器小车，讲它是怎么做出来的。" },
    { t: "安全第一", d: "烙铁怎么放、线头怎么处理、怎样不被烫到。" },
    { t: "上手焊", d: "先焊单个焊点，再焊导线，学长学姐在旁边一对一看着。" }
  ];
  $("#session").innerHTML = session.map((s, i) => `<li><span class="n">0${i + 1}</span><b>${esc(s.t)}</b><p>${esc(s.d)}</p></li>`).join("");

  // 新闻
  const PAGE = 3; let cat = "all", shown = PAGE;
  $("#chips").innerHTML = [{ id: "all", name: "全部" }, ...C.programs].map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === "all"}">${esc(short(c.name))}</button>`).join("");
  function renderNews() {
    const list = C.news.filter((n) => cat === "all" || n.cat === cat);
    $("#news-list").innerHTML = list.slice(0, shown).map((n) => {
      const parts = n.title.split(/\s*[|丨]\s*/);
      const head = parts.length > 1 ? parts[1] : n.title;
      return `<li><a href="${esc(n.source)}" target="_blank" rel="noopener">
        <span class="meta"><span class="date">${n.date.replaceAll("-", ".")}</span><span class="cat">${esc(short(catName[n.cat] || ""))}</span></span>
        <h3>${esc(head)}</h3><p>${esc(n.summary)}</p><span class="read">读原文</span></a></li>`;
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

  // 人物
  const person = (p, lead) => {
    const [r1, r2] = String(p.role).split(" · ");
    const av = p.photo ? `<img src="../shared/img/${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : `<span>${esc(p.name[0])}</span>`;
    return `<li class="${lead ? "is-lead" : ""}"><div class="av">${av}</div><div class="who">
      <h3>${esc(p.name)}</h3><div class="role">${esc(r1)}${r2 ? `<span>${esc(r2)}</span>` : ""}</div>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : TBD}${p.awards ? `<ul>${p.awards.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}</div></li>`;
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
  $("#season").innerHTML = C.join.season ? "招新时间：" + esc(C.join.season) : "招新时间 " + TBD;
  const cta = $("#join-cta");
  if (C.join.formUrl) { cta.href = C.join.formUrl; cta.textContent = "填写报名问卷"; }
  else { cta.setAttribute("aria-disabled", "true"); cta.addEventListener("click", (e) => e.preventDefault()); }
  $("#faq").innerHTML = C.join.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

  // 承办协办
  $("#honors").innerHTML = C.honors.map((h) => `<li><span class="y">${esc(h.year)}</span><span>${esc(h.text)}</span><a href="${esc(h.source)}" target="_blank" rel="noopener">原文</a></li>`).join("");
})();
