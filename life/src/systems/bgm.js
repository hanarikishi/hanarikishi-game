// ── BGM ─────────────────────────────────────────
// 画面ごとに曲を流す（Game.showScene から Bgm.forScene(name)）。
// assets/bgm/<曲名>.m4a か .mp3 があればそれをくり返し流し、なければ和風の曲をその場で合成して流す。
// ON/OFF は localStorage の hanarikisi_bgm（効果音とは別）

const BGM_SCENES = {
  title: 'title', create: 'opening', home: 'home', bout: 'bout', bashoResult: 'result',
  allocate: 'menu', banzukeView: 'menu', dojoUpgrade: 'menu', skillMap: 'menu',
  achievements: 'menu', meikan: 'menu', tensei: 'scout', isan: 'scout', scout: 'scout',
};

// 音階（数字＝何番目の音）。陽音階（明るい）と都節（しっとり）
const BGM_YO     = [146.8, 164.8, 196.0, 220.0, 246.9, 293.7, 329.6, 392.0, 440.0, 493.9, 587.3, 659.3];  // D3 E3 G3 A3 B3 D4 …
const BGM_MIYAKO = [146.8, 155.6, 196.0, 220.0, 233.1, 293.7, 311.1, 392.0, 440.0, 466.2, 587.3, 622.3];  // D3 Eb3 G3 A3 Bb3 D4 …

// 旋律の書き方：1文字＝8分音符1つ。数字/英字＝音（0〜9, a=10, b=11）、'-'＝前の音をのばす、'.'＝休み
function bgmParse(str, scale) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '.' || ch === '-') continue;
    let len = 1;
    while (str[i + len] === '-') len++;
    out.push({ step: i, f: scale[parseInt(ch, 36)], len });
  }
  return out;
}

// 曲：bpm（8分音符で数える）・steps（くり返しの長さ）・vol・parts（その拍で鳴らす関数）
// parts の関数は (t, step, sec) を受け取る。sec = 8分音符1つの秒数
const BGM_TRACKS = {
  // タイトル：ゆっくり・おごそか（低い持続音・間をあけた太鼓・尺八風の旋律）
  title: (() => {
    const mel = bgmParse('8-----98---7---a-----ba---8-------7-----87---5---3-----53---2---', BGM_MIYAKO);
    return { bpm: 140, steps: 64, vol: 0.9, parts: [
      (t, s, sec) => { if (s % 32 === 0) Sound.tone(t, 73.4, 73.4, sec * 32, 'sine', 0.10, 0.3, 1.5); },
      (t, s) => { if (s % 16 === 0) Sound.taiko(t, 0.45, 0.8); if (s % 16 === 12) Sound.taiko(t, 0.2, 0.8); },
      (t, s, sec) => { for (const n of mel) if (n.step === s) Sound.tone(t, n.f * 2, n.f * 2, sec * n.len, 'triangle', 0.07, 0.6, 0.12); },
    ] };
  })(),

  // ホーム：のんびり（三味線のくり返し・軽い太鼓・ときどき琴）
  home: (() => {
    const bass = bgmParse('0.5.3.5.0.5.4.3.2.7.5.7.0.5.3.0.', BGM_YO);
    const mel  = bgmParse('................8.7.5-6-7.......a.9.8-7-5-3-5---', BGM_YO);
    return { bpm: 200, steps: 48, vol: 0.8, parts: [
      (t, s) => { for (const n of bass) if (n.step === s % 32) Sound.pluck(t, n.f, 0.09, 0.5, 0.25); },
      (t, s) => { if (s % 16 === 0) Sound.taiko(t, 0.25, 1.1); if (s % 16 === 8) Sound.taiko(t, 0.15, 1.2); },
      (t, s, sec) => { for (const n of mel) if (n.step === s) Sound.pluck(t, n.f * 2, 0.07, sec * n.len + 0.3, 0.45); },
    ] };
  })(),

  // 取組：速い太鼓・低いうなり・都節の三味線（張りつめた感じ）
  bout: (() => {
    const drum = [1, 0, .5, .7, 0, .6, 0, 0, 1, 0, .5, .7, 0, .6, .5, .8];
    const acc  = bgmParse('0..3..4.5..4..3.0..3..4.7..5..4.', BGM_MIYAKO);
    return { bpm: 300, steps: 32, vol: 0.7, parts: [
      (t, s) => { const v = drum[s % 16]; if (v) Sound.taiko(t, 0.35 * v, s % 16 === 0 ? 0.85 : 1.05); },
      (t, s, sec) => { if (s % 16 === 0) Sound.tone(t, 73.4, 73.4, sec * 16, 'sawtooth', 0.025, 0.2, 0.3); },
      (t, s) => { for (const n of acc) if (n.step === s) Sound.pluck(t, n.f, 0.08, 0.35, 0.2); },
    ] };
  })(),

  // 場所結果：にぎやか（祭り囃子ふうの旋律と太鼓）
  result: (() => {
    const mel  = bgmParse('5.7.8.a-8.7.5---8.a.b.a-8.7.8---7.5.3.5-7.8.7---5.3.2.0-2.3.5---', BGM_YO);
    return { bpm: 220, steps: 64, vol: 0.75, parts: [
      (t, s) => { if (s % 4 === 0) Sound.taiko(t, s % 8 === 0 ? 0.35 : 0.2, 1.0); },
      (t, s) => { if (s % 8 === 6) Sound.hyoshigi(t, 0.12); },
      (t, s, sec) => { for (const n of mel) if (n.step === s) Sound.pluck(t, n.f * 2, 0.08, sec * n.len + 0.2, 0.35); },
    ] };
  })(),

  // 振り分け・番付・部屋・スキル・実績・名鑑：静か（琴の分散和音）
  menu: (() => {
    const arp = bgmParse('0.3.5.7.8.7.5.3.0.2.5.7.9.7.5.2.', BGM_YO);
    const mel = bgmParse('................................8---7-5-6---5---7---8-5-3-----', BGM_YO);
    return { bpm: 170, steps: 64, vol: 0.7, parts: [
      (t, s) => { for (const n of arp) if (n.step === s % 16) Sound.pluck(t, n.f * 2, 0.05, 0.9, 0.5); },
      (t, s, sec) => { for (const n of mel) if (n.step === s) Sound.tone(t, n.f * 2, n.f * 2, sec * n.len, 'triangle', 0.045, 0.6, 0.08); },
    ] };
  })(),

  // 引退・スカウト・入門：前向き（明るい旋律とゆっくりの太鼓）
  scout: (() => {
    const bass = bgmParse('0...5...3...5...2...7...5...4...', BGM_YO);
    const mel  = bgmParse('5-7-8---a-8-7---8-7-5---3-5-7---5-7-8---a-b-a---8-7-5-7-8-------', BGM_YO);
    return { bpm: 180, steps: 64, vol: 0.75, parts: [
      (t, s) => { for (const n of bass) if (n.step === s % 32) Sound.pluck(t, n.f, 0.09, 0.9, 0.3); },
      (t, s) => { if (s % 16 === 0) Sound.taiko(t, 0.25, 1.0); },
      (t, s, sec) => { for (const n of mel) if (n.step === s) Sound.pluck(t, n.f * 2, 0.07, sec * n.len + 0.3, 0.45); },
    ] };
  })(),
};
// 力士作成の曲（assets/bgm/opening.m4a＝オープニング動画の音。無いときはタイトルの合成曲）
BGM_TRACKS.opening = BGM_TRACKS.title;

const BGM_FILE_EXTS = ['m4a', 'mp3'];
// 曲の切り替え（秒）：前の曲が FADE_OUT で消えていき、GAP 後に次の曲が FADE_IN で入ってくる
const BGM_FADE_OUT = 1.5, BGM_FADE_GAP = 0.6, BGM_FADE_IN = 3.0;   // 置いてある形式を順に探す

const Bgm = {
  enabled: localStorage.getItem('hanarikisi_bgm') !== 'off',
  VOLUME: 0.22,
  want: null,       // 流したい曲（音が使えるようになる前に決まることがある）
  cur: null,        // { name, gain, src?, timer? }
  files: {},        // 曲名 → AudioBuffer | false

  forScene(scene) { this.play(BGM_SCENES[scene] || null); },

  play(name) {
    this.want = name;
    if (!this.enabled || !Sound.ctx) return;
    if (this.cur && this.cur.name === name) return;
    this.stopCurrent();
    if (!name) return;
    const c = Sound.ctx;
    // 前の曲が引いてから、ゆっくり入る（切り替えがぶつ切れにならないように）
    const g = c.createGain();
    const t0 = c.currentTime + BGM_FADE_GAP;
    g.gain.value = 0;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(this.VOLUME, t0 + BGM_FADE_IN);
    g.connect(Sound.master);
    const cur = { name, gain: g };
    this.cur = cur;

    const buf = this.files[name];
    if (buf) {
      cur.src = c.createBufferSource();
      cur.src.buffer = buf; cur.src.loop = true;
      cur.src.connect(g); cur.src.start(t0);
      return;
    }
    // 合成：少し先までの音を予約していく
    const tr = BGM_TRACKS[name];
    if (!tr) return;
    const sec = 60 / tr.bpm;
    let step = 0, next = t0;
    const tick = () => {
      if (this.cur !== cur) return;
      while (next < c.currentTime + 0.3) {
        Sound.outTarget = g; Sound.volMul = tr.vol;
        for (const p of tr.parts) p(next, step, sec);
        Sound.outTarget = null; Sound.volMul = 1;
        step = (step + 1) % tr.steps;
        next += sec;
      }
    };
    tick();
    cur.timer = setInterval(tick, 60);
  },

  stopCurrent() {
    const cur = this.cur;
    if (!cur) return;
    this.cur = null;
    clearInterval(cur.timer);
    const c = Sound.ctx;
    cur.gain.gain.cancelScheduledValues(c.currentTime);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, c.currentTime);
    cur.gain.gain.linearRampToValueAtTime(0, c.currentTime + BGM_FADE_OUT);
    setTimeout(() => { try { cur.src?.stop(); } catch (e) {} cur.gain.disconnect(); }, BGM_FADE_OUT * 1000 + 500);
  },

  setEnabled(on) {
    this.enabled = on;
    localStorage.setItem('hanarikisi_bgm', on ? 'on' : 'off');
    if (on) { const w = this.want; this.want = null; this.play(w); }
    else    this.stopCurrent();
  },

  // Sound.unlock() から呼ばれる：素材を読みに行き、決まっていた曲を流す
  onUnlock() {
    for (const name of Object.keys(BGM_TRACKS)) {
      soundFetchFirst(BGM_FILE_EXTS.map(ext => `assets/bgm/${name}.${ext}`))
        .then(buf => Sound.ctx.decodeAudioData(buf))
        .then(ab => {
          this.files[name] = ab;
          if (this.cur && this.cur.name === name) { this.stopCurrent(); this.play(name); }   // 合成で流していたら差し替え
        })
        .catch(() => { this.files[name] = false; });
    }
    this.play(this.want);
  },
};

// アプリを裏に回したら音を止める（戻ったら再開）
document.addEventListener('visibilitychange', () => {
  if (!Sound.ctx) return;
  if (document.hidden) Sound.ctx.suspend(); else Sound.ctx.resume();
});

// ── BGM・効果音のオンオフボタン（ホーム以外の画面は右上に浮かべて出す）──────────
const SOUND_ICON = on => `<svg viewBox="0 0 40 40"><path d="M6 15h7l9-8v26l-9-8H6z" fill="currentColor"/>${on
  ? '<path d="M27 13a9 9 0 0 1 0 14M31 9a14 14 0 0 1 0 22" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  : '<path d="M27 14l10 12M37 14 27 26" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'}</svg>`;

const SoundToggles = {
  html() {
    return `<button class="hm-sound btn-bgm snd-bgm ${Bgm.enabled ? '' : 'off'}" aria-label="BGM">♫</button>
      <button class="hm-sound snd-se ${Sound.enabled ? '' : 'off'}" aria-label="効果音">${SOUND_ICON(Sound.enabled)}</button>`;
  },
  bind(root) {
    root.querySelectorAll('.snd-se').forEach(b => b.addEventListener('click', e => {
      Sound.setEnabled(!Sound.enabled);
      e.currentTarget.innerHTML = SOUND_ICON(Sound.enabled);
      e.currentTarget.classList.toggle('off', !Sound.enabled);
    }));
    root.querySelectorAll('.snd-bgm').forEach(b => b.addEventListener('click', e => {
      Bgm.setEnabled(!Bgm.enabled);
      e.currentTarget.classList.toggle('off', !Bgm.enabled);
    }));
  },
};
