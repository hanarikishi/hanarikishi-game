const AchievementsScene = {
  cat: 'banzuke',

  render() {
    const s     = Game.state;
    const total = ACH_DEFS.length;
    const done  = achCount(s);

    const tabs = ACH_CATS.map(c => {
      const defs = ACH_DEFS.filter(d => d.cat === c.id);
      const n    = defs.filter(d => achIsUnlocked(s, d.id)).length;
      return `<button class="ach-tab ${c.id === this.cat ? 'active' : ''}" data-cat="${c.id}">
                ${c.name}<span class="ach-tab-count">${n}/${defs.length}</span>
              </button>`;
    }).join('');

    const rows = ACH_DEFS.filter(d => d.cat === this.cat).map(d => {
      const ok = achIsUnlocked(s, d.id);
      let prog = '';
      if (!ok && d.goal != null) {
        const cur = Math.min(d.goal, d.progress(s));
        prog = `<div class="ach-prog"><div class="ach-prog-bar" style="width:${(cur / d.goal) * 100}%"></div></div>
                <span class="ach-prog-num">${formatNum(cur)} / ${formatNum(d.goal)}</span>`;
      }
      return `
        <div class="ach-row ${ok ? 'done' : ''}">
          <span class="ach-mark">${ok ? '🏅' : '・'}</span>
          <div class="ach-body">
            <div class="ach-name">${d.name}</div>
            <div class="ach-desc">${d.desc}</div>
            ${prog}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="scene scene-achievements">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">戻る</button>
          <h2>実績</h2>
        </div>
        <div class="ach-summary">解除 <b>${done}</b> / ${total}</div>
        <div class="ach-tabs">${tabs}</div>
        <div class="ach-list">${rows}</div>
      </div>`;
  },

  attach() {
    document.getElementById('btn-back').addEventListener('click', () => {
      Game.showScene('home');
    });
    document.querySelectorAll('.ach-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.cat = btn.dataset.cat;
        Game.showScene('achievements');
      });
    });
  },
};
