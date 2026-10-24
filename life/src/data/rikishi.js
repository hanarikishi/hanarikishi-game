// ── 体重 ───────────────────────────────────────
// 新弟子検査は67kg以上。上限は250kg（実際の最重量は292.6kg）
// 180kgが最適：180kgを超えると重さの得が半分になり、190kgを超えると動きが鈍る
const TAIJUU_MIN = 67, TAIJUU_MAX = 250;
function taijuuEffMass(w) { return w <= 180 ? w : 180 + (w - 180) * 0.5; }
function taijuuSpeedMult(w) { return w <= 190 ? 1 : Math.max(0.7, 1 - (w - 190) / 200); }

const BODY_TYPES = {
  large: {
    name:        '大型',
    desc:        '体重が重く、押し相撲が得意',
    style:       'oshi',
    taijuu:      120,
    chikara:     46,
    waza:        20,
    hayasa:      24,
  },
  medium: {
    name:        '中型',
    desc:        'バランス型。どんな相撲にも対応できる',
    style:       'yotsu',
    taijuu:      110,
    chikara:     36,
    waza:        36,
    hayasa:      36,
  },
  small: {
    name:        '小型',
    desc:        '素早く機敏。技で相手を翻弄する',
    style:       'waza',
    taijuu:      100,
    chikara:     24,
    waza:        50,
    hayasa:      56,
  },
};

// プレイヤー（新弟子）の力・技・速さの倍率。v1.0 で 0.75 に下げたが、相手が強くなったので v1.1.2 で 1 に戻した
const PLAYER_START_MULT = 1;
function playerStartStat(bt, key, mult = 1) { return Math.round(bt[key] * PLAYER_START_MULT * mult); }

const NPC_PREFIX = ['龍', '鳳', '山', '海', '剛', '猛', '翔', '嵐', '波', '虎', '鷹', '白', '若', '大'];
const NPC_SUFFIX = ['ノ里', '山', '海', '龍', '鵬', '鶴', '虎', '嵐', '浪', '峰', 'ノ花', '錦', '富士'];
const HOMETOWNS  = ['東京', '大阪', '福岡', '北海道', 'モンゴル', '愛知', '宮城', '熊本', '鹿児島'];

function createPlayer(shikona, bodyTypeKey) {
  const bt = BODY_TYPES[bodyTypeKey] || BODY_TYPES.medium;
  return {
    shikona,
    bodyType:    bt.name,
    bodyTypeKey,
    style:       bt.style,
    age:         18,
    growthType:  rollGrowthType(),
    hometown:    HOMETOWNS[Math.floor(Math.random() * HOMETOWNS.length)],
    stats: {
      chikara: playerStartStat(bt, 'chikara'),
      waza:    playerStartStat(bt, 'waza'),
      hayasa:  playerStartStat(bt, 'hayasa'),
      taijuu:  bt.taijuu,
    },
    fatigue:      0,
    banzukeRank:  0,
    careerWins:   0,
    careerLosses: 0,
    yokozunaBasho:0,
    yusho:        0,
    isPlayer:     true,
  };
}

function createNPC(rankId, world = 1) {
  const p = NPC_PREFIX[Math.floor(Math.random() * NPC_PREFIX.length)];
  const s = NPC_SUFFIX[Math.floor(Math.random() * NPC_SUFFIX.length)];
  const keys = Object.keys(BODY_TYPES);
  const btKey = keys[Math.floor(Math.random() * keys.length)];
  const bt = BODY_TYPES[btKey];
  // 序ノ口〜三段目は初期プレイヤーと拮抗、幕下から強くなり幕内上位は1周目では難敵
  // [序ノ口, 序二段, 三段目, 幕下, 十両, 前頭下, 前頭上, 小結/関脇, 大関, 横綱]
  const NPC_BASE = [2, 7, 13, 20, 30, 40, 52, 62, 72, 80];
  const base = NPC_BASE[rankId] ?? (20 + rankId * 9);
  const v = () => Math.floor(Math.random() * 16) - 8;
  // world: 相撲界の水準（強い世代ほど強い）
  const st = x => Math.max(10, Math.min(99, Math.round((x + base + v()) * world)));
  return {
    shikona:     p + s,
    bodyType:    bt.name,
    bodyTypeKey: btKey,
    style:       bt.style,
    age:         18 + Math.floor(Math.random() * 15),
    stats: {
      chikara: st(bt.chikara - 10),
      waza:    st(bt.waza    - 10),
      hayasa:  st(bt.hayasa  - 10),
      // 体重はランクが上がるほど重くなる
      taijuu:  Math.max(TAIJUU_MIN, Math.min(TAIJUU_MAX, bt.taijuu + 10 + rankId * 6 + v() * 3)),
    },
    fatigue:     Math.floor(Math.random() * 15),
    banzukeRank: rankId,
    isPlayer:    false,
  };
}
