// 名簿の本場所：取組編成・NPC同士の取組・優勝決定・成長
// 1日ずつ進める作り（プレイヤー参加時は rosterSimDay の前にプレイヤーの取組を差し込む）

// ── 強さと勝敗 ─────────────────────────────────
function rosterStrength(r) {
  const s = r.stats;
  const base = s.chikara * 0.4 + s.waza * 0.3 + s.hayasa * 0.3;
  const body = 1 + (taijuuEffMass(s.taijuu) - 150) / 800;
  const fat  = 1 - (r.fatigue || 0) / 200;
  return base * body * fat;
}

function rosterWinProb(a, b) {
  return 1 / (1 + Math.exp(-(rosterStrength(a) - rosterStrength(b)) / 8));
}

// ── 場所の開始 ─────────────────────────────────
function rosterStartBasho(roster) {
  for (const r of roster.list) {
    r.bw = 0; r.bl = 0;           // 今場所の勝敗
    r.faced = [];                 // 今場所の対戦相手（shikona）
    r.lastResult = null;
  }
  roster.day = 0;
}

// ── 取組編成 ─────────────────────────────────
// 並べた順に、まだ当たっていない一番近い相手と組む
function rosterPairGreedy(order) {
  const pairs = [], used = new Set();
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    if (used.has(a)) continue;
    let partner = null;
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j];
      if (!used.has(b) && !a.faced.includes(b.shikona)) { partner = b; break; }
    }
    if (!partner) {   // 全員と当たり済みなら一番近い相手と再戦
      for (let j = i + 1; j < order.length; j++) if (!used.has(order[j])) { partner = order[j]; break; }
    }
    if (!partner) continue;
    used.add(a); used.add(partner);
    pairs.push([a, partner]);
  }
  return pairs;
}

const ROSTER_MAKUSHITA_DAYS = [1, 3, 5, 7, 9, 11, 13];   // 幕下の取組日（7番）

// ── 幕内・十両の割（実際の取組編成に寄せる）──────────────
// ・上位陣（横綱・大関・関脇・小結・前頭四枚目まで）は上位陣どうしで当たる
// ・横綱・大関どうしは後半に回す（大関どうし8日目〜、横綱がからむのは11日目〜、13日目〜はむしろ組む）
// ・序盤(1〜5日目)は番付の近さ、中盤(6〜10)は星の近さも、終盤(11〜15)は星を重く見る
// ・終盤、優勝争いの平幕は横綱・大関に当てる（割崩し）
// ・12〜14日目、幕尻の負け越しそうな力士と十両上位の勝ち越した力士を当てる（入れ替え戦）
const ROSTER_UPPER_MAE = 4;

function rosterIsTop(r)   { return r.rank === 'yokozuna' || r.rank === 'ozeki'; }
function rosterIsUpper(r) {
  return r.div === 'makuuchi' && (r.rank !== 'maegashira' || r.num <= ROSTER_UPPER_MAE);
}

// a と b を組む「まずさ」。小さいほど組みやすい
function rosterPairCost(a, b, day, leaderBw) {
  if (a.faced.includes(b.shikona)) return 1000;
  const rankGap = Math.abs(a.pos - b.pos) / 2;   // ≒ 枚数の差
  const recGap  = Math.abs(a.bw - b.bw);
  const [rankW, recW] = day <= 5 ? [1, 0] : day <= 10 ? [0.5, 3] : [0.2, 6];
  const jitter = Math.random() * 1.5;

  if (a.div === 'makuuchi') {
    const ua = rosterIsUpper(a), ub = rosterIsUpper(b);
    const ta = rosterIsTop(a),   tb = rosterIsTop(b);
    if (ta && tb) {
      const okDay = a.rank === 'ozeki' && b.rank === 'ozeki' ? 8 : 11;
      if (day < okDay) return 500;
      return day >= 13 ? -50 + jitter : (15 - day) * 3 + jitter;
    }
    if (ua && ub) return (ta || tb ? -20 : 0) + rankGap * 0.5 + recGap * recW + jitter;
    if (ua !== ub) {
      // 割崩し：終盤、優勝を争う平幕を横綱・大関に当てる
      const low = ua ? b : a;
      if ((ta || tb) && day >= 11 && low.bw >= leaderBw - 1) return -60 + jitter;
      return 200 + rankGap;
    }
  }
  return rankGap * rankW + recGap * recW + jitter;
}

// 番付の上から順に、いちばん組みやすい相手を選ぶ
function rosterPairByCost(members, day) {
  const leaderBw = Math.max(...members.map(r => r.bw));
  const order = [...members].sort((a, b) => a.pos - b.pos);
  const pairs = [], used = new Set();
  for (const a of order) {
    if (used.has(a)) continue;
    let best = null, bestCost = Infinity;
    for (const b of order) {
      if (b === a || used.has(b)) continue;
      const c = rosterPairCost(a, b, day, leaderBw);
      if (c < bestCost) { best = b; bestCost = c; }
    }
    if (!best) continue;
    used.add(a); used.add(best);
    pairs.push([a, best]);
  }
  // 最後に余って再戦になった組は、ほかの組と相手を入れ替えて直す
  const faced = (x, y) => x.faced.includes(y.shikona);
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    if (!faced(a, b)) continue;
    for (let j = pairs.length - 1; j >= 0; j--) {
      if (j === i) continue;
      const [c, d] = pairs[j];
      if (!faced(a, c) && !faced(b, d)) { pairs[i] = [a, c]; pairs[j] = [b, d]; break; }
      if (!faced(a, d) && !faced(b, c)) { pairs[i] = [a, d]; pairs[j] = [c, b]; break; }
    }
  }
  return pairs;
}

// 入れ替え戦（12〜14日目）：幕尻の負けが込んだ力士 × 十両上位の勝ち越した力士を2組
function rosterCrossPairs(maku, juryo, day) {
  if (day < 12 || day > 14) return [];
  const down = maku.filter(r => r.rank === 'maegashira' && r.bl >= r.bw)
    .sort((a, b) => b.pos - a.pos).slice(0, 4);
  const up = juryo.filter(r => r.bw > r.bl)
    .sort((a, b) => a.pos - b.pos).slice(0, 4);
  const pairs = [];
  for (const a of down) {
    if (pairs.length >= 2) break;
    const b = up.find(x => !pairs.some(p => p[1] === x) && !a.faced.includes(x.shikona));
    if (b) pairs.push([a, b]);
  }
  return pairs.length === 2 ? pairs : [];   // 両方の人数を偶数に保つため2組そろったときだけ
}

function rosterPairsForDay(roster, day) {
  const pairs = [];
  let maku  = roster.list.filter(r => r.div === 'makuuchi');
  let juryo = roster.list.filter(r => r.div === 'juryo');
  const cross = rosterCrossPairs(maku, juryo, day);
  const inCross = new Set(cross.flat());
  maku  = maku.filter(r => !inCross.has(r));
  juryo = juryo.filter(r => !inCross.has(r));
  pairs.push(...cross, ...rosterPairByCost(maku, day), ...rosterPairByCost(juryo, day));
  if (ROSTER_MAKUSHITA_DAYS.includes(day)) {
    const members = roster.list.filter(r => r.div === 'makushita');
    // 同じ成績どうし（スイス式）
    const order = [...members].sort((a, b) => (b.bw - a.bw) || (a.pos - b.pos));
    pairs.push(...rosterPairGreedy(order));
  }
  return pairs;
}

function rosterRecordBout(winner, loser) {
  winner.bw++; loser.bl++;
  winner.faced.push(loser.shikona);
  loser.faced.push(winner.shikona);
  recBout(winner, loser);   // 記録（連勝・金星・三賞のもと など）
}

// 1日分の NPC 同士の取組
function rosterSimDay(roster, day) {
  for (const [a, b] of rosterPairsForDay(roster, day)) {
    if (a.isPlayer || b.isPlayer) continue;   // プレイヤーの取組は別処理（第3段階）
    if (Math.random() < rosterWinProb(a, b)) rosterRecordBout(a, b);
    else                                     rosterRecordBout(b, a);
  }
  roster.day = day;
}

// ── 優勝 ──────────────────────────────────────
// forced: { 階級: 四股名 } 決定戦の結果で優勝者が決まっている場合
function rosterDecideChampions(roster, forced = {}) {
  const champs = {};
  for (const div of ['makuuchi', 'juryo', 'makushita']) {
    const members = roster.list.filter(r => r.div === div);
    const best = Math.max(...members.map(r => r.bw));
    let cands = members.filter(r => r.bw === best);
    const playoff = cands.length > 1;
    if (forced[div]) cands = cands.filter(r => r.shikona === forced[div]).slice(0, 1);
    // 優勝決定戦：勝ち抜き
    while (cands.length > 1) {
      const [a, b] = cands;
      const w = Math.random() < rosterWinProb(a, b) ? a : b;
      cands = [w, ...cands.slice(2)];
    }
    const c = cands[0];
    c.yushoThis = true;
    // 優勝の回数（記録のランキング用。自分の分は bout.js で数える）
    if (!c.isPlayer) {
      const k = { makuuchi: 'mkYusho', juryo: 'jrYusho', makushita: 'msYusho' }[div];
      c[k] = (c[k] || 0) + 1;
      if (div === 'makuuchi' && c.bl === 0) c.mkZensho = (c.mkZensho || 0) + 1;
    }
    if (div === 'makuuchi') {
      // 歴代の幕内優勝（ずっと残す）
      roster.makuuchiHistory = roster.makuuchiHistory || [];
      roster.makuuchiHistory.push({ bashoNo: roster.bashoNo, shikona: rosterDisplayName(c), title: c.title,
                                    w: c.bw, l: c.bl, playoff, isPlayer: !!c.isPlayer, look: c.look || null,
                                    age: c.age ?? null });
    }
    champs[div] = { shikona: rosterDisplayName(c), w: c.bw, l: c.bl, playoff, isPlayer: !!c.isPlayer };
  }
  roster.champions = roster.champions || [];
  roster.champions.push({ bashoNo: roster.bashoNo, ...Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, v.shikona])) });
  if (roster.champions.length > 120) roster.champions.shift();
  return champs;
}

// ── NPC の成長（場所ごと）────────────────────────
function rosterGrowNPC(r) {
  if (r.isPlayer) return;
  const mult = getAgePhase(r).keikoMult;
  const s    = r.stats;
  const lv   = (s.chikara + s.waza + s.hayasa) / 3;
  const room = Math.max(0, (r.peak || 60) - lv);
  for (const k of ['chikara', 'waza', 'hayasa']) {
    const g = room * 0.05 * mult + (Math.random() < 0.3 ? 1 : 0) * (room > 0 ? 1 : 0);
    s[k] = Math.max(1, Math.min(99, Math.round(s[k] + g)));
  }
  if (getAgePhase(r).phase === 'growth') s.taijuu = Math.min(TAIJUU_MAX, Math.round((s.taijuu + Math.random() * 1.5) * 10) / 10);
}

// ── 1場所まるごと（プレイヤー不参加時）─────────────────
// 戻り値: { champions, retired: [...] }
function rosterRunBasho(roster, { yearEnd } = {}) {
  rosterStartBasho(roster);
  for (let day = 1; day <= 15; day++) rosterSimDay(roster, day);
  return rosterEndBasho(roster, { yearEnd });
}

// ── 相撲界の水準（強い世代・弱い世代）─────────────────
// worldLevel は 0.85〜1.15 をゆっくり動く。10〜20場所ごとに目標を選び直し、毎場所その1割ずつ近づく
// 新人の伸びしろと、序ノ口〜三段目の相手の強さにかかる
const WORLD_MIN = 0.85, WORLD_MAX = 1.15;

function rosterWorldLevel(roster) {
  return roster?.worldLevel || 1;
}

function rosterUpdateWorld(roster) {
  if (roster.worldLevel == null) roster.worldLevel = 1;
  if (roster.worldTarget == null || roster.bashoNo >= (roster.worldUntil || 0)) {
    roster.worldTarget = WORLD_MIN + Math.random() * (WORLD_MAX - WORLD_MIN);
    roster.worldUntil  = roster.bashoNo + 10 + Math.floor(Math.random() * 11);
  }
  roster.worldLevel += (roster.worldTarget - roster.worldLevel) * 0.1;
}

// 表示用の世代名
function worldEraName(w) {
  return w >= 1.05 ? '強い世代' : w <= 0.95 ? '弱い世代' : '並の世代';
}

function rosterEndBasho(roster, { yearEnd, forced } = {}) {
  roster.bashoNo = (roster.bashoNo || 0) + 1;
  rosterUpdateWorld(roster);
  const champions = rosterDecideChampions(roster, forced);
  const sansho = recSansho(roster);
  for (const r of roster.list) rosterGrowNPC(r);
  if (yearEnd) for (const r of roster.list) if (!r.isPlayer) applyYearlyAging(r);
  const retired = banzukeHensei(roster);
  for (const r of roster.list) { delete r.bw; delete r.bl; r.faced = []; }
  roster.day = 0;
  roster.pendingOpp = null;
  return { champions, retired, sansho };
}
