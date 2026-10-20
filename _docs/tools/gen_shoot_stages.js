// はなりきしシュートのステージを作る道具
// node _docs/tools/gen_shoot_stages.js   → shoot/stages.js を書き出す
// 1面ずつ、角度と強さを総当たりで打ってみて「入る打ち方がある・簡単すぎない」ものだけを使う
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
eval(fs.readFileSync(path.join(root, 'shoot', 'core.js'), 'utf8'));
const S = globalThis.SHOOT, C = S.C;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = (r, a, b) => Math.round(a + r() * (b - a));

// 入る打ち方の割合（動くゴールは、いくつかのタイミングで調べて平均）
function solveRatio(st) {
  const phases = st.hoop.period ? [0, 0.25, 0.5, 0.75].map(k => k * st.hoop.period) : [0];
  let ok = 0, n = 0;
  for (const t0 of phases) for (let a = 8; a <= 86; a += 1.5) for (let sp = 300; sp <= C.MAX_SPEED; sp += 17) {
    const r = a * Math.PI / 180; n++;
    if (S.simulate(st, Math.cos(r) * sp, -Math.sin(r) * sp, t0).scored) ok++;
  }
  return ok / n;
}

const CHAPTERS = [
  { name: 'はじめての土俵', make: (r, i) => ({ shooter: R(r, 50, 120 + i * 6), hoop: { x: R(r, 470, 520) + i * 12, y: R(r, 130, 280), board: 'R' } }) },
  { name: '天井に注意', make: (r, i) => {
    const hx = R(r, 480, 640), hy = R(r, 200, 300), cy = R(r, 60, 130 - i * 2);
    return { shooter: R(r, 50, 150), hoop: { x: hx, y: hy, board: 'R' }, walls: [[R(r, 160, 260), cy, R(r, 420, hx - 60), cy, 'w']] };
  } },
  { name: '壁ごし', make: (r, i) => {
    const hx = R(r, 500, 640), wx = R(r, 280, 430), top = R(r, 230 - i * 8, 300);
    return { shooter: R(r, 50, 160), hoop: { x: hx, y: R(r, 150, 260), board: 'R' }, walls: [[wx, C.FLOOR, wx, top, 'w']] };
  } },
  { name: 'バンクショット', make: (r, i) => {
    const hx = R(r, 560, 640), hy = R(r, 170, 280);
    return { shooter: R(r, 50, 180), hoop: { x: hx, y: hy, board: 'R' }, walls: [[hx - R(r, 90, 130), hy - R(r, 40, 80), hx - 20, hy - R(r, 55, 70), 'w']] };
  } },
  { name: '杭の森', make: (r, i) => {
    const hx = R(r, 500, 640), hy = R(r, 140, 270), pegs = [];
    for (let k = 0; k < 4 + Math.floor(i / 2); k++) {
      const x = R(r, 200, 560), y = R(r, 70, 330);
      if (Math.hypot(x - hx, y - hy) < 70) continue;
      pegs.push([x, y, R(r, 7, 12)]);
    }
    return { shooter: R(r, 50, 150), hoop: { x: hx, y: hy, board: 'R' }, pegs };
  } },
  { name: '動くゴール', make: (r, i) => {
    const vert = r() < 0.6;
    return { shooter: R(r, 50, 160), hoop: { x: R(r, 500, 620), y: R(r, 170, 250), board: 'R', dx: vert ? 0 : R(r, 30, 50 + i * 3), dy: vert ? R(r, 30, 50 + i * 4) : 0, period: R(r, 22, 40) / 10 } };
  } },
  { name: 'はねる座布団', make: (r, i) => {
    const hx = R(r, 520, 640), hy = R(r, 140, 230), px = R(r, 260, 420);
    return { shooter: R(r, 50, 150), hoop: { x: hx, y: hy, board: 'R' },
      walls: [[px - 60, C.FLOOR - 6, px + 60, C.FLOOR - 6, 'z'], [R(r, 200, 260), R(r, 40, 110), R(r, 430, 480), R(r, 40, 110), 'w']] };
  } },
  { name: '総まとめ', make: (r, i) => {
    const st = { shooter: R(r, 50, 150), hoop: { x: R(r, 500, 630), y: R(r, 150, 260), board: 'R' }, walls: [], pegs: [] };
    const feats = ['ceil', 'wall', 'pegs', 'move', 'zab'].sort(() => r() - 0.5).slice(0, 2);
    if (feats.includes('ceil')) st.walls.push([R(r, 180, 260), R(r, 60, 110), R(r, 400, 460), R(r, 60, 110), 'w']);
    if (feats.includes('wall')) { const wx = R(r, 300, 430); st.walls.push([wx, C.FLOOR, wx, R(r, 230, 300), 'w']); }
    if (feats.includes('pegs')) for (let k = 0; k < 4; k++) { const x = R(r, 220, 540), y = R(r, 80, 320); if (Math.hypot(x - st.hoop.x, y - st.hoop.y) > 70) st.pegs.push([x, y, 9]); }
    if (feats.includes('move')) { st.hoop.dy = R(r, 30, 60); st.hoop.period = R(r, 25, 40) / 10; }
    if (feats.includes('zab')) { const px = R(r, 260, 420); st.walls.push([px - 60, C.FLOOR - 6, px + 60, C.FLOOR - 6, 'z']); }
    return st;
  } },
];

const out = [];
let seed = 7;
CHAPTERS.forEach((ch, ci) => {
  const got = [];
  for (let i = 0; got.length < 10; i++) {
    const r = rng(seed++);
    const st = ch.make(r, got.length);
    st.walls = st.walls || []; st.pegs = st.pegs || [];
    const ratio = solveRatio(st);
    // 入る打ち方がある（0.4%以上）・簡単すぎない（章が進むほど厳しく）
    const hi = 0.12 - ci * 0.01;
    if (ratio >= 0.004 && ratio <= hi) { st.ratio = +ratio.toFixed(4); got.push(st); process.stdout.write(`${ch.name} ${got.length}/10 (${(ratio * 100).toFixed(1)}%)\n`); }
    if (i > 400) throw new Error('作れない: ' + ch.name);
  }
  // 章の中はやさしい順
  got.sort((a, b) => b.ratio - a.ratio);
  got.forEach(st => { st.chapter = ci; out.push(st); });
});
const js = '// node _docs/tools/gen_shoot_stages.js で作ったステージ（手で書きかえない）\nwindow.SHOOT_CHAPTERS = ' + JSON.stringify(CHAPTERS.map(c => c.name)) + ';\nwindow.SHOOT_STAGES = [\n' + out.map(s => '  ' + JSON.stringify(s)).join(',\n') + '\n];\n';
fs.writeFileSync(path.join(root, 'shoot', 'stages.js'), js);
console.log('書き出し', out.length, '面');
