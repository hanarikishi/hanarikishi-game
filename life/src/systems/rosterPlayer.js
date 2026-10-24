// プレイヤーの名簿参加（幕下入り・名簿の力士との取組・名簿からの離脱）
// 名簿にはプレイヤーの「分身」（isPlayer: true）を置き、能力などは rikishi から同期する

function rosterPlayerEntry(roster) {
  return roster?.list.find(r => r.isPlayer) || null;
}

function rosterSyncPlayer(state) {
  const p = rosterPlayerEntry(state.roster);
  if (!p) return null;
  const r = state.rikishi;
  Object.assign(p, {
    shikona: r.shikona, age: r.age, growthType: r.growthType,
    bodyTypeKey: r.bodyTypeKey, style: r.style, stats: { ...r.stats }, fatigue: r.fatigue,
  });
  return p;
}

// 名簿の地位を「並び順」から付け直す（横綱〜小結はそのまま、以降は定員で区切る）
function rosterRerankByIndex(roster) {
  const named = ['yokozuna', 'ozeki', 'sekiwake', 'komusubi'];
  const sekitoriLine = ROSTER_DIV_SIZE.makuuchi + ROSTER_DIV_SIZE.juryo;
  roster.list.forEach((r, i) => {
    if (named.includes(r.rank) && i < ROSTER_DIV_SIZE.makuuchi) return;
    r.rank = i < ROSTER_DIV_SIZE.makuuchi ? 'maegashira' : i < sekitoriLine ? 'juryo' : 'makushita';
  });
  rosterAssignTitles(roster);
}

// プレイヤーの番付表示を名簿に合わせる
function rosterApplyToPlayer(state) {
  const p = rosterPlayerEntry(state.roster);
  const r = state.rikishi;
  if (p) { r.banzukeRank = p.banzukeRank; r.rosterTitle = p.title; }
  else   { r.rosterTitle = null; }
}

// 名簿に入る。rank: 地位キー、offset: その地位の中で何人目に入るか（0始まり）
function rosterInsertPlayer(state, rank, offset) {
  const roster = state.roster;
  if (rosterPlayerEntry(roster)) return;
  const order = ROSTER_RANK_ORDER.indexOf(rank);
  let start = roster.list.findIndex(x => ROSTER_RANK_ORDER.indexOf(x.rank) >= order);
  if (start < 0) start = roster.list.length;
  let idx = start + offset;
  if (['yokozuna', 'ozeki', 'sekiwake', 'komusubi'].includes(rank)) {
    const end = roster.list.findIndex(x => ROSTER_RANK_ORDER.indexOf(x.rank) > order);
    idx = end < 0 ? roster.list.length : end;      // 地位の最後尾（張出）
  }
  // 最下位の NPC を名簿から外して控えに回す（総数190を保つ）
  const out = roster.list.pop();
  roster.reserve = roster.reserve || [];
  roster.reserve.push({ shikona: out.shikona, gen: out.gen || 1 });

  const p = { isPlayer: true, gen: 1, rank, record: null, entryBasho: roster.bashoNo || 0 };
  roster.list.splice(Math.min(idx, roster.list.length), 0, p);
  rosterSyncPlayer(state);
  rosterRerankByIndex(roster);
  rosterApplyToPlayer(state);
}

// 三段目で勝ち越して幕下へ：60枚目 −（勝ち − 負け）× 6 枚（全勝で15枚目付近）
function rosterJoinFromSandanme(state, wins, losses) {
  const num = Math.max(15, Math.min(60, 60 - (wins - losses) * 6));
  rosterInsertPlayer(state, 'makushita', (num - 1) * 2 + 1);   // 西の num 枚目
}

// 既存セーブで幕下以上にいるプレイヤーを名簿に入れる
function rosterJoinExisting(state) {
  const map = { 9: ['yokozuna', 0], 8: ['ozeki', 0], 7: ['sekiwake', 0], 6: ['komusubi', 0],
                5: ['maegashira', 15], 4: ['juryo', 13], 3: ['makushita', 59] };
  const [rank, offset] = map[state.rikishi.banzukeRank] || map[3];
  rosterInsertPlayer(state, rank, offset);
}

// 名簿から抜ける（引退・転生）。控えの四股名で新人を入れる
function rosterRemovePlayer(state) {
  const roster = state.roster;
  const p = rosterPlayerEntry(roster);
  if (!p) return;
  roster.list.splice(roster.list.indexOf(p), 1);
  const res = (roster.reserve || []).shift() || { shikona: rosterMakeNames(1)[0], gen: 0 };
  roster.list.push(henseiNewcomer(roster, res));
  rosterRerankByIndex(roster);
  rosterApplyToPlayer(state);
}

// ── 本場所の進行 ───────────────────────────────
function rosterEnsureStarted(roster) {
  if (roster.list.some(r => r.bw == null)) rosterStartBasho(roster);
}

function rosterDayOfBout(player, boutNo) {
  return player.div === 'makushita' ? ROSTER_MAKUSHITA_DAYS[boutNo - 1] : boutNo;
}

// プレイヤーの boutNo 番目の相手を決める（その日までの NPC 取組も進める）
function rosterGetPlayerOpponent(state, boutNo) {
  const roster = state.roster;
  const p = rosterSyncPlayer(state);
  if (!p) return null;
  rosterEnsureStarted(roster);
  const day = rosterDayOfBout(p, boutNo);

  // 同じ日の相手がすでに決まっていればそれを使う（再読み込み対策）
  if (roster.pendingOpp && roster.pendingOpp.day === day) {
    const o = roster.list.find(x => x.shikona === roster.pendingOpp.shikona && !x.isPlayer);
    if (o) return o;
  }

  for (let d = (roster.day || 0) + 1; d < day; d++) rosterSimDay(roster, d);
  const pairs = rosterPairsForDay(roster, day);
  let opp = null;
  for (const [a, b] of pairs) {
    if (a.isPlayer) { opp = b; continue; }
    if (b.isPlayer) { opp = a; continue; }
    if (Math.random() < rosterWinProb(a, b)) rosterRecordBout(a, b);
    else                                     rosterRecordBout(b, a);
  }
  roster.day = day;
  // 組めなかった場合（ありえないが念のため）は同じ階級の誰か
  if (!opp) opp = roster.list.find(x => !x.isPlayer && x.div === p.div);
  roster.pendingOpp = { day, shikona: opp.shikona };
  return opp;
}

function rosterRecordPlayerBout(state, win) {
  const roster = state.roster;
  const p = rosterPlayerEntry(roster);
  if (!p || !roster.pendingOpp) return;
  const o = roster.list.find(x => x.shikona === roster.pendingOpp.shikona && !x.isPlayer);
  if (o) {
    if (win) rosterRecordBout(p, o); else rosterRecordBout(o, p);
    rosterRecordHeadToHead(state, o, win);
  }
  roster.pendingOpp = null;
}

// 場所の残りの日を進める
function rosterFinishDays(roster) {
  rosterEnsureStarted(roster);
  for (let d = (roster.day || 0) + 1; d <= 15; d++) rosterSimDay(roster, d);
}

// プレイヤーが優勝争いの同点に並んでいれば、決定戦の相手（四股名）を返す
function rosterPlayoffOpponents(roster) {
  const p = rosterPlayerEntry(roster);
  if (!p) return [];
  const members = roster.list.filter(r => r.div === p.div);
  const best = Math.max(...members.map(r => r.bw));
  if (p.bw !== best) return [];
  const opps = members.filter(r => !r.isPlayer && r.bw === best).map(r => r.shikona);
  // 幕下は1番勝負：同点のNPCからランダムに1人
  if (p.div === 'makushita' && opps.length > 1) return [opps[Math.floor(Math.random() * opps.length)]];
  return opps;
}
