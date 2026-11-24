/* 方案一 · 蓝图：所有内容由 ../shared/content.js 渲染 */
(function () {
  const C = window.CLUB;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const get = (path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), C);
  const TBD = '<span class="tbd">待社团补充</span>';
  const catName = Object.fromEntries(C.programs.map((p) => [p.id, p.name]));
  document.documentElement.classList.add("js");

  // simple bindings
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const v = get(el.dataset.bind);
    el.innerHTML = v == null ? TBD : esc(v);
  });

  // mobile menu
  const btn = $(".menu-btn"), nav = $("#nav");
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open);
    btn.textContent = open ? "关闭" : "菜单";
  });
  nav.addEventListener("click", (e) => { if (e.target.tagName === "A") { nav.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); btn.textContent = "菜单"; } });

  // timeline: real events placed proportionally on 2021-01 → 2026-12
  const start = new Date("2021-01-01").getTime(), end = new Date("2026-12-31").getTime();
  // 时间轴节点：日期取自 news，文字为简写，可在此增删
  const milestones = [
    { date: "2021-06-01", label: "社团成立", exact: false },
    { date: "2022-01-04", label: "“迎元旦”语音电路焊接", exact: true },
    { date: "2023-09-25", label: "华为全联接大会 2023", exact: true },
    { date: "2024-04-25", label: "承办昇思训练营", exact: true },
    { date: "2024-12-09", label: "AI 论文分享会，近 200 人", exact: true },
    { date: "2025-11-25", label: "近百人走进鸿蒙生态学堂", exact: true },
    { date: "2026-10-26", label: "“焊动金秋”焊接实践", exact: true }
  ];
  $("#timeline").innerHTML = milestones.map((m) => {
    const pct = ((new Date(m.date).getTime() - start) / (end - start)) * 100;
    const shown = m.exact ? m.date.slice(0, 7).replace("-", ".") : "2021";
    return `<li style="left:${pct.toFixed(2)}%"><span class="num">${shown}</span>${esc(m.label)}</li>`;
  }).join("");
  // keep last ticks inside the sheet on desktop
  document.querySelectorAll("#timeline li").forEach((li) => { if (parseFloat(li.style.left) > 82) li.style.transform = "translateX(-100%)", li.style.borderLeft = "0", li.style.borderRight = "1px solid var(--color-rule-2)", li.style.paddingRight = "8px", li.style.textAlign = "right"; });
  const tl = $(".timeline");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { tl.classList.add("is-in"); o.disconnect(); } }), { threshold: 0.4 }).observe(tl);
  } else tl.classList.add("is-in");

  // departments
  $("#depts").innerHTML = C.meta.departments.map((d) => `<li><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></li>`).join("");

  // programs register
  $("#programs-body").innerHTML = C.programs.map((p, i) => {
    const n = C.news.filter((x) => x.cat === p.id).length;
    return `<tr><td class="num">P-0${i + 1}</td><td>${esc(p.name)}</td><td>${esc(p.desc)}</td><td>${esc(p.where)}</td><td><a href="#news" data-jump="${p.id}">${n} 篇</a></td></tr>`;
  }).join("");

  // news with filters
  const PAGE = 4;
  let cat = "all", shown = PAGE;
  const cats = [{ id: "all", name: "全部" }, ...C.programs.map((p) => ({ id: p.id, name: p.name.replace(/教学实践|技术课程|与开发者活动|系列分享会/g, "") }))];
  $("#filters").innerHTML = cats.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === "all"}">${esc(c.name)}</button>`).join("");
  function renderNews() {
    const list = C.news.filter((n) => cat === "all" || n.cat === cat);
    $("#newslist").innerHTML = list.slice(0, shown).map((n) => `
      <li>
        <span class="num">${n.date.replaceAll("-", ".")}</span>
        <div><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><span class="tag">${esc(catName[n.cat] || "")}</span></div>
        <a class="src" href="${esc(n.source)}" target="_blank" rel="noopener">阅读原文</a>
      </li>`).join("");
    $("#more").hidden = list.length <= shown;
    $("#more").textContent = `再看 ${Math.min(PAGE, list.length - shown)} 条（共 ${list.length} 条）`;
  }
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    cat = b.dataset.cat; shown = PAGE;
    document.querySelectorAll("#filters button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderNews();
  });
  $("#more").addEventListener("click", () => { shown += PAGE; renderNews(); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-jump]"); if (!a) return;
    const b = document.querySelector(`#filters [data-cat="${a.dataset.jump}"]`); if (b) b.click();
  });
  renderNews();

  // people tabs
  const groups = [
    { id: "leaders", name: "社长" },
    { id: "teachers", name: "指导老师" }
  ];
  const notes = { leaders: "历届社长、副社长的照片和专访待社团补充。", teachers: "" };
  $("#people-tabs").innerHTML = groups.map((g, i) => `<button type="button" role="tab" id="tab-${g.id}" aria-selected="${i === 0}" aria-controls="people-panel" data-g="${g.id}">${g.name}</button>`).join("");
  function renderPeople(id) {
    $("#people-panel").setAttribute("aria-labelledby", "tab-" + id);
    $("#people-panel").innerHTML = C.people[id].map((p) => {
      const [r1, r2] = String(p.role).split(" · ");
      const ph = p.photo ? `<img src="../shared/img/${esc(p.photo)}" alt="${esc(p.name)} 活动照片" loading="lazy">` : "照片待补充";
      return `<article class="person">
        <div class="person__ph">${ph}</div>
        <h3>${esc(p.name)}</h3>
        <div class="role">${esc(r1)}${r2 ? `<span>${esc(r2)}</span>` : ""}</div>
        ${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : `<p class="desc">${TBD}</p>`}
        ${p.awards ? `<ul>${p.awards.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      </article>`;
    }).join("");
    $("#people-note").textContent = notes[id];
  }
  $("#people-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#people-tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderPeople(b.dataset.g);
  });
  $("#people-tabs").addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const bs = [...document.querySelectorAll("#people-tabs button")];
    const i = bs.indexOf(document.activeElement);
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length];
    n.focus(); n.click();
  });
  renderPeople("leaders");

  // honors
  $("#honors").innerHTML = C.honors.map((h) => `<li><span class="num">${esc(h.year)}</span><span>${esc(h.text)}</span><a href="${esc(h.source)}" target="_blank" rel="noopener">来源</a></li>`).join("");

  // join
  $("#steps").innerHTML = C.join.steps.map((s, i) => `<li><span class="num">0${i + 1}</span><b>${esc(s.t)}</b><p>${esc(s.d)}</p></li>`).join("");
  $("#season").innerHTML = C.join.season ? esc(C.join.season) : TBD;
  $("#form").innerHTML = C.join.formUrl ? `<a href="${esc(C.join.formUrl)}">填写报名问卷</a>` : TBD;
  const cta = $("#join-cta");
  if (C.join.formUrl) { cta.href = C.join.formUrl; cta.textContent = "填写报名问卷"; }
  else { cta.setAttribute("aria-disabled", "true"); cta.addEventListener("click", (e) => e.preventDefault()); }
  $("#faq").innerHTML = C.join.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
})();
