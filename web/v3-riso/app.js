/* 方案三 · 社刊：所有内容由 ../shared/content.js 渲染 */
(function () {
  const C = window.CLUB;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TBD = '<span class="tbd">待社团补充</span>';
  const catName = Object.fromEntries(C.programs.map((p) => [p.id, p.name]));
  const fmt = (d) => { const [y, m, dd] = d.split("-"); return `${y} 年 ${+m} 月 ${+dd} 日`; };
  const headOf = (t) => { const p = t.split(/\s*[|丨]\s*/); return p.length > 1 ? p[1] : t; };

  // menu
  const mb = $(".menu-btn"), nav = $("#nav");
  mb.addEventListener("click", () => { const o = nav.classList.toggle("is-open"); mb.setAttribute("aria-expanded", o); mb.textContent = o ? "收起" : "栏目"; });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("is-open"); mb.setAttribute("aria-expanded", "false"); mb.textContent = "栏目"; } });

  $("#updated").textContent = "最近更新：" + fmt(C.news[0].date);

  // front page: lead = latest, sides = next two of different categories
  const lead = C.news[0];
  const sides = [];
  for (const n of C.news.slice(1)) { if (sides.length < 2 && n.cat !== lead.cat && !sides.some((s) => s.cat === n.cat)) sides.push(n); }
  $("#front-grid").innerHTML = `
    <article class="lead">
      <span class="kicker">${fmt(lead.date)}，${esc(catName[lead.cat])}</span>
      <h3>${esc(headOf(lead.title))}</h3>
      <p>${esc(lead.summary)}</p>
      <a class="more" href="${esc(lead.source)}" target="_blank" rel="noopener">阅读原文</a>
    </article>
    <div class="side">${sides.map((n) => `
      <article>
        <span class="kicker">${fmt(n.date)}，${esc(catName[n.cat])}</span>
        <h3>${esc(headOf(n.title))}</h3>
        <p>${esc(n.summary)}</p>
        <a class="more" href="${esc(n.source)}" target="_blank" rel="noopener">阅读原文</a>
      </article>`).join("")}</div>`;

  // archive: year filter + search
  const years = ["全部", ...[...new Set(C.news.map((n) => n.date.slice(0, 4)))]];
  let year = "全部", q = "";
  $("#years").innerHTML = years.map((y) => `<button type="button" aria-pressed="${y === "全部"}" data-y="${y}">${y}</button>`).join("");
  const hl = (s) => { const t = esc(s); return q ? t.split(esc(q)).join(`<mark>${esc(q)}</mark>`) : t; };
  function renderRows() {
    const list = C.news.filter((n) => (year === "全部" || n.date.startsWith(year)) && (!q || (n.title + n.summary).includes(q)));
    $("#count").textContent = `共 ${list.length} 篇`;
    $("#rows").innerHTML = list.length ? list.map((n) => `
      <li><span class="d">${n.date.slice(5).replace("-", ".")}<br><small>${n.date.slice(0, 4)}</small></span>
        <div><h3><a href="${esc(n.source)}" target="_blank" rel="noopener">${hl(n.title)}</a></h3><p>${hl(n.summary)}</p></div>
        <span class="c">${esc(catName[n.cat])}</span></li>`).join("") : `<li><span class="empty">没有找到相关报道，换个关键词试试。</span></li>`;
  }
  $("#years").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    year = b.dataset.y;
    document.querySelectorAll("#years button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderRows();
  });
  $("#q").addEventListener("input", (e) => { q = e.target.value.trim(); renderRows(); });
  renderRows();

  // about
  $("#intro").textContent = C.meta.intro;
  const facts = [["成立", C.meta.founded + " 年"], ["类型", C.meta.type], ["挂靠", C.meta.host], ["面向", C.meta.audience], ["地点", C.meta.location], ["成员人数", null]];
  $("#facts").innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v == null ? TBD : esc(v)}</dd></div>`).join("");
  $("#depts").innerHTML = C.meta.departments.map((d) => `<li><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></li>`).join("");

  // programs
  $("#plist").innerHTML = C.programs.map((p, i) => {
    const n = C.news.filter((x) => x.cat === p.id).length;
    return `<li><span class="n">${i + 1}</span><div><h3>${esc(p.name)}</h3><span class="w">${esc(p.where)}</span></div><p>${esc(p.desc)}</p><a href="#archive" data-q="${esc(p.name.slice(0, 2))}">存档 ${n} 篇</a></li>`;
  }).join("");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-q]"); if (!a) return;
    const kw = { 电路: "焊接", 昇腾: "昇", 企业: "华为", 人工: "大赛", AI: "分享" }[a.dataset.q] || a.dataset.q;
    $("#q").value = kw; q = kw; renderRows();
  });

  // people
  const role2 = (r) => { const [a, b] = String(r).split(" · "); return b ? `${esc(a)}，${esc(b)}` : esc(a); };
  const col = (title, arr, note) => `<div class="pcol"><h3>${title}</h3><ul>${arr.map((p) => `<li><b>${esc(p.name)}</b><span class="r">${role2(p.role)}</span>${p.desc ? `<p>${esc(p.desc)}</p>` : ""}</li>`).join("")}</ul><p class="note">${note}</p></div>`;
  const rj = C.people.leaders[0];
  $("#people-cols").innerHTML =
    col("指导老师", C.people.teachers, "") +
    `<article class="profile">
      <figure class="grained"><img src="../shared/img/${esc(rj.photo)}" alt="${esc(rj.name)} 活动照片" loading="lazy"></figure>
      <div>
        <span class="k">人物特写</span>
        <h3>${esc(rj.name)}</h3>
        <p>${esc(rj.role)}。${esc(rj.desc)}</p>
        <ul>${rj.awards.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      </div>
    </article>`;

  // join
  $("#jsteps").innerHTML = C.join.steps.map((s) => `<li><b>${esc(s.t)}</b>：${esc(s.d)}</li>`).join("");
  $("#season").innerHTML = C.join.season ? esc(C.join.season) : TBD;
  $("#form").innerHTML = C.join.formUrl ? `<a href="${esc(C.join.formUrl)}">填写报名问卷</a>` : TBD;
  $("#loc").textContent = C.meta.location;
  const cta = $("#join-cta");
  if (C.join.formUrl) { cta.href = C.join.formUrl; cta.textContent = "填写报名问卷"; }
  else { cta.setAttribute("aria-disabled", "true"); cta.addEventListener("click", (e) => e.preventDefault()); }
  $("#faq").innerHTML = C.join.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  $("#honors").innerHTML = C.honors.map((h) => `<li><b>${esc(h.year)}</b>${esc(h.text)}（<a href="${esc(h.source)}" target="_blank" rel="noopener">来源</a>）</li>`).join("");
})();
