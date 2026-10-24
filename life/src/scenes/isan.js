const IsanScene = {
  alloc: null,
  totalPts: 0,
  pick: null,   // 次のスキルマップへ引き継ぐスキルのID

  // 次の枚へ引き継ぐスキルを選ぶ欄（最後の枚なら出さない）
  inheritHtml() {
    const s = Game.state;
    const page = skillPage(s);
    if (page >= SKILL_PAGE_MAX) return '';
    const sk = s.tensei.skills || {};
    const learned = currentSkillDefs(s).filter(d => sk[d.id] >= 1);
    if (!learned.length) return `<div class="isan-desc">スキルマップは ${page + 1}枚目へ進みます（この枚で解放したスキルは無いので、引き継ぐものはありません）</div>`;
    return `<div class="isan-desc">スキルマップは ${page + 1}枚目へ進みます。この枚で解放したスキルから、ランダムで${SKILL_INHERIT_MAX}個までが引き継がれます（ほかは消えます）</div>`;
  },

  render(data) {
    const r    = Game.state.rikishi;
    const t    = Game.state.tensei || {};
    const isan = t.isan || {};
    const pts  = calcIsanPoints(r, Game.state);
    this.totalPts = pts;
    if (!this.alloc) this.alloc = { chikara: 0, waza: 0, hayasa: 0, tanimachiSpeed: 0 };
    if (!this.pick)  this.pick  = new Set();

    const used   = Object.values(this.alloc).reduce((s, v) => s + v, 0) * ISAN_COST;
    const remain = pts - used;

    const cats = [
      { key: 'chikara',        label: '力',             sub: '初期値+',  accum: isan.chikara        || 0 },
      { key: 'waza',           label: '技',             sub: '初期値+',  accum: isan.waza           || 0 },
      { key: 'hayasa',         label: '速さ',           sub: '初期値+',  accum: isan.hayasa         || 0 },
      { key: 'tanimachiSpeed', label: 'たにまち獲得速度', sub: 'ボーナス+%', accum: isan.tanimachiSpeed || 0 },
    ];

    const rows = cats.map(c => `
      <div class="isan-row" data-key="${c.key}">
        <div class="isan-label">
          <span class="isan-cat">${c.label}</span>
          <span class="isan-sub">${c.sub}</span>
        </div>
        <div class="isan-accum">累計 +${c.accum}</div>
        <div class="isan-control">
          <button class="isan-minus" data-key="${c.key}">−</button>
          <span class="isan-val" id="isan-val-${c.key}">${this.alloc[c.key]}</span>
          <button class="isan-plus" data-key="${c.key}">＋</button>
        </div>
      </div>`).join('');

    return `
      <div class="scene scene-isan">
        <div class="scene-header">
          <button class="btn-back" id="btn-back-isan">戻る</button>
          <h2>遺産ポイント振り分け</h2>
        </div>

        <div class="isan-pts-banner">
          獲得した遺産ポイント<br>
          <span class="isan-pts-total">${pts}pt</span><br>
          <span class="isan-pts-remain" id="isan-remain">残り ${remain}pt</span>
        </div>

        <div class="isan-desc">幕内優勝1回・横綱在位1場所で1pt。${ISAN_COST}ptで +1（たにまちは +1%）。振り分けたボーナスは超転生後も累積されます</div>

        <div class="isan-rows">${rows}</div>

        ${this.inheritHtml()}

        <button class="btn-primary btn-large" id="btn-confirm-isan">超転生する</button>
      </div>`;
  },

  attach(data) {
    document.getElementById('btn-back-isan').addEventListener('click', () => {
      this.alloc = null;
      this.pick  = null;
      Game.showScene('tensei');
    });

    const updateRemain = () => {
      const used   = Object.values(this.alloc).reduce((s, v) => s + v, 0) * ISAN_COST;
      const remain = this.totalPts - used;
      const el = document.getElementById('isan-remain');
      if (el) el.textContent = `残り ${remain}pt`;
    };

    document.querySelectorAll('.isan-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (this.alloc[key] > 0) {
          this.alloc[key]--;
          const el = document.getElementById(`isan-val-${key}`);
          if (el) el.textContent = this.alloc[key];
          updateRemain();
        }
      });
    });

    document.querySelectorAll('.isan-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const key  = btn.dataset.key;
        const used = Object.values(this.alloc).reduce((s, v) => s + v, 0) * ISAN_COST;
        if (used + ISAN_COST <= this.totalPts) {
          this.alloc[key]++;
          const el = document.getElementById(`isan-val-${key}`);
          if (el) el.textContent = this.alloc[key];
          updateRemain();
        }
      });
    });

    document.getElementById('btn-confirm-isan').addEventListener('click', () => {
      const page = skillPage(Game.state);
      const msg = page < SKILL_PAGE_MAX
        ? `引退して、新弟子を探しますか？
スキルマップは${page + 1}枚目へ進み、引き継ぎはランダムです`
        : '引退して、新弟子を探しますか？';
      if (!confirm(msg)) return;
      const alloc = this.alloc;
      const inherit = [...this.pick];
      this.alloc = null;
      this.pick  = null;
      Game.state.scoutPool = null;
      Game.showScene('scout', { isSuper: true, alloc, inherit });
    });
  },
};
