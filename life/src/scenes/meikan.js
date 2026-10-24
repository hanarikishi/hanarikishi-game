// 力士名鑑：自分の詳しい情報と歴代（名簿の力士の情報は番付表から見る）
const MeikanScene = {
  from: 'home',   // 戻る先（番付から自分をタップして来たら 'banzukeView'）

  life: null,     // 見ている歴代の自分（playerHistory の番号）。null なら今の自分

  // 場所ごとの成績（新しい順）
  bashoLogHtml(log) {
    if (!log?.length) return '<div class="mk-empty">場所の記録はまだありません</div>';
    return `<div class="mk-basho-log">${[...log].reverse().map(x => `
      <div class="mk-basho ${x.w > x.l ? 'kachi' : 'make'} ${x.yusho ? 'yusho' : ''}">
        <span class="mkb-when">${x.label}</span>
        <span class="mkb-rank">${x.title}</span>
        <span class="mkb-rec">${x.w}勝${x.l}敗</span>
        <span class="mkb-note">${x.yusho ? `🏆${x.yusho}優勝` : ''}${(x.sansho || []).map(p => p.replace('賞', '')).join('・')}</span>
      </div>`).join('')}</div>`;
  },

  // 歴代の自分の1人分
  renderLife(s, h) {
    const st = h.mk != null ? h : { mk: h.yusho || 0 };
    return `
      <div class="scene scene-meikan">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">名鑑へ</button>
          <h2>第${h.life}代 ${h.shikona}</h2>
        </div>
        <div class="mk-list">
          <div class="mk-face">${LookSprite.imgHtml(h.look || null, 'mk-face-img')}</div>
          <div class="mk-detail-name">${h.shikona}</div>
          <dl class="mk-kv">
            <dt>体格</dt><dd>${h.bodyType}・${h.growthType}型</dd>
            <dt>最高位</dt><dd>${h.maxRank}</dd>
            <dt>通算成績</dt><dd>${h.w}勝${h.l}敗（勝率 ${h.w + h.l ? Math.round(h.w / (h.w + h.l) * 100) + '%' : '—'}）</dd>
            <dt>優勝</dt><dd>幕内 ${st.mk || 0}回${h.jr != null ? ` ｜ 十両 ${h.jr}回 ｜ 幕下 ${h.ms}回` : ''}${h.zs ? ` ｜ 全勝 ${h.zs}回` : ''}</dd>
            ${h.yk || h.ykBasho ? `<dt>横綱在位</dt><dd>${h.yk || h.ykBasho}場所</dd>` : ''}
            ${h.oz ? `<dt>大関在位</dt><dd>${h.oz}場所</dd>` : ''}
            ${h.mkb ? `<dt>幕内在位</dt><dd>${h.mkb}場所</dd>` : ''}
            <dt>引退</dt><dd>${h.retireAge}歳</dd>
            ${h.rival ? `<dt>ライバル</dt><dd>${h.rival}</dd>` : ''}
          </dl>
          <div class="section-label">場所ごとの成績</div>
          ${h.bashoLog ? this.bashoLogHtml(h.bashoLog) : '<div class="mk-empty">この力士の場所ごとの記録は残っていません（記録を始める前の力士）</div>'}
        </div>
      </div>`;
  },

  render(data) {
    if (data?.from) this.from = data.from;
    if (this.life != null && Game.state.playerHistory?.[this.life]) return this.renderLife(Game.state, Game.state.playerHistory[this.life]);
    this.life = null;
    const s   = Game.state;
    const r   = s.rikishi;
    const rel = s.relations;
    const roster = s.roster;
    const pct = (w, l) => (w + l ? `${Math.round(w / (w + l) * 100)}%` : '—');

    // 能力（ちゃんこの注ぎ途中も出す）
    const inv = r.chankoInvest || {};
    const statBox = (key, label, val) => {
      const cost = typeof allocCost === 'function' ? allocCost(key, r.stats[key]) : null;
      return `<div class="mk-stat"><span>${label}</span><b>${val}</b>${cost ? chankoBowlsHtml(inv[key] || 0, cost, true) : ''}</div>`;
    };
    const stats = `
      <div class="mk-grid">
        ${statBox('chikara', '力', r.stats.chikara)}
        ${statBox('waza', '技', r.stats.waza)}
        ${statBox('hayasa', '速さ', r.stats.hayasa)}
        ${statBox('taijuu', '体重', r.stats.taijuu + 'kg')}
      </div>`;

    const phase = getAgePhase(r).phase;
    const growth = isGrowthRevealed(r)
      ? `${(GROWTH_TYPES[r.growthType] || GROWTH_TYPES.futsuu).name}型・${AGE_PHASE_NAMES[phase]}` : '？（21歳で分かる）';
    const w = r.careerWins || 0, l = r.careerLosses || 0;
    const profile = `
      <dl class="mk-kv">
        <dt>地位</dt><dd>${r.rosterTitle || getRankName(r.banzukeRank)}</dd>
        <dt>最高位</dt><dd>${r.maxRankTitle || r.rosterTitle || getRankName(r.banzukeRank)}</dd>
        <dt>年齢</dt><dd>${r.age}歳 ｜ ${growth}</dd>
        <dt>体格</dt><dd>${(BODY_TYPES[r.bodyTypeKey] || {}).name || r.bodyType}（${{ oshi: '押し', yotsu: '四つ', waza: '技' }[r.style] || ''}相撲）</dd>
        <dt>出身</dt><dd>${r.hometown || '—'}</dd>
        ${r.background ? `<dt>経歴</dt><dd>${(SCOUT_BACKGROUNDS.find(b => b.id === r.background) || {}).name || ''}${r.trait ? `・★${(SCOUT_TRAITS.find(t => t.id === r.trait) || {}).name}` : ''}</dd>` : ''}
        ${s.oyakata ? `<dt>親方</dt><dd>${s.oyakata.shikona}（元${s.oyakata.maxRank}）｜ 毎場所ちゃんこ +${s.oyakata.bonus}${s.oyakata.gift ? ` ｜ 教え ${s.oyakata.gift.label}+${s.oyakata.gift.amount}` : ''}</dd>` : ''}
        <dt>通算成績</dt><dd>${w}勝${l}敗（勝率 ${pct(w, l)}）</dd>
        <dt>優勝</dt><dd>幕内 ${r.yusho || 0}回 ｜ 十両 ${r.yushoJuryo || 0}回 ｜ 幕下 ${r.yushoMakushita || 0}回</dd>
        ${r.yokozunaBasho ? `<dt>横綱在位</dt><dd>${r.yokozunaBasho}場所</dd>` : ''}
        <dt>連勝</dt><dd>${r.currentStreak || 0}連勝中</dd>
        <dt>ちゃんこ</dt><dd>🍲${s.chankoPts || 0}杯（未振り分け）</dd>
      </dl>`;

    // 同期・ライバル（今の地位と対戦成績）
    const h2hOf = name => roster?.headToHead?.[name];
    const relRow = (key, tag) => {
      const k = rosterFindByKey(roster, key);
      const name = key.split('#')[0];
      const h = h2hOf(name);
      return `<div class="mk-life-body">${tag} ${k ? `${rosterDisplayName(k)}（${k.title}・${k.age}歳）` : `${name}（引退）`}${h ? ` ｜ 対戦 ${h.w}勝${h.l}敗` : ''}</div>`;
    };
    const relHtml = rel ? `
      <div class="mk-life">
        <div class="mk-life-head">同期・ライバル</div>
        ${rel.rival ? relRow(rel.rival, '<span class="rel-tag rel-rival">ライバル</span>') : ''}
        ${rel.doki.filter(k => k !== rel.rival).map(k => relRow(k, '<span class="rel-tag rel-doki">同期</span>')).join('')}
      </div>` : '';

    // よく当たる相手（歴代通算の対戦数が多い順）
    const foes = Object.entries(roster?.headToHead || {})
      .sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 5);
    const foesHtml = foes.length ? `
      <div class="mk-life">
        <div class="mk-life-head">よく当たる相手</div>
        ${foes.map(([n, h]) => `<div class="mk-life-body">${n} ｜ ${h.w}勝${h.l}敗</div>`).join('')}
      </div>` : '';

    // 決まり手（歴代通算）
    const kim = Object.entries(s.achievements?.total?.kimarite || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const kimHtml = kim.length ? `
      <div class="mk-life">
        <div class="mk-life-head">得意の決まり手（歴代通算）</div>
        <div class="mk-life-body">${kim.map(([n, c]) => `${n} ${c}回`).join(' ｜ ')}</div>
      </div>` : '';

    // 歴代の自分
    const lives = (s.playerHistory || []).map((h, i) => ({ ...h, idx: i })).reverse();
    const livesHtml = lives.map(h => `
      <div class="mk-life mk-life-tap" data-life="${h.idx}">
        <div class="mk-life-head">${LookSprite.imgHtml(h.look || null, 'mk-life-face')}第${h.life}代 ${h.shikona}<span class="mk-life-state">${h.retireAge}歳引退</span></div>
        <div class="mk-life-body">${h.bodyType}・${h.growthType}型 ｜ 最高位 ${h.maxRank}</div>
        <div class="mk-life-body">${h.w}勝${h.l}敗 ｜ 優勝${h.yusho}回${h.rival ? ` ｜ ライバル ${h.rival}` : ''}</div>
      </div>`).join('');

    return `
      <div class="scene scene-meikan">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">戻る</button>
          <h2>力士名鑑</h2>
        </div>
        <div class="mk-list">
          <div class="mk-face">${LookSprite.imgHtml(r.look || null, 'mk-face-img')}</div>
          <div class="mk-detail-name">${r.shikona}</div>
          <div class="mk-detail-h2h">第${rel?.lifeNo || lives.length + 1}代</div>
          ${stats}
          ${profile}
          ${relHtml}
          ${foesHtml}
          ${kimHtml}
          <div class="section-label">場所ごとの成績（今の${r.shikona}）</div>
          ${this.bashoLogHtml(r.bashoLog)}
          ${livesHtml ? `<div class="section-label">歴代の自分（タップで詳しく）</div>${livesHtml}` : ''}
        </div>
      </div>`;
  },

  attach() {
    LookSprite.fill(document.querySelector('.mk-list'));
    document.getElementById('btn-back').addEventListener('click', () => {
      if (this.life != null) { this.life = null; Game.showScene('meikan'); return; }
      const to = this.from; this.from = 'home';
      Game.showScene(to);
    });
    document.querySelectorAll('.mk-life-tap').forEach(el => el.addEventListener('click', () => {
      this.life = +el.dataset.life;
      Game.showScene('meikan');
    }));
  },
};
