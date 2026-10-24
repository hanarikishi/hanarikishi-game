const SKILL_ZOOM_MIN = 0.3, SKILL_ZOOM_MAX = 1.6;

const SkillMapScene = {
  zoom: 0.55,         // マップの拡大率（SVG 1200px に対して）
  viewCenter: null,   // 見ている中心（SVG の座標）

  render() {
    const state     = Game.state;
    const page      = skillPage(state);
    const defs      = currentSkillDefs(state);
    const t         = state.tensei || {};
    const tanimachi = t.tanimachi || 0;
    const kanroku   = t.kanroku   || 0;
    const fxK       = calcSkillEffects(state);
    const kanrokuMax = 10 + (fxK.kanrokuCap || 0);

    const SVG_SIZE = 1200;

    // ── ガイド円 ──
    const guideCircles = RING_RADII.slice(1).map(r =>
      `<circle cx="${SKILL_CENTER}" cy="${SKILL_CENTER}" r="${r}" class="sk-guide-ring" />`
    ).join('');

    // ── エッジ生成 ──
    const drawnEdges = new Set();
    const edgeLines = defs.flatMap(def => {
      const nbKeys = getNeighborKeys(def.ring, def.slot);
      return nbKeys.map(nbKey => {
        const edgeKey = [def.id, nbKey].sort().join('|');
        if (drawnEdges.has(edgeKey)) return '';
        drawnEdges.add(edgeKey);

        const nbDef = defs.find(d => d.id === nbKey);
        if (!nbDef) return '';

        const posA = ringSlotToXY(def.ring, def.slot);
        const posB = ringSlotToXY(nbDef.ring, nbDef.slot);
        const lvA  = getSkillLv(state, def.ring, def.slot);
        const lvB  = getSkillLv(state, nbDef.ring, nbDef.slot);
        const litA = lvA >= def.maxLv;
        const litB = lvB >= nbDef.maxLv;
        const cls  = (litA && litB) ? 'sk-line-lit' : (litA || litB) ? 'sk-line-half' : 'sk-line';

        return `<line x1="${posA.x.toFixed(1)}" y1="${posA.y.toFixed(1)}" x2="${posB.x.toFixed(1)}" y2="${posB.y.toFixed(1)}" class="${cls}" />`;
      });
    }).join('');

    // ── ノード生成 ──
    const nodesHtml = defs.map(def => {
      const lv     = getSkillLv(state, def.ring, def.slot);
      const maxed  = lv >= def.maxLv;
      const reqMet = def.req(state);
      const cost   = def.cost(lv);
      const canBuy = !maxed && reqMet && tanimachi >= cost;

      const cls = maxed  ? 'sk-node-maxed'
                : canBuy ? 'sk-node-canbuy'
                : reqMet ? 'sk-node-wait'
                :          'sk-node-locked';

      const pos  = ringSlotToXY(def.ring, def.slot);
      const R    = def.ring === 0 ? 28 : def.ring <= 2 ? 22 : def.ring <= 4 ? 18 : 15;

      return `<g class="sk-node ${cls} ${def.isNew ? 'sk-node-new' : ''}" data-id="${def.id}" transform="translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)})" role="button" tabindex="0">
        <circle cx="0" cy="0" r="${R}" class="sk-node-circle" />
        <text class="sk-node-emoji" dy="0.35em">${def.emoji}</text>
        ${maxed ? `<text class="sk-node-check" dy="0.35em">✓</text>` : ''}
      </g>`;
    }).join('');

    // 前の枚から引き継いだスキル
    const inherited = (t.inherited || [])
      .map(x => ({ x, d: skillDefsForPage(x.page).find(d => d.id === x.id) })).filter(o => o.d);
    const inheritHtml = inherited.length ? `
        <div class="sk-section">
          <div class="section-label">引き継いだスキル（${inherited.length}個・ずっと効く）</div>
          <div class="sk-inherit-list">${inherited.map(({ x, d }) =>
            `<span class="sk-inherit">${d.emoji} ${d.name}<small>${x.page}枚目</small></span>`).join('')}</div>
        </div>` : '';

    const kanrokuPips = Array.from({ length: kanrokuMax }, (_, i) =>
      `<span class="kanroku-pip ${i < kanroku ? 'pip-on' : ''}"></span>`
    ).join('');

    // 今効いているスキルの合計（0のものは出さない）
    const f1 = x => (Number.isInteger(x) ? x : x.toFixed(1));
    const totals = [
      fxK.taniPct        && `たにまち +${f1(fxK.taniPct)}%（×${(1 + fxK.taniPct / 100).toFixed(2)}）`,
      fxK.bashoTaniPct   && `場所中のたにまち +${f1(fxK.bashoTaniPct)}%`,
      fxK.taniPerMin     && `女将 毎分 +${f1(fxK.taniPerMin * (fxK.taniAutoMult || 1))}`,
      fxK.taniAutoMult > 1 && `女将の倍率 ×${f1(fxK.taniAutoMult)}`,
      fxK.winChanko      && `勝ちちゃんこ +${f1(fxK.winChanko)}%`,
      fxK.chankoPlus     && `毎場所ちゃんこ +${fxK.chankoPlus}杯`,
      (fxK.chikara || fxK.waza || fxK.hayasa || fxK.taijuu) && `上限 力+${fxK.chikara} 技+${fxK.waza} 速+${fxK.hayasa} 体重+${fxK.taijuu}`,
      fxK.heyaDiscount   && `部屋の強化 −${f1(fxK.heyaDiscount)}%`,
      fxK.kanrokuMult > 1 && `貫禄 ×${fxK.kanrokuMult.toFixed(2)}`,
    ].filter(Boolean);
    const totalsHtml = `
        <div class="sk-section">
          <div class="section-label">いま効いているスキルの合計</div>
          <div class="sk-inherit-list">${totals.length ? totals.map(x => `<span class="sk-inherit">${x}</span>`).join('') : '<span class="sk-inherit">まだありません</span>'}</div>
        </div>`;

    return `
      <div class="scene scene-skillmap">
        <div class="scene-header">
          <button class="btn-back" id="btn-back-skill">戻る</button>
          <h2>スキルマップ ${page}枚目</h2>
        </div>

        <div class="sk-header-currency">
          <span class="sk-cur-label">たにまち</span>
          <span class="sk-cur-val" id="sm-tanimachi">${formatNum(tanimachi)}</span>
        </div>

        <div class="sk-map-wrap">
          <div class="sk-map-container" id="sk-map-container">
            <svg class="sk-svg" id="sk-svg" width="${SVG_SIZE * this.zoom}" height="${SVG_SIZE * this.zoom}" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}">
              <g class="sk-guide-rings">${guideCircles}</g>
              <g class="sk-edges">${edgeLines}</g>
              <g class="sk-nodes">${nodesHtml}</g>
            </svg>
          </div>
          <div class="sk-zoom">
            <button class="sk-zoom-btn" id="sk-zoom-in" aria-label="拡大">＋</button>
            <button class="sk-zoom-btn" id="sk-zoom-out" aria-label="縮小">−</button>
            <button class="sk-zoom-btn sk-zoom-fit" id="sk-zoom-fit" aria-label="全体">全体</button>
          </div>
        </div>

        <div class="sk-page-info">${page < SKILL_PAGE_MAX
          ? `横綱で引退して超転生すると ${page + 1}枚目へ。この枚で解放したスキルからランダムで${SKILL_INHERIT_MAX}個を引き継ぐ（ほかは消える）`
          : `最後の枚（${SKILL_PAGE_MAX}枚目）です`}</div>

        <div class="sk-legend">
          <span class="sk-legend-item"><span class="sk-leg-dot sk-leg-maxed"></span>解放済み</span>
          <span class="sk-legend-item"><span class="sk-leg-dot sk-leg-canbuy"></span>購入可</span>
          <span class="sk-legend-item"><span class="sk-leg-dot sk-leg-wait"></span>たにまち不足</span>
          <span class="sk-legend-item"><span class="sk-leg-dot sk-leg-locked"></span>ロック</span>
        </div>

        ${totalsHtml}
        ${inheritHtml}

        <div class="sk-section">
          <div class="section-label">🏆 貫禄（横綱防衛で蓄積・転生でリセット）</div>
          <div class="kanroku-wrap">
            <div class="kanroku-pips">${kanrokuPips}</div>
            <div class="kanroku-info">${kanroku}/${kanrokuMax} → たにまち +${Math.round((fxK.kanrokuMult - 1) * 100)}%</div>
          </div>
        </div>

        <div class="sk-overlay hidden" id="sk-overlay">
          <div class="sk-popup-box">
            <div class="sp-emoji" id="sp-emoji"></div>
            <div class="sp-name"  id="sp-name"></div>
            <div class="sp-req"   id="sp-req"></div>
            <div class="sp-desc"  id="sp-desc"></div>
            <div class="sp-cost"  id="sp-cost"></div>
            <div class="sp-btns">
              <button class="btn-primary sp-buy-btn" id="sp-buy">購入する</button>
              <button class="btn-ghost"              id="sp-close">閉じる</button>
            </div>
          </div>
        </div>
      </div>`;
  },

  attach() {
    document.getElementById('btn-back-skill').addEventListener('click', () => {
      Game.showScene('home');
    });

    // マップを中心にスクロール（前に見ていた位置があればそこ）
    const container = document.getElementById('sk-map-container');
    if (container) {
      const c = this.viewCenter || { x: SKILL_CENTER, y: SKILL_CENTER };
      container.scrollLeft = c.x * this.zoom - container.clientWidth / 2;
      container.scrollTop  = c.y * this.zoom - container.clientHeight / 2;
      container.addEventListener('scroll', () => { this.viewCenter = this.centerOf(container); });
      this.attachZoom(container);
    }

    document.querySelectorAll('.sk-node').forEach(node => {
      node.addEventListener('click', () => {
        const def = currentSkillDefs(Game.state).find(d => d.id === node.dataset.id);
        if (def) this._openPopup(def);
      });
    });

    document.getElementById('sp-close').addEventListener('click', () => {
      document.getElementById('sk-overlay').classList.add('hidden');
    });
    document.getElementById('sk-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'sk-overlay')
        document.getElementById('sk-overlay').classList.add('hidden');
    });
  },

  // 今見ている中心（SVG の座標）
  centerOf(container) {
    return { x: (container.scrollLeft + container.clientWidth / 2) / this.zoom,
             y: (container.scrollTop + container.clientHeight / 2) / this.zoom };
  },

  // 拡大・縮小：中心（SVG の座標）を保ったまま大きさを変える
  setZoom(container, z, center) {
    const c = center || this.centerOf(container);
    this.zoom = Math.max(SKILL_ZOOM_MIN, Math.min(SKILL_ZOOM_MAX, z));
    const svg = document.getElementById('sk-svg');
    svg.setAttribute('width', 1200 * this.zoom);
    svg.setAttribute('height', 1200 * this.zoom);
    container.scrollLeft = c.x * this.zoom - container.clientWidth / 2;
    container.scrollTop  = c.y * this.zoom - container.clientHeight / 2;
    this.viewCenter = c;
  },

  attachZoom(container) {
    document.getElementById('sk-zoom-in').addEventListener('click', () => this.setZoom(container, this.zoom * 1.3));
    document.getElementById('sk-zoom-out').addEventListener('click', () => this.setZoom(container, this.zoom / 1.3));
    document.getElementById('sk-zoom-fit').addEventListener('click', () =>
      this.setZoom(container, Math.min(container.clientWidth, container.clientHeight) / 1200, { x: SKILL_CENTER, y: SKILL_CENTER }));
    // 2本指でピンチ
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    container.addEventListener('touchstart', e => {
      if (e.touches.length === 2) { pinch = { d: dist(e.touches), z: this.zoom, c: this.centerOf(container) }; e.preventDefault(); }
    }, { passive: false });
    container.addEventListener('touchmove', e => {
      if (pinch && e.touches.length === 2) { e.preventDefault(); this.setZoom(container, pinch.z * dist(e.touches) / pinch.d, pinch.c); }
    }, { passive: false });
    container.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
    // パソコンでは Ctrl＋ホイール（トラックパッドのピンチ）で
    container.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      this.setZoom(container, this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
  },

  _openPopup(def) {
    const state  = Game.state;
    const lv     = getSkillLv(state, def.ring, def.slot);
    const maxed  = lv >= def.maxLv;
    const reqMet = def.req(state);
    const cost   = def.cost(lv);
    const canBuy = !maxed && reqMet && (state.tensei?.tanimachi || 0) >= cost;

    document.getElementById('sp-emoji').textContent = def.emoji;
    document.getElementById('sp-name').textContent  = def.name;
    document.getElementById('sp-req').textContent   = `解放条件: ${def.reqLabel}`;
    document.getElementById('sp-desc').textContent  = def.desc;

    const costEl = document.getElementById('sp-cost');
    let   buyBtn = document.getElementById('sp-buy');

    if (maxed) {
      costEl.textContent = '─ 解放済み ─';
      buyBtn.textContent = '解放済み';
      buyBtn.disabled    = true;
    } else if (!reqMet) {
      costEl.textContent = `条件: ${def.reqLabel}`;
      buyBtn.textContent = '条件未達';
      buyBtn.disabled    = true;
    } else {
      costEl.textContent = `価格: たにまち ${formatNum(cost)}`;
      buyBtn.textContent = '購入する';
      buyBtn.disabled    = !canBuy;
    }

    const newBtn = buyBtn.cloneNode(true);
    buyBtn.replaceWith(newBtn);
    if (canBuy) {
      newBtn.addEventListener('click', () => {
        const t      = Game.state.tensei;
        const before = this.caps();
        t.tanimachi -= cost;
        Sound.play('skill');
        t.skills     = t.skills || {};
        t.skills[def.id] = lv + 1;
        achCheck();
        Game.save();
        document.getElementById('sk-overlay').classList.add('hidden');
        Game.showScene('skillMap', { noFade: true });
        // 能力の上限が上がったら、いくつになったかを出す
        const after = this.caps();
        const diff = after.filter((x, i) => x.v !== before[i].v).map((x, i) =>
          `${x.label}の上限 ${before.find(b => b.label === x.label).v}${x.unit} → ${x.v}${x.unit}`);
        if (diff.length) this.toast(diff.join('<br>'));
      });
    }

    document.getElementById('sk-overlay').classList.remove('hidden');
  },

  // 能力の上限（解放の前後で比べる）
  caps() {
    return [['chikara', '力', ''], ['waza', '技', ''], ['hayasa', '速さ', ''], ['taijuu', '体重', 'kg']]
      .map(([k, label, unit]) => ({ label, unit, v: statMax(Game.state, k) }));
  },

  toast(html) {
    const el = document.createElement('div');
    el.className = 'sk-toast';
    el.innerHTML = html;
    document.querySelector('.scene-skillmap')?.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },
};
