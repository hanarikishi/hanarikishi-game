const TitleScene = {
  render() {
    return `
      <div class="scene scene-title">
        <div class="title-bg-ring"></div>
        <div class="title-content">
          <div class="title-sub">相撲育成ゲーム</div>
          <h1 class="title-logo">
            <span class="title-dosukoi">どすこい！</span>
            <span class="title-hana">はなりきし</span>
          </h1>
          <div class="title-opening">
            <video src="assets/video/opening.mp4" autoplay muted loop playsinline preload="auto" disablepictureinpicture controlslist="nodownload noplaybackrate" tabindex="-1"></video>
          </div>
          <div class="title-btns">
            ${localStorage.getItem('hanarikisi_save')
              ? `<button class="btn-primary btn-title-main" id="btn-continue">つづきから</button>
                 <button class="btn-title-sub" id="btn-start">はじめから</button>`
              : '<button class="btn-primary btn-title-main" id="btn-start">はじめる</button>'}
          </div>
        </div>
      </div>`;
  },

  attach() {
    // 再生が始まるまで動画は見せない（再生ボタンの絵が一瞬出るのを防ぐ）
    const v = document.querySelector('.title-opening video');
    if (v) {
      v.addEventListener('playing', () => v.classList.add('on'), { once: true });
      v.play?.().catch(() => {});
    }
    document.getElementById('btn-continue')?.addEventListener('click', () => {
      Game.loadSave();
      Game.showScene(Game.state ? 'home' : 'create');   // 古い形式のセーブは捨てられるので新しく始める
    });
    document.getElementById('btn-start').addEventListener('click', () => {
      // はじめから：今のセーブは「力士を作る」で土俵へ出たときに上書きされる
      if (!localStorage.getItem('hanarikisi_save')) { Game.showScene('create'); return; }
      Game.confirmBox('はじめからにすると、<b>今までのセーブは消えます</b>。<br>本当にはじめからにしますか？', 'はじめから', () => Game.showScene('create'));
    });
  },
};
