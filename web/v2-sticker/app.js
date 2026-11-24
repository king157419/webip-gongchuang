/* 方案二 · 贴纸：所有内容由 ../shared/content.js 渲染 */
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

  // facts (each with its source)
  const facts = [
    { fig: C.meta.founded, cap: "年成立", src: "社团基本信息" },
    { fig: C.news.length, cap: "篇活动报道收录在本站", src: "通信学院公开报道" },
    { fig: C.meta.departments.length, cap: "个部门", src: "2026 年申报材料" },
    { fig: "近 200", cap: "名同学来听 AI 论文分享会", src: "2024.12 报道" },
    { fig: "百余名", cap: "同学一起去了 2024 华为全联接大会，还有四十余名同学入选昇腾大模型实践课", src: "2024.09 / 2026.05 报道" }
  ];
  $("#facts").innerHTML = facts.map((f) => `<li><span class="fig">${esc(f.fig)}</span><span class="cap">${esc(f.cap)}</span><span class="src">来源：${esc(f.src)}</span></li>`).join("");

  // programs
  $("#programs").innerHTML = C.programs.map((p) => {
    const n = C.news.filter((x) => x.cat === p.id).length;
    return `<li><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><span class="where">${esc(p.where)}</span><a class="count" href="#news" data-jump="${p.id}">看 ${n} 篇报道</a></li>`;
  }).join("") + `<li class="cards__join"><h3>还有你的点子</h3><p>想办一场新活动？加入学术部或组织部，下一篇报道可能就是你写的。</p><a href="#join">去报名</a></li>`;

  // a session
  const session = [
    { t: "学长讲解", d: "电烙铁怎么握、焊锡怎么送、焊点长什么样。" },
    { t: "看项目", d: "学术部介绍社团的机器小车，讲它怎么做出来。" },
    { t: "安全须知", d: "烙铁规范、线头处理、防烫伤，先讲清楚再动手。" },
    { t: "分组上手", d: "先焊单个焊点，再焊导线；学长在旁边一对一指导。" }
  ];
  $("#session").innerHTML = session.map((s, i) => `<li><span class="n">${i + 1}</span><b>${esc(s.t)}</b><p>${esc(s.d)}</p></li>`).join("");

  // news
  const PAGE = 3; let cat = "all", shown = PAGE;
  $("#chips").innerHTML = [{ id: "all", name: "全部" }, ...C.programs].map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === "all"}">${esc(short(c.name))}</button>`).join("");
  function renderNews() {
    const list = C.news.filter((n) => cat === "all" || n.cat === cat);
    $("#news-list").innerHTML = list.slice(0, shown).map((n) => {
      const parts = n.title.split(/\s*[|丨]\s*/);
      const head = parts.length > 1 ? parts[1] : n.title;
      return `<li><a href="${esc(n.source)}" target="_blank" rel="noopener">
        <span class="meta"><span>${n.date.replaceAll("-", ".")}</span><span class="cat">${esc(short(catName[n.cat] || ""))}</span></span>
        <h3>${esc(head)}</h3><p>${esc(n.summary)}</p><span class="read">阅读原文</span></a></li>`;
    }).join("");
    $("#more").hidden = list.length <= shown;
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

  // people
  const groups = [["leaders", "社长"], ["teachers", "指导老师"]];
  const notes = { leaders: "历届社长、副社长的照片和专访待社团补充。", teachers: "" };
  $("#people-tabs").innerHTML = groups.map(([id, n], i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-g="${id}">${n}</button>`).join("");
  function renderPeople(id) {
    $("#people-list").innerHTML = C.people[id].map((p) => {
      const [r1, r2] = String(p.role).split(" · ");
      const av = p.photo ? `<img src="../shared/img/${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : esc(p.name[0]);
      return `<li><div class="av">${av}</div><h3>${esc(p.name)}</h3><div class="role">${esc(r1)}${r2 ? `<span>${esc(r2)}</span>` : ""}</div>
        ${p.desc ? `<p>${esc(p.desc)}</p>` : TBD}${p.awards ? `<ul>${p.awards.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}</li>`;
    }).join("");
    $("#people-note").textContent = notes[id];
  }
  $("#people-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#people-tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderPeople(b.dataset.g);
  });
  renderPeople("leaders");

  // join
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

  // honors
  $("#honors").innerHTML = C.honors.map((h) => `<li><span class="y">${esc(h.year)}</span><span>${esc(h.text)}</span><a href="${esc(h.source)}" target="_blank" rel="noopener">来源</a></li>`).join("");
})();
