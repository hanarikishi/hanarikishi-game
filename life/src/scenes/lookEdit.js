// 自分の見た目（目・肌・まわし）を変える（ホームから）
const LookEditScene = {
  render() {
    const r = Game.state.rikishi;
    return `
      <div class="scene scene-look">
        <div class="scene-header">
          <button class="btn-back" id="btn-back">戻る</button>
          <h2>見た目</h2>
        </div>
        <div class="al-hint">取組の${r.shikona}の絵が変わります。「はなりきし」は表情が変わる絵です</div>
        <div id="look-editor">${LookEditor.html(r.look || null)}</div>
      </div>`;
  },

  attach() {
    const r  = Game.state.rikishi;
    const le = document.getElementById('look-editor');
    LookSprite.fill(le);
    LookEditor.bind(le, r.look || null, l => {
      r.look = { ...l };
      Game.save();
    });
    document.getElementById('btn-back').addEventListener('click', () => Game.showScene('home'));
  },
};
