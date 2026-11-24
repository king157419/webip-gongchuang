/* 全社团公用排行榜：和服务器 /api/board/<game> 打交道的小工具（v17-slice-r2 与 v24-fold-r2 各放一份，内容相同）。
 * - 昵称、浏览器标识存在 localStorage，两个游戏共用；存不了也照常能玩，只是下次要重填。
 * - 双击以 file:// 打开、接口不通、超时（5 秒）时一律返回 null，页面照旧只显示本机纪录，不报错。
 * - 别人的昵称只能用 textContent 写进页面（这里不碰 DOM）。 */
(function () {
  'use strict';
  const NAME_KEY = 'shu-ai-board-name', ID_KEY = 'shu-ai-board-key';
  const NAME_RE = /^[㐀-䶿一-鿿A-Za-z0-9_\-·. ]+$/;
  const online = location.protocol === 'http:' || location.protocol === 'https:';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 存不了就算了 */ } }
  };
  function browserKey() {
    let k = ls.get(ID_KEY);
    if (!k || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) {
      const a = new Uint8Array(18);
      try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.random() * 256; }
      k = Array.from(a, (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('');
      ls.set(ID_KEY, k);
    }
    return k;
  }
  function cleanName(s) {
    s = String(s == null ? '' : s);
    if (s.normalize) s = s.normalize('NFKC');
    return s.split(/\s+/).filter(Boolean).join(' ');
  }
  // 和服务器同一套规则；返回 null 表示合格，否则是给用户看的话
  function checkName(s) {
    if (!s) return '先起个昵称';
    if (Array.from(s).length > 12) return '昵称最多 12 个字';
    if (!NAME_RE.test(s)) return '昵称只能用汉字、字母、数字、空格和 _ - · .';
    return null;
  }
  async function call(game, method, body, query) {
    if (!online || !window.fetch) return { ok: false, net: true };
    const url = '/api/board/' + game + (query ? '?' + query : '');
    const ctl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 5000);
    try {
      const init = { method, credentials: 'same-origin', cache: 'no-store', headers: {} };
      if (ctl) init.signal = ctl.signal;
      if (body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
      const r = await Promise.race([fetch(url, init), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 5200))]);
      let data = null;
      try { data = await r.json(); } catch (e) { /* 不是 JSON（比如静态服务器的 404 页面） */ }
      if (r.ok && data && Array.isArray(data.top)) return { ok: true, data };
      return { ok: false, status: r.status, msg: data && typeof data.detail === 'string' ? data.detail : '', net: !data };
    } catch (e) {
      return { ok: false, net: true };
    } finally {
      clearTimeout(timer);
    }
  }
  window.ClubBoard = {
    online,
    cleanName,
    checkName,
    name() { const n = cleanName(ls.get(NAME_KEY)); return checkName(n) ? '' : n; },
    setName(n) { ls.set(NAME_KEY, n || null); },
    same(a, b) { return !!a && !!b && a.toLowerCase() === b.toLowerCase(); },
    // 成功：{ok:true, data:{top, total, me, unit}}；失败：{ok:false, status, msg, net}
    load(game, me) { return call(game, 'GET', null, me ? 'me=' + encodeURIComponent(me) : ''); },
    submit(game, name, score) { return call(game, 'POST', { name, score, key: browserKey() }); }
  };
})();
