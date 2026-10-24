// 相撲部屋（試作：本場所のみモード。旧「道場」）
const DojoUpgradeScene = {
  render() {
    const t         = Game.state.tensei || {};
    const tanimachi = t.tanimachi || 0;
    const rows = HEYA_DEFS.map(d => {
      const lv   = heyaLv(Game.state, d.id);
      const cost = heyaCost(Game.state, d, lv);
      const can  = tanimachi >= cost;
      return `
        <div class="dojo-keiko-row">
          <span class="dk-emoji">${d.emoji}</span>
          <div>
            <div class="dk-name">${d.name} Lv${lv + 1}</div>
            <div class="dk-lv">${lv ? d.desc(lv) : '未強化'}　→ ${d.desc(lv + 1)}</div>
          </div>
          <button class="btn-outline dk-upgrade ${can ? '' : 'disabled'}" data-id="${d.id}" ${can ? '' : 'disabled'}>
            強化 たにまち ${formatNum(cost)}
          </button>
        </div>`;
    }).join('');

    return `
      <div class="scene scene-dojo">
        <div class="scene-header">
          <button class="btn-back" id="btn-back-dojo">戻る</button>
          <h2>相撲部屋</h2>
        </div>
        <div class="dojo-currency">
          <div class="dojo-curr-item">
            <span class="dci-label">たにまち</span>
            <span class="dci-val">${formatNum(tanimachi)}</span>
          </div>
        </div>
        <div class="dojo-section">
          <div class="section-label">部屋の強化（たにまち・転生するとLv1に戻る）</div>
          <div class="dojo-keiko-list">${rows}</div>
        </div>
      </div>`;
  },

  attach() {
    document.getElementById('btn-back-dojo').addEventListener('click', () => {
      Game.showScene('home');
    });
    document.querySelectorAll('.dk-upgrade[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t  = Game.state.tensei;
        const d  = HEYA_DEFS.find(x => x.id === btn.dataset.id);
        const lv = heyaLv(Game.state, d.id);
        const cost = heyaCost(Game.state, d, lv);
        if (t.tanimachi < cost) return;
        t.tanimachi -= cost;
        t.heya = { ...(t.heya || {}), [d.id]: lv + 1 };
        Sound.play('skill');
        Game.save();
        Game.showScene('dojoUpgrade', { noFade: true });
      });
    });
  },
};
