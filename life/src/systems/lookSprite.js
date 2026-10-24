// 力士の見た目（目 × 肌 × まわし）の絵を部品から組み立てる。取組の Canvas と、名鑑・番付などの顔の絵で使う
// look: { eyes, skin, mawashi }（roster.js の NPC_* の番号）。自分は look が無ければ「はなりきし」（LOOK_DEFAULT）
// 重ねる順番（下から）：body_color（肌の色）→ mawashi（まわしの色）→ body_line（黒い線）→ 顔
//   顔 ふつう＝ nose ＋ eyes1〜3 ／ 引っ張り中 aim ／ ぶつかった collision ／ 勝った win ／ 負けた lose（ふつうの顔と入れ替え）
// 絵は assets/images/bout/parts/ に入る（元の絵は docs/art/bout-raw/、tools/buildParts.py で作る）

const LOOK_DEFAULT = { eyes: 0, skin: 7, mawashi: 9 };   // 「はなりきし」の見た目（黄色い肌・深緑のまわし）
const LOOK_FACES = ['aim', 'collision', 'win', 'lose'];            // ふつう以外の顔（自分だけが使う）
const LOOK_PARTS = ['body_color', 'mawashi', 'body_line', 'nose', ...LOOK_FACES,
  ...Array.from({ length: NPC_EYES_COUNT }, (_, i) => `eyes${i + 1}`)];

const LookSprite = {
  parts: null,
  ready: null,     // 部品が全部読み込めたら解決する Promise
  cache: {},       // `${key}@${size}@${face}` → canvas

  load() {
    if (this.ready) return this.ready;
    this.parts = {};
    this.ready = Promise.all(LOOK_PARTS.map(p => new Promise(res => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = `assets/images/bout/parts/${p}.png`;
      this.parts[p] = im;
    })));
    return this.ready;
  },

  loaded() {
    return !!this.parts && LOOK_PARTS.every(p => this.parts[p].complete && this.parts[p].naturalWidth > 0);
  },

  // 組み立てた絵（Canvas）。部品がまだなら null。face は 'normal' | 'aim' | 'collision' | 'win'
  canvas(look, size = 512, face = 'normal') {
    look = look || LOOK_DEFAULT;
    this.load();
    if (!this.loaded()) return null;
    const key = `${npcLookKey(look)}@${size}@${face}`;
    if (this.cache[key]) return this.cache[key];
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const oc = out.getContext('2d');
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = size;
    const tc = tmp.getContext('2d');
    // aim・collision・win は鼻も目も入った絵。lose は鼻が無いので nose を足す
    const faceParts = face === 'lose' ? ['nose', 'lose'] : LOOK_FACES.includes(face) ? [face] : ['nose', `eyes${look.eyes + 1}`];
    const layers = [['body_color', NPC_SKIN_COLORS[look.skin]], ['mawashi', NPC_MAWASHI_COLORS[look.mawashi]],
                    ['body_line', null], ...faceParts.map(p => [p, null])];
    for (const [p, col] of layers) {
      const im = this.parts[p];
      if (!col) { oc.drawImage(im, 0, 0, size, size); continue; }
      // 白いところが色に変わる（乗算）。そのあと元の絵の形で切り抜く
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, size, size);
      tc.drawImage(im, 0, 0, size, size);
      tc.globalCompositeOperation = 'multiply';
      tc.fillStyle = col;
      tc.fillRect(0, 0, size, size);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(im, 0, 0, size, size);
      oc.drawImage(tmp, 0, 0);
    }
    return (this.cache[key] = out);
  },

  // 画面に出す顔の絵。look が無ければ「はなりきし」。fill() で中身が入る
  imgHtml(look, cls = '') {
    return `<img class="look-img ${cls}" data-look="${npcLookKey(look || LOOK_DEFAULT)}" alt="">`;
  },

  // root の中の data-look の絵に中身を入れる（部品が読み込めてから）
  fill(root) {
    const imgs = [...(root || document).querySelectorAll('img[data-look]')];
    if (!imgs.length) return;
    this.load().then(() => {
      for (const img of imgs) {
        const [eyes, skin, mawashi] = img.dataset.look.split('_').map(Number);
        const cv = this.canvas({ eyes, skin, mawashi }, 160);
        if (cv) img.src = cv.toDataURL();
      }
    });
  },
};

// ── 自分の見た目を選ぶ欄（力士を作る画面・見た目の画面で使う）──────────────
// look: null（＝LOOK_DEFAULT）か { eyes, skin, mawashi }
const LookEditor = {
  html(look) {
    const cur = look || { ...LOOK_DEFAULT };
    const sw = (arr, key) => arr.map((c, i) =>
      `<button class="lk-sw ${cur && cur[key] === i ? 'on' : ''}" data-k="${key}" data-i="${i}" style="background:${c}" aria-label="${key}${i + 1}"></button>`).join('');
    const eyes = Array.from({ length: NPC_EYES_COUNT }, (_, i) =>
      `<button class="lk-eye ${cur && cur.eyes === i ? 'on' : ''}" data-k="eyes" data-i="${i}">目${i + 1}</button>`).join('');
    return `
      <div class="lk-editor">
        <div class="lk-preview">${LookSprite.imgHtml(cur, 'lk-preview-img')}</div>
        <div class="lk-rows">
          <div class="lk-row"><span class="lk-label">肌</span><div class="lk-opts">${sw(NPC_SKIN_COLORS, 'skin')}</div></div>
          <div class="lk-row"><span class="lk-label">まわし</span><div class="lk-opts">${sw(NPC_MAWASHI_COLORS, 'mawashi')}</div></div>
          <div class="lk-row"><span class="lk-label">目</span><div class="lk-opts">${eyes}</div></div>
        </div>
      </div>`;
  },

  // onChange(newLook) を呼ぶ。選んだら root の中を作り直す
  bind(root, look, onChange) {
    let cur = look ? { ...look } : { ...LOOK_DEFAULT };
    const redraw = () => {
      root.innerHTML = this.html(cur);
      LookSprite.fill(root);
      this.bind(root, cur, onChange);
    };
    root.querySelectorAll('[data-k]').forEach(btn => btn.addEventListener('click', () => {
      cur[btn.dataset.k] = +btn.dataset.i;
      onChange(cur);
      redraw();
    }));
  },
};
