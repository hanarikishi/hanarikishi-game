const APP_VERSION = '1.11.0';
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

    const scrollTop = container.scrollTop;
    container.innerHTML = scene.render(data);
    if (data && data.noFade) {
      container.scrollTop = scrollTop;   // 同じ画面の更新：フェードせず位置もそのまま
    } else {
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
    localStorage.setItem('hanarikisi_save', JSON.stringify(this.state));
  },

  loadSave() {
    const raw = localStorage.getItem('hanarikisi_save');
    if (raw) {
      const st = JSON.parse(raw);
      if ((st.saveVersion || 1) < SAVE_VERSION) { localStorage.removeItem('hanarikisi_save'); return; }   // 古い形式は捨てる
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
