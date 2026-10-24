// 幕内・十両・幕下の名簿（190人）。転生しても続く
// 設計: docs/superpowers/specs/2026-10-11-roster-banzuke-design.md

const ROSTER_DIV_SIZE = { makuuchi: 42, juryo: 28, makushita: 120 };
const ROSTER_TOTAL    = 190;
const ROSTER_MIN_MAEGASHIRA = 20;

// 名簿内の地位（並び順）と 0〜9 の banzukeRank への対応
const ROSTER_RANKS = {
  yokozuna:   { name: '横綱', rankId: 9, div: 'makuuchi' },
  ozeki:      { name: '大関', rankId: 8, div: 'makuuchi' },
  sekiwake:   { name: '関脇', rankId: 7, div: 'makuuchi' },
  komusubi:   { name: '小結', rankId: 6, div: 'makuuchi' },
  maegashira: { name: '前頭', rankId: 5, div: 'makuuchi' },
  juryo:      { name: '十両', rankId: 4, div: 'juryo' },
  makushita:  { name: '幕下', rankId: 3, div: 'makushita' },
};
const ROSTER_RANK_ORDER = Object.keys(ROSTER_RANKS);
const ROSTER_DIV_NAMES  = { makuuchi: '幕内', juryo: '十両', makushita: '幕下' };

// ── 取組の見た目（目 × 肌 × まわし）。名簿の中でかぶらないように1人ずつ割り当てる ──
const NPC_EYES_COUNT   = 3;
// 最後の1つ（黄）がはなりきしのふつうの肌、まわしの最後（深緑）がふつうのまわし（LOOK_DEFAULT）
const NPC_SKIN_COLORS  = ['#DAF2D0', '#F2CEEF', '#CAEDFB', '#FFC000', '#9999FF', '#FFFF66', '#F8E2DE', '#FFEE00'];
const NPC_MAWASHI_COLORS = ['#000000', '#FF0000', '#0070C0', '#4EA72E', '#FF99FF', '#E97132', '#A02B93',
                            '#D4AF37', '#C0C0C0', '#206100'];   // 金・銀・（はなりきしの）深緑
const NPC_LOOK_TOTAL = NPC_EYES_COUNT * NPC_SKIN_COLORS.length * NPC_MAWASHI_COLORS.length;   // 189通り

function npcLookKey(l) { return `${l.eyes}_${l.skin}_${l.mawashi}`; }
function npcLookFromIndex(i) {
  const m = NPC_MAWASHI_COLORS.length, k = NPC_SKIN_COLORS.length;
  return { eyes: Math.floor(i / (k * m)), skin: Math.floor(i / m) % k, mawashi: i % m };
}
function npcRandomLook() { return npcLookFromIndex(Math.floor(Math.random() * NPC_LOOK_TOTAL)); }

// 見た目が無い・ほかの力士とかぶっている NPC に、空いている組を割り当てる（番付上位の人が先に今の見た目を守る）。
// 組が足りないとき（NPC 190人のとき1人）は空きが無いので、かぶりを許す
function rosterAssignLooks(roster) {
  const used = new Set();
  const need = [];
  for (const r of roster.list) {
    if (r.isPlayer) continue;
    const ok = r.look && r.look.eyes < NPC_EYES_COUNT && r.look.skin < NPC_SKIN_COLORS.length
            && r.look.mawashi < NPC_MAWASHI_COLORS.length && !used.has(npcLookKey(r.look));
    if (ok) used.add(npcLookKey(r.look)); else need.push(r);
  }
  const free = [];
  for (let i = 0; i < NPC_LOOK_TOTAL; i++) if (!used.has(npcLookKey(npcLookFromIndex(i)))) free.push(i);
  rosterShuffle(free);
  for (const r of need) r.look = free.length ? npcLookFromIndex(free.pop()) : npcRandomLook();
}

// ── 四股名 ────────────────────────────────────
const ROSTER_NAME_HEAD = ['龍', '鳳', '山', '海', '剛', '猛', '翔', '嵐', '波', '虎', '鷹', '白', '若', '大',
                          '栃', '琴', '朝', '豊', '旭', '北', '玉', '千代', '隆', '安美', '貴', '照', '霧', '宝'];
const ROSTER_NAME_TAIL = ['ノ里', '山', '海', '龍', '鵬', '鶴', '虎', '嵐', '浪', '峰', 'ノ花', '錦', '富士',
                          '桜', '昇', '風', '光', '翔', '輝'];

function rosterShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 実在の名力士と同じになる組み合わせは使わない
const ROSTER_NAME_NG = new Set(['白鵬', '大鵬', '貴ノ花', '若ノ花', '栃錦', '千代富士', '照富士']);

function rosterMakeNames(n) {
  const all = [];
  for (const h of ROSTER_NAME_HEAD) for (const t of ROSTER_NAME_TAIL) {
    if (h !== t && !ROSTER_NAME_NG.has(h + t)) all.push(h + t);
  }
  return rosterShuffle([...new Set(all)]).slice(0, n);
}

// ── 力士生成 ─────────────────────────────────
// level: 能力の基準値（序ノ口 2 〜 横綱 80。createNPC の NPC_BASE と同じ目盛り）
// 体重：幕内 平均158kg・十両156・幕下147 くらい（実際の統計に合わせる）
//   番付が上ほど少し重い／体格で差／若いほど軽い／下の番付ほどばらつきが大きい
function rosterInitialWeight(bt, level, age, gauss) {
  const young  = Math.max(0, 22 - age) * 4;
  const spread = level < 30 ? 14 : 10;
  const w = 136 + level * 0.45 + (bt.taijuu - 95) * 0.6 - young + gauss() * spread;
  return Math.max(TAIJUU_MIN, Math.min(TAIJUU_MAX, Math.round(w)));
}

function rosterCreateRikishi(shikona, gen, level, age) {
  const keys  = Object.keys(BODY_TYPES);
  const btKey = keys[Math.floor(Math.random() * keys.length)];
  const bt    = BODY_TYPES[btKey];
  const v     = () => Math.floor(Math.random() * 16) - 8;
  const clamp = x => Math.max(10, Math.min(99, Math.round(x)));
  // 潜在能力（力・技・速の平均がここまで伸びる）。平均62・ばらつき大
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  const peak  = Math.max(38, Math.min(99, Math.round(62 + gauss() * 15)));
  return {
    shikona, gen, peak,
    bodyTypeKey: btKey,
    style:       bt.style,
    growthType:  rollGrowthType(),
    age,
    stats: {
      chikara: clamp(bt.chikara - 10 + level + v()),
      waza:    clamp(bt.waza    - 10 + level + v()),
      hayasa:  clamp(bt.hayasa  - 10 + level + v()),
      taijuu:  rosterInitialWeight(bt, level, age, gauss),
    },
    fatigue:  0,
    rank:     'makushita',     // 名簿内の地位キー（番付編成で更新）
    title:    '',              // 表示用（東前頭三枚目 など）
    banzukeRank: 3,
    record:   null,            // 前場所成績 { w, l }
    entryBasho: 0,
  };
}

// 並び順（index）から能力基準値を決める。上位ほど強い
function rosterLevelAt(index) {
  const pts = [[0, 80], [2, 74], [4, 64], [8, 56], [20, 46], [42, 38], [70, 30], [100, 26], [190, 14]];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
    if (index <= x2) return y1 + (y2 - y1) * (index - x1) / (x2 - x1);
  }
  return 14;
}

function generateRoster() {
  const names = rosterMakeNames(ROSTER_TOTAL);
  const list  = names.map((name, i) => {
    // 上位ほど年齢が高め（20〜34歳）、幕下下位は若手（18〜24歳）
    const age = i < 70 ? 22 + Math.floor(Math.random() * 12) : 18 + Math.floor(Math.random() * 10);
    const r  = rosterCreateRikishi(name, 1, rosterLevelAt(i), age);
    const lv = (r.stats.chikara + r.stats.waza + r.stats.hayasa) / 3;
    r.peak   = Math.min(99, Math.round(Math.max(r.peak, lv + Math.random() * 8)));
    return r;
  });
  // 幕内の初期構成：横綱2・大関2・関脇2・小結2・前頭34
  const head = ['yokozuna', 'yokozuna', 'ozeki', 'ozeki', 'sekiwake', 'sekiwake', 'komusubi', 'komusubi'];
  list.forEach((r, i) => {
    r.rank = head[i] || (i < 42 ? 'maegashira' : i < 70 ? 'juryo' : 'makushita');
  });
  const roster = { list, bashoNo: 0 };
  rosterAssignTitles(roster);
  return roster;
}

// ── 地位・東西・枚目の付与 ─────────────────────────
// list は番付順に並んでいる前提。各地位の中で 東→西→東→西
const ROSTER_KANSUJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function rosterKansuji(n) {
  if (n < 10) return ROSTER_KANSUJI[n];
  const tens = Math.floor(n / 10), ones = n % 10;
  return (tens === 1 ? '' : ROSTER_KANSUJI[tens]) + '十' + (ones ? ROSTER_KANSUJI[ones] : '');
}

function rosterAssignTitles(roster) {
  rosterAssignLooks(roster);
  const counter = {};
  roster.list.forEach((r, i) => {
    r.pos = i;
    const n    = counter[r.rank] = (counter[r.rank] || 0) + 1;
    r.side     = (n % 2 === 1) ? '東' : '西';
    r.num      = Math.ceil(n / 2);
    r.div      = ROSTER_RANKS[r.rank].div;
    r.banzukeRank = ROSTER_RANKS[r.rank].rankId;
    const name = ROSTER_RANKS[r.rank].name;
    const hasNum = ['maegashira', 'juryo', 'makushita'].includes(r.rank);
    if (hasNum)      r.title = `${r.side}${name}${r.num === 1 ? '筆頭' : rosterKansuji(r.num) + '枚目'}`;
    else if (r.num > 1) r.title = `${r.side}${name}（張出）`;
    else             r.title = `${r.side}${name}`;
  });
}

function rosterDisplayName(r) {
  return r.gen > 1 ? `${r.shikona}（${rosterKansuji(r.gen)}代目）` : r.shikona;
}

// ── セーブ互換 ───────────────────────────────
function rosterPatch(state) {
  if (!state.roster || !Array.isArray(state.roster.list) || state.roster.list.length !== ROSTER_TOTAL) {
    state.roster = generateRoster();
  }
  rosterAssignLooks(state.roster);   // 見た目が入る前のセーブにも割り当てる
}
