// 記録のための数え方（名簿の力士と自分）。記録の画面（scenes/records.js）で使う
// 名簿の力士は取組・場所の終わりごとに数え、自分は場所ごとの成績（rikishi.bashoLog）と取組の数から出す

const REC_TOP_RANKS = ['yokozuna', 'ozeki'];

// ── 1番ごと（rosterRecordBout から）────────────────────────
function recBout(winner, loser) {
  // 今場所の分（三賞・初日からの連勝。自分の分身も数える）
  if (REC_TOP_RANKS.includes(loser.rank)) winner.bTop = (winner.bTop || 0) + 1;
  // 1場所の中の連勝（幕内だけ）
  winner.bRun = (winner.bRun || 0) + 1;
  if (winner.div === 'makuuchi') winner.bRunMax = Math.max(winner.bRunMax || 0, winner.bRun);
  loser.bRun = 0;
  if (!winner.isPlayer) {
    winner.streak = (winner.streak || 0) + 1;
    winner.maxStreak = Math.max(winner.maxStreak || 0, winner.streak);
    // 幕内の連勝（幕内の取組だけで数える）
    winner.mkStreak = winner.div === 'makuuchi' ? (winner.mkStreak || 0) + 1 : 0;
    winner.maxMkStreak = Math.max(winner.maxMkStreak || 0, winner.mkStreak);
    winner.maxWinAge = Math.max(winner.maxWinAge || 0, winner.age || 0);
    if (winner.rank === 'maegashira' && loser.rank === 'yokozuna') winner.kinboshi = (winner.kinboshi || 0) + 1;
    if (winner.rank === 'maegashira' && loser.rank === 'ozeki')    winner.ginboshi = (winner.ginboshi || 0) + 1;
  }
  if (!loser.isPlayer) { loser.streak = 0; loser.mkStreak = 0; }
}

// ── 三賞（幕内の横綱・大関以外で勝ち越した力士）──────────────
// 殊勲賞：横綱・大関をいちばん多く破った／敢闘賞：平幕でいちばん勝った（10勝以上）／技能賞：10勝以上でいちばん技が高い
// 戻り値: [{ shikona, prize, isPlayer }]
function recSansho(roster) {
  const cands = roster.list.filter(r => r.div === 'makuuchi' && !REC_TOP_RANKS.includes(r.rank) && r.bw > r.bl);
  const out = [];
  const give = (list, prize) => list.forEach(r => {
    out.push({ shikona: r.shikona, prize, isPlayer: !!r.isPlayer });
    if (!r.isPlayer) r[prize] = (r[prize] || 0) + 1;
  });
  const top = Math.max(0, ...cands.map(r => r.bTop || 0));
  if (top >= 1) give(cands.filter(r => (r.bTop || 0) === top).slice(0, 2), 'shukun');
  const hira = cands.filter(r => r.rank === 'maegashira' && r.bw >= 10);
  const most = Math.max(0, ...hira.map(r => r.bw));
  if (hira.length) give(hira.filter(r => r.bw === most).slice(0, 2), 'kanto');
  const ten = cands.filter(r => r.bw >= 10);
  if (ten.length) give([ten.reduce((a, r) => (r.stats.waza > a.stats.waza ? r : a))], 'gino');
  return out;
}

// ── 場所の終わり（banzukeHensei の集計で、地位が変わる前に）────────────
function recBashoEnd(roster, r) {
  if (r.isPlayer) return;
  const mk = r.div === 'makuuchi';
  r.bashoCount = (r.bashoCount || 0) + 1;
  if (mk) { r.mkW = (r.mkW || 0) + r.bw; r.mkL = (r.mkL || 0) + r.bl; }
  // 連続勝ち越し（通算・幕内）
  r.kkRun   = r.bw > r.bl ? (r.kkRun || 0) + 1 : 0;
  r.maxKK   = Math.max(r.maxKK || 0, r.kkRun);
  r.mkKKRun = mk && r.bw > r.bl ? (r.mkKKRun || 0) + 1 : 0;
  r.maxMkKK = Math.max(r.maxMkKK || 0, r.mkKKRun);
  // 連続優勝（幕内）
  r.yushoRun    = mk && r.yushoThis ? (r.yushoRun || 0) + 1 : 0;
  r.maxYushoRun = Math.max(r.maxYushoRun || 0, r.yushoRun);
  // 1場所の中の連勝（幕内）
  if (mk) r.maxBashoRun = Math.max(r.maxBashoRun || 0, r.bRunMax || 0);
  if (!mk) r.mkStreak = 0;   // 幕内から落ちたら幕内の連勝は途切れる
  // 年間の勝ち星（6場所ごとに区切る）
  r.yearW = (r.yearW || 0) + r.bw;
  if ((roster.bashoNo || 0) % 6 === 0) {
    if (r.yearW > (r.maxYearW || 0)) { r.maxYearW = r.yearW; r.maxYearWYear = GAME_START_YEAR + (roster.bashoNo / 6) - 1; }
    r.yearW = 0;
  }
  // 最年長の関取
  if (mk || r.div === 'juryo') r.maxSekitoriAge = Math.max(r.maxSekitoriAge || 0, r.age);
  if (mk) r.maxMakuuchiAge = Math.max(r.maxMakuuchiAge || 0, r.age);
  r.bTop = 0; r.bRun = 0; r.bRunMax = 0;
}

// 新入幕・新三役・新大関・新横綱の年齢と、入門から何場所か（番付編成の後に）
// 名簿を作ったときからいる力士は入門が分からないので、新しく入った力士（entryBasho > 0）だけ
function recMilestones(roster) {
  for (const r of roster.list) {
    if (r.isPlayer || !(r.entryBasho > 0)) continue;
    const n = (roster.bashoNo || 0) - r.entryBasho;
    const mark = (key, ok) => { if (ok && !r[key]) r[key] = { age: r.age, n }; };
    mark('firstMk',  r.div === 'makuuchi');
    mark('firstSan', ['sekiwake', 'komusubi', 'ozeki', 'yokozuna'].includes(r.rank));
    mark('firstOz',  ['ozeki', 'yokozuna'].includes(r.rank));
    mark('firstYk',  r.rank === 'yokozuna');
  }
}

// 引退した力士の記録に残す項目
function recRetireFields(r) {
  const keys = ['mkW', 'mkL', 'maxStreak', 'maxMkStreak', 'maxBashoRun', 'maxMakuuchiAge', 'maxWinAge', 'kinboshi', 'ginboshi', 'shukun', 'kanto', 'gino', 'bashoCount',
                'maxKK', 'maxMkKK', 'maxYushoRun', 'maxOpen', 'maxYearW', 'maxYearWYear', 'maxSekitoriAge', 'firstMk', 'firstSan', 'firstOz', 'firstYk'];
  return Object.fromEntries(keys.filter(k => r[k] != null).map(k => [k, r[k]]));
}

// ── 自分の記録（場所ごとの成績から）────────────────────────
function playerRecordStats(r) {
  const log = r.bashoLog || [];
  const run = (ok) => { let best = 0, cur = 0; for (const x of log) { cur = ok(x) ? cur + 1 : 0; best = Math.max(best, cur); } return best; };
  const first = (ok) => { const i = log.findIndex(ok); return i < 0 ? null : { age: log[i].age, n: i }; };
  const years = {};
  // 年間の勝ち星は、6場所そろった年だけ（年の途中は数えない）
  const yearN = {};
  for (const x of log) { const y = x.label.split(' ')[0]; years[y] = (years[y] || 0) + x.w; yearN[y] = (yearN[y] || 0) + 1; }
  for (const y of Object.keys(years)) if (yearN[y] < 6) delete years[y];
  const sum = (ok, f) => log.filter(ok).reduce((a, x) => a + f(x), 0);
  const prize = p => log.filter(x => (x.sansho || []).includes(p)).length;
  return {
    mkW: sum(x => x.rankId >= 5, x => x.w), mkL: sum(x => x.rankId >= 5, x => x.l),
    maxStreak: r.maxStreak || 0, maxMkStreak: r.maxMkStreak || 0, maxWinAge: r.maxWinAge || 0, kinboshi: r.kinboshi || 0, ginboshi: r.ginboshi || 0,
    shukun: prize('殊勲賞'), kanto: prize('敢闘賞'), gino: prize('技能賞'),
    bashoCount: log.length,
    maxKK: run(x => x.w > x.l), maxMkKK: run(x => x.rankId >= 5 && x.w > x.l), maxYushoRun: run(x => x.yusho === '幕内'),
    maxBashoRun: Math.max(0, ...log.filter(x => x.rankId >= 5).map(x => x.run ?? 0)),
    maxMakuuchiAge: Math.max(0, ...log.filter(x => x.rankId >= 5).map(x => x.age)),
    maxYearW: Math.max(0, ...Object.values(years)),
    maxYearWYear: (() => { const m = Math.max(0, ...Object.values(years)); const y = Object.keys(years).find(k => years[k] === m); return y ? parseInt(y, 10) : null; })(),
    maxSekitoriAge: Math.max(0, ...log.filter(x => x.rankId >= 4).map(x => x.age)),
    firstMk: first(x => x.rankId >= 5), firstSan: first(x => x.rankId >= 6), firstOz: first(x => x.rankId >= 8), firstYk: first(x => x.rankId >= 9),
  };
}
