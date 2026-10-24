const BashoResultScene = {
  render(data) {
    const { wins, losses, oldRank, newRank, res, tanimachiEarned } = data;
    const r = Game.state.rikishi;
    const bashoIndex = (Game.state.calendar.bashoIndex + 5) % 6;

    // 名簿内は「東前頭三枚目」などの詳細表記
    const oldName = data.oldTitle || getRankName(oldRank);
    const newName = data.newTitle || getRankName(newRank);
    const upWord  = newRank > oldRank ? '昇進！' : '番付上昇';
    const downWord = newRank < oldRank ? '陥落…' : '番付下降';
    let rankMsg = '';
    if (res.promoted)     rankMsg = `<div class="rank-change promoted">${upWord}<br>${oldName} → ${newName}</div>`;
    else if (res.demoted) rankMsg = `<div class="rank-change demoted">${downWord}<br>${oldName} → ${newName}</div>`;
    else                  rankMsg = `<div class="rank-change unchanged">番付据え置き　${newName}</div>`;

    const yushoHtml = res.isYusho
      ? `<div class="yusho-badge">🏆 ${data.yushoDiv || ''}優勝</div>` : '';

    const tm = tanimachiEarned || 0;
    const rewardsHtml = tm > 0 ? `
      <div class="basho-rewards">
        <span>たにまち +${tm}</span>
      </div>` : '';

    const t = Game.state.tensei || {};

    const rr = data.rosterRes;
    const champHtml = rr ? `
      <div class="roster-champs">
        ${Object.entries(ROSTER_DIV_NAMES).map(([k, n]) => {
          const c = rr.champions[k];
          return `<div class="rc-row"><span class="rc-div">${n}優勝</span><span class="rc-name">${c.shikona}</span><span class="rc-rec">${c.w}勝${c.l}敗${c.playoff ? '（決定戦）' : ''}</span></div>`;
        }).join('')}
        ${[['shukun', '殊勲賞'], ['kanto', '敢闘賞'], ['gino', '技能賞']].map(([k, n]) => {
          const who = (rr.sansho || []).filter(x => x.prize === k);
          return `<div class="rc-row"><span class="rc-div">${n}</span><span class="rc-name rc-wrap">${
            who.length ? who.map(x => (x.isPlayer ? `<b>${x.shikona}</b>` : x.shikona)).join('・') : '該当なし'}</span></div>`;
        }).join('')}
        ${rr.retired.length ? `<div class="rc-retired">引退：${rr.retired.map(x => x.shikona).join('、')}</div>` : ''}
      </div>` : '';

    const relHtml = (data.relNotes || []).length
      ? `<div class="rel-notes">${data.relNotes.map(n => `<div>${n}</div>`).join('')}</div>` : '';

    const ag = data.aging;
    const agingHtml = ag ? `
      <div class="aging-info">
        <div class="aging-age">🎂 ${ag.newAge}歳になった</div>
        ${ag.revealed ? `<div class="aging-reveal">${(GROWTH_TYPES[r.growthType] || GROWTH_TYPES.futsuu).name}型だった！</div>` : ''}
        ${ag.statLoss ? `<div class="aging-loss">衰え… 力 −${ag.statLoss.chikara} / 技 −${ag.statLoss.waza} / 速さ −${ag.statLoss.hayasa}</div>` : ''}
      </div>` : '';

    return `
      <div class="scene scene-result">
        <h2 class="result-title">${getBashoName(bashoIndex)} 終了</h2>
        <div class="result-subtitle">${res.boutCount}番勝負</div>

        <div class="final-record">
          <span class="big-wins">${wins}</span>
          <span class="record-sep">勝</span>
          <span class="big-losses">${losses}</span>
          <span class="record-sep">敗</span>
          <span class="verdict-label">${res.verdict}</span>
        </div>
        ${data.chankoGot ? `<div class="al-pts">🍲 ちゃんこ +${data.chankoGot} 杯</div>` : ''}

        ${yushoHtml}
        ${rankMsg}
        ${rewardsHtml}
        ${agingHtml}
        ${relHtml}
        ${champHtml}

        <div class="career-info">通算 ${r.careerWins}勝${r.careerLosses}敗 ｜ たにまち ${formatNum(t.tanimachi || 0)}</div>

        <button class="btn-primary btn-large" id="btn-next-season">ちゃんこを振り分ける</button>
        ${window.Capacitor ? '' : '<button class="btn-share-x" id="btn-share-x">𝕏 でシェア</button>'}
      </div>`;
  },

  attach(data) {
    const { wins, losses, res } = data;
    Sound.play(res.isYusho ? 'yusho' : (res.promoted || wins > losses) ? 'good' : wins < losses ? 'bad' : 'tap');
    document.getElementById('btn-next-season').addEventListener('click', () => {
      Game.showScene('allocate');
    });
    // 場所の結果をXでシェア（ウェブ版のみ）
    document.getElementById('btn-share-x')?.addEventListener('click', () => {
      const r = Game.state.rikishi;
      const bashoIndex = (Game.state.calendar.bashoIndex + 5) % 6;
      const newName = data.newTitle || getRankName(data.newRank);
      const text = `どすこい！はなりきしで ${r.shikona}が ${getBashoName(bashoIndex)} ${wins}勝${losses}敗${res.isYusho ? '・優勝！' : ''} ${res.promoted ? '昇進して ' : ''}${newName}
#はなりきし`;
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://hanarikishi.github.io/hanarikishi-game/life/'), '_blank', 'noopener');
    });
  },
};
