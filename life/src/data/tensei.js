// 転生・経済システム定数と関数

// ── 値段の曲線 ────────────────────────────────────
// 倍々ではなく「最初はゆるやか、だんだん強く上がる」。上から2桁のキリのいい数に丸める
//   値段 = base × r^n × (1 + n × a)
function niceRound(x) {
  if (x < 10) return Math.ceil(x);
  const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / p) * p;
}
function growthCost(base, r, a, n) {
  return niceRound(base * Math.pow(r, n) * (1 + n * a));
}

// ── 懸賞 ────────────────────────────────────────
const KENSHO_PROB = [0, 0, 0, 0.10, 0.25, 0.40, 0.55, 0.70, 0.80, 0.90];

function rollKensho(rankId, extraProb) {
  return Math.random() < ((KENSHO_PROB[rankId] ?? 0) + (extraProb || 0));
}

function gainTanimachi(rankId, isKensho, tanimachiSpeedPct) {
  const base   = 1 + Math.floor(rankId * 0.6);
  const kensho = isKensho ? Math.floor(1 + Math.random() * 2) : 0;
  const mult   = 1 + (tanimachiSpeedPct || 0) / 100;
  return Math.max(1, Math.floor((base + kensho) * mult));
}

// ── 遺産ポイント ─────────────────────────────────
const ISAN_COST = 5;   // 遺産ポイントで +1（たにまちは +1%）するのに要るポイント
// state を渡すとスキル「語り継がれる」（遺産ポイント+%）も入る
function calcIsanPoints(rikishi, state) {
  const pct = state ? calcSkillEffects(state).isanPct || 0 : 0;
  // 幕内優勝1回で1pt、横綱在位1場所で1pt
  return Math.floor((1 + pct / 100) * ((rikishi.yusho || 0) + (rikishi.yokozunaBasho || 0)));
}

// ── 転生処理 ─────────────────────────────────────
// next: スカウトで選んだ候補（scoutMakeCandidate の形）か、体格キーの文字列（旧方式）
// inheritIds：超転生で次のスキルマップへ引き継ぐスキルのID（今の枚で解放したものから SKILL_INHERIT_MAX 個まで）
function doTensei(state, isSuper, isanAlloc, next, newShikona, inheritIds) {
  const r  = state.rikishi;
  const t  = state.tensei;
  const cand = next && typeof next === 'object' ? next : null;
  const newBodyTypeKey = cand ? cand.bodyTypeKey : next;
  const bt = BODY_TYPES[newBodyTypeKey || r.bodyTypeKey] || BODY_TYPES.medium;
  const base = cand ? cand.stats : bt;

  rosterRecordPlayerLife(state);
  achOnRetire(state);
  state.oyakata = oyakataFrom(r);   // 引退した力士が親方になる
  if (state.roster) rosterRemovePlayer(state);

  const baseReward = isSuper
    ? Math.floor(10 + r.banzukeRank * 5 + (r.careerWins || 0) * 0.05)
    : Math.floor( 3 + r.banzukeRank * 2 + (r.careerWins || 0) * 0.02);

  // スキル: 力士の誇り(+5%) と 力士伝説(固定加算)
  const fxNow = calcSkillEffects(state);
  const prideMult = fxNow.rikishiPride > 0 ? 1.05 : 1;
  const tanimachiReward = Math.floor(baseReward * prideMult) + Math.floor(fxNow.rebirthBonus || 0);

  t.tanimachi += tanimachiReward;

  if (isSuper && isanAlloc) {
    const isan = t.isan;
    isan.chikara        = (isan.chikara        || 0) + (isanAlloc.chikara        || 0);
    isan.waza           = (isan.waza           || 0) + (isanAlloc.waza           || 0);
    isan.hayasa         = (isan.hayasa         || 0) + (isanAlloc.hayasa         || 0);
    isan.tanimachiSpeed = (isan.tanimachiSpeed || 0) + (isanAlloc.tanimachiSpeed || 0);
  }

  t.kanroku         = 0;  // 転生でリセット（横綱の称号を失う）
  t.heya            = {};  // 相撲部屋も最初（Lv1）に戻る
  t.kamisanAccum    = 0;
  // スキル：ふつうの転生ではそのまま。超転生では次の枚のスキルマップへ進み、選んだものだけ引き継ぐ
  const page = skillPage(state);
  if (isSuper && page < SKILL_PAGE_MAX) {
    const learned = new Set(Object.keys(t.skills || {}).filter(id => t.skills[id] >= 1));
    // 引き継ぎはランダム（解放したスキルから SKILL_INHERIT_MAX 個）
    const pool = [...learned];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    t.inherited = [...(t.inherited || []),
      ...pool.slice(0, SKILL_INHERIT_MAX).map(id => ({ page, id }))];
    t.skills    = {};
    t.skillPage = page + 1;
  }

  const isan = t.isan;
  const fxNew = calcSkillEffects(state);
  state.rikishi = {
    shikona:      newShikona || r.shikona,
    bodyType:     bt.name,
    bodyTypeKey:  newBodyTypeKey || r.bodyTypeKey,
    style:        bt.style,
    age:          cand ? cand.age : 18,
    growthType:   cand ? cand.growthType : rollGrowthType(),
    background:   cand ? cand.bg : null,
    trait:        cand ? cand.trait : null,
    hometown:     r.hometown,
    stats: {
      chikara: Math.min(99 + (fxNew.chikara || 0), base.chikara + (isan.chikara || 0)),
      waza:    Math.min(99 + (fxNew.waza || 0), base.waza + (isan.waza || 0)),
      hayasa:  Math.min(99 + (fxNew.hayasa || 0), base.hayasa + (isan.hayasa || 0)),
      taijuu:  Math.min(TAIJUU_MAX + (fxNew.taijuu || 0), base.taijuu),
    },
    fatigue:      0,
    banzukeRank:  0,
    careerWins:   0,
    careerLosses: 0,
    yokozunaBasho:0,
    yusho:        0,
    isPlayer:     true,
    life:         achNewLife(),
    ...(r.look ? { look: r.look } : {}),   // 見た目は前の力士のまま（ホームの「見た目」で変えられる）
  };
  // 親方の教え：親方の得意な能力を少し受け継ぐ
  const gift = state.oyakata?.gift;
  if (gift) state.rikishi.stats[gift.stat] = Math.min(statMax(state, gift.stat), state.rikishi.stats[gift.stat] + gift.amount);

  // 世界の時間は続く（名簿の場所数から年と場所を出す）
  const bn = state.roster?.bashoNo || 0;
  state.calendar   = { year: GAME_START_YEAR + Math.floor(bn / 6), bashoIndex: bn % 6, phase: 'ready', day: 1 };
  state.basho      = { day: 0, wins: 0, losses: 0, results: [], opponent: null, tanimachiEarned: 0 };
  state.scoutPool    = null;
  state.chankoPts    = 0;

  if (isSuper) state.superRebirthCount = (state.superRebirthCount || 0) + 1;
  else         state.rebirthCount      = (state.rebirthCount      || 0) + 1;
  rosterOnNewLife(state);
  achCheck();

  return { tanimachiReward };
}

// ── セーブデータの補い ─────────────────────────
// SAVE_VERSION より古いセーブは読み込まない（main.js）。同じ形式の中で足りない項目だけ補う
function patchSave(state) {
  if (!state) return;
  const t = state.tensei;
  if (!t.isan)   t.isan   = { chikara: 0, waza: 0, hayasa: 0, tanimachiSpeed: 0 };
  if (!t.skills) t.skills = {};
  if (!t.heya)   t.heya   = {};
  if (state.chankoPts == null) state.chankoPts = 0;
  if (state.calendar && state.calendar.year < 1000) state.calendar.year += GAME_START_YEAR - 1;   // 旧: 1年目〜
  achPatch(state);
  rosterPatch(state);
  if (!state.relations) rosterOnNewLife(state);
}

// ── 相撲部屋 ─────────────────────────────────
// たにまちで強化。転生（超転生も）で最初に戻る。t.heya = { chankoban, keikoba, kanban, scout }
// 中の値は強化した回数（0＝最初）。画面では +1 して Lv1 から数える
const HEYA_DEFS = [
  { id: 'chankoban', name: 'ちゃんこ番', emoji: '🍲', desc: lv => `毎場所ちゃんこ +${lv}杯`,          cost: lv => growthCost(15, 1.45, 0.1, lv) },
  { id: 'keikoba',   name: '稽古場',     emoji: '🏟️', desc: lv => `勝ち越すとちゃんこ +${lv * 2}杯`, cost: lv => growthCost(10, 1.4, 0.1, lv) },
  { id: 'kanban',    name: '部屋の看板', emoji: '🏮', desc: lv => `たにまち +${lv * 10}%`,           cost: lv => growthCost(8, 1.4, 0.1, lv) },
  { id: 'scout',     name: 'スカウト網', emoji: '🔭', desc: lv => `新弟子の候補 ${3 + Math.min(2, Math.floor((lv + 1) / 2))}人${lv >= 2 ? '・成長タイプが見える' : ''}・特性 ${10 + lv * 8}%`,
                                                                                                       cost: lv => growthCost(12, 1.45, 0.1, lv) },
];
// 強化の値段（スキル「部屋の大工」で安くなる）
function heyaCost(state, d, lv) {
  return Math.max(1, Math.round(d.cost(lv) * (1 - (calcSkillEffects(state).heyaDiscount || 0) / 100)));
}

function heyaLv(state, id) {
  return (state.tensei?.heya || {})[id] || 0;
}

// 場所の後にもらう部屋のちゃんこ
function heyaChankoBonus(state, kachikoshi) {
  return heyaLv(state, 'chankoban') + (kachikoshi ? heyaLv(state, 'keikoba') * 2 : 0);
}

// ── 親方（引退した力士が部屋の親方になる）────────────────
// 親方の格：現役時代の最高位と優勝回数で、弟子が毎場所もらうちゃんこが増える
// 親方の教え：親方がいちばん得意だった能力（力・技・速さで最も高いもの）を、新弟子が入門時に少し受け継ぐ（＋格＋1）
const OYAKATA_GIFT_LABEL = { chikara: '力', waza: '技', hayasa: '速さ' };
function oyakataFrom(r) {
  const maxRank = r.maxRankScore != null ? Math.ceil(r.maxRankScore / 1000) : r.banzukeRank;
  const bonus = ({ 9: 3, 8: 2, 7: 1 }[maxRank] || 0) + ((r.yusho || 0) >= 1 ? 1 : 0) + ((r.yusho || 0) >= 5 ? 1 : 0);
  const best  = ['chikara', 'waza', 'hayasa'].reduce((a, k) => (r.stats[k] > r.stats[a] ? k : a), 'chikara');
  const gift  = { stat: best, label: OYAKATA_GIFT_LABEL[best], amount: bonus + 1 };
  return { shikona: r.shikona, maxRank: r.maxRankTitle || getRankName(r.banzukeRank), yusho: r.yusho || 0, bonus, gift };
}

function oyakataChankoBonus(state) {
  return state.oyakata?.bonus || 0;
}

// ── スカウト（新弟子探し）──────────────────────────────
// 引退すると候補から次の力士を選ぶ。相撲部屋の「スカウト網」で候補数・見える情報・まれな特性の出やすさが上がる
const SCOUT_BACKGROUNDS = [
  { id: 'chusotsu', name: '中卒', age: 15, statMult: 0.75, taijuu: -10, weight: 30 },
  { id: 'kousotsu', name: '高卒', age: 18, statMult: 1.0,  taijuu: 0,   weight: 45 },
  { id: 'daisotsu', name: '大卒', age: 22, statMult: 1.2,  taijuu: 8,   weight: 25 },
];
const SCOUT_TRAITS = [
  { id: 'kairiki', name: '怪力',     desc: '力 +8',            stats: { chikara: 8 } },
  { id: 'shunsoku', name: '俊足',    desc: '速さ +8',          stats: { hayasa: 8 } },
  { id: 'gikou',   name: '技巧',     desc: '技 +8',            stats: { waza: 8 } },
  { id: 'kyotai',  name: '巨体',     desc: '体重 +20kg',       stats: { taijuu: 20 } },
  { id: 'oogui',   name: '大食い',   desc: '毎場所ちゃんこ +1杯', stats: {} },
  { id: 'gakusei', name: '学生横綱', desc: '力・技・速さ +6（大卒のみ）', stats: { chikara: 6, waza: 6, hayasa: 6 }, onlyBg: 'daisotsu' },
];

function scoutLv(state) { return heyaLv(state, 'scout'); }
function scoutCandidateCount(state) { return 3 + Math.min(2, Math.floor((scoutLv(state) + 1) / 2)); }   // Lv1:4人 Lv3:5人
function scoutShowsGrowth(state) { return scoutLv(state) >= 2; }
function scoutRerollCost(n, state) {
  const off = state ? calcSkillEffects(state).rerollDiscount || 0 : 0;   // スキル「顔の広い親方」
  return Math.max(1, Math.round(growthCost(10, 1.6, 0, n) * (1 - off / 100)));
}

function scoutPick(list) {
  let roll = Math.random() * list.reduce((s, x) => s + x.weight, 0);
  for (const x of list) { roll -= x.weight; if (roll < 0) return x; }
  return list[0];
}

function scoutMakeCandidate(state) {
  const bg    = scoutPick(SCOUT_BACKGROUNDS);
  const keys  = Object.keys(BODY_TYPES);
  const btKey = keys[Math.floor(Math.random() * keys.length)];
  const bt    = BODY_TYPES[btKey];
  const v     = () => Math.floor(Math.random() * 7) - 3;
  const stats = {
    chikara: playerStartStat(bt, 'chikara', bg.statMult) + v(),
    waza:    playerStartStat(bt, 'waza',    bg.statMult) + v(),
    hayasa:  playerStartStat(bt, 'hayasa',  bg.statMult) + v(),
    taijuu:  bt.taijuu + bg.taijuu + v() * 2,
  };
  // まれな特性（10% ＋ スカウト網Lvごとに +8%）
  let trait = null;
  if (Math.random() < 0.10 + scoutLv(state) * 0.08) {
    const pool = SCOUT_TRAITS.filter(t => !t.onlyBg || t.onlyBg === bg.id);
    trait = pool[Math.floor(Math.random() * pool.length)];
    for (const [k, add] of Object.entries(trait.stats)) stats[k] += add;
  }
  stats.taijuu = Math.max(TAIJUU_MIN, stats.taijuu);   // 新弟子検査は67kg以上
  return { bg: bg.id, bodyTypeKey: btKey, age: bg.age, growthType: rollGrowthType(), stats, trait: trait?.id || null };
}

function scoutMakePool(state) {
  return Array.from({ length: scoutCandidateCount(state) }, () => scoutMakeCandidate(state));
}
