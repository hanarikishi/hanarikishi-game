// 番付表（力士をタップすると、その力士の情報・歴代・対戦成績）
const BanzukeViewScene = {
  tab: 'makuuchi',
  selected: null,   // 選んだ力士の四股名

  render() {
    const s  = Game.state;
    const r  = s.rikishi;
    const rs = s.roster;
    if (this.selected) return this.renderDetailScene(s);

    const tabs = Object.entries(ROSTER_DIV_NAMES).map(([k, n]) =>
      `<button class="bz-tab ${k === this.tab ? 'active' : ''}" data-tab="${k}">${n}</button>`
    ).concat(`<button class="bz-tab ${this.tab === 'lower' ? 'active' : ''}" data-tab="lower">三段目以下</button>`).join('');

    let body = '';
    if (this.tab === 'lower') {
      body = [2, 1, 0].map(id => {
        const isPlayer = r.banzukeRank === id;
        return `<div class="banzuke-row ${isPlayer ? 'banzuke-player bz-me' : ''}">
                  <span class="banzuke-rank-name">${getRankName(id)}</span>
                  <span class="banzuke-bouts">${getBoutCount(id)}番</span>
                  ${isPlayer ? `<span class="banzuke-you">← ${r.shikona}</span>` : ''}
                </div>`;
      }).join('') + '<div class="banzuke-note">三段目以下は名簿なし（毎回ちがう相手と当たります）</div>';
    } else {
      // 地位＋枚目ごとに東西1行
      const rows = [];
      for (const k of rs.list.filter(x => x.div === this.tab)) {
        const name  = ROSTER_RANKS[k.rank].name;
        const hasNum = ['maegashira', 'juryo', 'makushita'].includes(k.rank);
        const label = hasNum ? `${name}${k.num === 1 ? '筆頭' : rosterKansuji(k.num)}` : name;
        const key   = `${k.rank}_${k.num}`;
        let row = rows[rows.length - 1];
        if (!row || row.key !== key) rows.push(row = { key, label, east: null, west: null });
        row[k.side === '東' ? 'east' : 'west'] = k;
      }
      const cell = (k) => k ? `
        <div class="bz-cell ${k.isPlayer ? 'bz-player bz-me bz-tap' : 'bz-tap'}" ${k.isPlayer ? '' : `data-name="${k.shikona}"`}>
          <span class="bz-name">${rosterDisplayName(k)}${rosterTagsHtml(s, k)}</span>
          <span class="bz-sub">${k.age}歳${k.record ? ` ${k.record.w}-${k.record.l}` : ''}</span>
        </div>` : '<div class="bz-cell bz-empty"></div>';
      body = `
        <div class="bz-head"><span>東</span><span></span><span>西</span></div>
        ${rows.map(row => `
          <div class="bz-row">
            ${cell(row.east)}
            <div class="bz-label">${row.label}</div>
            ${cell(row.west)}
          </div>`).join('')}`;
    }

    const where = r.banzukeRank <= 2
      ? `${r.shikona}は ${getRankName(r.banzukeRank)}（名簿外）`
      : `${r.shikona}は ${getRankName(r.banzukeRank)}`;

    return `
      <div class="scene scene-banzuke-view">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">戻る</button>
          <h2>番付</h2>
        </div>
        <div class="bz-where">${where}</div>
        <div class="bz-hint">力士をタップすると詳しい情報が見られます（自分も）</div>
        ${Game.state.roster ? `<div class="bz-era">今の相撲界：${worldEraName(rosterWorldLevel(Game.state.roster))}</div>` : ''}
        <div class="bz-tabs">${tabs}</div>
        <div class="bz-table">${body}</div>
      </div>`;
  },

  renderDetailScene(s) {
    return `
      <div class="scene scene-meikan">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">番付へ</button>
          <h2>力士の情報</h2>
        </div>
        <div class="mk-list">${this.renderDetail(s, this.selected)}</div>
      </div>`;
  },

  renderDetail(s, name) {
    const now  = s.roster.list.find(r => r.shikona === name && !r.isPlayer);
    const hist = (s.roster.shikonaHistory || {})[name] || [];
    const h2h  = s.roster.headToHead?.[name];
    const gen  = g => `${rosterKansuji(g)}代目`;
    const nowHtml = now ? `
      <div class="mk-life current">
        <div class="mk-life-head">${gen(now.gen || 1)}（現役）${rosterTagsHtml(s, now)}</div>
        <div class="mk-life-body">${now.title} ｜ ${now.age}歳 ｜ ${(BODY_TYPES[now.bodyTypeKey] || {}).name || ''}</div>
        <div class="mk-life-body">力 ${Math.floor(now.stats.chikara)} ｜ 技 ${Math.floor(now.stats.waza)} ｜ 速 ${Math.floor(now.stats.hayasa)} ｜ 体重 ${Math.round(now.stats.taijuu)}kg</div>
        <div class="mk-life-body">通算 ${now.careerW || 0}勝${now.careerL || 0}敗 ｜ 優勝${now.careerYusho || 0}回 ｜ 最高位 ${now.maxRankTitle || now.title}</div>
        ${now.record ? `<div class="mk-life-body">前場所 ${now.record.w}勝${now.record.l}敗</div>` : ''}
        ${h2h?.byGen?.[now.gen || 1] ? `<div class="mk-life-body">あなたとの対戦 ${h2h.byGen[now.gen || 1].w}勝${h2h.byGen[now.gen || 1].l}敗</div>` : ''}
      </div>` : '';
    const pastHtml = [...hist].reverse().map(x => `
      <div class="mk-life">
        <div class="mk-life-head">${x.look ? LookSprite.imgHtml(x.look, 'mk-life-face') : ''}${gen(x.gen || 1)}<span class="mk-life-state">${x.retireAge}歳引退</span></div>
        <div class="mk-life-body">最高位 ${x.maxRank} ｜ ${x.w}勝${x.l}敗 ｜ 優勝${x.yusho}回</div>
        ${h2h?.byGen?.[x.gen || 1] ? `<div class="mk-life-body">あなたとの対戦 ${h2h.byGen[x.gen || 1].w}勝${h2h.byGen[x.gen || 1].l}敗</div>` : ''}
      </div>`).join('');
    return `
      ${now ? `<div class="mk-face">${LookSprite.imgHtml(now.look, 'mk-face-img')}</div>` : ''}
      <div class="mk-detail-name">${name}</div>
      ${h2h ? `<div class="mk-detail-h2h">歴代通算の対戦成績 ${h2h.w}勝${h2h.l}敗</div>` : ''}
      ${nowHtml}${pastHtml ? '<div class="section-label">歴代</div>' + pastHtml : (now ? '' : '<div class="mk-empty">記録なし</div>')}`;
  },

  attach() {
    LookSprite.fill(document.querySelector('.scene'));
    // 自分をタップ → 名鑑（自分の詳しい情報）。戻ると番付へ
    document.querySelectorAll('.bz-me').forEach(el => el.addEventListener('click', () => Game.showScene('meikan', { from: 'banzukeView' })));
    document.getElementById('btn-back').addEventListener('click', () => {
      if (this.selected) { this.selected = null; Game.showScene('banzukeView'); }
      else Game.showScene('home');
    });
    document.querySelectorAll('.bz-cell[data-name]').forEach(el => el.addEventListener('click', () => {
      this.selected = el.dataset.name;
      Game.showScene('banzukeView');
    }));
    document.querySelectorAll('.bz-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.tab = btn.dataset.tab;
        Game.showScene('banzukeView');
      });
    });
  },
};
