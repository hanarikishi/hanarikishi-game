// 番付編成（毎場所終了時）
// 設計: docs/superpowers/specs/2026-10-11-roster-banzuke-design.md 3章
// 前提: 各力士に今場所の bw / bl（勝・敗）、yushoThis（優勝）が入っている

// 半枚単位の移動量（正 = 上昇）
function henseiMoveHalf(r) {
  const diff = r.bw - r.bl;
  if (r.div !== 'makushita') return diff * 2;            // 幕内・十両：1勝1枚
  const k = r.num <= 15 ? 2 : r.num <= 30 ? 4 : 6;         // 幕下：位置で倍率
  return diff * k * 2;
}

// 引退判定
function henseiShouldRetire(r) {
  if (r.isPlayer) return false;
  const makekoshi = r.bw < r.bl;
  if (r.age >= 45) return true;
  if (r.rank === 'yokozuna') return makekoshi;   // 横綱は負け越したら引退
  if (r.div === 'makushita' && r.age >= 35 && makekoshi) return true;
  if (getAgePhase(r).phase === 'decline' && makekoshi) {
    const gt = GROWTH_TYPES[r.growthType] || GROWTH_TYPES.futsuu;
    const years = r.age - gt.plateauEnd;
    return Math.random() < Math.min(0.8, 0.15 + 0.1 * years);
  }
  return false;
}

function henseiRecordRetire(roster, r) {
  roster.shikonaHistory = roster.shikonaHistory || {};
  const h = roster.shikonaHistory[r.shikona] = roster.shikonaHistory[r.shikona] || [];
  h.push({ gen: r.gen, maxRank: r.maxRankTitle || r.title, w: r.careerW || 0, l: r.careerL || 0,
           yusho: r.careerYusho || 0, mkYusho: r.mkYusho || 0, jrYusho: r.jrYusho || 0, msYusho: r.msYusho || 0,
           mkZensho: r.mkZensho || 0, ykBasho: r.ykBasho || 0, ozBasho: r.ozBasho || 0, sanBasho: r.sanBasho || 0,
           mkBasho: r.mkBasho || 0, maxRankId: r.maxRankId, ...recRetireFields(r),
           look: r.look || null, retireAge: r.age, bashoNo: roster.bashoNo });
}

// 襲名：同じ四股名の新人
function henseiNewcomer(roster, old) {
  const age = 18 + Math.floor(Math.random() * 5);
  const n = rosterCreateRikishi(old.shikona, (old.gen || 1) + 1, 14 + Math.random() * 6, age);
  n.entryBasho = roster.bashoNo;
  // 伸びしろはそのときの相撲界の水準で変わる（強い世代には強い新人が入る）
  n.peak = Math.max(38, Math.min(99, Math.round(n.peak * rosterWorldLevel(roster))));
  return n;
}

function banzukeHensei(roster) {
  const list = roster.list;

  // ── 0. 今場所の集計（通算・優勝・直近3場所・カド番 等の前処理）
  for (const r of list) {
    r.record = { w: r.bw, l: r.bl };
    r.careerW = (r.careerW || 0) + r.bw;
    r.careerL = (r.careerL || 0) + r.bl;
    if (r.yushoThis) r.careerYusho = (r.careerYusho || 0) + 1;
    r.last3 = [...(r.last3 || []), { rank: r.rank, w: r.bw }].slice(-3);
    if (r.rank === 'yokozuna') r.ykMakekoshi = r.bw < r.bl ? (r.ykMakekoshi || 0) + 1 : 0;
    recBashoEnd(roster, r);   // 記録（連続勝ち越し・年間の勝ち星など）
    if (!r.isPlayer) {   // 在位の場所数（記録用）
      if (r.rank === 'yokozuna') r.ykBasho = (r.ykBasho || 0) + 1;
      if (r.rank === 'ozeki')    r.ozBasho = (r.ozBasho || 0) + 1;
      if (r.rank === 'sekiwake' || r.rank === 'komusubi') r.sanBasho = (r.sanBasho || 0) + 1;
      if (r.div === 'makuuchi')  r.mkBasho = (r.mkBasho || 0) + 1;
    }
    r.ozekiYushoStreak = (r.rank === 'ozeki' && r.yushoThis) ? (r.ozekiYushoStreak || 0) + 1 : 0;
  }

  // ── 1. 引退
  const retired = [];
  const stay = [];
  for (const r of list) {
    if (henseiShouldRetire(r)) { retired.push(r); henseiRecordRetire(roster, r); }
    else stay.push(r);
  }

  const kachikoshi = r => r.bw > r.bl;
  const yokozuna = [], ozeki = [], sekiwake = [], komusubi = [], rest = [];

  for (const r of stay) {
    const wasReturnable = r.ozekiReturn;
    r.ozekiReturn = false;

    if (r.rank === 'yokozuna') { yokozuna.push(r); continue; }

    if (r.rank === 'ozeki') {
      if ((r.ozekiYushoStreak || 0) >= 2) { yokozuna.push(r); r.kadoban = false; continue; }  // 横綱昇進
      if (r.bw < r.bl) {
        if (r.kadoban) {           // カド番で負け越し → 関脇へ陥落
          r.kadoban = false; r.ozekiReturn = true;
          sekiwake.push(r); continue;
        }
        r.kadoban = true;
      } else {
        r.kadoban = false;
      }
      ozeki.push(r); continue;
    }

    // 陥落直後の関脇が10勝 → 大関復帰
    if (wasReturnable && r.rank === 'sekiwake' && r.bw >= 10) { ozeki.push(r); continue; }

    // 大関昇進：三役で直近3場所33勝以上・直近10勝以上
    if (['sekiwake', 'komusubi'].includes(r.rank) && r.last3.length === 3
        && r.last3.every(x => ['sekiwake', 'komusubi'].includes(x.rank))
        && r.last3.reduce((a, x) => a + x.w, 0) >= 33 && r.bw >= 10) {
      ozeki.push(r); continue;
    }

    // 勝ち越した三役は残留（小結は関脇の空き次第で昇格、後で処理）
    if (r.rank === 'sekiwake' && kachikoshi(r)) { sekiwake.push(r); continue; }
    if (r.rank === 'komusubi' && kachikoshi(r)) { komusubi.push(r); continue; }

    rest.push(r);
  }

  // 小結で勝ち越し → 関脇に空きがあれば昇格
  komusubi.sort((a, b) => (b.bw - a.bw) || (a.pos - b.pos));
  while (sekiwake.length < 2 && komusubi.length) sekiwake.push(komusubi.shift());

  // ── 2. それ以外は目標位置で並べ替え
  // pos は1人＝半枚なので、半枚単位の移動量をそのまま引く
  for (const r of rest) r.target = r.pos - henseiMoveHalf(r);
  rest.sort((a, b) => (a.target - b.target) || (b.bw - a.bw) || (a.pos - b.pos));

  // プレイヤーが幕下六十枚目より下に落ちる → 名簿から外れて三段目へ（空いた枠は控えの新人）
  const pl = rest.find(r => r.isPlayer);
  if (pl && pl.target > ROSTER_TOTAL - 1) {
    rest.splice(rest.indexOf(pl), 1);
    const res = (roster.reserve || []).shift() || { shikona: rosterMakeNames(1)[0], gen: 0 };
    retired.push({ isPlaceholder: true, shikona: res.shikona, gen: res.gen });
  }

  // 三役の空き枠を埋める（並べ替え上位から）
  while (sekiwake.length < 2 && rest.length) sekiwake.push(rest.shift());
  while (komusubi.length < 2 && rest.length) komusubi.push(rest.shift());

  // 優勝した人が先（優勝して横綱・大関になったら東）
  const byPos = arr => arr.sort((a, b) => (!!b.yushoThis - !!a.yushoThis) || (b.bw - a.bw) || (a.pos - b.pos));
  [yokozuna, ozeki, sekiwake, komusubi].forEach(byPos);

  // ── 3. 並べて地位を付け直す
  const named = [...yokozuna, ...ozeki, ...sekiwake, ...komusubi];
  const order = [...named, ...rest];

  // 幕下→十両の優先昇進（幕下15枚目以内の全勝／東幕下筆頭の勝ち越し）
  const sekitoriLine = ROSTER_DIV_SIZE.makuuchi + ROSTER_DIV_SIZE.juryo;
  const forced = order.filter(r => r.div === 'makushita' &&
    ((r.num <= 15 && r.bl === 0 && r.bw === 7) || (r.num === 1 && r.side === '東' && kachikoshi(r))));
  for (const r of forced) {
    const idx = order.indexOf(r);
    if (idx >= sekitoriLine) { order.splice(idx, 1); order.splice(sekitoriLine - 1, 0, r); }
  }

  // 襲名の新人を幕下最下位へ
  for (const old of retired) order.push(henseiNewcomer(roster, old));

  const namedCount = named.length;
  order.forEach((r, i) => {
    if (i < namedCount) {
      r.rank = yokozuna.includes(r) ? 'yokozuna' : ozeki.includes(r) ? 'ozeki'
             : sekiwake.includes(r) ? 'sekiwake' : 'komusubi';
    } else if (i < ROSTER_DIV_SIZE.makuuchi) r.rank = 'maegashira';
    else if (i < sekitoriLine)              r.rank = 'juryo';
    else                                    r.rank = 'makushita';
    r.yushoThis = false;
    delete r.target;
  });

  roster.list = order.slice(0, ROSTER_TOTAL);
  rosterAssignTitles(roster);
  for (const r of roster.list) {
    if (r.maxRankId == null || r.banzukeRank > r.maxRankId) { r.maxRankId = r.banzukeRank; r.maxRankTitle = r.title; }
  }
  recMilestones(roster);
  return retired.filter(r => !r.isPlaceholder).map(r => ({ shikona: rosterDisplayName(r), age: r.age, title: r.title }));
}
