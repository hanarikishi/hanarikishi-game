// ── スカウト・入門（引退のあと、次の力士を選ぶ）──────────────
// data: { isSuper, alloc }（超転生なら遺産ポイントの振り分け）
const ScoutScene = {
  step: 'pick',      // 'pick' 候補を選ぶ → 'nyumon' 四股名を決めて入門
  picked: null,
  rerolls: 0,
  shikona: '',

  render(data) {
    const s = Game.state;
    if (!s.scoutPool) { s.scoutPool = scoutMakePool(s); this.rerolls = 0; this.step = 'pick'; }
    return this.step === 'nyumon' ? this.renderNyumon(s) : this.renderPick(s);
  },

  renderPick(s) {
    const showGrowth = scoutShowsGrowth(s);
    const cards = s.scoutPool.map((c, i) => {
      const bg = SCOUT_BACKGROUNDS.find(b => b.id === c.bg);
      const bt = BODY_TYPES[c.bodyTypeKey];
      const tr = SCOUT_TRAITS.find(t => t.id === c.trait);
      const gt = showGrowth ? (GROWTH_TYPES[c.growthType] || {}).name + '型' : '成長タイプ ？';
      return `
        <button class="sc-card ${tr ? 'rare' : ''}" data-i="${i}">
          <div class="sc-head"><span class="sc-bg">${bg.name}</span><span>${c.age}歳</span><span>${bt.name}</span></div>
          ${tr ? `<div class="sc-trait">★ ${tr.name}<small>${tr.desc}</small></div>` : ''}
          <div class="sc-stats">力 ${c.stats.chikara}　技 ${c.stats.waza}　速 ${c.stats.hayasa}　${c.stats.taijuu}kg</div>
          <div class="sc-growth">${gt}</div>
        </button>`;
    }).join('');
    const cost = scoutRerollCost(this.rerolls, s);
    const tani = s.tensei.tanimachi || 0;
    return `
      <div class="scene scene-scout">
        <div class="scene-header"><h2>新弟子のスカウト</h2></div>
        <div class="sc-intro">${s.rikishi.shikona}は親方として、次の弟子を探しに出た。</div>
        ${(() => { const oy = oyakataFrom(s.rikishi); return `<div class="al-hint">親方の格（最高位 ${oy.maxRank}・優勝${oy.yusho}回）：弟子は毎場所ちゃんこ +${oy.bonus}杯<br>親方の教え：入門すると${oy.gift.label} +${oy.gift.amount}（親方の得意を受け継ぐ）</div>`; })()}
        <div class="sc-list">${cards}</div>
        <div class="sc-actions">
          <button class="btn-ghost btn-small" id="sc-reroll" ${tani >= cost ? '' : 'disabled'}>探し直す（たにまち ${formatNum(cost)}）</button>
          <span class="sc-tani">たにまち ${formatNum(tani)}</span>
        </div>
        <div class="al-hint">相撲部屋の「スカウト網」を強化すると、候補が増え・成長タイプが見え・特性を持つ子が見つかりやすくなる</div>
      </div>`;
  },

  renderNyumon(s) {
    const c  = this.picked;
    const bg = SCOUT_BACKGROUNDS.find(b => b.id === c.bg);
    const tr = SCOUT_TRAITS.find(t => t.id === c.trait);
    return `
      <div class="scene scene-scout">
        <div class="scene-header"><h2>入門</h2></div>
        <div class="sc-intro">新弟子検査に合格！ ${bg.name}・${c.age}歳・${BODY_TYPES[c.bodyTypeKey].name}${tr ? `・★${tr.name}` : ''}</div>
        <div class="section-label">親方が四股名を付ける</div>
        <input type="text" id="sc-shikona" maxlength="8" value="${this.shikona}">
        <div class="name-ng hidden" id="name-ng"></div>
        <button class="btn-ghost btn-small" id="sc-name-again">別の四股名を考える</button>
        <div class="al-hint">最初は親方（${s.rikishi.shikona}）と同じ四股名。「別の四股名を考える」で親方の一字を継いだ名前になります</div>
        <div class="sc-actions">
          <button class="btn-ghost btn-small" id="sc-back">候補に戻る</button>
          <button class="btn-primary" id="sc-enter">入門する</button>
        </div>
      </div>`;
  },

  // 親方の四股名から一字を継いだ候補
  suggestName() {
    const prev = Game.state.rikishi.shikona || '';
    const head = prev ? prev[Math.floor(Math.random() * Math.min(2, prev.length))] : NPC_PREFIX[0];
    const tail = NPC_SUFFIX[Math.floor(Math.random() * NPC_SUFFIX.length)];
    return head + tail;
  },

  attach(data) {
    const s = Game.state;
    document.querySelectorAll('.sc-card').forEach(btn => btn.addEventListener('click', () => {
      this.picked  = s.scoutPool[+btn.dataset.i];
      this.shikona = s.rikishi.shikona || this.suggestName();   // 最初は親方と同じ四股名
      this.step    = 'nyumon';
      Game.showScene('scout', data);
    }));
    document.getElementById('sc-reroll')?.addEventListener('click', () => {
      const cost = scoutRerollCost(this.rerolls, s);
      if ((s.tensei.tanimachi || 0) < cost) return;
      s.tensei.tanimachi -= cost;
      this.rerolls++;
      s.scoutPool = scoutMakePool(s);
      Game.save();
      Game.showScene('scout', { ...data, noFade: true });
    });
    document.getElementById('sc-name-again')?.addEventListener('click', () => {
      this.shikona = this.suggestName();
      Game.showScene('scout', { ...data, noFade: true });
    });
    document.getElementById('sc-back')?.addEventListener('click', () => {
      this.step = 'pick';
      Game.showScene('scout', data);
    });
    document.getElementById('sc-enter')?.addEventListener('click', () => {
      const name = (document.getElementById('sc-shikona').value || '').trim() || this.shikona;
      const ng = shikonaNgReason(name);
      if (ng) {
        const el = document.getElementById('name-ng');
        el.textContent = ng; el.classList.remove('hidden');
        return;
      }
      doTensei(s, !!data?.isSuper, data?.alloc || null, this.picked, name, data?.inherit || null);
      this.step = 'pick'; this.picked = null; this.rerolls = 0;
      Sound.play('tensei');
      Game.save();
      Game.showScene('home');
    });
  },
};
