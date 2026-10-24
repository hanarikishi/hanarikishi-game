// ── 円形スキルマップ定数 ─────────────────────────────
const RING_SIZES  = [1, 7, 12, 18, 24, 30, 36, 30]; // 合計158ノード
const RING_RADII  = [0, 70, 140, 215, 295, 380, 470, 565];
const SKILL_CENTER = 600; // SVG 1200×1200 の中心

function ringSlotToXY(ring, slot) {
  if (ring === 0) return { x: SKILL_CENTER, y: SKILL_CENTER };
  const total = RING_SIZES[ring];
  const angle = (slot / total) * Math.PI * 2 - Math.PI / 2;
  const r     = RING_RADII[ring];
  return {
    x: SKILL_CENTER + r * Math.cos(angle),
    y: SKILL_CENTER + r * Math.sin(angle),
  };
}

function getNeighborKeys(ring, slot) {
  const neighbors = [];
  const total = RING_SIZES[ring];

  // 同リング隣接
  if (total > 1) {
    neighbors.push(`${ring}_${(slot - 1 + total) % total}`);
    neighbors.push(`${ring}_${(slot + 1) % total}`);
  }

  // 内側リング（ring-1）の最近傍
  if (ring > 0) {
    const innerTotal = RING_SIZES[ring - 1];
    if (innerTotal === 1) {
      neighbors.push(`${ring - 1}_0`);
    } else {
      const ratio = slot / total;
      const nearSlot  = Math.round(ratio * innerTotal) % innerTotal;
      const nearSlot2 = (nearSlot + 1) % innerTotal;
      neighbors.push(`${ring - 1}_${nearSlot}`);
      neighbors.push(`${ring - 1}_${nearSlot2}`);
    }
  }

  // 外側リング（ring+1）の最近傍
  if (ring + 1 < RING_SIZES.length) {
    const outerTotal = RING_SIZES[ring + 1];
    const ratio      = slot / total;
    const nearSlot   = Math.round(ratio * outerTotal) % outerTotal;
    neighbors.push(`${ring + 1}_${nearSlot}`);
  }

  return [...new Set(neighbors)];
}

function getSkillLv(state, ring, slot) {
  return ((state.tensei || {}).skills || {})[`${ring}_${slot}`] || 0;
}

function makeReq(ring, slot) {
  if (ring === 0) return () => true;
  const nbKeys = getNeighborKeys(ring, slot).filter(k => {
    const [r] = k.split('_').map(Number);
    return r < ring;
  });
  return (state) => nbKeys.some(k => {
    const [r, s] = k.split('_').map(Number);
    return getSkillLv(state, r, s) >= 1;
  });
}

// ── 158スキル定義 ─────────────────────────────────────
const SKILL_DEFS_RAW = [
  // Ring 0 (1ノード)
  { ring:0, slot:0,  id:'0_0',  name:'たにまち+1%',      emoji:'💰', desc:'たにまち獲得量+1%',       cost:5,    effect:{taniPct:1} },

  // Ring 1 (7ノード)
  { ring:1, slot:0,  id:'1_0',  name:'たにまち+2%',      emoji:'💰', desc:'たにまち獲得量+2%',       cost:10,   effect:{taniPct:2} },
  { ring:1, slot:1,  id:'1_1',  name:'たにまち+1%',      emoji:'💰', desc:'たにまち獲得量+1%',     cost:15,   effect:{taniPct:1} },
  { ring:1, slot:2,  id:'1_2',  name:'懸賞+2%',          emoji:'🎀', desc:'懸賞確率+2%',             cost:10,   effect:{winChanko:2} },
  { ring:1, slot:3,  id:'1_3',  name:'力+1',             emoji:'💪', desc:'初期力+1（転生後も適用）', cost:10,   effect:{chikara:1} },
  { ring:1, slot:4,  id:'1_4',  name:'技+1',             emoji:'🤸', desc:'初期技+1（転生後も適用）', cost:10,   effect:{waza:1} },
  { ring:1, slot:5,  id:'1_5',  name:'おかわり',            emoji:'🍲', desc:'毎場所ちゃんこ+1杯',  cost:15,   effect:{chankoPlus:1} },
  { ring:1, slot:6,  id:'1_6',  name:'女将',             emoji:'👩‍🍳', desc:'たにまち毎分+1自動増加',  cost:30,   effect:{taniPerMin:1} },

  // Ring 2 (12ノード)
  { ring:2, slot:0,  id:'2_0',  name:'たにまち+3%',      emoji:'💰', desc:'たにまち獲得量+3%',       cost:20,   effect:{taniPct:3} },
  { ring:2, slot:1,  id:'2_1',  name:'たにまち+5%',      emoji:'💰', desc:'たにまち獲得量+5%',       cost:30,   effect:{taniPct:5} },
  { ring:2, slot:2,  id:'2_2',  name:'たにまち+2%',      emoji:'💰', desc:'たにまち獲得量+2%',     cost:25,   effect:{taniPct:2} },
  { ring:2, slot:3,  id:'2_3',  name:'たにまち+3%',      emoji:'💰', desc:'たにまち獲得量+3%',     cost:35,   effect:{taniPct:3} },
  { ring:2, slot:4,  id:'2_4',  name:'懸賞+3%',          emoji:'🎀', desc:'懸賞確率+3%',             cost:20,   effect:{taniPct:3} },
  { ring:2, slot:5,  id:'2_5',  name:'懸賞+5%',          emoji:'🎀', desc:'懸賞確率+5%',             cost:35,   effect:{winChanko:5} },
  { ring:2, slot:6,  id:'2_6',  name:'力+2',             emoji:'💪', desc:'初期力+2（転生後も適用）', cost:20,   effect:{chikara:2} },
  { ring:2, slot:7,  id:'2_7',  name:'体重+2kg',         emoji:'⚖️', desc:'初期体重+2kg',            cost:20,   effect:{taijuu:2} },
  { ring:2, slot:8,  id:'2_8',  name:'速さ+1',           emoji:'💨', desc:'初期速さ+1（転生後も適用）',cost:10,  effect:{hayasa:1} },
  { ring:2, slot:9,  id:'2_9',  name:'技+2',             emoji:'🤸', desc:'初期技+2（転生後も適用）', cost:20,   effect:{waza:2} },
  { ring:2, slot:10, id:'2_10', name:'力・技・速さの器 −1%',      emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −1%',  cost:30,   effect:{heyaDiscount:1} },
  { ring:2, slot:11, id:'2_11', name:'付き人',           emoji:'🙌', desc:'懸賞確率+10%',            cost:60,   effect:{taniPct:10} },

  // Ring 3 (18ノード)
  { ring:3, slot:0,  id:'3_0',  name:'たにまち+7%',      emoji:'💰', desc:'たにまち獲得量+7%',       cost:50,   effect:{taniPct:7} },
  { ring:3, slot:1,  id:'3_1',  name:'たにまち+10%',     emoji:'💰', desc:'たにまち獲得量+10%',      cost:70,   effect:{taniPct:10} },
  { ring:3, slot:2,  id:'3_2',  name:'たにまち+15%',     emoji:'💰', desc:'たにまち獲得量+15%',      cost:100,  effect:{taniPct:15} },
  { ring:3, slot:3,  id:'3_3',  name:'たにまち+5%',      emoji:'💰', desc:'たにまち獲得量+5%',     cost:60,   effect:{taniPct:5} },
  { ring:3, slot:4,  id:'3_4',  name:'たにまち+7%',      emoji:'💰', desc:'たにまち獲得量+7%',     cost:80,   effect:{taniPct:7} },
  { ring:3, slot:5,  id:'3_5',  name:'場所たにまち+5%',  emoji:'🏆', desc:'場所中のたにまち獲得+5%',cost:80,  effect:{bashoTaniPct:5} },
  { ring:3, slot:6,  id:'3_6',  name:'懸賞+8%',          emoji:'🎀', desc:'懸賞確率+8%',             cost:60,   effect:{winChanko:8} },
  { ring:3, slot:7,  id:'3_7',  name:'懸賞+10%',         emoji:'🎀', desc:'懸賞確率+10%',            cost:80,   effect:{taniPct:10} },
  { ring:3, slot:8,  id:'3_8',  name:'力+3',             emoji:'💪', desc:'初期力+3',                cost:40,   effect:{chikara:3} },
  { ring:3, slot:9,  id:'3_9',  name:'力+4',             emoji:'💪', desc:'初期力+4',                cost:55,   effect:{chikara:4} },
  { ring:3, slot:10, id:'3_10', name:'体重+5kg',         emoji:'⚖️', desc:'初期体重+5kg',            cost:45,   effect:{taijuu:5} },
  { ring:3, slot:11, id:'3_11', name:'速さ+2',           emoji:'💨', desc:'初期速さ+2',              cost:25,   effect:{hayasa:2} },
  { ring:3, slot:12, id:'3_12', name:'速さ+3',           emoji:'💨', desc:'初期速さ+3',              cost:35,   effect:{hayasa:3} },
  { ring:3, slot:13, id:'3_13', name:'技+3',             emoji:'🤸', desc:'初期技+3',                cost:40,   effect:{waza:3} },
  { ring:3, slot:14, id:'3_14', name:'力・技・速さの器 −1%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −1%', cost:60,   effect:{heyaDiscount:1} },
  { ring:3, slot:15, id:'3_15', name:'懸賞+3%',       emoji:'🎀', desc:'懸賞確率+3%',       cost:40,   effect:{winChanko:3} },
  { ring:3, slot:16, id:'3_16', name:'後援者',           emoji:'💴', desc:'たにまち獲得量+20%',      cost:120,  effect:{taniPct:20} },
  { ring:3, slot:17, id:'3_17', name:'オフライン+10%',   emoji:'⏰', desc:'アプリを閉じている間の女将のたにまち+10%',   cost:80,   effect:{offlinePct:10} },

  // Ring 4 (24ノード)
  { ring:4, slot:0,  id:'4_0',  name:'たにまち+20%',     emoji:'💰', desc:'たにまち獲得量+20%',      cost:150,  effect:{taniPct:20} },
  { ring:4, slot:1,  id:'4_1',  name:'実績たにまち',     emoji:'🏅', desc:'実績1つにつき たにまち+1%', cost:200,  effect:{achTaniPct:1} },
  { ring:4, slot:2,  id:'4_2',  name:'たにまち+30%',     emoji:'💰', desc:'たにまち獲得量+30%',      cost:280,  effect:{taniPct:30} },
  { ring:4, slot:3,  id:'4_3',  name:'タニマチ名人',     emoji:'🎩', desc:'たにまち獲得量+50%',      cost:400,  effect:{taniPct:50} },
  { ring:4, slot:4,  id:'4_4',  name:'たにまち+10%',     emoji:'💰', desc:'たにまち獲得量+10%',    cost:150,  effect:{taniPct:10} },
  { ring:4, slot:5,  id:'4_5',  name:'実績たにまち②',         emoji:'🏅', desc:'実績1つにつき たにまち+1%', cost:200,  effect:{achTaniPct:1} },
  { ring:4, slot:6,  id:'4_6',  name:'場所たにまち+50%',             emoji:'🏆', desc:'場所中のたにまち獲得+50%',        cost:300,  effect:{bashoTaniPct:50} },
  { ring:4, slot:7,  id:'4_7',  name:'懸賞+15%',         emoji:'🎀', desc:'懸賞確率+15%',            cost:120,  effect:{taniPct:15} },
  { ring:4, slot:8,  id:'4_8',  name:'実績ちゃんこ',         emoji:'🏅', desc:'実績1つにつき 懸賞+0.5%',  cost:160,  effect:{achWinChanko:0.5} },
  { ring:4, slot:9,  id:'4_9',  name:'場所たにまち+10%', emoji:'🏆', desc:'場所中のたにまち獲得+10%', cost:150,  effect:{bashoTaniPct:10} },
  { ring:4, slot:10, id:'4_10', name:'力の器 −3%',             emoji:'🔨', desc:'力を+1するのに要るちゃんこ −3%',                cost:80,   effect:{heyaDiscount:2} },
  { ring:4, slot:11, id:'4_11', name:'力の器 −3%',             emoji:'🔨', desc:'力を+1するのに要るちゃんこ −3%',                cost:100,  effect:{heyaDiscount:2} },
  { ring:4, slot:12, id:'4_12', name:'おかわり',     emoji:'🍲', desc:'毎場所ちゃんこ+1杯', cost:120,  effect:{chankoPlus:1} },
  { ring:4, slot:13, id:'4_13', name:'速さの器 −3%',           emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −3%',              cost:55,   effect:{heyaDiscount:2} },
  { ring:4, slot:14, id:'4_14', name:'速さの器 −3%',           emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −3%',              cost:70,   effect:{heyaDiscount:2} },
  { ring:4, slot:15, id:'4_15', name:'技の器 −3%',             emoji:'🔨', desc:'技を+1するのに要るちゃんこ −3%',                cost:55,   effect:{heyaDiscount:2} },
  { ring:4, slot:16, id:'4_16', name:'技の器 −3%',             emoji:'🔨', desc:'技を+1するのに要るちゃんこ −3%',                cost:70,   effect:{heyaDiscount:2} },
  { ring:4, slot:17, id:'4_17', name:'力・技・速さの器 −2%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −2%', cost:100,  effect:{heyaDiscount:2} },
  { ring:4, slot:18, id:'4_18', name:'懸賞+6%',       emoji:'🎀', desc:'懸賞確率+6%',       cost:70,   effect:{winChanko:6} },
  { ring:4, slot:19, id:'4_19', name:'連勝オーラ①',      emoji:'⚡', desc:'連勝中 たにまち+2%×連勝数（10連勝まで）', cost:150, effect:{rensoLv:1} },
  { ring:4, slot:20, id:'4_20', name:'懸賞+10%',     emoji:'🎀', desc:'懸賞確率+10%',       cost:100,  effect:{taniPct:10} },
  { ring:4, slot:21, id:'4_21', name:'親方',             emoji:'🎌', desc:'全スキル効果×1.1',         cost:500,  effect:{allMult:1.1} },
  { ring:4, slot:22, id:'4_22', name:'オフライン+20%',   emoji:'⏰', desc:'アプリを閉じている間の女将のたにまち+20%',   cost:150,  effect:{offlinePct:20} },
  { ring:4, slot:23, id:'4_23', name:'貫禄強化①',        emoji:'🏅', desc:'貫禄のたにまちボーナス+1%/段',  cost:150,  effect:{kanrokuBonus:1} },

  // Ring 5 (30ノード)
  { ring:5, slot:0,  id:'5_0',  name:'たにまち+40%',     emoji:'💰', desc:'たにまち獲得量+40%',      cost:350,  effect:{taniPct:40} },
  { ring:5, slot:1,  id:'5_1',  name:'たにまち+50%',     emoji:'💰', desc:'たにまち獲得量+50%',      cost:450,  effect:{taniPct:50} },
  { ring:5, slot:2,  id:'5_2',  name:'たにまち+60%',     emoji:'💰', desc:'たにまち獲得量+60%',      cost:600,  effect:{taniPct:60} },
  { ring:5, slot:3,  id:'5_3',  name:'たにまち+75%',     emoji:'💰', desc:'たにまち獲得量+75%',      cost:800,  effect:{taniPct:75} },
  { ring:5, slot:4,  id:'5_4',  name:'女将強化',         emoji:'👩‍🍳', desc:'たにまち毎分+2増加',      cost:300,  effect:{taniPerMin:2} },
  { ring:5, slot:5,  id:'5_5',  name:'たにまち+20%',     emoji:'💰', desc:'たにまち獲得量+20%',    cost:350,  effect:{taniPct:20} },
  { ring:5, slot:6,  id:'5_6',  name:'たにまち+25%',     emoji:'💰', desc:'たにまち獲得量+25%',    cost:450,  effect:{taniPct:25} },
  { ring:5, slot:7,  id:'5_7',  name:'たにまち+30%',     emoji:'💰', desc:'たにまち獲得量+30%',    cost:600,  effect:{taniPct:30} },
  { ring:5, slot:8,  id:'5_8',  name:'場所たにまち+30%',         emoji:'🏆', desc:'場所中のたにまち獲得+30%',    cost:500,  effect:{bashoTaniPct:30} },
  { ring:5, slot:9,  id:'5_9',  name:'懸賞+25%',         emoji:'🎀', desc:'懸賞確率+25%',            cost:250,  effect:{winChanko:25} },
  { ring:5, slot:10, id:'5_10', name:'懸賞+30%',         emoji:'🎀', desc:'懸賞確率+30%',            cost:350,  effect:{taniPct:30} },
  { ring:5, slot:11, id:'5_11', name:'場所たにまち+20%', emoji:'🏆', desc:'場所中のたにまち獲得+20%', cost:280,  effect:{bashoTaniPct:20} },
  { ring:5, slot:12, id:'5_12', name:'場所たにまち+10%',     emoji:'🏆', desc:'場所中のたにまち獲得+10%',    cost:250,  effect:{bashoTaniPct:10} },
  { ring:5, slot:13, id:'5_13', name:'力の器 −4%',             emoji:'🔨', desc:'力を+1するのに要るちゃんこ −4%',                cost:130,  effect:{heyaDiscount:2} },
  { ring:5, slot:14, id:'5_14', name:'力の器 −4%',            emoji:'🔨', desc:'力を+1するのに要るちゃんこ −4%',               cost:180,  effect:{heyaDiscount:2} },
  { ring:5, slot:15, id:'5_15', name:'体重の器 −10%',         emoji:'🔨', desc:'体重を増やすのに要るちゃんこ −10%',            cost:120,  effect:{heyaDiscount:2} },
  { ring:5, slot:16, id:'5_16', name:'おかわり', emoji:'🍲', desc:'毎場所ちゃんこ+1杯', cost:220,  effect:{chankoPlus:1} },
  { ring:5, slot:17, id:'5_17', name:'速さの器 −4%',           emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −4%',              cost:95,   effect:{heyaDiscount:2} },
  { ring:5, slot:18, id:'5_18', name:'速さの器 −4%',           emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −4%',              cost:120,  effect:{heyaDiscount:2} },
  { ring:5, slot:19, id:'5_19', name:'技の器 −4%',             emoji:'🔨', desc:'技を+1するのに要るちゃんこ −4%',                cost:95,   effect:{heyaDiscount:2} },
  { ring:5, slot:20, id:'5_20', name:'技の器 −4%',             emoji:'🔨', desc:'技を+1するのに要るちゃんこ −4%',                cost:120,  effect:{heyaDiscount:2} },
  { ring:5, slot:21, id:'5_21', name:'力・技・速さの器 −2%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −2%', cost:160,  effect:{heyaDiscount:2} },
  { ring:5, slot:22, id:'5_22', name:'懸賞+9%',       emoji:'🎀', desc:'懸賞確率+9%',       cost:110,  effect:{winChanko:9} },
  { ring:5, slot:23, id:'5_23', name:'連勝オーラ②',      emoji:'⚡', desc:'連勝ボーナス+5%/段追加',   cost:300,  effect:{rensoLv:1} },
  { ring:5, slot:24, id:'5_24', name:'決まり手師①',      emoji:'🏅', desc:'勝つたび たにまち+1',           cost:200,  effect:{kimariteLv:1} },
  { ring:5, slot:25, id:'5_25', name:'懸賞+10%',           emoji:'🎀', desc:'懸賞確率+10%',   cost:150,  effect:{taniPct:10} },
  { ring:5, slot:26, id:'5_26', name:'場所たにまち+10%', emoji:'🏆', desc:'場所中のたにまち獲得+10%',cost:180, effect:{bashoTaniPct:10} },
  { ring:5, slot:27, id:'5_27', name:'オフライン+30%',   emoji:'⏰', desc:'アプリを閉じている間の女将のたにまち+30%',   cost:280,  effect:{offlinePct:30} },
  { ring:5, slot:28, id:'5_28', name:'貫禄強化②',        emoji:'🏅', desc:'貫禄のたにまちボーナス+2%/段追加',cost:300,effect:{kanrokuBonus:2} },
  { ring:5, slot:29, id:'5_29', name:'おかわり',            emoji:'🍲', desc:'毎場所ちゃんこ+1杯',cost:120, effect:{chankoPlus:1} },

  // Ring 6 (36ノード)
  { ring:6, slot:0,  id:'6_0',  name:'たにまち+80%',     emoji:'💰', desc:'たにまち獲得量+80%',      cost:1200, effect:{taniPct:80} },
  { ring:6, slot:1,  id:'6_1',  name:'たにまち+100%',    emoji:'💰', desc:'たにまち獲得量+100%',     cost:1600, effect:{taniPct:100} },
  { ring:6, slot:2,  id:'6_2',  name:'たにまち+120%',    emoji:'💰', desc:'たにまち獲得量+120%',     cost:2200, effect:{taniPct:120} },
  { ring:6, slot:3,  id:'6_3',  name:'女将強化・壱',     emoji:'👩‍🍳', desc:'たにまち毎分+3増加',      cost:800,  effect:{taniPerMin:3} },
  { ring:6, slot:4,  id:'6_4',  name:'師匠',             emoji:'🧘', desc:'たにまち自動増加×2倍',    cost:2000, effect:{taniAutoMult:2} },
  { ring:6, slot:5,  id:'6_5',  name:'たにまち+40%',     emoji:'💰', desc:'たにまち獲得量+40%',    cost:1000, effect:{taniPct:40} },
  { ring:6, slot:6,  id:'6_6',  name:'たにまち+50%',     emoji:'💰', desc:'たにまち獲得量+50%',    cost:1400, effect:{taniPct:50} },
  { ring:6, slot:7,  id:'6_7',  name:'たにまち+60%',     emoji:'💰', desc:'たにまち獲得量+60%',    cost:2000, effect:{taniPct:60} },
  { ring:6, slot:8,  id:'6_8',  name:'たにまち+75%',     emoji:'💰', desc:'たにまち獲得量+75%',    cost:2800, effect:{taniPct:75} },
  { ring:6, slot:9,  id:'6_9',  name:'懸賞+40%',         emoji:'🎀', desc:'懸賞確率+40%',            cost:600,  effect:{winChanko:40} },
  { ring:6, slot:10, id:'6_10', name:'懸賞+50%',         emoji:'🎀', desc:'懸賞確率+50%',            cost:900,  effect:{taniPct:50} },
  { ring:6, slot:11, id:'6_11', name:'場所たにまち+30%', emoji:'🏆', desc:'場所中のたにまち獲得+30%', cost:500,  effect:{bashoTaniPct:30} },
  { ring:6, slot:12, id:'6_12', name:'場所たにまち+20%',     emoji:'🏆', desc:'場所中のたにまち獲得+20%',    cost:450,  effect:{bashoTaniPct:20} },
  { ring:6, slot:13, id:'6_13', name:'場所たにまち+30%',     emoji:'🏆', desc:'場所中のたにまち獲得+30%',    cost:700,  effect:{bashoTaniPct:30} },
  { ring:6, slot:14, id:'6_14', name:'力の器 −6%',            emoji:'🔨', desc:'力を+1するのに要るちゃんこ −6%',               cost:350,  effect:{heyaDiscount:3} },
  { ring:6, slot:15, id:'6_15', name:'力の器 −6%',            emoji:'🔨', desc:'力を+1するのに要るちゃんこ −6%',               cost:500,  effect:{heyaDiscount:3} },
  { ring:6, slot:16, id:'6_16', name:'体重の器 −10%',        emoji:'🔨', desc:'体重を増やすのに要るちゃんこ −10%',           cost:250,  effect:{heyaDiscount:3} },
  { ring:6, slot:17, id:'6_17', name:'勝負ちゃんこ',     emoji:'🍲', desc:'本場所の前に1杯。その場所の間だけ力・技・重さのどれかが+5%', cost:400,  effect:{shobuChanko:1} },
  { ring:6, slot:18, id:'6_18', name:'力・技・速さの器 −3%',emoji:'🔨',desc:'力・技・速さを+1するのに要るちゃんこ −3%', cost:350,  effect:{heyaDiscount:3} },
  { ring:6, slot:19, id:'6_19', name:'速さの器 −6%',          emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −6%',             cost:200,  effect:{heyaDiscount:3} },
  { ring:6, slot:20, id:'6_20', name:'速さの器 −6%',          emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −6%',             cost:300,  effect:{heyaDiscount:3} },
  { ring:6, slot:21, id:'6_21', name:'技の器 −6%',            emoji:'🔨', desc:'技を+1するのに要るちゃんこ −6%',               cost:200,  effect:{heyaDiscount:3} },
  { ring:6, slot:22, id:'6_22', name:'技の器 −6%',            emoji:'🔨', desc:'技を+1するのに要るちゃんこ −6%',               cost:300,  effect:{heyaDiscount:3} },
  { ring:6, slot:23, id:'6_23', name:'力・技・速さの器 −3%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −3%', cost:280,  effect:{heyaDiscount:3} },
  { ring:6, slot:24, id:'6_24', name:'力・技・速さの器 −3%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −3%', cost:400,  effect:{heyaDiscount:3} },
  { ring:6, slot:25, id:'6_25', name:'懸賞+12%',       emoji:'🎀', desc:'懸賞確率+12%',       cost:180,  effect:{winChanko:12} },
  { ring:6, slot:26, id:'6_26', name:'連勝オーラ③',      emoji:'⚡', desc:'連勝ボーナス+5%/段追加',   cost:600,  effect:{rensoLv:1} },
  { ring:6, slot:27, id:'6_27', name:'決まり手師②',      emoji:'🏅', desc:'勝つたび たにまち+1追加',        cost:400,  effect:{kimariteLv:1} },
  { ring:6, slot:28, id:'6_28', name:'決まり手師③',      emoji:'🏅', desc:'勝つたび たにまち+1追加',        cost:700,  effect:{kimariteLv:1} },
  { ring:6, slot:29, id:'6_29', name:'懸賞+20%',    emoji:'🎀', desc:'懸賞確率+20%',    cost:300,  effect:{taniPct:20} },
  { ring:6, slot:30, id:'6_30', name:'場所たにまち+15%', emoji:'🏆', desc:'場所中のたにまち獲得+15%',cost:400, effect:{bashoTaniPct:15} },
  { ring:6, slot:31, id:'6_31', name:'オフライン+50%',   emoji:'⏰', desc:'アプリを閉じている間の女将のたにまち+50%',   cost:600,  effect:{offlinePct:50} },
  { ring:6, slot:32, id:'6_32', name:'オフライン+2h',    emoji:'⏰', desc:'アプリを閉じている間の女将の上限+2時間',  cost:800,  effect:{offlineCap:2} },
  { ring:6, slot:33, id:'6_33', name:'貫禄上限+3',       emoji:'🏅', desc:'貫禄の最大値+3',          cost:600,  effect:{kanrokuCap:3} },
  { ring:6, slot:34, id:'6_34', name:'横綱之魂',         emoji:'⛩️', desc:'横綱在位中 たにまち×1.2',    cost:1500, effect:{yokozunaSoul:1} },
  { ring:6, slot:35, id:'6_35', name:'力士の誇り',       emoji:'🌸', desc:'転生ごとにたにまち+5%ボーナス',cost:1200,effect:{rikishiPride:1} },

  // Ring 7 (30ノード)
  { ring:7, slot:0,  id:'7_0',  name:'たにまち+150%',    emoji:'💰', desc:'たにまち獲得量+150%',     cost:3500, effect:{taniPct:150} },
  { ring:7, slot:1,  id:'7_1',  name:'たにまち+200%',    emoji:'💰', desc:'たにまち獲得量+200%',     cost:5000, effect:{taniPct:200} },
  { ring:7, slot:2,  id:'7_2',  name:'女将・極',         emoji:'👩‍🍳', desc:'たにまち毎分+5増加',      cost:2500, effect:{taniPerMin:5} },
  { ring:7, slot:3,  id:'7_3',  name:'たにまち+100%',    emoji:'💰', desc:'たにまち獲得量+100%',   cost:4000, effect:{taniPct:100} },
  { ring:7, slot:4,  id:'7_4',  name:'たにまち+120%',    emoji:'💰', desc:'たにまち獲得量+120%',   cost:6000, effect:{taniPct:120} },
  { ring:7, slot:5,  id:'7_5',  name:'懸賞+75%',         emoji:'🎀', desc:'懸賞確率+75%',            cost:2000, effect:{winChanko:75} },
  { ring:7, slot:6,  id:'7_6',  name:'懸賞+100%',        emoji:'🎀', desc:'懸賞確率+100%（実質2倍）', cost:3500, effect:{taniPct:100} },
  { ring:7, slot:7,  id:'7_7',  name:'場所たにまち+50%', emoji:'🏆', desc:'場所中のたにまち獲得+50%', cost:1500, effect:{bashoTaniPct:50} },
  { ring:7, slot:8,  id:'7_8',  name:'場所たにまち+50%',     emoji:'🏆', desc:'場所中のたにまち獲得+50%',    cost:1500, effect:{bashoTaniPct:50} },
  { ring:7, slot:9,  id:'7_9',  name:'力の器 −8%',            emoji:'🔨', desc:'力を+1するのに要るちゃんこ −8%',               cost:800,  effect:{heyaDiscount:3} },
  { ring:7, slot:10, id:'7_10', name:'力の器 −8%',            emoji:'🔨', desc:'力を+1するのに要るちゃんこ −8%',               cost:1200, effect:{heyaDiscount:3} },
  { ring:7, slot:11, id:'7_11', name:'体重の器 −10%',        emoji:'🔨', desc:'体重を増やすのに要るちゃんこ −10%',           cost:600,  effect:{heyaDiscount:3} },
  { ring:7, slot:12, id:'7_12', name:'勝負ちゃんこ強化', emoji:'🍲', desc:'勝負ちゃんこの効果 +5% → +10%', cost:900,  effect:{shobuChanko:1} },
  { ring:7, slot:13, id:'7_13', name:'力・技・速さの器 −5%',emoji:'🔨',desc:'力・技・速さを+1するのに要るちゃんこ −5%', cost:800,  effect:{heyaDiscount:3} },
  { ring:7, slot:14, id:'7_14', name:'速さの器 −8%',          emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −8%',             cost:500,  effect:{heyaDiscount:3} },
  { ring:7, slot:15, id:'7_15', name:'速さの器 −8%',          emoji:'🔨', desc:'速さを+1するのに要るちゃんこ −8%',             cost:800,  effect:{heyaDiscount:3} },
  { ring:7, slot:16, id:'7_16', name:'技の器 −8%',            emoji:'🔨', desc:'技を+1するのに要るちゃんこ −8%',               cost:500,  effect:{heyaDiscount:3} },
  { ring:7, slot:17, id:'7_17', name:'技の器 −8%',            emoji:'🔨', desc:'技を+1するのに要るちゃんこ −8%',               cost:800,  effect:{heyaDiscount:3} },
  { ring:7, slot:18, id:'7_18', name:'力・技・速さの器 −4%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −4%', cost:700,  effect:{heyaDiscount:3} },
  { ring:7, slot:19, id:'7_19', name:'力・技・速さの器 −5%',     emoji:'🔨', desc:'力・技・速さを+1するのに要るちゃんこ −5%', cost:1000, effect:{heyaDiscount:3} },
  { ring:7, slot:20, id:'7_20', name:'懸賞+15%',       emoji:'🎀', desc:'懸賞確率+15%',       cost:350,  effect:{winChanko:15} },
  { ring:7, slot:21, id:'7_21', name:'連勝オーラ④',      emoji:'⚡', desc:'連勝ボーナス+5%/段追加',   cost:1200, effect:{rensoLv:1} },
  { ring:7, slot:22, id:'7_22', name:'連勝オーラ⑤',      emoji:'⚡', desc:'連勝ボーナス+5%/段追加',   cost:2000, effect:{rensoLv:1} },
  { ring:7, slot:23, id:'7_23', name:'決まり手師④',      emoji:'🏅', desc:'勝つたび たにまち+1追加',        cost:1500, effect:{kimariteLv:1} },
  { ring:7, slot:24, id:'7_24', name:'決まり手師⑤',      emoji:'🏅', desc:'勝つたび たにまち+1追加',        cost:2500, effect:{kimariteLv:1} },
  { ring:7, slot:25, id:'7_25', name:'場所たにまち+20%', emoji:'🏆', desc:'場所中のたにまち獲得+20%',cost:1000,effect:{bashoTaniPct:20} },
  { ring:7, slot:26, id:'7_26', name:'貫禄強化③',        emoji:'🏅', desc:'貫禄のたにまちボーナス+3%/段追加',cost:1500,effect:{kanrokuBonus:3} },
  { ring:7, slot:27, id:'7_27', name:'神風',             emoji:'🌀', desc:'その場所で負けなし（全勝中）なら たにまち×2',  cost:5000, effect:{kamikaze:1} },
  { ring:7, slot:28, id:'7_28', name:'力士伝説',         emoji:'🌟', desc:'転生ボーナス+100たにまち',  cost:8000, effect:{rebirthBonus:100} },
  { ring:7, slot:29, id:'7_29', name:'親方・極',         emoji:'🎌', desc:'全スキル効果×1.5',         cost:10000,effect:{allMult:1.5} },
];

// ── スキルマップの枚数（1〜10枚目）────────────────────────
// 超転生（横綱で引退）すると次の枚へ。並びは同じで、枚が進むほど効果が上がり値段も上がる。
// 2枚目からは新しいスキルが少しずつ混ざる（たにまち+% のマスと入れ替わる）
const SKILL_PAGE_MAX     = 10;
const SKILL_INHERIT_MAX  = 3;    // 超転生のとき次の枚へ引き継げる数
function skillPageMult(p)     { return 1 + 0.5 * (p - 1); }    // 効果：1枚目1倍 → 10枚目5.5倍
function skillPageCostMult(p) { return Math.pow(3, p - 1); }   // 値段：枚ごとに3倍

// 枚が進むと出てくる新しいスキル（intro 枚目から、たにまち+% のマス2つと入れ替わる）
const SKILL_NEW_TYPES = [
  { key: 'kachiChanko',    intro: 2,  base: 1,  name: '勝ち越しちゃんこ', emoji: '🍲' },
  { key: 'yushoChanko',    intro: 3,  base: 3,  name: '優勝ちゃんこ',     emoji: '🏆' },
  { key: 'heyaDiscount',   intro: 4,  base: 5,  name: '部屋の大工',       emoji: '🔨' },
  { key: 'chankoPct',      intro: 5,  base: 5,  name: '大鍋',             emoji: '🥘' },
  { key: 'zenshoChanko',   intro: 6,  base: 5,  name: '全勝ちゃんこ',     emoji: '✨' },
  { key: 'isanPct',        intro: 7,  base: 10, name: '語り継がれる',     emoji: '📜' },
  { key: 'rerollDiscount', intro: 8,  base: 15, name: '顔の広い親方',     emoji: '🔭' },
  { key: 'kenshoTani',     intro: 9,  base: 20, name: '懸賞の旗',         emoji: '🎏' },
  { key: 'allStat',        intro: 10, base: 1,  name: '総合力',           emoji: '🌟' },
];
const SKILL_CAP_KEYS = new Set(['chikara', 'waza', 'hayasa', 'taijuu', 'allStat']);
// 枚が進んでも変わらない効果（倍率・あるなしだけのもの）と、整数で増える効果
const SKILL_FIXED_KEYS = new Set(['allMult', 'taniAutoMult', 'shobuChanko', 'yokozunaSoul', 'rikishiPride', 'kamikaze']);
const SKILL_INT_KEYS   = new Set(['chankoPlus', 'chikara', 'waza', 'hayasa', 'taijuu', 'allStat',
  'bowlAll', 'bowlChikara', 'bowlWaza', 'bowlHayasa', 'bowlTaijuu', 'kachiChanko', 'yushoChanko', 'zenshoChanko',
  'kimariteLv', 'offlineCap', 'kanrokuCap', 'rebirthBonus']);
function skillScaleValue(key, base, p) {
  if (SKILL_FIXED_KEYS.has(key)) return base;
  const v = base * skillPageMult(p);
  return SKILL_INT_KEYS.has(key) ? Math.max(base, Math.floor(v)) : Math.round(v * 10) / 10;
}

// 効果の名前と説明（数字の入った名前は効果から作り直す。名前に数字の無いスキルは名前をそのまま使う）
const SKILL_EMOJI = { winChanko: '🍙', achWinChanko: '🏅', taniPct: '💰' };
function skillText(key, v, def) {
  const f = x => (Number.isInteger(x) ? x : x.toFixed(1));
  const stat = { chikara: '力', waza: '技', hayasa: '速さ' };
  const bowl = { bowlAll: '力・技・速さ', bowlChikara: '力', bowlWaza: '技', bowlHayasa: '速さ' };
  if (stat[key])  return [`${stat[key]}の上限+${f(v)}`, `${stat[key]}の上限（最初は99）+${f(v)}。ちゃんこで上限まで伸ばせる`];
  if (bowl[key])  return [`${bowl[key]}の器 −${f(v)}杯`, `${bowl[key]}を+1するのに要るちゃんこ −${f(v)}杯（最低1杯）`];
  const T = {
    taniPct:      [`たにまち+${f(v)}%`,     `たにまち獲得量+${f(v)}%`],
    achTaniPct:   [null,                     `実績1つにつき たにまち+${f(v)}%`],
    winChanko:    [`勝ちちゃんこ+${f(v)}%`, `勝つと ${f(v)}% の確率でちゃんこ+1杯（合計が100%を超えた分は、もう1杯の確率）`],
    achWinChanko: [null,                     `実績1つにつき 勝ちちゃんこ+${f(v)}%`],
    taijuu:       [`体重の上限+${f(v)}kg`,  `体重の上限（最初は${TAIJUU_MAX}kg）+${f(v)}kg`],
    bowlTaijuu:   [`体重の器 −${f(v)}杯`,   `体重を1kg増やす・絞るのに要るちゃんこ −${f(v)}杯（最低1杯）`],
    chankoPlus:   [null,                     `毎場所ちゃんこ+${f(v)}杯`],
    taniPerMin:   [null,                     `たにまち毎分+${f(v)}自動増加`],
    bashoTaniPct: [`場所たにまち+${f(v)}%`, `場所中のたにまち獲得+${f(v)}%`],
    offlinePct:   [`オフライン+${f(v)}%`,   `アプリを閉じている間の女将のたにまち+${f(v)}%`],
    offlineCap:   [`オフライン+${f(v)}h`,   `アプリを閉じている間の女将の上限+${f(v)}時間`],
    rensoLv:      [null,                     `連勝中 たにまち+${f(v * 2)}%×連勝数（10連勝まで）`],
    kimariteLv:   [null,                     `勝つたび たにまち+${f(v)}`],
    kanrokuBonus: [null,                     `貫禄のたにまちボーナス+${f(v)}%/段`],
    kanrokuCap:   [`貫禄上限+${f(v)}`,      `貫禄の最大値+${f(v)}`],
    rebirthBonus: [null,                     `転生ボーナス+${f(v)}たにまち`],
    kachiChanko:  [null, `勝ち越すとちゃんこ+${f(v)}杯`],
    yushoChanko:  [null, `優勝するとちゃんこ+${f(v)}杯`],
    heyaDiscount: [`部屋の強化 −${f(v)}%`, `相撲部屋の強化に要るたにまちが${f(v)}%減る（合計で最大60%）`],
    chankoPct:    [null, `場所の後にもらうちゃんこ+${f(v)}%（端数は切り捨て）`],
    zenshoChanko: [null, `全勝するとちゃんこ+${f(v)}杯`],
    isanPct:      [null, `超転生の遺産ポイント+${f(v)}%`],
    rerollDiscount: [null, `スカウトの探し直しが${f(v)}%安くなる（合計で最大80%）`],
    kenshoTani:   [null, `懸賞が出たときのたにまち+${f(v)}%`],
    allStat:      [null, `力・技・速さの上限+${f(v)}`],
  }[key];
  return T || [null, def.desc];
}

function skillReqLabel(def, defs) {
  const nb = getNeighborKeys(def.ring, def.slot).filter(k => +k.split('_')[0] < def.ring);
  if (!nb.length) return 'なし（出発点）';
  return nb.map(k => (defs.find(x => x.id === k) || {}).name || k).join(' または ') + 'を解放';
}

// 枚 p のスキル一覧（作ったものは覚えておく）
const _skillPageCache = {};
function skillDefsForPage(p) {
  p = Math.max(1, Math.min(SKILL_PAGE_MAX, p || 1));
  if (_skillPageCache[p]) return _skillPageCache[p];
  // 新しいスキルに入れ替えるマス：2〜7周目の「たにまち+%」を決まった順に並べたもの
  const swapSlots = SKILL_DEFS_RAW.filter(d => d.ring >= 2 && d.effect.taniPct && d.emoji === '💰')
    .sort((a, b) => ((a.ring * 37 + a.slot * 11) % 23) - ((b.ring * 37 + b.slot * 11) % 23) || a.ring - b.ring || a.slot - b.slot)
    .map(d => d.id);
  const swap = {};
  SKILL_NEW_TYPES.forEach((t, i) => { if (p >= t.intro) for (const id of swapSlots.slice(i * 2, i * 2 + 2)) swap[id] = t; });

  const defs = SKILL_DEFS_RAW.map(raw => {
    const nt = swap[raw.id];
    const [key, base] = nt ? [nt.key, nt.base] : Object.entries(raw.effect)[0];
    // 能力の上限を上げるスキルは、どの枚でもどのマスでも +1
    const v = SKILL_CAP_KEYS.has(key) ? 1 : nt ? skillScaleValue(key, base, p - nt.intro + 1) : skillScaleValue(key, base, p);
    const [autoName, desc] = skillText(key, v, raw);
    const name = nt ? nt.name : (/[0-9%]/.test(raw.name) && autoName) ? autoName : raw.name;
    const emoji = nt ? nt.emoji : raw.emoji === '🎀' ? (SKILL_EMOJI[key] || raw.emoji) : raw.emoji;
    const cost = niceRound(raw.cost * skillPageCostMult(p));
    return {
      ring: raw.ring, slot: raw.slot, id: raw.id, page: p,
      name, emoji, desc, isNew: !!nt,
      effect: { [key]: v },
      maxLv: 1,
      cost: () => cost,
      req: makeReq(raw.ring, raw.slot),
    };
  });
  for (const d of defs) d.reqLabel = skillReqLabel(d, defs);
  return (_skillPageCache[p] = defs);
}

function skillPage(state) { return Math.max(1, Math.min(SKILL_PAGE_MAX, state?.tensei?.skillPage || 1)); }
// 今の枚のスキル一覧（スキルマップ・購入はこれを使う）
function currentSkillDefs(state) { return skillDefsForPage(skillPage(state)); }
// 1枚目のスキル一覧
const SKILL_DEFS = skillDefsForPage(1);

// 効いているスキル：今の枚で解放したもの＋前の枚から引き継いだもの
function activeSkillDefs(state) {
  const t  = state.tensei || {};
  const sk = t.skills || {};
  const list = currentSkillDefs(state).filter(d => sk[d.id] >= 1);
  for (const inh of t.inherited || []) {
    const d = skillDefsForPage(inh.page).find(x => x.id === inh.id);
    if (d) list.push(d);
  }
  return list;
}

// ── スキル効果集計 ────────────────────────────────────
function calcSkillEffects(state) {
  const t    = state.tensei || {};
  const defs = activeSkillDefs(state);

  // allMult: 親方・極などの全体乗数
  let allMult = 1;
  for (const d of defs) if (d.effect.allMult) allMult *= d.effect.allMult;

  const sum = (key) => {
    let v = 0;
    for (const d of defs) if (d.effect[key]) v += d.effect[key];
    return v;
  };

  // 実績スキル: 解放した実績の数に比例
  const achN           = typeof achCount === 'function' ? achCount(state) : 0;
  const taniPct        = (sum('taniPct')   + sum('achTaniPct')   * achN) * allMult;
  const taniPerMin     = sum('taniPerMin')      * allMult;
  const taniAutoMult   = (() => { let v = 1; for (const d of defs) if (d.effect.taniAutoMult) v *= d.effect.taniAutoMult; return v * allMult; })();
  const winChanko      = (sum('winChanko') + sum('achWinChanko') * achN) * allMult;   // 勝つとちゃんこ+1杯の確率（%）
  // 能力の上限が上がる分（整数。親方の倍率はかけない）
  const allStat        = sum('allStat');
  const chikara        = sum('chikara') + allStat;
  const waza           = sum('waza')    + allStat;
  const hayasa         = sum('hayasa')  + allStat;
  const taijuu         = sum('taijuu');
  const chankoPlus     = sum('chankoPlus');      // 毎場所のちゃんこ +杯
  const rensoLv        = sum('rensoLv');
  const kimariteLv     = sum('kimariteLv');
  const offlinePct     = sum('offlinePct')      * allMult;
  const offlineCap     = sum('offlineCap');
  const shobuChanko    = sum('shobuChanko');
  const bashoTaniPct   = sum('bashoTaniPct')    * allMult;
  const kanrokuBonus   = sum('kanrokuBonus')    * allMult;
  const kanrokuCap     = sum('kanrokuCap');
  const yokozunaSoul   = sum('yokozunaSoul');
  const rikishiPride   = sum('rikishiPride');
  const kamikaze       = sum('kamikaze');
  const rebirthBonus   = sum('rebirthBonus');
  // 器が減る（その能力を+1するのに要るちゃんこ −杯）。bowlAll は力・技・速さ全部。最低1杯は残る（allocCost）
  const bowlRed = {};
  for (const [k, key] of [['chikara', 'bowlChikara'], ['waza', 'bowlWaza'], ['hayasa', 'bowlHayasa'], ['taijuu', 'bowlTaijuu']]) {
    bowlRed[k] = sum(key) + (k === 'taijuu' ? 0 : sum('bowlAll'));
  }
  // 枚が進むと出てくるスキル
  const kachiChanko    = sum('kachiChanko');
  const yushoChanko    = sum('yushoChanko');
  const zenshoChanko   = sum('zenshoChanko');
  const chankoPct      = sum('chankoPct');
  const heyaDiscount   = Math.min(60, sum('heyaDiscount'));
  const rerollDiscount = Math.min(80, sum('rerollDiscount'));
  const isanPct        = sum('isanPct');
  const kenshoTani     = sum('kenshoTani');

  const kanrokuPct     = (t.kanroku || 0) * (3 + kanrokuBonus);
  const kanrokuMult    = 1 + kanrokuPct / 100;

  return {
    taniPct, taniPerMin, taniAutoMult,
    winChanko,
    chikara, waza, hayasa, taijuu,
    chankoPlus, rensoLv, kimariteLv,
    offlinePct, offlineCap,
    shobuChanko,
    bashoTaniPct,
    kanrokuBonus, kanrokuCap, kanrokuMult,
    yokozunaSoul, rikishiPride, kamikaze, rebirthBonus,
    bowlRed,
    kachiChanko, yushoChanko, zenshoChanko, chankoPct, heyaDiscount, rerollDiscount, isanPct, kenshoTani,
    allMult,
  };
}

// 能力の上限（力・技・速さは99、体重は TAIJUU_MAX。スキルで上がる）
const STAT_BASE_MAX = 99;
function statMax(state, key) {
  const fx = calcSkillEffects(state);
  return key === 'taijuu' ? TAIJUU_MAX + (fx.taijuu || 0) : STAT_BASE_MAX + (fx[key] || 0);
}

// 勝ったときのちゃんこ（勝ちちゃんこ）。100%ごとに1杯確定、残りは確率
function rollWinChanko(pct) {
  if (!(pct > 0)) return 0;
  return Math.floor(pct / 100) + (Math.random() < (pct % 100) / 100 ? 1 : 0);
}
