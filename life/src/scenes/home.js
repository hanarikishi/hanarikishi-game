// ホームのボタンの絵（金色の線画。色は currentColor）
const HOME_MON = `<svg viewBox="0 0 40 40" class="hm-mon"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="2"/>${
  [0, 72, 144, 216, 288].map(a => `<ellipse cx="20" cy="11" rx="5.5" ry="8" fill="currentColor" transform="rotate(${a} 20 20)"/>`).join('')
}<circle cx="20" cy="20" r="3.2" fill="#0b1426"/></svg>`;
const HOME_ICONS = {
  banzuke:  HOME_MON,
  allocate: `<svg viewBox="0 0 40 40"><path d="M5 18h30a15 13 0 0 1-30 0z" fill="currentColor"/><path d="M14 31h12v3H14z" fill="currentColor"/><path d="M14 14c0-4 4-4 4-8M22 14c0-4 4-4 4-8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  dojo:     `<svg viewBox="0 0 40 40"><path d="M3 18 20 6l17 12z" fill="currentColor"/><path d="M8 18h24v16H8z" fill="currentColor"/><path d="M17 24h6v10h-6z" fill="#0b1426"/><path d="M11 22h4v4h-4zM25 22h4v4h-4z" fill="#0b1426"/></svg>`,
  skillmap: `<svg viewBox="0 0 40 40"><path d="M4 9l10-4 12 4 10-4v26l-10 4-12-4-10 4z" fill="currentColor"/><path d="M14 5v26M26 9v26" stroke="#0b1426" stroke-width="1.6"/></svg>`,
  ach:      `<svg viewBox="0 0 40 40"><path d="M11 5h18v9a9 9 0 0 1-18 0z" fill="currentColor"/><path d="M11 8H5c0 7 4 10 7 10M29 8h6c0 7-4 10-7 10" stroke="currentColor" stroke-width="2.4" fill="none"/><path d="M18 22h4v6h-4zM12 29h16v5H12z" fill="currentColor"/></svg>`,
  records:  `<svg viewBox="0 0 40 40"><path d="M9 6h22v28H9z" fill="currentColor"/><path d="M13 12h14M13 17h14M13 22h10M13 27h8" stroke="#0b1426" stroke-width="2.2"/></svg>`,
  meikan:   `<svg viewBox="0 0 40 40"><path d="M3 9c6-2 11-1 16 2v23c-5-3-10-4-16-2z" fill="currentColor"/><path d="M37 9c-6-2-11-1-16 2v23c5-3 10-4 16-2z" fill="currentColor"/></svg>`,
  retire:   `<svg viewBox="0 0 40 40"><path d="M14 6h12l2 4-1 18h-14l-1-18z" fill="currentColor"/><path d="M9 28h22v5H9z" fill="currentColor"/></svg>`,
};
const HomeScene = {
  render() {
    // 稽古期間は無い。場所と場所の間（ちゃんこの振り分けの後）はすぐ次の本場所に入る
    if (Game.state.calendar.phase !== 'basho') this.startBasho();
    const r   = Game.state.rikishi;
    const cal = Game.state.calendar;
    const b   = Game.state.basho;
    const t   = Game.state.tensei || {};
    const total        = getBoutCount(r.banzukeRank);
    const phaseLabel   = `${cal.year}年${BASHO_MONTHS[cal.bashoIndex]}月 ${getBashoName(cal.bashoIndex)}　${b.day}日目 / ${total}番`;

    const ageInfo  = isGrowthRevealed(r)
      ? `${(GROWTH_TYPES[r.growthType] || GROWTH_TYPES.futsuu).name}型・${AGE_PHASE_NAMES[getAgePhase(r).phase]}`
      : '？';
    const agePhase = getAgePhase(r).phase;
    const pE = Game.state.roster && rosterPlayerEntry(Game.state.roster);
    const hints = [
      agePhase === 'decline' ? '体の衰えを感じる…引退を考える時期かもしれない' : '',
      pE && pE.rank === 'yokozuna' && (pE.ykMakekoshi || 0) >= 1 ? '横綱として負け越した…進退が問われている' : '',
    ].filter(Boolean).map(h => `<div class="retire-hint">${h}</div>`).join('');

    const btn = (id, icon, label, cls = '') =>
      `<button class="hm-btn ${cls}" id="${id}"><span class="hm-ic">${HOME_ICONS[icon]}</span><span>${label}</span></button>`;
    const chanko = Game.state.chankoPts || 0;

    return `
      <div class="scene scene-home">
        <div class="hm-brush hm-brush-top"></div>
        <div class="home-header">
          <div class="hm-topbar">
            <div class="phase-label">${phaseLabel}</div>
            ${SoundToggles.html()}
          </div>
          <div class="rikishi-title">
            <span class="hm-rank">${r.rosterTitle || getRankName(r.banzukeRank)}</span>
            <span class="shikona">${r.shikona}</span>
            <button class="hm-look" id="btn-look">${LookSprite.imgHtml(r.look || null, 'hm-look-img')}<span>見た目</span></button>
          </div>
          <div class="age-line age-${isGrowthRevealed(r) ? agePhase : 'unknown'}">${r.age}歳 ｜ ${ageInfo}</div>
          ${hints}
          <div class="home-currency">
            <span class="hc-label">たにまち</span><span class="hc-val" id="hc-tanimachi-val">${formatNum(t.tanimachi || 0)}</span>
            <span class="hc-label">ちゃんこ</span><span class="hc-val">🍲${chanko}</span>
          </div>
        </div>

        ${KeikoStage.render()}

        <div class="stats-card">
          ${['chikara:力', 'waza:技', 'hayasa:速', 'taijuu:体重'].map(s => {
            const [key, label] = s.split(':');
            const val = r.stats[key];
            const pct = Math.min(100, (val / (key === 'taijuu' ? TAIJUU_MAX : 100)) * 100);
            return `
              <div class="stat-item">
                <span class="stat-label">${label}</span>
                <div class="stat-bar-wrap"><div class="stat-bar ${key}-bar" style="width:${pct}%"></div></div>
                <span class="stat-val">${key === 'taijuu' ? `${val}<small>kg</small>` : val}</span>
              </div>`;
          }).join('')}
        </div>

        <div class="home-actions">
          <div class="hm-row hm-row4">
            ${btn('btn-banzuke', 'banzuke', '番付')}
            ${btn('btn-meikan', 'meikan', '名鑑')}
            ${btn('btn-records', 'records', '記録')}
            ${btn('btn-dojo', 'dojo', '相撲部屋')}
          </div>
          <div class="hm-row hm-row4">
            ${btn('btn-allocate', 'allocate', `ちゃんこ振り分け${chanko ? `<b class="hm-count">${chanko}</b>` : ''}`)}
            ${btn('btn-skillmap', 'skillmap', 'スキルマップ')}
            ${btn('btn-retire', 'retire', '引退', 'hm-retire')}
          </div>
          <button class="hm-go" id="btn-basho"><span>今日の取組へ</span></button>
        </div>

        <div class="career-footer">
          <div class="hm-divider"><span></span>${HOME_MON}<span></span></div>
          通算 ${r.careerWins}勝${r.careerLosses}敗　<button class="hm-ach-link" id="btn-achievements">実績</button>
        </div>
        <div class="hm-brush hm-brush-bottom"></div>
      </div>`;
  },

  attach() {
    KeikoStage.attach();
    LookSprite.fill(document.querySelector('.rikishi-title'));
    document.getElementById('btn-look')?.addEventListener('click', () => Game.showScene('look'));

    SoundToggles.bind(document.querySelector('.hm-topbar'));
    document.getElementById('btn-banzuke')?.addEventListener('click', () => {
      Game.showScene('banzukeView');
    });
    document.getElementById('btn-records')?.addEventListener('click', () => Game.showScene('records'));
    document.getElementById('btn-allocate')?.addEventListener('click', () => {
      Game.showScene('allocate');
    });
    document.getElementById('btn-dojo')?.addEventListener('click', () => {
      Game.showScene('dojoUpgrade');
    });
    document.getElementById('btn-skillmap')?.addEventListener('click', () => {
      Game.showScene('skillMap');
    });
    document.getElementById('btn-meikan')?.addEventListener('click', () => {
      Game.showScene('meikan');
    });
    document.getElementById('btn-achievements')?.addEventListener('click', () => {
      Game.showScene('achievements');
    });
    document.getElementById('btn-retire')?.addEventListener('click', () => {
      Game.showScene('tensei');
    });

    document.getElementById('btn-basho')?.addEventListener('click', () => {
      Game.showScene('bout');
    });
  },

  // 本場所を始める（ちゃんこの振り分けの後すぐ）
  startBasho() {
    const cal = Game.state.calendar;
    cal.phase       = 'basho';
    cal.day         = 1;
    // 勝負ちゃんこ（スキル）：この場所の間だけ選んだ能力が上がる
    const shobuPct = shobuChankoPct(calcSkillEffects(Game.state).shobuChanko);
    const shobu    = shobuPct && cal.shobuPick ? { stat: cal.shobuPick, pct: shobuPct } : null;
    cal.shobuPick  = null;
    Game.state.basho = { day: 1, wins: 0, losses: 0, results: [], opponent: null, tanimachiEarned: 0, shobu,
      start: { ...Game.state.rikishi.stats }, oppRoll: {} };   // start: 場所開始時の自分の能力（幕下・十両の相手の基準）
    if (Game.state.roster) rosterStartBasho(Game.state.roster);
  },

  // 勝負ちゃんこの選択（スキルで解放）
  shobuChankoHtml() {
    const pct = shobuChankoPct(calcSkillEffects(Game.state).shobuChanko);
    if (!pct) return '';
    const pick = Game.state.calendar.shobuPick;
    return `<div class="section-label">勝負ちゃんこ（この場所の間だけ +${pct}%）</div>
      <div class="shobu-grid">${SHOBU_CHANKO.map(c => `
        <button class="shobu-btn ${pick === c.stat ? 'selected' : ''}" data-stat="${c.stat}">
          <span class="ck-emoji">${c.emoji}</span><span>${c.name}</span><span class="ck-effect">${c.label}+${pct}%</span>
        </button>`).join('')}
      </div>`;
  }
};
