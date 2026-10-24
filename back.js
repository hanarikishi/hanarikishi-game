// 戻る操作（スワイプ・戻るボタン）の共通部品。ゲームのページから <script src="../back.js"> で読む。
//   HanaBack.init({ isPlaying: () => 本番中か, onPause?: () => ポーズしたときの後始末 })
// 本番中に戻る操作をすると、ゲームを抜けずに「ポーズ」の画面を出す（つづける／ゲーム一覧へ）。
// 本番中でないとき（タイトル・ゲームオーバー）は、ふつうに前のページ（ゲーム一覧）へもどる。
// ポーズ中は requestAnimationFrame をとめて、ゲームの動きをとめる。
(() => {
  'use strict';
  let paused = false, pending = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { if (paused) pending.push(cb); else cb(t); });

  let cfg = null, armed = false, box = null;
  function css() {
    if (document.getElementById('hbCss')) return;
    const s = document.createElement('style'); s.id = 'hbCss';
    s.textContent = `
      #hbPause { position: fixed; inset: 0; z-index: 60; background: rgba(20,14,6,.72); display: flex; align-items: center; justify-content: center; font-family: "Hiragino Sans","Yu Gothic","Meiryo",sans-serif; }
      #hbPause .box { width: min(80vw, 300px); background: #fff8dc; color: #3a2a10; border: 3px solid #3a2a10; border-radius: 16px; padding: 18px 16px; text-align: center; }
      #hbPause h2 { margin: 0 0 12px; font-size: 22px; }
      #hbPause button { display: block; width: 100%; margin-top: 10px; padding: 12px 0; border-radius: 12px; border: 2px solid #3a2a10; background: #fff; color: #3a2a10; font: inherit; font-weight: bold; font-size: 16px; cursor: pointer; }
      #hbPause button.pri { background: #ffd24a; }`;
    document.head.appendChild(s);
  }
  function pause() {
    if (paused) return;
    if (cfg && cfg.onPause) cfg.onPause();
    paused = true; css();
    box = document.createElement('div'); box.id = 'hbPause';
    box.innerHTML = '<div class="box"><h2>ポーズ</h2><button class="pri" data-a="go">つづける</button><button data-a="list">ゲーム一覧へ</button></div>';
    ['pointerdown', 'pointerup', 'touchstart', 'mousedown'].forEach(ev => box.addEventListener(ev, e => e.stopPropagation()));
    box.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (a === 'go') resume();
      else if (a === 'list') location.href = '../';
    });
    document.body.appendChild(box);
  }
  function resume() {
    if (!paused) return;
    paused = false;
    if (box) { box.remove(); box = null; }
    const q = pending; pending = [];
    q.forEach(cb => raf(cb));
  }
  function arm() { if (armed) return; armed = true; try { history.pushState({ hb: 1 }, ''); } catch {} }
  function onPop() {
    if (!cfg) return;
    if (paused) { try { history.pushState({ hb: 1 }, ''); } catch {} return; }   // ポーズ中に戻る: そのまま
    if (cfg.isPlaying()) { try { history.pushState({ hb: 1 }, ''); } catch {} pause(); return; }
    armed = false; history.back();   // 本番中でなければ、前のページへ
  }
  window.HanaBack = {
    init(c) {
      cfg = c;
      // 履歴に積むのは、さいしょのタップのあと（ブラウザは、タップなしで積んだ履歴をとばす）
      window.addEventListener('pointerdown', arm, { capture: true, once: true });
      window.addEventListener('keydown', arm, { capture: true, once: true });
      window.addEventListener('popstate', onPop);
      // 画面をはなれる／かくれたときも、本番中ならポーズ
      document.addEventListener('visibilitychange', () => { if (document.hidden && cfg.isPlaying()) pause(); });
    },
    pause, resume, get paused() { return paused; },
  };
})();
