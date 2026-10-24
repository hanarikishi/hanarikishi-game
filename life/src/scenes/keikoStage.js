// 部屋のステージ（ホーム上部）：力士のコマ送りアニメ・親方の一言
//
// 絵の置き場所: 動きごとの path（なければ assets/images/keiko/<動きID>_<番号>.png。番号は1から）
// 絵が無いコマは「仮表示」：基本の絵を pose の形に動かし、動き名とコマ番号を出す。
// コマ数・速さを変えるときは KEIKO_ANIMS の frames / fps / poses をそろえて直す。
// pauseMs: [最短, 最長] … 1周したら1コマ目のまましばらく止まってから、また動く
const KEIKO_ANIMS = {
  // 待機：鼻をくるっと巻いて戻す（home1〜7。7は1と同じ形）
  idle:      { name: '待機',     frames: 7, fps: 8,  loop: true, pauseMs: [1800, 4000],
               path: n => `assets/images/home/home${n}.png`,
               poses: ['', '', '', '', '', '', ''] },
};

const KEIKO_STAGE_BASE_IMG = 'assets/images/home/home1.png';   // 読み込み前・仮表示に使う絵

const KeikoStage = {
  frameState: {},   // { 'shiko_1': 'ok' | 'ng' | 'loading' }
  timer: null,
  anim: null,       // 再生中 { id, frame, onEnd }
  showLabel: true,  // 仮表示のラベル（コマが全部そろったら false にしてよい）

  framePath(id, n) { const a = KEIKO_ANIMS[id]; return a.path ? a.path(n) : `assets/images/keiko/${id}_${n}.png`; },

  // 全コマの有無を先に調べておく（無いコマは仮表示）
  preload() {
    for (const [id, a] of Object.entries(KEIKO_ANIMS)) {
      for (let n = 1; n <= a.frames; n++) {
        const key = `${id}_${n}`;
        if (this.frameState[key]) continue;
        this.frameState[key] = 'loading';
        const img = new Image();
        img.onload  = () => { this.frameState[key] = 'ok'; };
        img.onerror = () => { this.frameState[key] = 'ng'; };
        img.src = this.framePath(id, n);
      }
    }
  },

  idleAnimId() { return 'idle'; },

  render() {
    return `
      <div class="keiko-stage" id="keiko-stage">
        <div class="ks-wall"></div>
        <div class="ks-pillar ks-pillar-l"></div><div class="ks-pillar ks-pillar-r"></div>
        <div class="ks-banner ks-banner-l">${HOME_MON}</div>
        <div class="ks-banner ks-banner-r">${HOME_MON}</div>
        <div class="ks-floor"><div class="ks-tawara"></div></div>
        <div class="ks-rikishi"><img class="ks-sprite" id="ks-sprite" src="${KEIKO_STAGE_BASE_IMG}" alt=""></div>
        <div class="ks-label" id="ks-label"></div>
        <div class="ks-bubble hidden" id="ks-bubble"></div>
      </div>`;
  },

  attach() {
    this.preload();
    this.play(this.idleAnimId());
    // ときどき親方の一言
    if (Math.random() < 0.2) this.say(oyakataComment(Game.state.rikishi));
  },

  // 動きを最初から再生。ループしない動きは終わったら onEnd を呼んで待機に戻る
  play(id, onEnd) {
    this.anim = { id, frame: 0, onEnd };
    this.drawFrame();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000 / KEIKO_ANIMS[id].fps);
  },

  tick() {
    if (!document.getElementById('keiko-stage')) { clearInterval(this.timer); this.timer = null; return; }
    const a = KEIKO_ANIMS[this.anim.id];
    this.anim.frame++;
    if (this.anim.frame >= a.frames) {
      if (a.loop && a.pauseMs) {
        // 1コマ目に戻して少し止まり、また最初から
        this.anim.frame = 0;
        this.drawFrame();
        clearInterval(this.timer);
        const [lo, hi] = a.pauseMs, id = this.anim.id;
        this.timer = setTimeout(() => { if (document.getElementById('keiko-stage') && this.anim.id === id) this.play(id); }, lo + Math.random() * (hi - lo));
        return;
      }
      if (a.loop) { this.anim.frame = 0; }
      else {
        const cb = this.anim.onEnd;
        this.play(this.idleAnimId());
        if (cb) cb();
        return;
      }
    }
    this.drawFrame();
  },

  drawFrame() {
    const sprite = document.getElementById('ks-sprite');
    const label  = document.getElementById('ks-label');
    if (!sprite) return;
    const a   = KEIKO_ANIMS[this.anim.id];
    const n   = this.anim.frame + 1;
    const key = `${this.anim.id}_${n}`;
    const real = this.frameState[key] === 'ok';
    const src  = real ? this.framePath(this.anim.id, n) : KEIKO_STAGE_BASE_IMG;
    if (!sprite.src.endsWith(src)) sprite.src = src;
    sprite.style.transform = real ? '' : (a.poses[this.anim.frame] || '');
    sprite.classList.toggle('ks-placeholder', !real);
    if (label) {
      label.textContent = `${a.name} ${n}/${a.frames}${real ? '' : '（仮）'}`;
      label.classList.toggle('hidden', !this.showLabel || real);   // 本物の絵のときは出さない
    }
  },

  say(text) {
    const el = document.getElementById('ks-bubble');
    if (!el || !text) return;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  },
};

// 親方の一言（疲労・年齢段階で変わる）
function oyakataComment(r) {
  const phase = getAgePhase(r).phase;
  const pool = [];
  if (phase === 'growth')  pool.push('伸び盛りだな', '今のうちにしっかり鍛えろ');
  if (phase === 'peak')    pool.push('いい体になってきた', '今が一番強い時期だ');
  if (phase === 'plateau') pool.push('ここからは工夫が大事だ', '焦るな、積み重ねだ');
  if (phase === 'decline') pool.push('体と相談しながらやれ', 'まだまだ見せてくれ');
  pool.push('腰を落とせ！', 'その調子だ', '一番一番が勝負だ');
  return pool[Math.floor(Math.random() * pool.length)];
}
