// 人間関係（同期・ライバル・注目の若手）と記録（対戦成績・自分の歴代）

function rosterKey(r) { return `${r.shikona}#${r.gen || 1}`; }

function rosterFindByKey(roster, key) {
  return roster?.list.find(r => !r.isPlayer && rosterKey(r) === key) || null;
}

// 入門時（新規作成・転生）：幕下下位の若手から同期を選び、潜在能力が一番高い1人をライバルに
function rosterOnNewLife(state) {
  const roster = state.roster;
  if (!roster) return;
  const young = roster.list
    .filter(r => !r.isPlayer && r.div === 'makushita')
    .sort((a, b) => (a.age - b.age) || (b.pos - a.pos));
  const doki = young.slice(0, 5);
  const rival = doki.reduce((best, r) => (!best || (r.peak || 0) > (best.peak || 0)) ? r : best, null);
  state.relations = {
    lifeNo:     (state.rebirthCount || 0) + (state.superRebirthCount || 0) + 1,
    startBasho: roster.bashoNo || 0,
    doki:       doki.map(rosterKey),
    rival:      rival ? rosterKey(rival) : null,
  };
}

// 注目の若手：自分より後に入門した24歳以下のうち、番付が上の3人
function rosterRisingStars(state) {
  const rel = state.relations, roster = state.roster;
  if (!rel || !roster) return [];
  return roster.list
    .filter(r => !r.isPlayer && (r.entryBasho || 0) > rel.startBasho && r.age <= 24
                 && !rel.doki.includes(rosterKey(r)))
    .slice(0, 3);
}

// 番付表・取組画面用のタグ
function rosterTagsOf(state, r) {
  const rel = state.relations;
  if (!rel || r.isPlayer) return [];
  const k = rosterKey(r), tags = [];
  if (rel.rival === k)         tags.push({ cls: 'rival',  label: 'ライバル' });
  else if (rel.doki.includes(k)) tags.push({ cls: 'doki', label: '同期' });
  if (rosterRisingStars(state).includes(r)) tags.push({ cls: 'rising', label: '若手' });
  return tags;
}

function rosterTagsHtml(state, r) {
  return rosterTagsOf(state, r).map(t => `<span class="rel-tag rel-${t.cls}">${t.label}</span>`).join('');
}

// ── 対戦成績 ──────────────────────────────────
function rosterRecordHeadToHead(state, opp, win) {
  const roster = state.roster;
  roster.headToHead = roster.headToHead || {};
  const h = roster.headToHead[opp.shikona] = roster.headToHead[opp.shikona] || { w: 0, l: 0, byGen: {} };
  const g = h.byGen[opp.gen || 1] = h.byGen[opp.gen || 1] || { w: 0, l: 0 };
  if (win) { h.w++; g.w++; } else { h.l++; g.l++; }
}

function rosterHeadToHead(state, opp) {
  const h = state.roster?.headToHead?.[opp.shikona];
  const g = h?.byGen?.[opp.gen || 1];
  return g ? `対戦成績 ${g.w}勝${g.l}敗` : '初対戦';
}

// ── 場所結果の通知 ─────────────────────────────
function rosterRelationSnapshot(state) {
  const rel = state.relations, roster = state.roster;
  if (!rel || !roster) return null;
  const snap = {};
  for (const k of [rel.rival, ...rel.doki].filter(Boolean)) {
    const r = rosterFindByKey(roster, k);
    if (r) snap[k] = { pos: r.pos, rankId: r.banzukeRank, title: r.title, name: rosterDisplayName(r) };
  }
  const p = rosterPlayerEntry(roster);
  snap._player = p ? p.pos : 999;
  return snap;
}

function rosterRelationNotes(state, before, rosterRes) {
  const rel = state.relations, roster = state.roster;
  if (!rel || !before) return [];
  const notes = [];
  const champNames = Object.entries(rosterRes?.champions || {});
  for (const [k, b] of Object.entries(before)) {
    if (k === '_player') continue;
    const who = k === rel.rival ? 'ライバル' : '同期';
    const now = rosterFindByKey(roster, k);
    if (!now) { notes.push(`${who}の${b.name}が引退した（最終 ${b.title}）`); continue; }
    for (const [div, c] of champNames) {
      if (c.shikona === rosterDisplayName(now)) notes.push(`${who}の${b.name}が${ROSTER_DIV_NAMES[div]}優勝！`);
    }
    if (now.banzukeRank > b.rankId) notes.push(`${who}の${b.name}が${ROSTER_RANKS[now.rank].name}に昇進（${now.title}）`);
    if (k === rel.rival) {
      const p = rosterPlayerEntry(roster);
      const pNow = p ? p.pos : 999;
      if (b.pos > before._player && now.pos < pNow)  notes.push(`ライバルの${b.name}に番付で抜かれた…`);
      if (b.pos < before._player && now.pos > pNow)  notes.push(`ライバルの${b.name}を番付で抜いた！`);
    }
  }
  return notes;
}

// ── 自分の歴代 ────────────────────────────────
function rosterUpdatePlayerMaxRank(state) {
  const r = state.rikishi;
  const p = state.roster && rosterPlayerEntry(state.roster);
  const score = r.banzukeRank * 1000 - (p ? p.pos : 999);
  if (r.maxRankScore == null || score > r.maxRankScore) {
    r.maxRankScore = score;
    r.maxRankTitle = r.rosterTitle || getRankName(r.banzukeRank);
  }
}

// 自分の一代の記録（場所ごとの成績から数える）
function playerLifeStats(r) {
  const log = r.bashoLog || [];
  const n = f => log.filter(f).length;
  return {
    mk: r.yusho || 0, jr: r.yushoJuryo || 0, ms: r.yushoMakushita || 0,
    zs: n(x => x.yusho === '幕内' && x.l === 0),
    yk: r.yokozunaBasho || 0, oz: n(x => x.rankId === 8), san: n(x => x.rankId === 6 || x.rankId === 7), mkb: n(x => x.rankId >= 5),
  };
}

function rosterRecordPlayerLife(state) {
  const r = state.rikishi;
  state.playerHistory = state.playerHistory || [];
  state.playerHistory.push({
    life:       state.relations?.lifeNo || state.playerHistory.length + 1,
    shikona:    r.shikona,
    bodyType:   (BODY_TYPES[r.bodyTypeKey] || {}).name || r.bodyType,
    growthType: (GROWTH_TYPES[r.growthType] || {}).name || '?',
    maxRank:    r.maxRankTitle || getRankName(r.banzukeRank),
    w: r.careerWins || 0, l: r.careerLosses || 0,
    yusho:      r.yusho || 0,
    ykBasho:    r.yokozunaBasho || 0,
    ...playerLifeStats(r),
    ...playerRecordStats(r),
    maxRankId:  r.maxRankScore != null ? Math.ceil(r.maxRankScore / 1000) : r.banzukeRank,
    bodyTypeKey: r.bodyTypeKey,
    bashoLog:   r.bashoLog || [],
    look:       r.look || null,
    retireAge:  r.age,
    rival:      state.relations?.rival ? state.relations.rival.split('#')[0] : null,
  });
}
