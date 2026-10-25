// Xでシェアする共通部品。ゲームのページから <script src="../share.js"> で読む。
//   HanaShare.update(show, text) … 毎フレーム呼んでよい。show が true の間だけ「Xでシェア」ボタンを出す
//   HanaShare.open(text)         … すぐにXの投稿画面を開く（ゲーム側に自前のボタンがあるとき用）
// text には「結果」だけ書く。タイトル・ハッシュタグ・URL は自動で付く。
(() => {
  'use strict';
  const TAG = '#はなりきし';
  const pageUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const intent = text => 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(`${text}\n${TAG}`) + '&url=' + encodeURIComponent(pageUrl());
  const open = text => { window.open(intent(text), '_blank', 'noopener'); };

  let btn = null, shown = false, cur = '';
  function make() {
    const s = document.createElement('style');
    s.textContent = `
      #shareX {
        position: fixed; z-index: 5; cursor: pointer; font: bold 12px "Hiragino Sans","Yu Gothic","Meiryo",sans-serif;
        left: 50vw; transform: translateX(-50%);
        bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
        padding: 6px 10px; border-radius: 999px; border: 2px solid #3a2a10; background: #111; white-space: nowrap; color: #fff;
      }
      #shareX[hidden] { display: none; }`;
    document.head.appendChild(s);
    btn = document.createElement('button');
    btn.id = 'shareX'; btn.type = 'button'; btn.hidden = true; btn.textContent = '𝕏 でシェア';
    // ゲーム側のタップ処理に拾われないようにする
    ['pointerdown', 'pointerup', 'touchstart', 'mousedown'].forEach(ev => btn.addEventListener(ev, e => e.stopPropagation()));
    btn.addEventListener('click', e => { e.stopPropagation(); open(cur); });
    document.body.appendChild(btn);
  }
  function update(show, text) {
    if (!btn) make();
    cur = text || '';
    show = !!show && !!cur;
    if (show !== shown) { shown = show; btn.hidden = !show; }
  }
  window.HanaShare = { update, open };
})();
