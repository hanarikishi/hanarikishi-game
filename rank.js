// ランキングと記録の共通部品。ゲームのページから <script src="../rank.js"> と <script src="../firebase-config.js"> で読む。
//   HanaRank.update(show, value, also) … 毎フレーム呼んでよい。show が false→true になった瞬間に value を記録して、「ランキング」ボタンを出す。also が true の間も、ボタンだけ出す（タイトル画面など）
//   HanaRank.submit(value)       … すぐに記録する
//   HanaRank.open()              … ランキングの画面を開く
// 記録は、いつもこの端末に保存する（今日・今週・今月・通算のベスト）。
// firebase-config.js に Firebase の設定が入っていると、みんなの順位（日・週・月・通算）も出る。作りかたは _docs/FIREBASE.md
(() => {
  'use strict';
  const GAMES = {
    suika:     { title: 'はなりきし出世', unit: '点', dir: 'desc' },
    flappy:    { title: 'はなりきしフラッピー', unit: '点', dir: 'desc' },
    crossy:    { title: 'はなりきしクロッシー', unit: '歩', dir: 'desc' },
    stack:     { title: 'はなりきしスタック', unit: '段', dir: 'desc' },
    breakout:  { title: 'はなりきしブロック崩し', unit: '点', dir: 'desc' },
    survivors: { title: 'はなりきしサバイバーズ（レベル）', unit: '', dir: 'desc', key: 'survivors_lv', fmt: v => `Lv ${v}` },   // 記録の保存先を新しくして、時間のランキングをリセット
    shoot:     { title: 'はなりきしシュート', unit: '点', dir: 'desc' },
    hakkeyoi:  { title: 'はっけよい！はなりきし', unit: 'ms', dir: 'asc' },
  };
  const id = (location.pathname.match(/\/([^\/]+)\/(?:index\.html)?$/) || [])[1] || 'game';
  const G = GAMES[id] || { title: id, unit: '', dir: 'desc' };
  const RESET_TAG = '_r2';   // 全部の記録をリセットしたいときは、これを _r3 … と変える（保存先の名前が新しくなる。ルールの gameOk/maxOf も同じ名前に）
  const rid = (G.key || id) + RESET_TAG;   // 端末の記録と、みんなの順位の保存先の名前
  const fmtV = v => G.fmt ? G.fmt(v) : `${Math.round(v * 100) / 100}${G.unit}`;
  const better = (a, b) => G.dir === 'asc' ? a < b : a > b;
  // ニックネームの禁止ワード（下ネタ・Fワードなど）は「どすこい！はなりきし」の四股名と同じ。ngwords.js を、あとから読みこむ
  const me = document.currentScript;
  if (typeof shikonaNgReason === 'undefined') { const sc = document.createElement('script'); sc.src = me && me.src ? me.src.replace(/rank\.js(\?.*)?$/, 'ngwords.js') : '../ngwords.js'; document.head.appendChild(sc); }
  const ngReason = n => (typeof shikonaNgReason === 'function' ? shikonaNgReason(n) : null);
  const DEFAULT_NAME = 'ななしの力士';
  const NAME_KEY = 'sumo-rank-name', LOCAL_KEY = 'sumo-rank-local';
  const TABS = [['d', '今日'], ['w', '今週'], ['m', '今月'], ['a', '通算']];

  // ---- 日・週・月（日本時間で区切る）----
  function keys() {
    const d = new Date(Date.now() + 9 * 3600e3), y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate();
    const m2 = String(mo + 1).padStart(2, '0'), d2 = String(da).padStart(2, '0');
    const t = new Date(Date.UTC(y, mo, da)), dow = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dow + 3);                         // その週の木曜日（ISO週）
    const wy = t.getUTCFullYear(), w1 = new Date(Date.UTC(wy, 0, 4));
    const wk = 1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
    return { d: `d_${y}-${m2}-${d2}`, w: `w_${wy}-W${String(wk).padStart(2, '0')}`, m: `m_${y}-${m2}`, a: 'all' };
  }

  // ---- この端末の記録 ----
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } }
  function saveLocal(o) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); } catch {} }
  function myBest(p) { const g = (loadLocal()[rid] || {}); return g[keys()[p]]; }
  const getName = () => { let n = DEFAULT_NAME; try { n = localStorage.getItem(NAME_KEY) || DEFAULT_NAME; } catch {} return ngReason(n) ? DEFAULT_NAME : n; };
  const setName = n => { try { localStorage.setItem(NAME_KEY, n); } catch {} };

  // ---- Firebase（設定があるときだけ）----
  let fbP = null;
  const cfg = () => window.HANA_FIREBASE && window.HANA_FIREBASE.apiKey && window.HANA_FIREBASE.projectId ? window.HANA_FIREBASE : null;
  function fb() {
    if (!cfg()) return Promise.resolve(null);
    if (!fbP) fbP = (async () => {
      const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
      const [A, Au, F] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
      const app = A.initializeApp(cfg()), auth = Au.getAuth(app);
      // App Check（reCAPTCHA v3）: firebase-config.js に appCheckSiteKey があるときだけ有効にする。手順は _docs/FIREBASE.md
      if (cfg().appCheckSiteKey) {
        const AC = await import(base + 'firebase-app-check.js');
        if (/^(localhost|127.0.0.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;   // 手元で試すとき用（コンソールにデバッグ用のトークンが出る）
        AC.initializeAppCheck(app, { provider: new AC.ReCaptchaV3Provider(cfg().appCheckSiteKey), isTokenAutoRefreshEnabled: true });
      }
      await Au.signInAnonymously(auth);
      return { auth, db: F.getFirestore(app), F };
    })().catch(e => { console.warn('[rank] Firebase につながりません', e); fbP = null; return null; });
    return fbP;
  }
  async function pushRemote(p, v) {
    const f = await fb(); if (!f) return;
    const { F, db, auth } = f, ref = F.doc(db, 'ranks', rid, keys()[p], auth.currentUser.uid);
    try {
      const cur = await F.getDoc(ref), nm = getName().slice(0, 12);
      if (cur.exists() && !better(v, cur.data().v)) {
        if (cur.data().name !== nm) await F.setDoc(ref, { name: nm, v: cur.data().v, dir: cur.data().dir || G.dir, t: F.serverTimestamp() });   // 記録はそのままで、名前だけ かえる
        return;
      }
      await F.setDoc(ref, { name: nm, v, dir: G.dir, t: F.serverTimestamp() });
    } catch (e) { console.warn('[rank] 記録を送れません', e); }
  }
  async function fetchTop(p) {
    const f = await fb(); if (!f) return null;
    const { F, db, auth } = f;
    try {
      const q = F.query(F.collection(db, 'ranks', rid, keys()[p]), F.orderBy('v', G.dir), F.limit(20));
      const snap = await F.getDocs(q);
      return snap.docs.map(d => ({ uid: d.id, me: d.id === auth.currentUser.uid, ...d.data() }));
    } catch { return null; }
  }

  // この端末のベストを、みんなの順位へ送る（いまの記録より良いときだけ書きかわる。前に送れていなかった分も、ここで追いつく）
  function syncRemote() {
    const g = loadLocal()[rid] || {}, K = keys();
    for (const p of ['d', 'w', 'm', 'a']) if (typeof g[K[p]] === 'number') pushRemote(p, g[K[p]]);
  }

  // ---- 記録する ----
  function submit(v) {
    if (typeof v !== 'number' || !isFinite(v) || v < 0) return;
    const K = keys(), L = loadLocal(), g = L[rid] = L[rid] || {}, up = [];
    for (const p of ['d', 'w', 'm', 'a']) if (g[K[p]] === undefined || better(v, g[K[p]])) { g[K[p]] = v; up.push(p); }
    // ふるい記録は消す（日は40日、週は14週、月は14か月ぶんだけ残す）
    const keep = { d: 40, w: 14, m: 14 };
    for (const p of ['d', 'w', 'm']) {
      const ks = Object.keys(g).filter(k => k.startsWith(p + '_')).sort();
      ks.slice(0, Math.max(0, ks.length - keep[p])).forEach(k => delete g[k]);
    }
    saveLocal(L);
    last = { v, up };
    syncRemote();
    return up;
  }

  // ---- 画面 ----
  let last = null, btn = null, shown = false, lastShow = false, modalEl = null, curTab = 'd';
  function css() {
    if (document.getElementById('hrCss')) return;
    const s = document.createElement('style'); s.id = 'hrCss';
    s.textContent = `
      #hrBtn { position: fixed; z-index: 5; cursor: pointer; font: bold 12px "Hiragino Sans","Yu Gothic","Meiryo",sans-serif;
        left: 50vw; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);   /* 下の列: 左に「ゲーム一覧」、まん中に「ランキング」、右に「シェア」 */
        padding: 6px 10px; border-radius: 999px; border: 2px solid #3a2a10; background: #ffd24a; color: #3a2a10; white-space: nowrap; }
      #hrBtn[hidden] { display: none; }
      #hrModal { position: fixed; inset: 0; z-index: 50; background: rgba(20,14,6,.72); display: flex; align-items: center; justify-content: center; font-family: "Hiragino Sans","Yu Gothic","Meiryo",sans-serif; }
      #hrModal .box { width: min(92vw, 400px); max-height: 86dvh; display: flex; flex-direction: column; background: #fff8dc; color: #3a2a10; border: 3px solid #3a2a10; border-radius: 16px; overflow: hidden; }
      #hrModal h2 { margin: 0; padding: 12px 14px 4px; font-size: 18px; text-align: center; }
      #hrModal .sub { text-align: center; font-size: 12px; color: #7a6a4a; padding: 0 14px 8px; }
      #hrModal .tabs { display: flex; gap: 6px; padding: 0 12px 8px; }
      #hrModal .tabs button { flex: 1; padding: 7px 0; border-radius: 10px; border: 2px solid #3a2a10; background: #fff; color: #3a2a10; font: inherit; font-weight: bold; cursor: pointer; }
      #hrModal .tabs button.on { background: #ffd24a; }
      #hrModal .list { flex: 1; overflow-y: auto; padding: 0 12px; min-height: 120px; }
      #hrModal .row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-bottom: 1px solid #e6d9b0; font-size: 14px; }
      #hrModal .row.me { background: #fff1b8; border-radius: 8px; font-weight: bold; }
      #hrModal .row .n { width: 30px; text-align: right; color: #7a6a4a; font-weight: bold; }
      #hrModal .row .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #hrModal .row .v { font-weight: bold; }
      #hrModal .msg { padding: 22px 10px; text-align: center; color: #7a6a4a; font-size: 13px; line-height: 1.6; }
      #hrModal .mine { padding: 8px 14px; font-size: 13px; text-align: center; background: #f3e7b8; border-top: 2px solid #3a2a10; }
      #hrModal .foot { display: flex; gap: 8px; padding: 10px 12px; }
      #hrModal .foot button { flex: 1; padding: 9px 0; border-radius: 10px; border: 2px solid #3a2a10; background: #fff; color: #3a2a10; font: inherit; font-weight: bold; cursor: pointer; }
      #hrModal .foot button.pri { background: #ffd24a; }`;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  async function renderList() {
    const el = modalEl.querySelector('.list'), p = curTab;
    modalEl.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    const mine = myBest(p);
    modalEl.querySelector('.mine').textContent = mine === undefined ? 'この期間の きみの記録: まだなし' : `この期間の きみの記録: ${fmtV(mine)}`;
    if (!cfg()) { el.innerHTML = '<div class="msg">みんなのランキングは じゅんび中です。<br>いまは この端末の記録だけ 残ります。</div>'; return; }
    el.innerHTML = '<div class="msg">よみこみ中…</div>';
    const rows = await fetchTop(p);
    if (curTab !== p) return;
    if (!rows) { el.innerHTML = '<div class="msg">ランキングを よみこめませんでした。<br>通信を たしかめてください。</div>'; return; }
    if (!rows.length) { el.innerHTML = '<div class="msg">まだ だれも 記録していません。<br>いちばんのりを めざそう！</div>'; return; }
    el.innerHTML = rows.map((r, i) => `<div class="row ${r.me ? 'me' : ''}"><span class="n">${i + 1}</span><span class="nm">${esc(r.name)}</span><span class="v">${fmtV(r.v)}</span></div>`).join('');
  }
  function open() {
    css(); if (modalEl) return;
    syncRemote();
    modalEl = document.createElement('div'); modalEl.id = 'hrModal';
    modalEl.innerHTML = `<div class="box"><h2>🏆 ${esc(G.title)}</h2><div class="sub">日本時間で 日・週・月が かわります</div>
      <div class="tabs">${TABS.map(([p, n]) => `<button data-p="${p}">${n}</button>`).join('')}</div>
      <div class="list"></div><div class="mine"></div>
      <div class="foot"><button id="hrName">名前: ${esc(getName())}</button><button class="pri" id="hrClose">とじる</button></div></div>`;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('pointerdown', e => e.stopPropagation());
    modalEl.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target === modalEl || e.target.id === 'hrClose') { modalEl.remove(); modalEl = null; return; }
      const b = e.target.closest('.tabs button'); if (b) { curTab = b.dataset.p; renderList(); return; }
      if (e.target.id === 'hrName') {
        let msg = 'ランキングに のせる名前（12文字まで）\n※ ランキングに公開されます。本名は入れないでください', def = getName();
        for (;;) {
          const v = prompt(msg, def); if (v === null) break;
          const n = v.trim().slice(0, 12); if (!n) break;
          const why = ngReason(n);
          if (why) { msg = 'その名前は使えません。別の名前にしてください\n（下ネタ・乱暴な言葉・Fワードなどは禁止です）'; def = ''; continue; }
          setName(n); e.target.textContent = '名前: ' + n; syncRemote(); break;   // いまの記録にも 新しい名前を反映
        }
      }
    });
    renderList();
  }
  function update(show, value, also) {
    if (!btn) { css(); btn = document.createElement('button'); btn.id = 'hrBtn'; btn.type = 'button'; btn.hidden = true; btn.textContent = '🏆 ランキング';
      ['pointerdown', 'pointerup', 'touchstart', 'mousedown'].forEach(ev => btn.addEventListener(ev, e => e.stopPropagation()));
      btn.addEventListener('click', e => { e.stopPropagation(); open(); }); document.body.appendChild(btn); }
    if (show && !lastShow && typeof value === 'number' && (G.dir === 'asc' || value > 0)) submit(value);   // 0点は記録しない
    lastShow = !!show;
    btn.classList.toggle('low', !show);
    const vis = !!show || !!also;
    if (vis !== shown) { shown = vis; btn.hidden = !vis; }
  }
  window.HanaRank = { update, submit, open, id, myBest, fmt: fmtV };
})();
