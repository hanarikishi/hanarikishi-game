// 記録：歴代の幕内優勝と、いろいろな記録のランキング（名簿の力士＋歴代の自分）
// val が大きいほど上（asc: true なら小さいほど上）。val が null（と、asc でないとき0以下）の人は出さない
const pctOf = (w, l) => w / (w + l);
const recPct = (w, l, min) => (w + l >= min ? pctOf(w, l) : null);
const recFmtPct = (w, l) => `${(pctOf(w, l) * 100).toFixed(1)}%<small>${w}勝${l}敗</small>`;
const RECORD_CATEGORIES = [
  { id: 'win', label: '白星・勝率', items: [
    { id: 'w',      label: '通算勝利',       val: x => x.w,  fmt: x => `${x.w}勝` },
    { id: 'mkW',    label: '幕内勝利',       val: x => x.mkW, fmt: x => `${x.mkW}勝` },
    { id: 'pct',    label: '通算勝率',       val: x => recPct(x.w, x.l, 200), fmt: x => recFmtPct(x.w, x.l), note: '通算200番以上' },
    { id: 'mkPct',  label: '幕内勝率',       val: x => recPct(x.mkW, x.mkL, 150), fmt: x => recFmtPct(x.mkW, x.mkL), note: '幕内150番以上' },
    { id: 'streak', label: '最多連勝',       val: x => x.maxMkStreak, fmt: x => `${x.maxMkStreak}連勝`, note: '幕内の取組だけ' },
    { id: 'run',    label: '連勝（1場所）',  val: x => x.maxBashoRun, fmt: x => `${x.maxBashoRun}連勝`, note: '1つの場所の中での連勝（幕内）' },
    { id: 'yearW',  label: '年間最多勝',     val: x => x.maxYearW, fmt: x => `${x.maxYearW}勝${x.maxYearWYear ? `<small>${x.maxYearWYear >= 1000 ? `${x.maxYearWYear}年` : `${x.maxYearWYear}年目`}</small>` : ''}`, note: '1年（6場所）の勝ち星。年が終わってから数える', afterYear: true },
    { id: 'zs',     label: '全勝優勝',       val: x => x.zs, fmt: x => `${x.zs}回`, note: '幕内の全勝優勝' },
    { id: 'kk',     label: '連続勝ち越し',   val: x => x.maxKK, fmt: x => `${x.maxKK}場所` },
    { id: 'mkKK',   label: '幕内連続勝ち越し', val: x => x.maxMkKK, fmt: x => `${x.maxMkKK}場所` },
  ] },
  { id: 'title', label: '優勝・三賞・金星', items: [
    { id: 'mk',     label: '幕内優勝',   val: x => x.mk, fmt: x => `${x.mk}回` },
    { id: 'yRun',   label: '連続優勝',   val: x => x.maxYushoRun, fmt: x => `${x.maxYushoRun}場所` },
    { id: 'jr',     label: '十両優勝',   val: x => x.jr, fmt: x => `${x.jr}回` },
    { id: 'ms',     label: '幕下優勝',   val: x => x.ms, fmt: x => `${x.ms}回` },
    { id: 'sansho', label: '三賞（合計）', val: x => x.shukun + x.kanto + x.gino,
      fmt: x => `${x.shukun + x.kanto + x.gino}回<small>殊${x.shukun} 敢${x.kanto} 技${x.gino}</small>` },
    { id: 'shukun', label: '殊勲賞', val: x => x.shukun, fmt: x => `${x.shukun}回`, note: '横綱・大関をいちばん多く破って勝ち越し' },
    { id: 'kanto',  label: '敢闘賞', val: x => x.kanto,  fmt: x => `${x.kanto}回`,  note: '平幕でいちばん勝った（10勝以上）' },
    { id: 'gino',   label: '技能賞', val: x => x.gino,   fmt: x => `${x.gino}回`,   note: '10勝以上でいちばん技が高い' },
    { id: 'kin',    label: '金星',   val: x => x.kinboshi, fmt: x => `${x.kinboshi}個`, note: '平幕で横綱を破った数' },
    { id: 'gin',    label: '銀星',   val: x => x.ginboshi, fmt: x => `${x.ginboshi}個`, note: '平幕で大関を破った数' },
  ] },
  { id: 'rank', label: '地位・在位', items: [
    { id: 'yk',   label: '横綱在位',   val: x => x.yk,  fmt: x => `${x.yk}場所` },
    { id: 'oz',   label: '大関在位',   val: x => x.oz,  fmt: x => `${x.oz}場所` },
    { id: 'san',  label: '三役在位',   val: x => x.san, fmt: x => `${x.san}場所`, note: '関脇・小結' },
    { id: 'mkb',  label: '幕内在位',   val: x => x.mkb, fmt: x => `${x.mkb}場所` },
    { id: 'bc',   label: '通算場所数', val: x => x.bashoCount, fmt: x => `${x.bashoCount}場所`, note: '名簿の力士は幕下以上にいた場所。自分は全部の場所' },
  ] },
  { id: 'iron', label: '出場', items: [
    { id: 'g',   label: '通算出場', val: x => x.w + x.l, fmt: x => `${x.w + x.l}番` },
    { id: 'mkG', label: '幕内出場', val: x => x.mkW + x.mkL, fmt: x => `${x.mkW + x.mkL}番` },
    { id: 'l',   label: '通算黒星', val: x => x.l, fmt: x => `${x.l}敗` },
    { id: 'mkL', label: '幕内黒星', val: x => x.mkL, fmt: x => `${x.mkL}敗` },
  ] },
  { id: 'age', label: '年齢', items: [
    { id: 'young',  label: '最年少幕内優勝', asc: true, fromHistory: true, val: h => h.age || null, fmt: h => `${h.age}歳` },
    { id: 'old',    label: '最年長幕内優勝', fromHistory: true, val: h => h.age || null, fmt: h => `${h.age}歳` },
    { id: 'yMk',    label: '最年少新入幕',   asc: true, val: x => x.firstMk?.age ?? null, fmt: x => `${x.firstMk.age}歳` },
    { id: 'ySan',   label: '最年少新三役',   asc: true, val: x => x.firstSan?.age ?? null, fmt: x => `${x.firstSan.age}歳` },
    { id: 'yOz',    label: '最年少大関',     asc: true, val: x => x.firstOz?.age ?? null, fmt: x => `${x.firstOz.age}歳` },
    { id: 'yYk',    label: '最年少横綱',     asc: true, val: x => x.firstYk?.age ?? null, fmt: x => `${x.firstYk.age}歳` },
    { id: 'oWin',   label: '最年長の白星',   val: x => x.maxWinAge, fmt: x => `${x.maxWinAge}歳` },
    { id: 'oMk',    label: '最年長幕内',     val: x => x.maxMakuuchiAge, fmt: x => `${x.maxMakuuchiAge}歳`, note: '幕内にいた最高の年齢' },
    { id: 'oSeki',  label: '最年長関取',     val: x => x.maxSekitoriAge, fmt: x => `${x.maxSekitoriAge}歳`, note: '十両以上にいた最高の年齢' },
  ] },
];
const RECORD_RANKINGS = RECORD_CATEGORIES.flatMap(c => c.items.map(x => ({ ...x, cat: c.id })));
const RECORD_TOP = 20;

const RecordsScene = {
  tab: 'history',   // 'history' 歴代の幕内優勝 | 'ranking'
  rk: 'w',          // 見ているランキング

  // 場所の通し番号 → 「◯年目 ◯場所」
  bashoLabel(n) {
    return `${GAME_START_YEAR + Math.floor((n - 1) / 6)}年${BASHO_MONTHS[(n - 1) % 6]}月 ${getBashoName((n - 1) % 6)}`;
  },

  face(look, isPlayer) {
    if (!look && !isPlayer) return '<span class="rec-face rec-face-none"></span>';
    return LookSprite.imgHtml(look, 'rec-face');
  },

  // ランキングに入れる人（現役・引退した名簿の力士、歴代の自分、今の自分）
  people(s) {
    const out = [];
    const rs = s.roster;
    const nameOf = (shikona, gen) => (gen > 1 ? `${shikona}（${rosterKansuji(gen)}代目）` : shikona);
    // どの人も同じ形にそろえる（無い記録は0）
    const norm = x => ({ mkW: 0, mkL: 0, maxMkStreak: 0, maxBashoRun: 0, maxMakuuchiAge: 0, maxYearW: 0, maxYearWYear: 0, zs: 0, maxKK: 0, maxMkKK: 0, mk: 0, maxYushoRun: 0,
      jr: 0, ms: 0, shukun: 0, kanto: 0, gino: 0, kinboshi: 0, ginboshi: 0, yk: 0, oz: 0, san: 0, mkb: 0, bashoCount: 0,
      maxWinAge: 0, maxSekitoriAge: 0, retireAge: 0, w: 0, l: 0,
      ...Object.fromEntries(Object.entries(x).filter(([, v]) => v != null)) });
    const npc = (x, extra) => norm({ ...recRetireFields(x), w: x.w, l: x.l, mk: x.mkYusho, jr: x.jrYusho, ms: x.msYusho,
      zs: x.mkZensho, yk: x.ykBasho, oz: x.ozBasho, san: x.sanBasho, mkb: x.mkBasho, look: x.look, ...extra });
    for (const r of rs?.list || []) {
      if (r.isPlayer) continue;
      out.push(npc({ ...r, w: r.careerW, l: r.careerL },
        { name: rosterDisplayName(r), sub: `現役・${r.title}`, maxRankId: r.maxRankId, maxRank: r.maxRankTitle || r.title }));
    }
    for (const [shikona, hist] of Object.entries(rs?.shikonaHistory || {})) {
      for (const h of hist) out.push(npc(h, { name: nameOf(shikona, h.gen || 1), retireAge: h.retireAge,
        sub: `引退・最高位 ${h.maxRank}`, maxRankId: h.maxRankId, maxRank: h.maxRank }));
    }
    for (const h of s.playerHistory || []) {
      out.push(norm({ ...h, mk: h.mk ?? h.yusho, yk: h.yk ?? h.ykBasho, name: h.shikona, isPlayer: true,
                      sub: `第${h.life}代の自分・最高位 ${h.maxRank}` }));
    }
    const r = s.rikishi;
    out.push(norm({ ...playerRecordStats(r), ...playerLifeStats(r), w: r.careerWins, l: r.careerLosses, look: r.look,
      maxRankId: r.maxRankScore != null ? Math.ceil(r.maxRankScore / 1000) : r.banzukeRank,
      maxRank: r.maxRankTitle || r.rosterTitle || getRankName(r.banzukeRank),
      name: r.shikona, isPlayer: true, now: true, sub: `今の自分・${r.rosterTitle || getRankName(r.banzukeRank)}` }));
    return out;
  },

  historyHtml(s) {
    const list = [...(s.roster?.makuuchiHistory || [])].reverse();
    if (!list.length) return '<div class="mk-empty">まだ記録がありません（これからの場所の幕内優勝が残ります）</div>';
    return list.map(h => `
      <div class="rec-row ${h.isPlayer ? 'rec-me' : ''}">
        ${this.face(h.look, h.isPlayer)}
        <div class="rec-main">
          <div class="rec-name">${h.shikona}${h.isPlayer ? '<span class="rec-you">あなた</span>' : ''}</div>
          <div class="rec-sub">${this.bashoLabel(h.bashoNo)} ｜ ${h.title}${h.age ? ` ｜ ${h.age}歳` : ''}</div>
        </div>
        <div class="rec-val">${h.w}勝${h.l}敗${h.l === 0 ? '<small>全勝</small>' : h.playoff ? '<small>決定戦</small>' : ''}</div>
      </div>`).join('');
  },

  rankingHtml(s, rk) {
    const src = rk.fromHistory
      ? (s.roster?.makuuchiHistory || []).map(h => ({ ...h, name: h.shikona, sub: `${this.bashoLabel(h.bashoNo)} ｜ ${h.title}` }))
      : this.people(s);
    const ok = x => { const v = rk.val(x); return v != null && (rk.asc ? v >= 0 : v > 0); };
    const list = src.filter(ok).sort((a, b) => (rk.asc ? rk.val(a) - rk.val(b) : rk.val(b) - rk.val(a))).slice(0, RECORD_TOP);
    const note = rk.note ? `<div class="al-hint">${rk.note}</div>` : '';
    if (!list.length) return note + '<div class="mk-empty">まだ記録がありません</div>';
    return note + list.map((x, i) => `
      <div class="rec-row ${x.isPlayer ? 'rec-me' : ''}">
        <span class="rec-no">${i + 1}</span>
        ${this.face(x.look, x.isPlayer)}
        <div class="rec-main">
          <div class="rec-name">${x.name}${x.now || (rk.fromHistory && x.isPlayer) ? '<span class="rec-you">あなた</span>' : ''}</div>
          <div class="rec-sub">${x.sub}</div>
        </div>
        <div class="rec-val">${rk.fmt(x)}</div>
      </div>`).join('');
  },

  render() {
    const s = Game.state;
    const tabs = [['history', '歴代の幕内優勝'], ['ranking', 'ランキング']].map(([id, label]) =>
      `<button class="bz-tab ${id === this.tab ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('');
    const rk  = RECORD_RANKINGS.find(x => x.id === this.rk) || RECORD_RANKINGS[0];
    const cat = RECORD_CATEGORIES.find(c => c.id === rk.cat);
    const chips = this.tab === 'ranking' ? `
      <div class="rec-chips rec-cats">${RECORD_CATEGORIES.map(c =>
        `<button class="rec-chip rec-cat ${c.id === cat.id ? 'on' : ''}" data-rk="${c.items[0].id}">${c.label}</button>`).join('')}</div>
      <div class="rec-chips">${cat.items.filter(x => !x.afterYear || (s.roster?.bashoNo || 0) >= 6).map(x =>
        `<button class="rec-chip ${x.id === rk.id ? 'on' : ''}" data-rk="${x.id}">${x.label}</button>`).join('')}</div>` : '';
    return `
      <div class="scene scene-records">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">戻る</button>
          <h2>記録</h2>
        </div>
        <div class="bz-tabs">${tabs}</div>
        ${chips}
        <div class="rec-list">${this.tab === 'ranking' ? this.rankingHtml(s, rk) : this.historyHtml(s)}</div>
      </div>`;
  },

  attach() {
    LookSprite.fill(document.querySelector('.rec-list'));
    document.getElementById('btn-back').addEventListener('click', () => Game.showScene('home'));
    document.querySelectorAll('.bz-tab').forEach(btn => btn.addEventListener('click', () => {
      this.tab = btn.dataset.tab;
      Game.showScene('records', { noFade: true });
    }));
    document.querySelectorAll('.rec-chip').forEach(btn => btn.addEventListener('click', () => {
      this.rk = btn.dataset.rk;
      Game.showScene('records', { noFade: true });
    }));
  },
};
