// 土俵際の踏ん張りの強さ（技99で、外へ出る勢いを1フレームごとにこの割合だけ殺す）
const BOUT_EDGE_BRAKE = 0.35;
// 自分の勢いで外へ出そうなとき（直前に当たっていない）は、技が高いほど さらに踏みとどまる（自滅しにくい）
const BOUT_SELF_BRAKE    = 0.35;
const BOUT_SELF_BRAKE_MS = 400;   // 最後に当たってからこの時間がたったら「自分の勢い」とみなす
// 軽い当たりで相手が動く割合の下限（強く当てたとき＝1）
const BOUT_LIGHT_HIT = 0.2;
// 「はっけよい」から「のこった！」までのミリ秒
const BOUT_READY_MS = 1500;   // 「はっけよーーい」を言い切るまで
const BOUT_HIT_FACE_MS = 400;   // ぶつかった顔を出しておく長さ
// 幕下・十両の相手の能力：場所開始時の自分を偏差値50として、ばらつかせる（取組の中だけ。名簿の能力は変えない）
const BOUT_HENSACHI_SD = 0.12;        // 力・技・速さのばらつき（偏差値10 ＝ 自分の能力の12%）
const BOUT_HENSACHI_SD_WEIGHT = 0.08; // 体重のばらつき


const BOUT_KNOCK_RATIO = 1.2;   // ぶつかった勢いの何倍の速さで、お互い後ろへ飛ぶか（自分も相手も同じ）
const BOUT_KNOCK_MINV = 0.005;  // 飛ぶ速さの最低ライン（土俵の幅に対する割合。ゆっくり当たったとき用）
const BOUT_OPP_KNOCK_FRAMES = 20;  // 飛ばされている間（このフレーム数）は、引き戻しや踏ん張りを止めて、そのまま滑らせる

const BoutScene = {
  opponent:  null,
  phase:     'idle',   // idle | aiming | flying | done
  boutDone:  false,
  rounds:    0,
  animId:    null,
  playerImg: null,

  pPos: null, oPos: null,
  pVel: null, oVel: null,

  // 相手AI
  oPhase: 'ready',   // ready | windup | charging
  oTimer: 0,

  // Slingshot aiming
  isAiming:   false,
  aimStart:   null,
  aimCurrent: null,

  render() {
    const r     = Game.state.rikishi;
    const b     = Game.state.basho;
    const roster  = Game.state.roster;
    const inRoster = !!(roster && rosterPlayerEntry(roster));
    let opp = this.opponent;
    // 名簿の取組なのに相手が未登録（前の場所の相手が残っている等）なら選び直す。登録しないと勝敗が名簿に残らない
    if (opp && inRoster && !b.playoff && !roster.pendingOpp) opp = null;
    if (!opp) {
      if (b.playoff?.queue?.length) opp = roster.list.find(x => x.shikona === b.playoff.queue[0]);
      else if (inRoster)           opp = rosterGetPlayerOpponent(Game.state, b.day);
      if (!opp) {
        // 名簿外（三段目以下）の相手：今場所の成績は自分と近いもの（同じくらいの星どうしが当たる）
        opp = generateOpponent(r.banzukeRank);
        const n = Math.max(0, b.day - 1);
        opp.bw = Math.max(0, Math.min(n, b.wins + Math.floor(Math.random() * 3) - 1));
        opp.bl = n - opp.bw;
        opp.generated = true;
      }
    }
    if (!opp.look) opp.look = npcRandomLook();   // 名簿外の相手は見た目をその場で決める
    // 幕下・十両の相手：場所開始時の自分の能力を偏差値50として、能力をばらつかせる（同じ相手は場所の間ずっと同じ）
    if ((opp.div === 'makushita' || opp.div === 'juryo') && !opp.boutCopy) {
      const b = Game.state.basho, base = b.start || Game.state.rikishi.stats;
      b.oppRoll = b.oppRoll || {};
      if (!b.oppRoll[opp.shikona]) {
        const z = () => Math.max(-2, Math.min(2, (Math.random() + Math.random() + Math.random() - 1.5) * 2));   // ほぼ正規分布（±2まで）
        const roll = (v, sd) => Math.max(10, Math.round(v * (1 + z() * sd)));
        b.oppRoll[opp.shikona] = { chikara: roll(base.chikara, BOUT_HENSACHI_SD), waza: roll(base.waza, BOUT_HENSACHI_SD),
          hayasa: roll(base.hayasa, BOUT_HENSACHI_SD), taijuu: roll(base.taijuu, BOUT_HENSACHI_SD_WEIGHT) };
      }
      opp = { ...opp, boutCopy: true, stats: { ...opp.stats, ...b.oppRoll[opp.shikona] } };
    }
    this.opponent = opp;
    const total = getBoutCount(r.banzukeRank);
    // 最終戦が全勝同士か（実績「全勝対決」用）
    if (inRoster && !b.playoff && b.day === total) {
      b.zenshoClash = b.losses === 0 && opp.bl === 0 && opp.bw === b.wins;
    }
    const relLine = opp.title
      ? `<div class="opp-rel">${rosterTagsHtml(Game.state, opp)}<span>${rosterHeadToHead(Game.state, opp)}</span>${b.zenshoClash ? '<span class="opp-clash">全勝対決！</span>' : ''}</div>` : '';
    const headLabel = b.playoff
      ? `${getBashoName(Game.state.calendar.bashoIndex)}　優勝決定戦`
      : `${getBashoName(Game.state.calendar.bashoIndex)}　${b.day}番目 / ${total}番`;

    // 年齢と今場所の成績（名簿外の相手は勝敗を持たない）
    const oppInfo = [
      opp.age != null ? `${opp.age}歳` : '',
      opp.bw != null ? `今場所 ${opp.bw}勝${opp.bl}敗` : '',
    ].filter(Boolean).join('　');

    const miniStat = (label, val) =>
      `<div class="ms-item"><span class="ms-label">${label}</span><span class="ms-val">${val}</span></div>`;
    const miniStats = st => `
      <div class="mini-stats">
        ${miniStat('力', formatNum(Math.floor(st.chikara)))}
        ${miniStat('技', formatNum(Math.floor(st.waza)))}
        ${miniStat('速', formatNum(Math.floor(st.hayasa)))}
        ${miniStat('体重', Math.round(st.taijuu) + 'kg')}
      </div>`;
    const shobuTag = b.shobu
      ? `<span class="shobu-tag">🍲${({ chikara: '力', waza: '技', taijuu: '重さ' })[b.shobu.stat]}+${b.shobu.pct}%</span>` : '';
    const myInfo = `${r.age}歳　今場所 ${b.wins}勝${b.losses}敗`;

    return `
      <div class="scene scene-bout">
        <div class="bout-header">
          <span>${headLabel}</span>
          <span class="bout-tools">
            <span class="bout-score">${b.wins}勝${b.losses}敗</span>
            ${SoundToggles.html()}
            <button class="bout-pause-btn" id="btn-pause" aria-label="一時停止">❚❚</button>
          </span>
        </div>

        <div class="opp-panel">
          <div class="opp-panel-left">
            <div class="fp-line">
              <span class="rank-badge rank-${opp.banzukeRank}">${opp.title || getRankName(opp.banzukeRank)}</span>
              <span class="opp-shikona">${opp.title ? rosterDisplayName(opp) : opp.shikona}</span>
            </div>
            ${oppInfo ? `<small class="opp-rec">${oppInfo}</small>` : ''}
            ${relLine}
          </div>
          ${miniStats(opp.stats)}
        </div>

        <div class="canvas-wrap" id="canvas-wrap">
          <canvas id="bout-canvas" style="touch-action:none;"></canvas>
          <div class="bout-call" id="bout-call">はっけよーい</div>
          <div class="bout-pause hidden" id="bout-pause">
            <div class="bout-pause-label">一時停止</div>
            <button class="btn-primary" id="btn-resume">再開する</button>
          </div>
        </div>

        <div class="player-panel">
          <div class="opp-panel-left">
            <div class="fp-line">
              <span class="rank-badge rank-${r.banzukeRank}">${r.rosterTitle || getRankName(r.banzukeRank)}</span>
              <span class="player-shikona">${r.shikona}</span>
            </div>
            <small class="opp-rec">${myInfo}${shobuTag ? '　' + shobuTag : ''}</small>
          </div>
          ${miniStats(r.stats)}
        </div>

        <div id="bout-result" class="bout-result hidden"></div>
      </div>`;
  },

  attach() {
    if (!this.playerImg) {
      this.playerImg = new Image();
      this.playerImg.src = 'assets/images/hanarikisi.png';
    }
    LookSprite.load();   // 相手（と見た目を変えた自分）の絵の部品
    this.paused    = false;
    SoundToggles.bind(document.querySelector('.bout-tools'));
    document.getElementById('btn-pause').addEventListener('click', () => this.setPaused(!this.paused));
    document.getElementById('btn-resume').addEventListener('click', () => this.setPaused(false));
    this.pAng = this.oAng = null;   // 絵の向き（相手の方）
    this.boutWin   = null;
    this.lastHitAt = 0;
    this.boutDone   = false;
    this.rounds     = 0;
    this.phase      = 'idle';
    this.isAiming   = false;
    this.aimStart   = null;
    this.aimCurrent = null;
    this.pVel = { x: 0, y: 0 };
    this.oVel = { x: 0, y: 0 };
    this.oKnock = 0;
    // 相手AI初期化
    this.oPhase = 'ready';
    this.oStagger = 0;
    this.hitLog = []; this.lastDodgeAt = 0; this.lastLaunchAt = 0; this.lastChargeAt = 0;
    const o0 = this.opponent;
    this.oTimer = Math.round(Math.max(15, 50 - (o0 ? o0.stats.hayasa * 0.3 + o0.banzukeRank * 3 : 0)));

    const canvas = document.getElementById('bout-canvas');
    const wrap   = document.getElementById('canvas-wrap');
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');

    const size = Math.min(wrap.clientWidth || window.innerWidth - 32, 400);
    canvas.width  = size;
    canvas.height = size;

    const cx = size / 2, cy = size / 2;
    const dR = size * 0.42;
    this.pPos = { x: cx, y: cy + dR * 0.56 };
    this.oPos = { x: cx, y: cy - dR * 0.56 };

    // マウス・タッチ共通（ポインターをつかんでおくので、キャンバスの外まで引っ張れる）
    this.pointerId = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      e.preventDefault();
      if (!this.onDown(this.getPos(e))) return;
      this.pointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.onMove(this.getPos(e));
    });
    const release = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.onUp();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    // 立合い：「はっけよい」の間は止まっていて、「のこった！」で始まる
    this.readyUntil = performance.now() + BOUT_READY_MS;
    // 取組の始め・終わりの効果音は鳴らさない（うるさいので。文字の演出だけ）
    this.startLoop();
  },

  // 一時停止：物理と相手の動きを止める（止まっている間の時間は立合いの待ちに数えない）
  setPaused(on) {
    if (this.boutDone || this.paused === on) return;
    this.paused = on;
    const now = performance.now();
    if (on) {
      this.pausedAt = now;
      if (this.phase === 'aiming') { this.isAiming = false; this.phase = 'flying'; }   // 引っ張りは取り消す
      this.pointerId = null;
    } else if (this.readyUntil) {
      this.readyUntil += now - this.pausedAt;
    }
    document.getElementById('bout-pause')?.classList.toggle('hidden', !on);
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = on ? '▶' : '❚❚';
  },

  // 取組で使う自分の能力（勝負ちゃんこの分を上乗せ）
  pStat(key) {
    const v  = Game.state.rikishi.stats[key];
    const sb = Game.state.basho?.shobu;
    return sb && sb.stat === key ? v * (1 + sb.pct / 100) : v;
  },

  getPos(e) {
    const rect  = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  },

  rR() { return this.canvas.width * 0.085; },

  // ── スリングショット操作 ──────────────────────

  // 動いている途中でもいつでもつかめる
  canGrab() {
    if (this.readyUntil) return false;
    return this.phase === 'idle' || this.phase === 'flying';
  },

  // 土俵のどこを触ってもつかめる（触った点から引いた向き・長さで飛ぶ）。つかめたら true
  onDown(pos) {
    if (this.boutDone || this.paused || !this.canGrab()) return false;
    this.isAiming   = true;
    this.phase      = 'aiming';
    this.aimStart   = { ...pos };
    this.aimCurrent = { ...pos };
    Sound.play('pull');
    return true;
  },

  onMove(pos) {
    if (this.phase !== 'aiming') return;
    this.aimCurrent = { ...pos };
  },

  // 引っ張りのベクトル（発射する向き）
  aimPull() {
    return { x: this.aimStart.x - this.aimCurrent.x, y: this.aimStart.y - this.aimCurrent.y };
  },

  onUp() {
    if (this.phase !== 'aiming') return;
    this.isAiming = false;

    const { x: dx, y: dy } = this.aimPull();
    const dist = Math.hypot(dx, dy);

    // 引きが短すぎたら取り消し（体はそのまま滑り続ける）
    if (dist < 12) { this.phase = 'flying'; return; }

    const { speed, power } = this.launchSpeed(dist);
    this.pVel   = { x: (dx / dist) * speed, y: (dy / dist) * speed };
    this.phase  = 'flying';
    this.dodgeRolled = false;   // 相手がこの一撃をかわすかは、近づいたときに一度だけ決める
    Sound.play('launch', { power });
    // 小さく動く（かわし・位置取り）は取組回数に数えない
    if (power >= 0.25) this.rounds++;
    this.lastLaunchAt = performance.now();
  },

  // 引っ張り距離 → 発射速度。技が高いほど短い引きで小さく正確に動ける
  //   技 低: 最低速度が高く（小さく動けない）、強弱がほぼ直線
  //   技 高: 最低速度が低く、短い引きの範囲が広い（小回りが利く）
  // 最大速度（思い切りぶつかる強さ）は技に関係なく同じ
  launchSpeed(dist) {
    // 速さ：飛び出す最大の速さ（速さ0で0.6倍〜99で1.4倍。スキルで上限を超えた分も少し効く）。速いほどぶつかる勢い（速さ×重さ）も強い
    const spd     = Math.max(0, Math.min(1.2, (this.pStat('hayasa') || 0) / 99));
    const maxV    = this.canvas.width * 0.032 * (0.6 + 0.8 * spd) * taijuuSpeedMult(this.pStat('taijuu'));   // 190kg超は鈍る
    const maxPull = maxV * 6;
    const w       = Math.max(0, Math.min(1.2, (this.pStat('waza') || 0) / 99));
    const power   = Math.max(0, Math.min(1, dist / maxPull));
    const minFrac = 0.45 - 0.37 * w;   // 技0: 45% / 技99: 8%
    const curve   = 1 + 1.2 * w;       // 技0: 直線 / 技99: 短い引きを細かく調整できる曲線
    return { speed: maxV * (minFrac + (1 - minFrac) * Math.pow(power, curve)), power };
  },

  // ── メインループ ──────────────────────────────

  startLoop() {
    const loop = () => {
      if (this.boutDone) return;
      if (!this.paused) this.stepPhysics();   // 相手は常に動く（一時停止中は止める）
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  },

  stepPhysics() {
    if (this.readyUntil) {
      if (performance.now() >= this.readyUntil) {
        this.readyUntil = 0;
        const call = document.getElementById('bout-call');
        if (call) { call.textContent = 'のこった！'; call.classList.add('go'); setTimeout(() => call.classList.add('hidden'), 700); }
      }
      return;
    }
    const s  = this.canvas.width;
    const cx = s / 2, cy = s / 2;
    const dR = s * 0.42;
    const rR = this.rR();
    const r  = Game.state.rikishi;
    const o  = this.opponent;
    const isFlying = this.phase === 'flying';
    const isMoving = isFlying || this.phase === 'aiming';   // 引っ張っている間も体は滑り続ける

    // ── 相手AI（ready → windup → charging サイクル）──
    const pdx = this.pPos.x - this.oPos.x;
    const pdy = this.pPos.y - this.oPos.y;
    const pd  = Math.hypot(pdx, pdy) || 1;
    const vToPlayer = (this.oVel.x * pdx + this.oVel.y * pdy) / pd;

    const oW = Math.max(0, Math.min(1, (o.stats.waza || 0) / 99));

    // かわし：まっすぐ飛んでくるのを横に動いてかわす（技が高い相手ほど・突進中は無理）
    if (isFlying && !this.dodgeRolled && this.oPhase !== 'charging') {
      const pSpd = Math.hypot(this.pVel.x, this.pVel.y);
      const toward = -(this.pVel.x * pdx + this.pVel.y * pdy) / pd;   // 相手へ向かう速さ
      if (pd < rR * 4.5 && toward > s * 0.012) {
        this.dodgeRolled = true;
        if (Math.random() < 0.08 + oW * 0.30 + o.banzukeRank * 0.01) {
          const side = Math.random() < 0.5 ? 1 : -1;   // 飛んでくる向きに直角
          const dodge = s * (0.020 + oW * 0.012);
          this.oVel.x += (-this.pVel.y / pSpd) * side * dodge;
          this.oVel.y += ( this.pVel.x / pSpd) * side * dodge;
          this.lastDodgeAt = performance.now();
          this.oPhase = 'ready';
          this.oTimer = 20;
        }
      }
    }

    if (this.oPhase === 'ready') {
      // 適切な間合いまでゆっくり近づき、タイマー終了でwindup へ
      const targetDist = rR * 3.8;
      if (pd > targetDist) {
        const approach = 0.010 + o.stats.hayasa * 0.00008;
        this.oVel.x += (pdx / pd) * approach;
        this.oVel.y += (pdy / pd) * approach;
      }
      this.oTimer--;
      if (this.oTimer <= 0) {
        this.oPhase = 'windup';
        this.oTimer = 8 + Math.floor(Math.random() * 14);   // 溜めの長さをばらつかせる
        // 技のある相手はときどき「誘い」：溜めて突っ込まずに仕切り直す
        this.oFeint = Math.random() < 0.05 + oW * 0.20;
      }
    } else if (this.oPhase === 'windup') {
      // プレイヤーから離れる方向へ引き、溜めを作る
      const pullBack = 0.020;
      this.oVel.x -= (pdx / pd) * pullBack;
      this.oVel.y -= (pdy / pd) * pullBack;
      this.oTimer--;
      if (this.oTimer <= 0 && this.oFeint) {
        this.oFeint = false;
        this.oPhase = 'ready';
        this.oTimer = 10 + Math.floor(Math.random() * 10);
      } else if (this.oTimer <= 0) {
        // 突進開始：一気に速度を設定
        this.oPhase = 'charging';
        this.oStagger = 0;
        this.lastChargeAt = performance.now();
        const chargeSpd = s * (0.026 + o.stats.hayasa * 0.0003 + o.banzukeRank * 0.0025) * taijuuSpeedMult(o.stats.taijuu);
        this.oVel.x = (pdx / pd) * chargeSpd;
        this.oVel.y = (pdy / pd) * chargeSpd;
      }
    } else {
      // charging：速度が落ちたか押し返されたら ready へ戻す
      const oSpd2 = Math.hypot(this.oVel.x, this.oVel.y);
      if (oSpd2 < s * 0.007 || vToPlayer < -s * 0.008) {
        this.oPhase = 'ready';
        this.oTimer = Math.round(Math.max(15, 50 - o.stats.hayasa * 0.3 - o.banzukeRank * 3));
      }
    }

    // 速度上限
    const oSpd = Math.hypot(this.oVel.x, this.oVel.y);
    const maxOSpd = s * 0.034;
    if (oSpd > maxOSpd && !(this.oKnock > 0)) {
      this.oVel.x = this.oVel.x / oSpd * maxOSpd;
      this.oVel.y = this.oVel.y / oSpd * maxOSpd;
    }

    // 土俵端の引き戻し（charging中は除く）
    const oDCur = Math.hypot(this.oPos.x - cx, this.oPos.y - cy);
    if (oDCur > dR * 0.80 && this.oPhase !== 'charging' && !(this.oKnock > 0)) {
      const pull = (oDCur - dR * 0.80) / (dR * 0.20) * 0.07;
      this.oVel.x -= (this.oPos.x - cx) / oDCur * pull;
      this.oVel.y -= (this.oPos.y - cy) / oDCur * pull;
    }

    // 相手の土俵際の踏ん張り：技が高いほど外へ出る勢いを殺して残る（自分と同じ式）
    if (oDCur > dR * 0.75 && !(this.oKnock > 0)) {
      const nx = (this.oPos.x - cx) / oDCur, ny = (this.oPos.y - cy) / oDCur;
      const vOut = this.oVel.x * nx + this.oVel.y * ny;
      if (vOut > 0) {
        const brake = vOut * BOUT_EDGE_BRAKE * oW * Math.min(1, (oDCur - dR * 0.75) / (dR * 0.20));
        this.oVel.x -= nx * brake; this.oVel.y -= ny * brake;
      }
    }

    this.oPos.x += this.oVel.x; this.oPos.y += this.oVel.y;
    const oFric = this.oPhase === 'charging' || this.oKnock > 0 ? 0.94 : 0.87;
    if (this.oKnock > 0) this.oKnock--;
    this.oVel.x *= oFric; this.oVel.y *= oFric;

    // 相手の場外（余裕を持たせて判定）
    const oD = Math.hypot(this.oPos.x - cx, this.oPos.y - cy);
    if (oD > dR - rR * 0.5) { this.endBout(true); return; }

    // プレイヤー移動（飛んでいる・引っ張っている場合）
    if (isMoving) {
      // 土俵際の踏ん張り: 技が高いほど外向きの勢いを殺して残る
      const pDx = this.pPos.x - cx, pDy = this.pPos.y - cy;
      const pDCur = Math.hypot(pDx, pDy) || 1;
      // 自分の勢いで出そうなとき（当たられていない）は、早めから強く踏みとどまる
      const self  = performance.now() - this.lastHitAt > BOUT_SELF_BRAKE_MS;
      const start = self ? 0.68 : 0.75;
      if (pDCur > dR * start) {
        const nx = pDx / pDCur, ny = pDy / pDCur;
        const vOut = this.pVel.x * nx + this.pVel.y * ny;
        if (vOut > 0) {
          const w     = Math.max(0, Math.min(1.2, (this.pStat('waza') || 0) / 99));
          const edge  = Math.min(1, (pDCur - dR * start) / (dR * 0.20));
          const brake = vOut * Math.min(0.9, (BOUT_EDGE_BRAKE + (self ? BOUT_SELF_BRAKE : 0)) * w) * edge;
          this.pVel.x -= nx * brake; this.pVel.y -= ny * brake;
        }
      }
      this.pPos.x += this.pVel.x; this.pPos.y += this.pVel.y;
      this.pVel.x *= 0.94; this.pVel.y *= 0.94;
    }

    // 衝突判定（常に実行 — 相手が突進してきた場合もヒットする）
    const dx   = this.pPos.x - this.oPos.x;
    const dy   = this.pPos.y - this.oPos.y;
    const dist = Math.max(1, Math.hypot(dx, dy));

    if (dist < rR * 2) {
      const nx = dx / dist, ny = dy / dist;

      const rvx  = this.pVel.x - this.oVel.x;
      const rvy  = this.pVel.y - this.oVel.y;
      const vRel = rvx * nx + rvy * ny;

      if (vRel < 0) {
        // ぶつかった強さで音量を変える（押し合いの小さな接触では鳴らさない）
        const hitPow = -vRel / (this.canvas.width * 0.05);
        if (hitPow > 0.1 && performance.now() - (this.lastHitSe || 0) > 120) {
          this.lastHitSe = performance.now();
          Sound.play('hit', { power: hitPow });
        }
        this.recordHit(nx, ny, hitPow);
        // 吹き飛び：自分も相手も 同じ計算（力・技・重さは関係なし）。ぶつかった勢いに比例して、お互い同じだけ後ろへ飛ぶ。
        // ゆっくり当たっても、最低でも土俵の幅の一定割合の速さで飛ぶ
        const kick = Math.max(-vRel * BOUT_KNOCK_RATIO, Math.min(s * BOUT_KNOCK_MINV, -vRel * 8));
        this.pVel.x += nx * kick;
        this.pVel.y += ny * kick;
        this.oVel.x -= nx * kick;
        this.oVel.y -= ny * kick;
        this.oKnock = BOUT_OPP_KNOCK_FRAMES;

        // 相手が突進してきた衝突もプレイヤーを flying 状態にして跳ね返す
        if (this.phase === 'idle') {
          this.phase = 'flying';
          this.rounds++;
        }

        // 衝突後の相手
        //  ・突進してぶつかった → 仕切り直し
        //  ・強く当てられた → よろけて少し間が空く（突進と突進の間に2回まで）
        //  ・小さく当てられた → 構わず攻めを続け、かえって早く攻め返してくる（ちょんちょん当て続けても止まらない）
        if (this.oPhase === 'charging') {
          this.oPhase = 'ready';
          this.oTimer = Math.round(Math.max(15, 50 - o.stats.hayasa * 0.3 - o.banzukeRank * 3));
          this.oStagger = 0;
        } else if (hitPow >= 0.6 && (this.oStagger || 0) < 2) {
          this.oStagger = (this.oStagger || 0) + 1;
          this.oPhase = 'ready';
          this.oTimer = Math.max(this.oTimer, 12);
        } else {
          this.oTimer = Math.max(1, this.oTimer - 6);
        }
      }

      // めり込み解消
      const ov = rR * 2 - dist;
      this.pPos.x += nx * ov * 0.52; this.pPos.y += ny * ov * 0.52;
      this.oPos.x -= nx * ov * 0.52; this.oPos.y -= ny * ov * 0.52;
    }

    // プレイヤー場外（常に判定）
    const pD = Math.hypot(this.pPos.x - cx, this.pPos.y - cy);
    if (pD > dR - rR * 0.5) { this.endBout(false); return; }

    // 速度が落ちたら idle に戻す（flying 時のみ）
    if (isFlying) {
      const pv = Math.abs(this.pVel.x) + Math.abs(this.pVel.y);
      if (pv < 0.35) {
        this.phase = 'idle';
      }
    }
  },

  // ── 描画 ─────────────────────────────────────

  draw() {
    const c  = this.ctx;
    const s  = this.canvas.width;
    const cx = s / 2, cy = s / 2;
    const dR = s * 0.42;
    const rR = this.rR();

    c.clearRect(0, 0, s, s);

    // 土俵
    c.beginPath();
    c.arc(cx, cy, dR, 0, Math.PI * 2);
    c.fillStyle = '#c8956c';
    c.fill();
    c.beginPath();
    c.arc(cx, cy, dR, 0, Math.PI * 2);
    c.strokeStyle = '#5c3d1e';
    c.lineWidth = 9;
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, dR - 4, 0, Math.PI * 2);
    c.strokeStyle = '#a07040';
    c.lineWidth = 3;
    c.stroke();

    // 中央十字
    c.strokeStyle = '#8b5e3c';
    c.lineWidth = 2;
    [[-16,0,16,0],[0,-16,0,16]].forEach(([x1,y1,x2,y2]) => {
      c.beginPath(); c.moveTo(cx+x1,cy+y1); c.lineTo(cx+x2,cy+y2); c.stroke();
    });

    // 引っ張れる間は自分の足元を金色のパルスで示す（土俵のどこを触っても引っ張れる）
    if (this.canGrab()) {
      const pulse = 0.12 + Math.sin(Date.now() / 600) * 0.07;
      c.beginPath();
      c.arc(this.pPos.x, this.pPos.y, rR * 1.8, 0, Math.PI * 2);
      c.fillStyle = `rgba(201,162,39,${pulse})`;
      c.fill();
    }

    // エイム中：パワー色のゴムひも＋軌道プレビュー
    if (this.phase === 'aiming' && this.aimCurrent) {
      // ゴムひもは力士から、引いたぶんだけ後ろへ伸ばして描く
      const pull = this.aimPull();
      const ax = this.pPos.x, ay = this.pPos.y;
      const fx = ax - pull.x, fy = ay - pull.y;
      const pullDist = Math.hypot(ax - fx, ay - fy);
      const power    = this.launchSpeed(pullDist).power;

      // パワーに応じた色（緑→黄→赤）
      const cr = Math.round(power * 255);
      const cg = Math.round((1 - power) * 180);

      // ゴムひも
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(fx, fy);
      c.strokeStyle = `rgba(${cr},${cg},40,0.75)`;
      c.lineWidth   = 2.5;
      c.stroke();

      // 軌道点線
      const adx = ax - fx, ady = ay - fy;
      const dist = Math.hypot(adx, ady);
      if (dist > 12) {
        const speed = this.launchSpeed(dist).speed;
        let tx = ax, ty = ay;
        let vx = (adx / dist) * speed, vy = (ady / dist) * speed;
        c.beginPath();
        c.moveTo(tx, ty);
        for (let i = 0; i < 28; i++) {
          tx += vx; ty += vy; vx *= 0.94; vy *= 0.94;
          c.lineTo(tx, ty);
          if (Math.hypot(vx, vy) < 0.5) break;
        }
        c.strokeStyle = `rgba(${cr},${cg},40,0.45)`;
        c.lineWidth   = 2;
        c.setLineDash([5, 5]);
        c.stroke();
        c.setLineDash([]);
      }
    }

    // 相手（上）- ready/windup時は揺れる、charging時は溜めのオーラ
    const sway = this.oPhase !== 'charging' ? Math.sin(Date.now() / 700) * 2 : 0;
    if (this.oPhase === 'windup') {
      const pulse2 = 0.10 + Math.sin(Date.now() / 120) * 0.08;
      c.beginPath();
      c.arc(this.oPos.x, this.oPos.y, rR * 2.0, 0, Math.PI * 2);
      c.fillStyle = `rgba(220,60,40,${pulse2})`;
      c.fill();
    }
    this.drawRik(this.oPos.x + sway, this.oPos.y, rR, this.opponent, '#cc3322', false);

    // 自分（下）
    const isAiming = this.phase === 'aiming';
    this.drawRik(this.pPos.x, this.pPos.y, rR, Game.state.rikishi, '#2244cc', isAiming);
  },

  // 今の自分の顔：勝ったら win、負けたら lose、引っ張っている間は aim、ぶつかった直後は collision
  playerFace() {
    if (this.boutWin !== null) return this.boutWin ? 'win' : 'lose';
    if (this.phase === 'aiming') return 'aim';
    if (performance.now() - this.lastHitAt < BOUT_HIT_FACE_MS) return 'collision';
    return 'normal';
  },

  // 相手の顔：勝負がついたら win/lose（自分の逆）、溜め・突進中は aim、ぶつかった直後は collision
  opponentFace() {
    if (this.boutWin !== null) return this.boutWin ? 'lose' : 'win';
    if (this.oPhase === 'windup' || this.oPhase === 'charging') return 'aim';
    if (performance.now() - this.lastHitAt < BOUT_HIT_FACE_MS) return 'collision';
    return 'normal';
  },

  drawRik(x, y, r, rikishi, color, grabbed) {
    const c      = this.ctx;
    const name   = rikishi.shikona || '';
    const isPlayer = rikishi.isPlayer;

    if (grabbed) {
      c.beginPath();
      c.arc(x, y, r * 1.4, 0, Math.PI * 2);
      c.fillStyle = 'rgba(201,162,39,0.28)';
      c.fill();
    }

    // 頭のてっぺんが相手を向くように絵を回す（重なってほぼ同じ位置のときは前の向きのまま）
    const other = rikishi === this.opponent ? this.pPos : this.oPos;
    const angKey = isPlayer ? 'pAng' : 'oAng';
    if (other && Math.hypot(other.x - x, other.y - y) >= 1) this[angKey] = Math.atan2(other.x - x, y - other.y);
    const ang = this[angKey] ?? (isPlayer ? 0 : Math.PI);

    // 部品を重ねた絵（自分は顔が変わる）
    const face = LookSprite.canvas(rikishi.look, 512, isPlayer ? this.playerFace() : this.opponentFace());
    if (face && (face instanceof HTMLCanvasElement || (face.complete && face.naturalWidth > 0))) {
      // 自分の表情の絵・相手の組み立てた絵（背景は透明なので切り抜かない。輪郭に沿って影を落とす）
      const size = r * 2.8;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.3)';
      c.shadowBlur  = 8;
      c.shadowOffsetX = 3;
      c.shadowOffsetY = 4;
      c.translate(x, y);
      c.rotate(ang);
      c.drawImage(face, -size / 2, -size / 2, size, size);
      c.restore();
    } else if (isPlayer && this.playerImg?.complete && this.playerImg.naturalWidth > 0) {
      // 画像を円形クリップで描画（白背景を隠す）
      const size = r * 2.8;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.3)';
      c.shadowBlur  = 8;
      c.shadowOffsetX = 3;
      c.shadowOffsetY = 4;
      c.beginPath();
      c.arc(x, y, r * 1.3, 0, Math.PI * 2);
      c.clip();
      c.translate(x, y);
      c.rotate(ang);
      c.drawImage(this.playerImg, -size / 2, -size / 2, size, size);
      c.restore();
    } else {
      // NPC は円で描画
      c.beginPath();
      c.arc(x + 3, y + 4, r, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fill();

      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      const g = c.createRadialGradient(x - r*0.3, y - r*0.3, r*0.05, x, y, r);
      g.addColorStop(0, '#f8f0e0');
      g.addColorStop(1, '#ccc0a0');
      c.fillStyle   = g;
      c.fill();
      c.strokeStyle = grabbed ? '#c9a227' : color;
      c.lineWidth   = grabbed ? 3.5 : 2.5;
      c.stroke();

      c.fillStyle    = '#2a1500';
      c.font         = `bold ${Math.round(r * 0.85)}px serif`;
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText(name[0] || '力', x, y + 1);
    }

    // 四股名ラベル
    c.fillStyle    = isPlayer ? '#c9a227' : '#ffaaaa';
    c.font         = `bold ${Math.round(r * 0.4)}px serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'top';
    c.fillText(name.slice(0, 5), x, y + r * (isPlayer ? 1.35 : 1.0));
  },

  // ── 勝敗処理 ─────────────────────────────────

  // 当たりの記録（決まり手を決めるため）。n は相手→自分の向き
  recordHit(nx, ny, pow) {
    const now = performance.now();
    this.lastHitAt = now;
    const pTo = -(this.pVel.x * nx + this.pVel.y * ny);   // 自分が相手へ向かう速さ
    const oTo =  (this.oVel.x * nx + this.oVel.y * ny);   // 相手が自分へ向かう速さ
    const byPlayer = pTo >= oTo;
    // 攻めた側の動きが当たる向きからどれだけそれていたか（0＝正面、1＝真横）→ 投げ・いなしの目安
    const av = byPlayer ? this.pVel : this.oVel;
    const as = Math.hypot(av.x, av.y) || 1;
    const glance = Math.abs(av.x * ny - av.y * nx) / as;
    // 受けた側が背中を向けて離れていく途中だったか → 送り出し
    const retreating = (byPlayer ? -oTo : -pTo) > this.canvas.width * 0.004;
    this.hitLog = (this.hitLog || []).filter(h => now - h.t < 1500);
    this.hitLog.push({ t: now, byPlayer, pow, glance, retreating });
  },

  // 勝負が決まった瞬間の様子（kimarite.js の decideKimarite に渡す）
  kimariteContext(win) {
    const now = performance.now();
    const s = this.canvas.width, c = s / 2, dR = s * 0.42;
    const o = this.opponent;
    const ps = { chikara: this.pStat('chikara'), waza: this.pStat('waza'), hayasa: this.pStat('hayasa'), taijuu: this.pStat('taijuu') };
    const recent = (this.hitLog || []).filter(h => now - h.t < 900);
    const last = recent[recent.length - 1] || null;
    const lv = win ? this.oVel : this.pVel;                 // 負けた側の速さ
    const wp = win ? this.pPos : this.oPos;                 // 勝った側の位置
    return {
      winnerStyle: win ? Game.state.rikishi.style : o.style,
      w: win ? ps : o.stats,
      l: win ? o.stats : ps,
      byWinner: !!last && last.byPlayer === win,           // 最後に当てたのは勝った側
      contact:  !!last,                                    // 直前に当たりがあった
      pow:      last ? last.pow : 0,
      glance:   last ? last.glance : 0,
      retreating: !!last && last.retreating,
      hits:     recent.filter(h => h.byPlayer === win).length,
      loserSpeed: Math.hypot(lv.x, lv.y) / (s * 0.02),     // 1 を超えると勢いよく飛ばされた
      winnerAtEdge: Math.hypot(wp.x - c, wp.y - c) > dR * 0.78,
      dodged:   !win && now - (this.lastDodgeAt || 0) < 900,   // 相手がかわして勝った
      loserLaunched: win ? now - (this.lastChargeAt || 0) < 1200 : now - (this.lastLaunchAt || 0) < 900,   // 負けた側が自分から飛び込んでいた
    };
  },

  // 取組の結果（電光掲示板ふう）：勝った力士 ○・決まり手・負けた力士 ●、それぞれの今場所の成績
  // reward：見出しの右に出すもの（たにまち・金星など）。無ければ白星・黒星
  boutBoardHtml(win, kimarite, note, reward) {
    const b = Game.state.basho, r = Game.state.rikishi, o = this.opponent;
    const me  = { name: r.shikona, title: r.rosterTitle || getRankName(r.banzukeRank), rec: `${b.wins}勝${b.losses}敗`, me: true };
    const opp = { name: o.shikona, title: o.title || getRankName(o.banzukeRank ?? r.banzukeRank), rec: o.bw != null ? `${o.bw}勝${o.bl}敗` : '' };
    const [w, l] = win ? [me, opp] : [opp, me];
    const row = (x, star, cls) => `
      <div class="bb-row ${cls} ${x.me ? 'bb-me' : ''}">
        <span class="bb-star">${star}</span>
        <span class="bb-who"><small>${x.title}</small>${x.name}</span>
        <span class="bb-rec">${x.rec}</span>
      </div>`;
    return `
      <div class="bout-board ${win ? 'bb-won' : 'bb-lost'}">
        <div class="bb-head">${note || '結果'}<span>${reward || (win ? '白星' : '黒星')}</span></div>
        ${row(w, '○', 'bb-win')}
        <div class="bb-kimarite">${kimarite}</div>
        ${row(l, '●', 'bb-lose')}
      </div>`;
  },

  // 結果の下の「次へ」ボタンが画面に入るように、そこまでスクロールする
  showNextButton() {
    requestAnimationFrame(() => { document.getElementById('btn-next')?.scrollIntoView({ block: 'nearest' }); });
  },

  endBout(win) {
    if (this.boutDone) return;
    this.boutDone = true;
    this.boutWin  = win;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.phase = 'done';
    this.draw();

    const b   = Game.state.basho;
    const r   = Game.state.rikishi;
    const o   = this.opponent;
    const kimarite = decideKimarite(this.kimariteContext(win));

    // 優勝決定戦（場所の成績・報酬には数えない）
    if (b.playoff) {
      const pf = b.playoff;
      if (win) { pf.queue.shift(); if (!pf.queue.length) pf.winner = 'player'; }
      else     pf.winner = o.shikona;
      const ra = document.getElementById('bout-result');
      ra.innerHTML = `
        ${this.boutBoardHtml(win, kimarite, '優勝決定戦', pf.winner === 'player' ? '🏆 決定戦を制した！' : '')}
        <button class="btn-primary" id="btn-next">${pf.winner ? '場所結果を見る' : '次の決定戦へ'}</button>`;
      ra.classList.remove('hidden');
      this.showNextButton();
      Game.save();
      document.getElementById('btn-next').addEventListener('click', () => {
        if (pf.winner) this.goToBashoResult();
        else { this.opponent = null; Game.showScene('bout'); }
      });
      return;
    }

    if (win) b.wins++;
    else     b.losses++;
    if (o.generated) { if (win) o.bl++; else o.bw++; }   // 名簿の相手は rosterRecordPlayerBout が数える
    b.results.push({ win, kimarite, opponent: o.shikona });
    r.careerWins   += win ? 1 : 0;
    r.careerLosses += win ? 0 : 1;
    b.day++;

    // 連勝ストリーク
    if (win) r.currentStreak = (r.currentStreak || 0) + 1;
    else     r.currentStreak = 0;
    achOnBout(win, kimarite);
    if (Game.state.roster && rosterPlayerEntry(Game.state.roster)) rosterRecordPlayerBout(Game.state, win);

    let rewardHtml = '';
    if (win && Game.state.tensei) {
      const t   = Game.state.tensei;
      const fx  = calcSkillEffects(Game.state);
      const isKensho = rollKensho(r.banzukeRank, 0);
      // スキル「懸賞の旗」：懸賞が出たときのたにまち+%
      const tmBase   = gainTanimachi(r.banzukeRank, isKensho, t.isan.tanimachiSpeed) * (isKensho ? 1 + (fx.kenshoTani || 0) / 100 : 1);
      // スキル：連勝オーラ（10連勝まで）・貫禄・横綱之魂・神風（この場所負けなし）
      const renso  = 1 + Math.min(10, r.currentStreak || 0) * 0.02 * (fx.rensoLv || 0);
      const soul   = fx.yokozunaSoul > 0 && r.banzukeRank >= 9 ? 1.2 : 1;
      const kaze   = fx.kamikaze > 0 && b.losses === 0 ? 2 : 1;
      const tm  = Math.max(1, Math.floor(tmBase * (1 + (fx.taniPct || 0) / 100) * (1 + (fx.bashoTaniPct || 0) / 100)
                                         * (1 + heyaLv(Game.state, 'kanban') * 0.1) * fx.kanrokuMult * renso * soul * kaze))
                + Math.floor(fx.kimariteLv || 0);   // 決まり手師：勝つたび +1/段
      t.tanimachi       += tm;
      b.tanimachiEarned  = (b.tanimachiEarned || 0) + tm;
      const kenshoTxt    = isKensho ? '（懸賞！）' : '';
      // スキル「勝ちちゃんこ」：勝つと確率でちゃんこ +1杯
      const ck = rollWinChanko(fx.winChanko);
      if (ck) { Game.state.chankoPts = (Game.state.chankoPts || 0) + ck; b.winChanko = (b.winChanko || 0) + ck; }
      rewardHtml = `<span class="bb-tani">たにまち +${tm}${kenshoTxt}${ck ? `　🍲+${ck}` : ''}</span>`;
    }

    // 金星：前頭が横綱に勝つ
    const pE = Game.state.roster && rosterPlayerEntry(Game.state.roster);
    // 記録：最多連勝・最年長の白星・金星・銀星（この力士の分）
    const inMk = r.banzukeRank >= 5;
    r.mkStreak = win && inMk ? (r.mkStreak || 0) + 1 : 0;
    r.maxMkStreak = Math.max(r.maxMkStreak || 0, r.mkStreak);
    if (win) {
      r.maxStreak = Math.max(r.maxStreak || 0, r.currentStreak || 0);
      r.maxWinAge = Math.max(r.maxWinAge || 0, r.age);
      if (pE && pE.rank === 'maegashira' && o.rank === 'yokozuna') r.kinboshi = (r.kinboshi || 0) + 1;
      if (pE && pE.rank === 'maegashira' && o.rank === 'ozeki')    r.ginboshi = (r.ginboshi || 0) + 1;
    }
    if (win && pE && pE.rank === 'maegashira' && o.rank === 'yokozuna') {
      Game.state.achievements.total.kinboshi = (Game.state.achievements.total.kinboshi || 0) + 1;
      achCheck();
      rewardHtml = '<span class="bb-kinboshi">⭐ 金星！</span>' + rewardHtml;
    }

    const total  = getBoutCount(r.banzukeRank);
    const isLast = b.day > total;


    const ra = document.getElementById('bout-result');
    ra.innerHTML = `
      ${this.boutBoardHtml(win, kimarite, '', rewardHtml)}
      <button class="btn-primary" id="btn-next">
        ${isLast ? '場所結果を見る' : `次の取組へ（${b.day}/${total}番）`}
      </button>`;
    ra.classList.remove('hidden');
    this.showNextButton();

    document.getElementById('btn-next').addEventListener('click', () => {
      if (isLast) this.goToBashoResult();
      else {
        this.opponent = null;
        Game.save();
        Game.showScene('bout');
      }
    });
  },

  goToBashoResult() {
    this.opponent = null;   // 次の場所の初日に前の場所の相手を持ち越さない
    const b   = Game.state.basho;
    const r   = Game.state.rikishi;
    const cal = Game.state.calendar;
    const roster   = Game.state.roster;
    const pEntry   = roster ? rosterPlayerEntry(roster) : null;
    const res      = calcBashoResult(b.wins, b.losses, r.banzukeRank);
    const oldRank  = r.banzukeRank;
    const oldTitle = r.rosterTitle || null;
    const yearEnd  = (cal.bashoIndex + 1) % 6 === 0;
    let rosterRes  = null;
    let relBefore  = null;
    let mkBottom   = false;

    if (roster && pEntry) {
      // 名簿内：残りの日を進め、同点なら優勝決定戦へ
      rosterFinishDays(roster);
      if (!b.playoff) {
        const opps = rosterPlayoffOpponents(roster);
        if (opps.length) {
          b.playoff = { queue: opps, winner: null };
          this.opponent = null;
          Game.save();
          Game.showScene('bout');
          return;
        }
      }
      relBefore = rosterRelationSnapshot(Game.state);
      const forced = b.playoff?.winner
        ? { [pEntry.div]: b.playoff.winner === 'player' ? pEntry.shikona : b.playoff.winner } : {};
      rosterSyncPlayer(Game.state);
      // 幕内の最下位＝前頭のいちばん下の枚目（東西どちらでも）。番付編成の前に判定
      const lastMaeNum = Math.max(...roster.list.filter(x => x.rank === 'maegashira').map(x => x.num));
      mkBottom = pEntry.rank === 'maegashira' && pEntry.num === lastMaeNum;
      const oldPos = pEntry.pos;
      const oldDiv = pEntry.div;     // 番付編成で書き換わる前に控える
      rosterRes = rosterEndBasho(roster, { yearEnd, forced });
      const p = rosterPlayerEntry(roster);
      res.isYusho   = !!rosterRes.champions[oldDiv]?.isPlayer;
      res.newRank   = p ? p.banzukeRank : 2;            // 定員から外れたら三段目
      // 位置が同じでも、地位が上がっていれば昇進（横綱・大関が同時に上がると位置が変わらないことがある）
      res.promoted  = !!p && (p.banzukeRank > oldRank || (p.banzukeRank === oldRank && p.pos < oldPos));
      res.demoted   = !p || p.banzukeRank < oldRank || (p.banzukeRank === oldRank && p.pos > oldPos);
      res.unchanged = !res.promoted && !res.demoted;
      rosterApplyToPlayer(Game.state);
    } else if (roster) {
      // 名簿外：NPC同士で場所を進める
      relBefore = rosterRelationSnapshot(Game.state);
      rosterFinishDays(roster);
      rosterRes = rosterEndBasho(roster, { yearEnd });
      if (oldRank <= 2 && res.newRank >= 3) res.newRank = 3;   // 三段目からは幕下へ
    }

    // 白星1つでちゃんこ1杯（最低2杯）
    const fxEnd = calcSkillEffects(Game.state);
    const kachikoshi = b.wins > b.losses;
    const chankoBase = Math.max(ALLOC_MIN_PER_BASHO, b.wins) + heyaChankoBonus(Game.state, kachikoshi)
                    + (r.trait === 'oogui' ? 1 : 0)    // 特性「大食い」
                    + oyakataChankoBonus(Game.state)   // 親方の格
                    + fxEnd.chankoPlus                 // スキル「おかわり」
                    + (kachikoshi ? fxEnd.kachiChanko : 0)             // スキル「勝ち越しちゃんこ」
                    + (res.isYusho ? fxEnd.yushoChanko : 0)            // スキル「優勝ちゃんこ」
                    + (b.losses === 0 ? fxEnd.zenshoChanko : 0);       // スキル「全勝ちゃんこ」
    const chankoGot = Math.floor(chankoBase * (1 + (fxEnd.chankoPct || 0) / 100));   // スキル「大鍋」
    Game.state.chankoPts = (Game.state.chankoPts || 0) + chankoGot;

    if (oldRank === 9) r.yokozunaBasho = (r.yokozunaBasho || 0) + 1;
    // 優勝回数は幕内優勝だけ。十両・幕下以下の優勝は別に記録する
    if (res.isYusho) {
      if (oldRank >= 5)       r.yusho          = (r.yusho          || 0) + 1;
      else if (oldRank === 4) r.yushoJuryo     = (r.yushoJuryo     || 0) + 1;
      else                    r.yushoMakushita = (r.yushoMakushita || 0) + 1;
    }

    // 自分の場所ごとの成績（名鑑・記録で見る）
    r.bashoLog = r.bashoLog || [];
    r.bashoLog.push({ label: `${cal.year}年 ${getBashoName(cal.bashoIndex)}`, age: r.age, rankId: oldRank,
                      title: oldTitle || getRankName(oldRank), w: b.wins, l: b.losses,
                      run: b.results.reduce((a, x) => { a.c = x.win ? a.c + 1 : 0; a.m = Math.max(a.m, a.c); return a; }, { c: 0, m: 0 }).m,   // 1場所の中の連勝
                      sansho: (rosterRes?.sansho || []).filter(x => x.isPlayer).map(x => ({ shukun: '殊勲賞', kanto: '敢闘賞', gino: '技能賞' })[x.prize]),
                      yusho: res.isYusho ? (oldRank >= 5 ? '幕内' : oldRank === 4 ? '十両' : oldRank === 3 ? '幕下' : getRankName(oldRank)) : null });

    // 貫禄: 横綱を維持したとき（降格なし）にスタック
    if (oldRank === 9 && res.newRank === 9 && Game.state.tensei) {
      const t = Game.state.tensei;
      t.kanroku = Math.min(10 + (calcSkillEffects(Game.state).kanrokuCap || 0), (t.kanroku || 0) + 1);
    }

    r.banzukeRank    = res.newRank;
    cal.phase        = 'ready';   // 場所と場所の間（ちゃんこの振り分け）
    cal.day          = 1;
    cal.bashoIndex   = (cal.bashoIndex + 1) % 6;
    let aging = null;
    if (cal.bashoIndex === 0) {
      cal.year++;
      aging = applyYearlyAging(r);
    }
    // 三段目から勝ち越して幕下へ → 名簿に入る
    if (roster && !pEntry && oldRank <= 2 && res.newRank === 3) {
      rosterJoinFromSandanme(Game.state, b.wins, b.losses);
    }
    // 名簿の実績
    if (res.isYusho && mkBottom) achUnlock('yusho_ms_bottom');   // 幕内最下位からの優勝（IDは旧名のまま）
    if (res.isYusho && oldRank >= 5 && b.losses === 0 && b.zenshoClash) achUnlock('yusho_clash');
    const relNotes = rosterRelationNotes(Game.state, relBefore, rosterRes);
    rosterUpdatePlayerMaxRank(Game.state);
    b.playoff = null;
    b.zenshoClash = false;
    achOnBashoEnd({ wins: b.wins, boutCount: res.boutCount, oldRank, newRank: res.newRank, res, wasYearEnd: !!aging });
    Game.save();
    Game.showScene('bashoResult', {
      wins: b.wins, losses: b.losses, oldRank, newRank: res.newRank, res, aging, rosterRes,
      oldTitle, newTitle: r.rosterTitle || null, relNotes, chankoGot,
      yushoDiv: res.isYusho ? (oldRank >= 5 ? '幕内' : oldRank === 4 ? '十両' : '幕下') : null,
      tanimachiEarned: b.tanimachiEarned || 0,
    });
  },
};
