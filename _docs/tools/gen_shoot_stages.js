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

// 障害物をなくしたときの割合（障害物が本当に効いているかを調べる）
function bareRatio(st) { return solveRatio({ ...st, walls: [], pegs: [] }); }

// 障害物は「入る打ち方の軌道の上」に置く（地面から生えた壁は、山なりに飛ばせば越えられるので使わない）
function pathOf(st, vx, vy) {
  const h = S.ballHome(st), b = { x: h.x, y: h.y, vx, vy }, pts = [];
  for (let i = 0; i < 5 / C.DT; i++) {
    const py = b.y, hp = S.step(b, st, i * C.DT, () => {});
    if (i % 6 === 0) pts.push([b.x, b.y]);
    if (S.through(py, b, hp)) return pts;
    if (b.x < -40 || b.y > C.FLOOR) break;
  }
  return null;
}
function addBlocker(st, r, kind) {
  const sols = [];
  for (let a = 12; a <= 80; a += 4) for (let sp = 400; sp <= C.MAX_SPEED; sp += 40) {
    const rad = a * Math.PI / 180;
    if (S.simulate(st, Math.cos(rad) * sp, -Math.sin(rad) * sp).scored) sols.push([Math.cos(rad) * sp, -Math.sin(rad) * sp]);
  }
  if (!sols.length) return false;
  const [vx, vy] = sols[Math.floor(r() * sols.length)], pts = pathOf(st, vx, vy);
  if (!pts || pts.length < 12) return false;
  const k = Math.floor(pts.length * (0.3 + r() * 0.35)), [px, py] = pts[k], hp = S.hoopAt(st, 0);
  if (py < st.ceil + 36 || py > C.FLOOR - 70 || Math.hypot(px - hp.x, py - hp.y) < 100 || Math.abs(px - S.ballHome(st).x) < 90) return false;
  if (kind === 'peg') {
    const ang = r() * Math.PI, d = R(r, 22, 30);
    for (let j = -1; j <= 1; j++) st.pegs.push([Math.round(px + Math.cos(ang) * d * j), Math.round(py + Math.sin(ang) * d * j), R(r, 9, 12)]);
  } else {
    const len = R(r, 70, 130) / 2, ang = (R(r, -35, 35)) * Math.PI / 180;
    st.walls.push([Math.round(px - Math.cos(ang) * len), Math.round(py - Math.sin(ang) * len), Math.round(px + Math.cos(ang) * len), Math.round(py + Math.sin(ang) * len), kind === 'mat' ? 'z' : 'w']);
  }
  return true;
}
const base = (r, i) => ({ shooter: R(r, 50, 300), hoop: { x: R(r, 480, 640), y: R(r, 150, 280), board: 'R' } });

const CHAPTERS = [
  { name: 'はじめてのコート', obs: [], make: (r, i) => ({ shooter: R(r, 50, 100 + i * 20), hoop: { x: R(r, 470, 520) + i * 12, y: R(r, 130, 280), board: 'R' } }) },
  { name: '空中の板', obs: ['plank'], make: base },
  { name: 'ふたつの板', obs: ['plank', 'plank'], make: base },
  { name: 'バンクショット', obs: [], make: (r, i) => {
    const hx = R(r, 560, 640), hy = R(r, 170, 280);
    return { shooter: R(r, 50, 180), hoop: { x: hx, y: hy, board: 'R' }, walls: [[hx - R(r, 90, 130), hy - R(r, 40, 80), hx - 20, hy - R(r, 55, 70), 'w']] };
  } },
  { name: '杭の森', obs: ['peg', 'peg'], make: base },
  { name: '動くゴール', obs: [], make: (r, i) => {
    const vert = r() < 0.6;
    return { shooter: R(r, 50, 160), hoop: { x: R(r, 500, 620), y: R(r, 170, 250), board: 'R', dx: vert ? 0 : R(r, 30, 50 + i * 3), dy: vert ? R(r, 30, 50 + i * 4) : 0, period: R(r, 22, 40) / 10 } };
  } },
  { name: 'はねるマット', obs: ['mat', 'plank'], make: base },
  { name: '総まとめ', obs: ['plank', 'peg', 'mat'], pick: 2, make: (r, i) => {
    const st = base(r, i);
    if (r() < 0.5) { st.hoop.dy = R(r, 30, 60); st.hoop.period = R(r, 25, 40) / 10; }
    return st;
  } },
];

// 章ごとの輪の大きさ（半幅）と、入る打ち方の割合の範囲。章が進むほど輪が小さく、入る打ち方が少なくなる
const RIMS = [40, 37, 34, 31, 29, 27, 25, 23];
const HI = [0.20, 0.13, 0.09, 0.065, 0.045, 0.045, 0.04, 0.03];

// 天井: 輪の高さからどれだけ上に置くか（章が進むほど低く＝高く打ち上げられない）
const GAP_LO = [190, 170, 150, 135, 115, 100, 85, 70];

// 解き方の見本（入る打ち方のまん中あたり）。同じ打ち方が何面も通るのを防ぐのに使う
function sampleSol(st) {
  const sols = [];
  for (let a = 12; a <= 82; a += 3) for (let sp = 400; sp <= C.MAX_SPEED; sp += 30) {
    const rad = a * Math.PI / 180, vx = Math.cos(rad) * sp, vy = -Math.sin(rad) * sp;
    if (S.simulate(st, vx, vy).scored) sols.push([vx, vy]);
  }
  return sols.length ? sols[Math.floor(sols.length / 2)] : null;
}

const out = [];
let seed = 7;
CHAPTERS.forEach((ch, ci) => {
  const got = [];
  for (let i = 0; got.length < 10; i++) {
    const r = rng(seed++);
    if (i > 6000) throw new Error('作れない: ' + ch.name);
    const st = ch.make(r, got.length);
    st.hoop.rim = RIMS[ci];
    st.ceil = Math.max(30, Math.round(st.hoop.y - (st.hoop.dy || 0) - GAP_LO[ci] - r() * 60));
    st.walls = st.walls || []; st.pegs = st.pegs || [];
    let kinds = ch.obs.slice();
    if (ch.pick) kinds = kinds.sort(() => r() - 0.5).slice(0, ch.pick);
    if (!kinds.every(k => addBlocker(st, r, k))) continue;
    const ratio = solveRatio(st);
    // 章ごとの範囲に収まるものだけを使う（前の章よりはっきり難しくなる）
    const hi = HI[ci], lo = Math.max(0.003, hi * 0.25);
    if (i % 200 === 199) process.stdout.write(`  ..${ch.name} ${i + 1}回試して ${got.length}面\n`);
    // 障害物があるなら、あるとないとで入りやすさが3割以上変わるものだけ（飾りの障害物は使わない）
    const hasObs = st.walls.length + st.pegs.length > 0;
    if (ratio >= lo && ratio <= hi && hasObs) { const bare = bareRatio(st); if (Math.abs(bare - ratio) < 0.25 * Math.max(bare, ratio)) continue; st.bare = +bare.toFixed(4); }
    if (ratio >= lo && ratio <= hi) {
      // 直前の3面と、同じ打ち方で入ってしまうものは使わない
      st.sol = sampleSol(st);
      if (!st.sol || got.slice(-3).some(o => S.simulate(st, o.sol[0], o.sol[1]).scored || S.simulate(o, st.sol[0], st.sol[1]).scored)) continue;
    }
    if (ratio >= lo && ratio <= hi) { st.ratio = +ratio.toFixed(4); got.push(st); process.stdout.write(`${ch.name} ${got.length}/10 (${(ratio * 100).toFixed(1)}%)\n`); }
  }
  // 章の中はやさしい順
  got.sort((a, b) => b.ratio - a.ratio);
  got.forEach(st => { st.chapter = ci; delete st.sol; delete st.bare; out.push(st); });
});
const js = '// node _docs/tools/gen_shoot_stages.js で作ったステージ（手で書きかえない）\nwindow.SHOOT_CHAPTERS = ' + JSON.stringify(CHAPTERS.map(c => c.name)) + ';\nwindow.SHOOT_STAGES = [\n' + out.map(s => '  ' + JSON.stringify(s)).join(',\n') + '\n];\n';
fs.writeFileSync(path.join(root, 'shoot', 'stages.js'), js);
console.log('書き出し', out.length, '面');
