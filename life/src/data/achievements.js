// 実績システム（転生・超転生しても引き継ぐ）

const ACH_CATS = [
  { id: 'banzuke',  name: '番付' },
  { id: 'life',     name: '一力士' },
  { id: 'total',    name: '全通算' },
  { id: 'yusho',    name: '優勝' },
  { id: 'kimarite', name: '決まり手' },
  { id: 'kuroboshi',name: '白星・黒星' },
  { id: 'age',      name: '年齢' },
  { id: 'ikusei',   name: '育成・転生' },
];

const ACH_KIMARITE_CATS = { oshi: '押し', yotsu: '四つ', nage: '投げ', hiki: '引き' };

function achFmt(n) {
  return n >= 1e6 ? (n / 1e6) + 'M' : n >= 10000 ? (n / 1000) + 'K' : String(n);
}

// ── 定義の生成 ─────────────────────────────────
const ACH_DEFS = (() => {
  const defs = [];
  const tiers = (cat, idBase, label, unit, goals, progress, special = {}) => {
    for (const g of goals) {
      defs.push({
        id: `${idBase}_${g}`, cat, goal: g, progress,
        name: special[g] || `${label} ${achFmt(g)}${unit}`,
        desc: `${label}${achFmt(g)}${unit}を達成`,
      });
    }
  };
  const one = (cat, id, name, desc, test) => defs.push({ id, cat, name, desc, test });

  const A    = s => s.achievements.total;
  const life = s => s.rikishi.life || {};

  // 番付
  one('banzuke', 'rank_debut', '初土俵', '最初の場所を終える', s => A(s).basho >= 1);
  [[2, '三段目昇進'], [3, '幕下昇進'], [4, '関取'], [5, '幕内力士'], [6, '三役'], [8, '大関昇進'], [9, '横綱昇進']]
    .forEach(([rank, name]) => one('banzuke', `rank_${rank}`, name, `${getRankName(rank)}に昇進する`, s => s.rikishi.banzukeRank >= rank));
  one('banzuke', 'rank_tsuna', '綱の重み', '横綱で10場所在位する', s => (s.rikishi.yokozunaBasho || 0) >= 10);

  // 一力士
  tiers('life', 'life_win',  '一力士で', '勝', [100, 300, 500, 1000], s => s.rikishi.careerWins || 0);
  tiers('life', 'life_loss', '一力士で', '敗', [100, 300, 500],       s => s.rikishi.careerLosses || 0);
  tiers('life', 'life_streakW', '一力士で', '連勝', [5, 10, 15, 20, 30, 50, 69, 100, 200, 300, 500, 1000],
        s => s.rikishi.currentStreak || 0, { 69: '双葉山に並ぶ 69連勝' });
  tiers('life', 'life_streakL', '一力士で', '連敗', [5, 10, 15, 20, 30, 50, 100], s => life(s).streakL || 0);
  tiers('life', 'life_yusho', '一力士で幕内優勝', '回', [1, 3, 5, 10, 20, 30, 33, 46],
        s => s.rikishi.yusho || 0, { 1: '初優勝', 33: '大鵬超え 優勝33回', 46: '白鵬超え 優勝46回' });
  defs.push({ id: 'life_kachikoshi_20', cat: 'life', goal: 20, progress: s => life(s).kachikoshi || 0,
              name: '勝ち越し名人', desc: '一力士で20場所勝ち越す' });

  // 全通算
  tiers('total', 'tot_win',  '通算', '勝', [1000, 3000, 5000, 10000, 30000, 50000, 100000], s => A(s).wins);
  tiers('total', 'tot_loss', '通算', '敗', [500, 1000, 3000, 5000, 10000, 30000, 50000],    s => A(s).losses);
  tiers('total', 'tot_streakW', '転生をまたいで', '連勝', [100, 300, 500, 1000, 1500, 2000, 3000, 5000], s => A(s).streakW);
  tiers('total', 'tot_streakL', '転生をまたいで', '連敗', [100, 300, 500, 1000, 2000], s => A(s).streakL);
  tiers('total', 'tot_yusho', '通算幕内優勝', '回', [10, 50, 100, 300, 500, 1000, 3000, 5000], s => A(s).yusho);
  tiers('total', 'tot_kimarite_use', '同じ決まり手で', '勝', [100, 500, 1000, 5000, 10000],
        s => Math.max(0, ...Object.values(A(s).kimarite)));

  // 優勝（特別）
  one('yusho', 'yusho_zensho', '全勝優勝', '幕内で15戦全勝優勝する', null);
  one('yusho', 'yusho_year6',  '年間全制覇', '1年6場所すべてで幕内優勝する', null);
  one('yusho', 'yusho_perfect','完全優勝', '1年間で90勝0敗', null);
  one('yusho', 'yusho_direct', '下積みなし', '十両で優勝せずに幕内で初優勝する', null);
  one('yusho', 'yusho_ms_bottom', '幕内最下位からの優勝', '幕内の最下位（前頭のいちばん下）で幕内優勝する', null);
  one('yusho', 'yusho_clash', '全勝対決', '幕内で全勝同士の最終戦に勝って全勝優勝する', null);

  // 決まり手
  tiers('kimarite', 'kim_kinds', '決まり手', '種', [4, 8, 12, 16, 20, 25], s => Object.keys(A(s).kimarite).length,
        { 25: '決まり手全制覇（非技も）' });
  for (const [k, n] of Object.entries(ACH_KIMARITE_CATS))
    one('kimarite', `kim_cat_${k}`, `${n}系制覇`, `${n}系の決まり手をすべて出す`,
        s => KIMARITE[k].every(km => A(s).kimarite[km] > 0));

  // 白星・黒星
  one('kuroboshi', 'first_win',  '初白星', '初めて勝つ', s => A(s).wins >= 1);
  one('kuroboshi', 'first_loss', '初黒星', '初めて負ける', s => A(s).losses >= 1);
  one('kuroboshi', 'zenpai',     '全敗', '1場所すべて負ける', null);
  one('kuroboshi', 'demote',     '陥落', '番付が下がる', null);
  one('kuroboshi', 'demote_ozeki','大関陥落', '大関から陥落する', null);
  one('kuroboshi', 'demote_sekitori','関取陥落', '十両から幕下に落ちる', null);
  tiers('kuroboshi', 'kinboshi', '金星', '個', [1, 5, 10, 20, 30, 50, 100], s => A(s).kinboshi || 0);
  one('kuroboshi', 'comeback',   'どん底からの再起', '幕内経験後に序ノ口まで落ち、再び幕内へ戻る', null);

  // 年齢
  one('age', 'age_soujuku', '早熟の天才', '早熟型で24歳までに横綱になる',
      s => s.rikishi.growthType === 'soujuku' && s.rikishi.banzukeRank >= 9 && s.rikishi.age <= 24);
  one('age', 'age_bansei', '大器晩成', '晩成型・超晩成型で30歳以降に横綱になる',
      s => ['bansei', 'chouBansei'].includes(s.rikishi.growthType) && s.rikishi.banzukeRank >= 9 && s.rikishi.age >= 30);
  one('age', 'age_chou', '超晩成', '超晩成型が判明する',
      s => s.rikishi.growthType === 'chouBansei' && isGrowthRevealed(s.rikishi));
  one('age', 'age_40', '生涯現役', '40歳まで現役を続ける', s => s.rikishi.age >= 40);
  one('age', 'age_45', '鉄人', '45歳まで現役を続ける',   s => s.rikishi.age >= 45);
  one('age', 'age_retire', '引き際の美学', '大関以上で、衰え期に入る前に引退する', null);

  // 育成・転生
  const skillCount = s => Object.values(s.tensei.skills || {}).filter(v => v >= 1).length;
  tiers('ikusei', 'skill', 'スキル', '個解放', [10, 25, 50, 100, 130, 158], skillCount, { 158: '全スキル解放' });
  one('ikusei', 'dojo_10', '相撲部屋Lv10', '相撲部屋の強化を合計Lv10にする', s => Object.values(s.tensei.heya || {}).reduce((x, y) => x + y, 0) >= 10);
  one('ikusei', 'body_all', '三体格制覇', '大型・中型・小型すべてで横綱になる',
      s => ['large', 'medium', 'small'].every(k => A(s).yokozunaBodies[k]));
  tiers('ikusei', 'tensei', '転生', '回', [1, 5, 10, 25, 50, 100, 300, 500, 1000],
        s => (s.rebirthCount || 0) + (s.superRebirthCount || 0));
  tiers('ikusei', 'super', '超転生', '回', [1, 5, 10, 25, 50, 100, 200], s => s.superRebirthCount || 0);

  return defs;
})();

const ACH_BY_ID = Object.fromEntries(ACH_DEFS.map(d => [d.id, d]));

// ── 状態 ──────────────────────────────────────
function achNewLife() {
  return { streakL: 0, kachikoshi: 0, yushoJuryo: 0,
           reachedMakuuchi: false, fellAfterMakuuchi: false, yearYusho: 0, yearWins: 0, yearLosses: 0 };
}

function achPatch(state) {
  if (!state.achievements) state.achievements = {};
  const a = state.achievements;
  if (!a.unlocked) a.unlocked = {};
  if (!a.total)    a.total    = {};
  const t = a.total;
  for (const k of ['basho', 'wins', 'losses', 'yusho', 'streakW', 'streakL', 'kinboshi']) if (t[k] == null) t[k] = 0;
  for (const k of ['kimarite', 'yokozunaBodies']) if (!t[k]) t[k] = {};
  if (state.rikishi && !state.rikishi.life) state.rikishi.life = achNewLife();
}

function achCount(state) {
  return Object.keys(state?.achievements?.unlocked || {}).filter(id => ACH_BY_ID[id]).length;
}

function achIsUnlocked(state, id) {
  return !!state?.achievements?.unlocked?.[id];
}

// ── 解除 ──────────────────────────────────────
function achUnlock(id) {
  const s = Game.state;
  if (!ACH_BY_ID[id] || s.achievements.unlocked[id]) return;
  s.achievements.unlocked[id] = true;
  achToast(ACH_BY_ID[id]);
}

function achCheck() {
  const s = Game.state;
  if (!s?.achievements || !s.rikishi) return;
  for (const d of ACH_DEFS) {
    if (s.achievements.unlocked[d.id]) continue;
    const ok = d.goal != null ? d.progress(s) >= d.goal : (d.test ? d.test(s) : false);
    if (ok) achUnlock(d.id);
  }
}

// ── イベント ─────────────────────────────────
function achOnBout(win, kimarite) {
  const s = Game.state, t = s.achievements.total, life = s.rikishi.life;
  if (win) {
    t.wins++; t.streakW++; t.streakL = 0; life.streakL = 0; life.yearWins++;
    t.kimarite[kimarite] = (t.kimarite[kimarite] || 0) + 1;
  } else {
    t.losses++; t.streakL++; t.streakW = 0; life.streakL++; life.yearLosses++;
  }
  achCheck();
}

// bout.js の場所終了時（番付更新・年替わり処理の後）に呼ぶ
function achOnBashoEnd({ wins, boutCount, oldRank, newRank, res, wasYearEnd }) {
  const s = Game.state, t = s.achievements.total, r = s.rikishi, life = r.life;
  t.basho++;
  if (res.verdict === '勝ち越し') life.kachikoshi++;

  // 優勝系の実績は幕内優勝だけで数える（十両は「下積みなし」の判定にだけ使う）
  if (res.isYusho && oldRank === 4) life.yushoJuryo++;
  if (res.isYusho && oldRank >= 5) {
    if ((r.yusho || 0) === 1 && life.yushoJuryo === 0) achUnlock('yusho_direct');
    t.yusho++;
    life.yearYusho++;
    if (wins === boutCount && boutCount === 15) achUnlock('yusho_zensho');
  }
  if (wins === 0) achUnlock('zenpai');
  if (res.demoted) achUnlock('demote');
  if (oldRank === 8 && newRank < 8) achUnlock('demote_ozeki');
  if (oldRank >= 4 && newRank < 4)  achUnlock('demote_sekitori');

  if (newRank >= 9) t.yokozunaBodies[r.bodyTypeKey] = true;
  if (life.fellAfterMakuuchi && newRank >= 5) achUnlock('comeback');
  if (newRank >= 5) life.reachedMakuuchi = true;
  if (life.reachedMakuuchi && newRank === 0) life.fellAfterMakuuchi = true;

  if (wasYearEnd) {
    if (life.yearYusho >= 6) achUnlock('yusho_year6');
    if (life.yearWins >= 90 && life.yearLosses === 0) achUnlock('yusho_perfect');
    life.yearYusho = 0; life.yearWins = 0; life.yearLosses = 0;
  }
  achCheck();
}

// doTensei() で旧力士が入れ替わる前に呼ぶ
function achOnRetire(state) {
  const r = state.rikishi;
  if (r.banzukeRank >= 8 && getAgePhase(r).phase !== 'decline') achUnlock('age_retire');
}

// ── 通知 ──────────────────────────────────────
function achToast(def) {
  if (typeof document === 'undefined') return;
  let box = document.getElementById('ach-toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ach-toasts';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'ach-toast';
  if (typeof Sound !== 'undefined') Sound.play('ach');
  el.innerHTML = `<span class="ach-toast-label">🏅 実績解除</span><span class="ach-toast-name">${def.name}</span>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3200);
}
