// ── 効果音 ──────────────────────────────────────
// Sound.play('hit') で鳴らす。assets/sounds/<名前>.m4a か .mp3 があればそれを、なければ合成音を鳴らす
// ON/OFF は localStorage の hanarikisi_sound（タイトル画面でも効くようにセーブとは別）

// 効果音全体の音量（1 で元の大きさ）
const SOUND_SE_VOLUME = 0.4;

const Sound = {
  ctx: null,
  files: {},        // 名前 → AudioBuffer（読み込めたもの）| false（無かった）
  lastPlay: 0,      // tap 以外を最後に鳴らした時刻（ボタン音の重なり防止）
  enabled: localStorage.getItem('hanarikisi_sound') !== 'off',

  NAMES: ['tap', 'up', 'eat', 'pull', 'launch', 'hit', 'tachiai', 'win', 'lose',
          'good', 'bad', 'yusho', 'ach', 'tensei', 'skill', 'hakkeyoi', 'nokotta'],

  // スマホは最初のタップまで音を出せないので、そこで有効化して素材を読みに行く
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // iPhone はマナーモードだと Web Audio が消音されるので、音楽再生扱いにして鳴らす
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    this.ctx = new AC();
    this.setupBus();
    for (const name of this.NAMES) this.loadFile(name);
    if (typeof Bgm !== 'undefined') Bgm.onUnlock();
  },

  // 出力：各音 →（そのまま）master ／（送り）残響 → master → コンプレッサ → スピーカー
  setupBus() {
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp).connect(c.destination);
    // 効果音だけの音量つまみ（BGM は Bgm が master に直接つなぐ）
    this.seBus = c.createGain();
    this.seBus.gain.value = SOUND_SE_VOLUME;
    this.seBus.connect(this.master);
    // 残響：減衰するノイズを響きとして使う（広い館内のイメージ・約1.8秒）
    const len = Math.floor(c.sampleRate * 1.8);
    const ir  = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.verb = c.createConvolver();
    this.verb.buffer = ir;
    const vg = c.createGain();
    vg.gain.value = 0.35;
    this.verb.connect(vg).connect(this.master);
  },

  loadFile(name) {
    soundFetchFirst(['m4a', 'mp3'].map(ext => `assets/sounds/${name}.${ext}`))
      .then(buf => this.ctx.decodeAudioData(buf))
      .then(ab => { this.files[name] = ab; })
      .catch(() => { this.files[name] = false; });
  },

  setEnabled(on) {
    this.enabled = on;
    localStorage.setItem('hanarikisi_sound', on ? 'on' : 'off');
  },

  // opts.power: 0〜1（強さで音量を変える音用）
  play(name, opts = {}) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state !== 'running') this.ctx.resume();
    if (name !== 'tap') this.lastPlay = performance.now();
    const vol = opts.power != null ? 0.3 + 0.7 * Math.max(0, Math.min(1, opts.power)) : 1;
    const buf = this.files[name];
    if (buf) {
      const src = this.ctx.createBufferSource();
      const g   = this.ctx.createGain();
      src.buffer = buf;
      g.gain.value = vol;
      src.connect(g).connect(this.seBus);
      src.start();
      return;
    }
    const fn = SOUND_SYNTH[name];
    if (fn) fn(this.ctx.currentTime, vol);
  },

  // 声（端末の読み上げ。日本語の声が無い端末では鳴らない）。行司の声の素材 assets/sounds/<名前>.m4a（.mp3） があればそちらが優先
  // parts: [[言葉, 速さ, 高さ], ...] を続けて読む（区切りごとに速さと高さを変えて抑揚をつける）。高さは 0〜2
  say(parts) {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    const voice = ss.getVoices().find(v => v.lang && v.lang.startsWith('ja'));
    ss.cancel();
    for (const [text, rate, pitch] of parts) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.rate = rate; u.pitch = pitch; u.volume = 1;
      if (voice) u.voice = voice;
      ss.speak(u);
    }
  },

  // ── 合成の部品 ──（send: 残響に送る量 0〜1）
  // BGM を作るときは outTarget（BGM の音量つまみ）へつなぎ、volMul で全体の音量をそろえる
  outTarget: null,
  volMul: 1,
  out(node, send = 0) {
    node.connect(this.outTarget || this.seBus);
    if (send > 0) {
      const g = this.ctx.createGain();
      g.gain.value = send * (this.outTarget && typeof Bgm !== 'undefined' ? Bgm.VOLUME : SOUND_SE_VOLUME);   // 残響もそれぞれの音量に合わせる
      node.connect(g).connect(this.verb);
    }
  },

  env(t, vol, atk, dur) {
    vol *= this.volMul;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  },

  // 音程 f0→f1 へ動く単音
  tone(t, f0, f1, dur, type = 'sine', vol = 0.3, send = 0.2, atk = 0.005) {
    const o = this.ctx.createOscillator(), g = this.env(t, vol, atk, dur);
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.connect(g);
    this.out(g, send);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  noiseBuf(dur) {
    const c = this.ctx, len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  // フィルタを通したノイズ。f1 を渡すとフィルタが f0→f1 へ動く（風切り音など）
  noise(t, dur, f0, vol = 0.3, type = 'lowpass', send = 0.1, f1 = null, atk = 0.002, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = this.env(t, vol, atk, dur);
    src.buffer = this.noiseBuf(dur + 0.05);
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    src.connect(f).connect(g);
    this.out(g, send);
    src.start(t);
  },

  // 三味線・琴のような弾く音（のこぎり波の高域をすぐ絞る）
  pluck(t, f, vol = 0.2, dur = 0.6, send = 0.3) {
    const c = this.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter();
    const m = c.createGain(), g = this.env(t, vol, 0.003, dur);
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = f; o2.frequency.value = f * 1.003;
    lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(f * 8, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * 0.6);
    m.gain.value = 0.5;
    o.connect(lp); o2.connect(m).connect(lp); lp.connect(g);
    this.out(g, send);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },

  // 太鼓（音程が落ちる低音＋皮を叩くノイズ）
  taiko(t, vol = 0.8, pitch = 1) {
    this.tone(t, 150 * pitch, 55 * pitch, 0.45, 'sine', vol, 0.35, 0.002);
    this.tone(t, 260 * pitch, 120 * pitch, 0.12, 'triangle', vol * 0.35, 0.2, 0.001);
    this.noise(t, 0.09, 1200, vol * 0.45, 'lowpass', 0.3);
  },

  // 拍子木（カンッ）
  hyoshigi(t, vol = 0.5) {
    this.noise(t, 0.05, 2600, vol, 'bandpass', 0.6, null, 0.001, 8);
    this.tone(t, 1900, 1750, 0.07, 'square', vol * 0.12, 0.6, 0.001);
    this.tone(t, 3100, 3000, 0.05, 'sine', vol * 0.2, 0.6, 0.001);
  },

  // 鐘・鈴（倍音がずれた金属音）
  bell(t, f, vol = 0.2, dur = 1.5, send = 0.5) {
    for (const [mul, a] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]]) {
      this.tone(t, f * mul, f * mul, dur / Math.sqrt(mul), 'sine', vol * a, send, 0.002);
    }
  },

  // 歓声（中域のノイズが盛り上がって引いていく。ざわめきのゆらぎ付き）
  crowd(t, dur = 1.8, vol = 0.3) {
    const c = this.ctx;
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = this.noiseBuf(dur + 0.1);
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.2);
    g.gain.setValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.frequency.value = 7; lg.gain.value = vol * 0.25;
    lfo.connect(lg).connect(g.gain);
    src.connect(bp).connect(g);
    this.out(g, 0.5);
    src.start(t); lfo.start(t); lfo.stop(t + dur + 0.1);
  },

  // 旋律：notes = [[周波数, 開始の遅れ秒, 長さ秒], ...]。kind は 'pluck' か波形名
  melody(t, notes, vol = 0.2, kind = 'pluck') {
    for (const [f, dt, dur] of notes) {
      if (kind === 'pluck') this.pluck(t + dt, f, vol, Math.max(0.3, dur));
      else this.tone(t + dt, f, f, dur, kind, vol, 0.35, 0.01);
    }
  },
};

// 候補の URL を順に試し、最初に見つかったファイルの中身を返す（どれも無ければ失敗）
function soundFetchFirst(urls) {
  return urls.reduce((p, url) => p.catch(() =>
    fetch(url).then(res => { if (!res.ok) throw 0; return res.arrayBuffer(); })), Promise.reject());
}

// 和風の音階（明るい曲は D E G A B、沈む曲は半音を混ぜる）
const NOTE = {
  Bb3: 233, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494,
  D5: 587, E5: 659, G5: 784, A5: 880, B5: 988, D6: 1175,
};

// 素材が無いときの合成音
const SOUND_SYNTH = {
  tap:     (t, v) => { Sound.noise(t, 0.03, 3000, 0.25 * v, 'bandpass', 0.05, null, 0.001, 5); Sound.tone(t, 1500, 1200, 0.04, 'sine', 0.12 * v, 0.05, 0.001); },
  up:      (t, v) => {
    Sound.melody(t, [[NOTE.D5, 0, 0.3], [NOTE.E5, 0.07, 0.3], [NOTE.A5, 0.14, 0.5]], 0.14 * v);
    Sound.bell(t + 0.14, NOTE.D6 * 2, 0.04 * v, 0.6);
  },
  eat:     (t, v) => {
    for (let i = 0; i < 3; i++) Sound.tone(t + i * 0.09, 300 + i * 80, 900 + i * 150, 0.07, 'sine', 0.25 * v, 0.1);
    Sound.noise(t + 0.3, 0.25, 900, 0.12 * v, 'bandpass', 0.1, 2500, 0.05, 2);
  },
  pull:    (t, v) => Sound.tone(t, 180, 420, 0.12, 'triangle', 0.12 * v, 0.05, 0.01),
  launch:  (t, v) => Sound.noise(t, 0.3, 500, 0.45 * v, 'bandpass', 0.15, 3500, 0.02, 2),
  hit:     (t, v) => {
    Sound.tone(t, 140, 38, 0.4, 'sine', 1.0 * v, 0.3, 0.001);
    Sound.tone(t, 320, 90, 0.06, 'square', 0.25 * v, 0.2, 0.001);
    Sound.noise(t, 0.16, 1100, 0.8 * v, 'lowpass', 0.35);
    Sound.noise(t, 0.04, 4000, 0.25 * v, 'highpass', 0.2);
  },
  tachiai: (t, v) => { Sound.hyoshigi(t, 0.6 * v); Sound.hyoshigi(t + 0.22, 0.75 * v); },
  win:     (t, v) => {
    Sound.taiko(t, 0.9 * v); Sound.taiko(t + 0.15, 0.7 * v);
    Sound.crowd(t + 0.05, 2.2, 0.35 * v);
    Sound.melody(t + 0.3, [[NOTE.D5, 0, 0.3], [NOTE.E5, 0.12, 0.3], [NOTE.G5, 0.24, 0.3], [NOTE.A5, 0.36, 0.8], [NOTE.D5, 0.36, 0.8]], 0.16 * v);
  },
  lose:    (t, v) => {
    Sound.taiko(t, 0.5 * v, 0.7);
    Sound.crowd(t, 1.0, 0.12 * v);
    Sound.melody(t + 0.2, [[NOTE.A4, 0, 0.4], [NOTE.F4, 0.25, 0.4], [NOTE.E4, 0.5, 0.4], [NOTE.Bb3, 0.75, 1.0]], 0.15 * v);
  },
  good:    (t, v) => {
    Sound.hyoshigi(t, 0.5 * v); Sound.hyoshigi(t + 0.2, 0.6 * v);
    Sound.melody(t + 0.45, [[NOTE.D5, 0, 0.3], [NOTE.E5, 0.13, 0.3], [NOTE.G5, 0.26, 0.3], [NOTE.A5, 0.39, 0.3], [NOTE.D6, 0.52, 1.0], [NOTE.A5, 0.52, 1.0]], 0.15 * v);
  },
  bad:     (t, v) => {
    Sound.taiko(t, 0.6 * v, 0.6);
    Sound.melody(t + 0.25, [[NOTE.E4, 0, 0.5], [NOTE.F4, 0.3, 0.5], [NOTE.E4, 0.6, 0.4], [NOTE.Bb3, 0.9, 1.2]], 0.14 * v);
  },
  yusho:   (t, v) => {
    // 太鼓の連打（だんだん速く）→ 大歓声と祝いの旋律
    let dt = 0;
    for (let i = 0; i < 9; i++) { Sound.taiko(t + dt, (0.5 + i * 0.05) * v); dt += Math.max(0.07, 0.2 - i * 0.018); }
    Sound.taiko(t + dt + 0.05, 1.0 * v, 0.9);
    Sound.crowd(t + dt, 3.5, 0.4 * v);
    const s = dt + 0.2;
    const tune = [[NOTE.D5, 0, 0.3], [NOTE.E5, 0.15, 0.3], [NOTE.G5, 0.3, 0.3], [NOTE.A5, 0.45, 0.3], [NOTE.B5, 0.6, 0.3], [NOTE.D6, 0.75, 1.4]];
    Sound.melody(t + s, [...tune, [NOTE.A5, 0.75, 1.4], [NOTE.D5, 0.75, 1.4]], 0.17 * v);
    Sound.melody(t + s, tune, 0.05 * v, 'sawtooth');
    Sound.bell(t + s + 0.75, NOTE.D6, 0.08 * v, 2.5);
  },
  ach:     (t, v) => { Sound.bell(t, NOTE.A5, 0.12 * v, 1.4); Sound.bell(t + 0.1, NOTE.D6, 0.1 * v, 1.6); },
  tensei:  (t, v) => {
    Sound.tone(t, 55, 110, 2.5, 'sine', 0.3 * v, 0.5, 0.8);
    [NOTE.D4, NOTE.E4, NOTE.G4, NOTE.A4, NOTE.B4, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.D6]
      .forEach((f, i) => Sound.bell(t + i * 0.11, f, 0.06 * v, 1.6, 0.7));
  },
  // 行司の掛け声ふう：「はっけ」を短く鋭く、「よーーい」を高く長く引っぱる
  hakkeyoi: (t, v) => {
    Sound.say([['はっけ', 1.3, 1.6], ['よーーーい！', 0.65, 2.0]]);
    Sound.hyoshigi(t, 0.4 * v);
    Sound.tone(t + 0.3, 70, 70, 1.1, 'sine', 0.12 * v, 0.3, 0.6);   // 溜めのうなり
  },
  nokotta:  (t, v) => {
    Sound.say([['のこった！', 1.5, 1.8], ['のこった！', 1.6, 1.9]]);
    Sound.taiko(t, 0.9 * v); Sound.taiko(t + 0.12, 0.6 * v);
    Sound.crowd(t, 1.4, 0.25 * v);
  },
  skill:   (t, v) => { Sound.bell(t, 1568, 0.08 * v, 0.6, 0.3); Sound.bell(t + 0.07, 2093, 0.08 * v, 0.9, 0.3); },
};

// 最初の操作で音を有効化／ボタンを押したら tap（専用の音が鳴ったときは鳴らさない）
// （スマホのタッチは pointerdown では音の許可が下りないので、指を離したとき・クリックでも試す）
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
  document.addEventListener(ev, () => Sound.unlock(), true);
}
document.addEventListener('click', e => {
  if (!e.target.closest('button') || e.target.closest('button').disabled) return;
  if (performance.now() - Sound.lastPlay < 50) return;
  Sound.play('tap');
});
