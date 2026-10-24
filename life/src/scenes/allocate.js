// ── ちゃんこの振り分け ─────────────────────────────
// 白星1つ＝ちゃんこ1杯（1場所に最低2杯）＋相撲部屋・親方・特性・スキルの分。場所の後に能力へ注ぐ
// 能力ごとにちゃんこを注いでいき、必要な杯数たまったら +1（体重は +1kg）。高いほど必要な杯数が増える

const ALLOC_STATS = [
  { key: 'chikara', label: '力',   info: 'ぶつかったとき、相手を押し飛ばす強さ' },
  { key: 'waza',    label: '技',   info: '相手より高いと、ぶつかっても受け流して飛ばされにくい。土俵際で踏ん張れる。短く引いて小さく正確に動ける' },
  { key: 'hayasa',  label: '速さ', info: '離したときに飛び出す速さ。速いほどぶつかる勢いも強い' },
  { key: 'taijuu',  label: '体重', info: '重いほど飛ばされにくい。ただし重すぎると得が減り、動きも鈍る。絞るのにもちゃんこを使う' },
];
const ALLOC_MIN_PER_BASHO = 2;
const ALLOC_TAIJUU_STEP   = 1;

// 能力の値 → +1 に必要な杯数（上限なら null）。表はゲームの画面には出さない（器の数だけ見せる）
const ALLOC_COST_TABLE = [[50, 1], [60, 3], [70, 5], [80, 7], [90, 9], [Infinity, 10]];   // [この値未満なら, 杯数]。90から先（上限を上げた後も）10杯
const ALLOC_TAIJUU_TABLE = [[120, 1], [130, 2], [140, 3], [150, 4], [160, 5], [170, 6], [180, 7], [190, 8], [200, 9], [Infinity, 10]];   // 1kgごと

function allocCost(key, value) {
  let base;
  const max = statMax(Game.state, key);   // 上限はスキルで上がる
  if (key === 'taijuu') {
    if (value + ALLOC_TAIJUU_STEP > max) return null;
    base = ALLOC_TAIJUU_TABLE.find(([lim]) => value < lim)[1];
  } else {
    if (value >= max) return null;
    base = ALLOC_COST_TABLE.find(([lim]) => value < lim)[1];
  }
  // スキル「◯の器 −1杯」（最低1杯）
  const red = (calcSkillEffects(Game.state).bowlRed || {})[key] || 0;
  return Math.max(1, base - red);
}

// ちゃんこの器：食べた分は 🍲、残りは影（シルエット）
function chankoBowlsHtml(have, cost, small) {
  return `<span class="ck-bowls ${small ? 'small' : ''}">${'<i class="full">🍲</i>'.repeat(have)}${'<i class="empty">🍲</i>'.repeat(Math.max(0, cost - have))}</span>`;
}

// 絞る（体重 −1kg）にもちゃんこを使う。器はその1kgを増やすときと同じ杯数（下限なら null）
function allocSlimCost(value) {
  if (value - 1 < TAIJUU_MIN) return null;
  return allocCost('taijuu', value - 1);
}

const AllocateScene = {
  slimRowHtml(v, invest, pts) {
    const cost = allocSlimCost(v);
    return `
          <div class="al-main al-slim-row">
            <span class="al-label al-sub">絞る</span>
            <span class="al-val"></span>
            <span class="al-bowls">${cost == null ? '<span class="al-max">下限</span>' : chankoBowlsHtml(invest.slim || 0, cost)}</span>
            ${cost == null ? '' : '<span class="al-step">−1kg</span>'}
            <button class="al-btn al-slim" id="al-slim" ${cost != null && pts > 0 ? '' : 'disabled'}>絞る</button>
          </div>`;
  },

  render() {
    const r      = Game.state.rikishi;
    const pts    = Game.state.chankoPts || 0;
    // 場所の後（次の場所の前）か、ホームから開いた場所の途中か
    const between = Game.state.calendar.phase !== 'basho';
    const invest = r.chankoInvest || {};
    const rows = ALLOC_STATS.map(s => {
      const v    = r.stats[s.key];
      const cost = allocCost(s.key, v);
      const have = invest[s.key] || 0;
      const step = s.key === 'taijuu' ? `+${ALLOC_TAIJUU_STEP}kg` : '+1';
      const bowls = cost == null ? '<span class="al-max">上限</span>' : chankoBowlsHtml(have, cost);
      return `
        <div class="al-row">
          <div class="al-main">
            <span class="al-label">${s.label}</span>
            <span class="al-val">${s.key === 'taijuu' ? v + 'kg' : v}</span>
            <span class="al-bowls">${bowls}</span>
            ${cost == null ? '' : `<span class="al-step">${step}</span>`}
            <button class="al-btn" data-key="${s.key}" ${cost != null && pts > 0 ? '' : 'disabled'}>食べる</button>
          </div>
          ${s.key === 'taijuu' ? this.slimRowHtml(v, invest, pts) : ''}
          <div class="al-info">${s.info}</div>
        </div>`;
    }).join('');

    return `
      <div class="scene scene-allocate">
        <div class="scene-header"><h2>ちゃんこの振り分け</h2></div>
        <div class="al-pts">🍲 ちゃんこ <b>${pts}</b> 杯</div>
        <div class="al-list">${rows}</div>
        ${between ? HomeScene.shobuChankoHtml() : ''}
        <div class="al-actions">
          <button class="btn-primary" id="al-done">${between ? '本場所へ' : '戻る'}</button>
        </div>
        ${between ? '<button class="btn-retire" id="al-retire">引退する</button>' : ''}
        ${pts ? '<div class="al-hint">残ったちゃんこは次に持ち越せます</div>' : ''}
      </div>`;
  },

  attach() {
    const r = Game.state.rikishi;
    document.querySelectorAll('.al-btn[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key  = btn.dataset.key;
        const cost = allocCost(key, r.stats[key]);
        if (cost == null || Game.state.chankoPts < 1) return;
        Game.state.chankoPts -= 1;
        r.chankoInvest = r.chankoInvest || {};
        r.chankoInvest[key] = (r.chankoInvest[key] || 0) + 1;
        if (r.chankoInvest[key] >= cost) {
          r.chankoInvest[key] = 0;
          if (key === 'taijuu') r.stats.taijuu = Math.round((r.stats.taijuu + ALLOC_TAIJUU_STEP) * 10) / 10;
          else r.stats[key] += 1;
          Sound.play('up');
        } else {
          Sound.play('eat');
        }
        Game.save();
        Game.showScene('allocate', { noFade: true });
      });
    });
    // 絞る：器が埋まったら体重 −1kg（食べるのと同じくちゃんこを使う）
    document.getElementById('al-slim')?.addEventListener('click', () => {
      const cost = allocSlimCost(r.stats.taijuu);
      if (cost == null || Game.state.chankoPts < 1) return;
      Game.state.chankoPts -= 1;
      r.chankoInvest = r.chankoInvest || {};
      r.chankoInvest.slim = (r.chankoInvest.slim || 0) + 1;
      if (r.chankoInvest.slim >= cost) {
        r.chankoInvest.slim = 0;
        r.stats.taijuu = Math.round((r.stats.taijuu - 1) * 10) / 10;
        Sound.play('up');
      } else {
        Sound.play('eat');
      }
      Game.save();
      Game.showScene('allocate', { noFade: true });
    });
    // 勝負ちゃんこ（スキル）：次の場所の間だけ上がる能力を選ぶ
    document.querySelectorAll('.shobu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cal = Game.state.calendar;
        cal.shobuPick = cal.shobuPick === btn.dataset.stat ? null : btn.dataset.stat;
        Sound.play('eat');
        Game.save();
        Game.showScene('allocate', { noFade: true });
      });
    });
    document.getElementById('al-retire')?.addEventListener('click', () => Game.showScene('tensei'));
    document.getElementById('al-done').addEventListener('click', () => {
      if (Game.state.calendar.phase !== 'basho') HomeScene.startBasho();
      Game.save();
      Game.showScene('home');
    });
  },
};
