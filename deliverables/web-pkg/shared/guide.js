/* =====================================================================
 * 首页导流：首屏下方的三个“入口”与手机端常驻“加入我们”按钮
 * 三套方案共用；文字里的数字全部从 content.js 计算，不手写。
 * 用法：页面放 <nav id="doors" data-ip="zhi" data-news="#news"></nav>，在 content.js 之后引入本文件。
 * ===================================================================== */
(function () {
  const C = window.CLUB;
  const box = document.getElementById("doors");
  if (!C || !box) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ip = box.dataset.ip || "zhi";
  const latest = C.news[0];
  const P = C.people;
  // 表情图是 2×2 拼图：左上挥手、右上思考、左下欢呼、右下困倦
  const doors = [
    { href: "#join", pos: "0% 0%", t: "第一次来，怎么加入？", d: "不限学院、不限基础，三步就能加入。", primary: true },
    { href: box.dataset.news || "#news", pos: "100% 0%", t: "社团最近在做什么？", d: `最近一次：${latest.date.slice(0, 4)} 年 ${+latest.date.slice(5, 7)} 月的${(C.programs.find((p) => p.id === latest.cat) || { name: "活动" }).name.replace(/教学实践|技术课程|与开发者活动|系列分享会/g, "")}活动。` },
    { href: "#people", pos: "0% 100%", t: "谁在带社团？", d: `社长${P.leaders.map((x) => x.name).join("、")}，指导老师${P.teachers.map((x) => x.name).join("、")}。` }
  ];
  box.setAttribute("aria-label", "从这里开始");
  box.innerHTML = `<ul class="doors__list">${doors.map((x) => `
    <li><a class="door${x.primary ? " door--primary" : ""}" href="${x.href}">
      <span class="door__pic" aria-hidden="true" style="background-image:url(../shared/img/ip/${ip}-expressions.webp);background-position:${x.pos}"></span>
      <span class="door__txt"><b class="door__t">${esc(x.t)}</b><span class="door__d">${esc(x.d)}</span></span>
      <span class="door__go" aria-hidden="true">→</span>
    </a></li>`).join("")}</ul>`;

  // 手机端：滚过首屏后出现“加入我们”，到了加入版块自动隐藏
  const fab = document.createElement("a");
  fab.className = "fab"; fab.href = "#join"; fab.textContent = "加入我们";
  document.body.appendChild(fab);
  const join = document.getElementById("join");
  if (!("IntersectionObserver" in window) || !join) return;
  let pastDoors = false, atJoin = false;
  const sync = () => fab.classList.toggle("is-on", pastDoors && !atJoin);
  new IntersectionObserver(([e]) => { pastDoors = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(box);
  new IntersectionObserver(([e]) => { atJoin = e.isIntersecting; sync(); }, { threshold: 0.15 }).observe(join);
})();
