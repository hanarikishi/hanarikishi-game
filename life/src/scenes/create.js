const CreateScene = {
  selectedType: 'medium',
  look: null,   // 見た目（null＝はなりきし）

  render() {
    const types = Object.entries(BODY_TYPES);
    const cards = types.map(([key, bt]) => `
      <div class="body-type-card ${key === 'medium' ? 'selected' : ''}" data-type="${key}">
        <div class="btc-name">${bt.name}</div>
        <div class="btc-desc">${bt.desc}</div>
        <div class="btc-stats">
          <span class="stat-chip">力 ${playerStartStat(bt, 'chikara')}</span>
          <span class="stat-chip">技 ${playerStartStat(bt, 'waza')}</span>
          <span class="stat-chip">速 ${playerStartStat(bt, 'hayasa')}</span>
          <span class="stat-chip">${bt.taijuu}kg</span>
        </div>
      </div>`).join('');

    return `
      <div class="scene scene-create">
        <div class="scene-header">
          <h2>力士を作る</h2>
        </div>
        <div class="create-form">
          <div class="form-group">
            <label>四股名（しこな）</label>
            <input type="text" id="input-shikona" placeholder="例：はなりきし" maxlength="10" />
            <div class="name-ng hidden" id="name-ng"></div>
          </div>
          <div class="form-group">
            <label>体格タイプ</label>
            <div class="body-type-grid">${cards}</div>
          </div>
          <div class="form-group">
            <label>見た目</label>
            <div id="look-editor">${LookEditor.html(this.look)}</div>
          </div>
          <button class="btn-primary btn-large" id="btn-create">土俵へ！</button>
        </div>
      </div>`;
  },

  attach() {
    this.selectedType = 'medium';
    const le = document.getElementById('look-editor');
    LookSprite.fill(le);
    LookEditor.bind(le, this.look, l => { this.look = l; });

    document.querySelectorAll('.body-type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.body-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedType = card.dataset.type;
      });
    });

    document.getElementById('btn-create').addEventListener('click', () => {
      const shikona = document.getElementById('input-shikona').value.trim() || 'はなりきし';
      const ng = shikonaNgReason(shikona);
      if (ng) {
        const el = document.getElementById('name-ng');
        el.textContent = ng; el.classList.remove('hidden');
        return;
      }
      Game.state = {
        rikishi:  { ...createPlayer(shikona, this.selectedType), ...(this.look ? { look: this.look } : { look: { ...LOOK_DEFAULT } }) },
        saveVersion: SAVE_VERSION,
        calendar: { year: GAME_START_YEAR, bashoIndex: 0, phase: 'ready', day: 1 },
        basho:    { day: 0, wins: 0, losses: 0, results: [], opponent: null, tanimachiEarned: 0 },
        chankoPts: 0,
        tensei: {
          tanimachi: 0,
          heya: {},
          skills: {},
          kanroku: 0,
          kamisanAccum: 0,
          isan: { chikara: 0, waza: 0, hayasa: 0, tanimachiSpeed: 0 },
        },
        rebirthCount: 0,
        superRebirthCount: 0,
      };
      achPatch(Game.state);
      rosterPatch(Game.state);
      rosterOnNewLife(Game.state);
      Game.save();
      Game.showScene('home');
    });
  },
};
