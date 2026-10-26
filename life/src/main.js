const APP_VERSION = '1.11.35';
// セーブの形式。稽古・米俵を外した本場所のみモードから 2。これより古いセーブは読み込まない（新しく始める）
const SAVE_VERSION = 2;

// ── 数値フォーマット ─────────────────────────────
// 単位ごとに桁数を変える: <10→2桁 / 10-99→1桁 / 100+→整数 / 1K+ → 同パターン繰り返し
// 単位は K・M・B・T、その先は aa, ab, … az, ba, …（放置ゲームの書き方）
function formatNum(n) {
  if (n <= 0) return '0';

  function scale(v) {
    if (v >= 100) return String(Math.floor(v));
    if (v >= 10)  return (Math.floor(v * 10) / 10).toFixed(1);
    return (Math.floor(v * 100) / 100).toFixed(2);
  }

  if (n >= 1e3) {
    const tier = Math.floor(Math.log10(n) / 3);   // 1=K 2=M 3=B 4=T 5=aa …
    return scale(n / Math.pow(1000, tier)) + numUnit(tier);
  }

  // 1000未満: 整数なら整数表示、小数なら桁数適用
  if (n === Math.floor(n)) return String(Math.floor(n));
  return scale(n);
}

function numUnit(tier) {
  if (tier <= 4) return ['', 'K', 'M', 'B', 'T'][tier];
  const i = tier - 5;
  const abc = 'abcdefghijklmnopqrstuvwxyz';
  return abc[Math.floor(i / 26) % 26] + abc[i % 26];
}

const Game = {
  state: null,

  init() {
    this.showScene('title');
    this.initBack();
  },

  // ── 戻る操作（Android の戻るボタン・スワイプ）──────────────
  // いきなり終了せず、取組中は一時停止・ホームとタイトルは「ゲームを終了しますか？」・ほかの画面は前の画面へ
  initBack() {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) { App.addListener('backButton', () => this.handleBack()); return; }
    // ウェブ版: 履歴にひとつ積んでおき、戻る操作を ここで受けとる（さいしょのタップのあとに積む）
    const arm = () => { try { history.pushState({ hb: 1 }, ''); } catch {} };
    const first = () => { window.removeEventListener('pointerdown', first, true); arm(); };
    window.addEventListener('pointerdown', first, true);
    window.addEventListener('popstate', () => { arm(); this.handleBack(); });
  },

  handleBack() {
    const cf = document.querySelector('.cf-overlay');
    if (cf) { cf.remove(); return; }                                  // 確認が出ていたら とじる
    const sc = this.scene;
    if (sc === 'bout') { BoutScene.setPaused(!BoutScene.paused); return; }   // 取組中: 一時停止（もう一度で再開）
    if (sc === 'title' || sc === 'home') {
      this.confirmBox('ゲームを終了しますか？', '終了する', () => this.exitApp());
      return;
    }
    if (sc === 'create') { this.showScene('title'); return; }
    const back = document.querySelector('#app .btn-back');
    if (back) back.click();                                           // 「戻る」ボタンのある画面は、それを押したことにする
    // 場所の結果・ちゃんこの振り分け・スカウトは、とばせないので何もしない
  },

  exitApp() {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.exitApp) App.exitApp(); else location.href = '../';
  },

  showScene(name, data) {
    const container = document.getElementById('app');
    const sceneMap  = {
      title:        TitleScene,
      create:       CreateScene,
      home:         HomeScene,
      bout:         BoutScene,
      bashoResult:  BashoResultScene,
      banzukeView:  BanzukeViewScene,
      tensei:       TenseiScene,
      isan:         IsanScene,
      dojoUpgrade:  DojoUpgradeScene,
      skillMap:     SkillMapScene,
      achievements: AchievementsScene,
      meikan:       MeikanScene,
      allocate:     AllocateScene,
      scout:        ScoutScene,
      look:         LookEditScene,
      records:      RecordsScene,
    };

    const scene = sceneMap[name];
    if (!scene) { console.error('Unknown scene:', name); return; }
    this.scene = name;

    const scrollTop = container.scrollTop;
    container.innerHTML = scene.render(data);
    if (data && data.noFade) {
      container.scrollTop = scrollTop;   // 同じ画面の更新：フェードせず位置もそのまま
    } else {
      container.scrollTop = 0;   // 前の画面で下にスクロールしていても、新しい画面は いちばん上から（2試合目の上が切れていた）
      container.classList.add('scene-enter');
      requestAnimationFrame(() => requestAnimationFrame(() => container.classList.remove('scene-enter')));
    }

    // ホームと取組は自分の画面の中に音のボタンがある。それ以外は右上に浮かべる
    if (name !== 'home' && name !== 'bout') {
      const f = document.createElement('div');
      f.className = 'snd-float';
      f.innerHTML = SoundToggles.html();
      container.appendChild(f);
      SoundToggles.bind(f);
    }

    if (scene.attach) scene.attach(data);
    Bgm.forScene(name);
  },

  // ゲームの中の確認ダイアログ。OK なら onOk を呼ぶ
  confirmBox(html, okLabel, onOk) {
    const box = document.createElement('div');
    box.className = 'cf-overlay';
    box.innerHTML = `<div class="cf-box"><div class="cf-msg">${html}</div>
      <div class="cf-btns"><button class="btn-ghost" data-a="no">やめる</button><button class="btn-primary cf-ok" data-a="ok">${okLabel}</button></div></div>`;
    document.body.appendChild(box);
    box.addEventListener('click', e => {
      const a = e.target.dataset?.a;
      if (!a && e.target !== box) return;
      box.remove();
      if (a === 'ok') onOk();
    });
  },

  save() {
    if (!this.state) return;
    this.state.lastTickTime = Date.now();
    try { localStorage.setItem('hanarikisi_save', JSON.stringify(this.state)); } catch {}   // 容量がいっぱいなどでも、ゲームを止めない
  },

  loadSave() {
    let raw = null;
    try { raw = localStorage.getItem('hanarikisi_save'); } catch {}
    if (raw) {
      let st = null;
      try { st = JSON.parse(raw); } catch {}
      if (!st || typeof st !== 'object' || !st.rikishi) { try { localStorage.removeItem('hanarikisi_save'); } catch {} return; }   // こわれたセーブは捨てる（新しく始める）
      if ((st.saveVersion || 1) < SAVE_VERSION) { try { localStorage.removeItem('hanarikisi_save'); } catch {} return; }   // 古い形式は捨てる
      sanitizeSaveNames(st);
      this.state = st;
      patchSave(this.state);
      // 女将：アプリを閉じていた間のたにまち（最大6時間＋スキル）
      const t = this.state.tensei;
      if (t && this.state.lastTickTime) {
        const fxOff  = calcSkillEffects(this.state);
        const capSec = 21600 + (fxOff.offlineCap || 0) * 3600;
        const offSec = Math.min((Date.now() - this.state.lastTickTime) / 1000, capSec) * (1 + (fxOff.offlinePct || 0) / 100);
        const gained = Math.floor(fxOff.taniPerMin * (fxOff.taniAutoMult || 1) * offSec / 60);
        if (gained > 0) t.tanimachi = (t.tanimachi || 0) + gained;
      }
    }
  },
};

// ── 女将：たにまちが毎分ふえる ─────────────────
function startTick() {
  setInterval(() => {
    if (!Game.state?.tensei) return;
    const t  = Game.state.tensei;
    const fx = calcSkillEffects(Game.state);
    if (fx.taniPerMin > 0) {
      t.kamisanAccum = (t.kamisanAccum || 0) + fx.taniPerMin * (fx.taniAutoMult || 1) / 60;
      const tmEarned = Math.floor(t.kamisanAccum);
      if (tmEarned > 0) {
        t.kamisanAccum -= tmEarned;
        t.tanimachi = (t.tanimachi || 0) + tmEarned;
      }
    }
    const taniEl = document.getElementById('hc-tanimachi-val');
    if (taniEl) taniEl.textContent = formatNum(t.tanimachi || 0);
  }, 1000);
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version-badge').textContent = `v${APP_VERSION}`;
  Game.init();
  startTick();
});
