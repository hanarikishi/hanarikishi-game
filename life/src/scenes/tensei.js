const TenseiScene = {
  render() {
    const r  = Game.state.rikishi;
    const t  = Game.state.tensei || {};
    const rc = Game.state.rebirthCount || 0;
    const sc = Game.state.superRebirthCount || 0;

    const normalReward = Math.floor(3 + r.banzukeRank * 2 + (r.careerWins || 0) * 0.02);
    const superReward  = Math.floor(10 + r.banzukeRank * 5 + (r.careerWins || 0) * 0.05);
    const isanPts      = calcIsanPoints(r, Game.state);
    const isYokozuna   = r.banzukeRank === 9;

    const superCard = isYokozuna ? `
      <div class="tensei-option-card super">
        <div class="to-title">超転生（横綱引退）</div>
        <div class="to-desc">遺産ポイントを次周のステータスに振り分けできます。${skillPage(Game.state) < SKILL_PAGE_MAX ? `スキルマップは${skillPage(Game.state) + 1}枚目へ進み、${SKILL_INHERIT_MAX}個まで引き継げます` : ''}</div>
        <div class="to-reward">たにまち +${superReward}　遺産ポイント ${isanPts}pt</div>
        <button class="btn-primary btn-super" id="btn-super-tensei">超転生する</button>
      </div>` : '';

    const rebirthInfo = (rc + sc) > 0
      ? `<div class="tc-rebirth">転生 ${rc}回 ／ 超転生 ${sc}回</div>` : '';

    return `
      <div class="scene scene-tensei">
        <div class="scene-header">
          <button class="btn-back" id="btn-back-tensei">戻る</button>
          <h2>引退・転生</h2>
        </div>

        <div class="tensei-career">
          <div class="tc-shikona">${r.shikona}</div>
          <div class="tc-rank">最高位 ${getRankName(r.banzukeRank)}</div>
          <div class="tc-stats-row">
            <span>${r.careerWins}勝${r.careerLosses}敗</span>
            ${r.yusho > 0 ? `<span class="tc-yusho">🏆 優勝${r.yusho}回</span>` : ''}
            ${r.yokozunaBasho > 0 ? `<span class="tc-yokozuna">横綱${r.yokozunaBasho}場所</span>` : ''}
          </div>
          ${rebirthInfo}
        </div>

        <div class="tensei-section">
          <div class="section-label">転生オプション</div>
          <div class="tensei-options">
            <div class="tensei-option-card">
              <div class="to-title">転生</div>
              <div class="to-desc">引退して親方になり、新弟子をスカウトします。新弟子は序ノ口から。相撲部屋はLv1に戻ります</div>
              <div class="to-reward">たにまち +${normalReward}</div>
              <button class="btn-primary btn-tensei" id="btn-do-tensei">引退して新弟子を探す</button>
            </div>
            ${superCard}
          </div>
        </div>
      </div>`;
  },

  attach() {
    document.getElementById('btn-back-tensei').addEventListener('click', () => {
      Game.showScene('home');
    });

    document.getElementById('btn-do-tensei')?.addEventListener('click', () => {
      if (!confirm('引退して、新弟子を探しますか？')) return;
      Game.state.scoutPool = null;
      Game.showScene('scout', { isSuper: false });
    });

    document.getElementById('btn-super-tensei')?.addEventListener('click', () => {
      Game.showScene('isan', {});
    });
  },
};
