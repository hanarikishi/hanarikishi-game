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
function addTramp(st, r) {
  const len = R(r, 90, 130), tilt = R(r, 0, 22) * Math.PI / 180;
  const lo = st.shooter + 120, hi = st.hoop.x - 110 - len - 28;
  if (hi < lo) return false;
  const fx = R(r, lo, hi), gap = R(r, 78, 100), t1 = fx + 28, t2 = t1 + len * Math.cos(tilt), y1 = C.FLOOR - 8, y2 = y1 - len * Math.sin(tilt);
  st.walls.push([fx, st.ceil, fx, C.FLOOR - gap, 'w']);                     // 天井から下がる棒（下をくぐる）
  st.walls.push([Math.round(t1), y1, Math.round(t2), Math.round(y2), 'z']);   // トランポリン
  return true;
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
  if (kind === 'peg') {   // 棒（短い棒を3本ならべる）
    const ang = r() * Math.PI, d = R(r, 28, 36);
    for (let j = -1; j <= 1; j++) {
      const cx = px + Math.cos(ang) * d * j, cy = py + Math.sin(ang) * d * j, a = ang + Math.PI / 2 + R(r, -30, 30) * Math.PI / 180, l = R(r, 16, 26);
      st.walls.push([Math.round(cx - Math.cos(a) * l), Math.round(cy - Math.sin(a) * l), Math.round(cx + Math.cos(a) * l), Math.round(cy + Math.sin(a) * l), 'w']);
    }
  } else {
    const len = R(r, 70, 130) / 2, ang = (R(r, -35, 35)) * Math.PI / 180;
    st.walls.push([Math.round(px - Math.cos(ang) * len), Math.round(py - Math.sin(ang) * len), Math.round(px + Math.cos(ang) * len), Math.round(py + Math.sin(ang) * len), kind === 'mat' ? 'z' : 'w']);
  }
  return true;
}
// ---- 4章 × 8面 ----
const PER = 8, TOTAL = 32;
const lerp = (a, b, k) => a + (b - a) * k;

// 面のかたち。dist=打つ人とゴールの距離 / bank=ボードへ当てる壁 / moving=ゴールが動く（v=縦 h=横 fast=速い）
function make(r, k, o) {
  const hx0 = o.dist ? R(r, Math.max(560, o.dist + 45), 640) : o.moving === 'h' ? R(r, 500, 620) : R(r, 480, 640);
  const hy = o.moving === 'v' ? R(r, 170, 250) : R(r, 150, 280);
  const shooter = o.dist ? Math.max(45, hx0 - o.dist) : R(r, 50, 300);
  const hx = o.bank ? Math.max(hx0, 560) : hx0;
  const st = { shooter, hoop: { x: hx, y: hy, board: 'R' } };
  if (o.bank) st.walls = [[hx - R(r, 90, 130), hy - R(r, 40, 80), hx - 20, hy - R(r, 55, 70), 'w']];
  if (o.moving) {
    const amp = R(r, 30, 40 + k);
    if (o.moving === 'h') st.hoop.dx = amp; else st.hoop.dy = amp;
    st.hoop.period = o.fast ? R(r, 16, 24) / 10 : R(r, 22, 40) / 10;
  }
  return st;
}

// 章の中身（1-1〜1-4 は「距離が遠くなるだけ」。そのあと仕掛けを足して、最後の章で全部まぜる）
const CHAPTERS = [
  { name: '遠いゴールと空中の板', specs: [
    { o: { dist: 300 }, free: 1 }, { o: { dist: 390 }, free: 1 }, { o: { dist: 480 }, free: 1 }, { o: { dist: 570 }, free: 1 },
    { o: {}, obs: ['plank'] }, { o: {}, obs: ['plank'] }, { o: {}, obs: ['plank', 'plank'] }, { o: { dist: 480 }, obs: ['plank', 'plank'] },
  ] },
  { name: 'バンクと杭の森', specs: [
    { o: { bank: 1 } }, { o: { bank: 1 } }, { o: { bank: 1, dist: 480 } },
    { o: {}, obs: ['peg'] }, { o: {}, obs: ['peg'] }, { o: {}, obs: ['peg', 'peg'] },
    { o: {}, obs: ['peg', 'plank'] }, { o: { bank: 1 }, obs: ['peg'] },
  ] },
  { name: '動くゴールとトランポリン', specs: [
    { o: { moving: 'v' } }, { o: { moving: 'v' } }, { o: { moving: 'h' } }, { o: { moving: 'h', fast: 1 } },
    { o: {}, obs: ['tramp'] }, { o: {}, obs: ['tramp', 'plank'] },
    { o: { moving: 'v' }, obs: ['tramp'] }, { o: { moving: 'h' }, obs: ['tramp'] },
  ] },
  { name: '総まとめ', specs: [
    { o: { bank: 1 }, obs: ['plank'] }, { o: { moving: 'v' }, obs: ['peg'] }, { o: {}, obs: ['tramp', 'peg'] },
    { o: { moving: 'h' }, obs: ['tramp', 'plank'] }, { o: { bank: 1 }, obs: ['tramp'] }, { o: { moving: 'v', fast: 1 }, obs: ['peg', 'plank'] },
    { o: {}, obs: ['tramp', 'peg', 'plank'] }, { o: { moving: 'v', fast: 1 }, obs: ['tramp', 'plank', 'peg'] },
  ] },
];

// 先へ進むほど、輪は小さく・天井は低く・入る打ち方は少なく
const RIM_AT = k => Math.round(lerp(40, 23, k / (TOTAL - 1)));
const GAP_AT = k => lerp(190, 70, k / (TOTAL - 1));
const HI_AT = k => 0.20 * Math.pow(0.15, k / (TOTAL - 1));

// 解き方の見本（入る打ち方のまん中あたり）。同じ打ち方が何面も通るのを防ぐのに使う
function sampleSol(st) {
  const sols = [];
  for (let a = 12; a <= 82; a += 3) for (let sp = 400; sp <= C.MAX_SPEED; sp += 30) {
    const rad = a * Math.PI / 180, vx = Math.cos(rad) * sp, vy = -Math.sin(rad) * sp;
    if (S.simulate(st, vx, vy).scored) sols.push([vx, vy]);
  }
  return sols.length ? sols[Math.floor(sols.length / 2)] : null;
}

const out = [], notes = [];
let seed = 11;
CHAPTERS.forEach((ch, ci) => {
  const got = [];
  ch.specs.forEach((spec, si) => {
    const k = ci * PER + si;
    let obs = (spec.obs || []).slice().sort((a, b) => (b === 'tramp') - (a === 'tramp')), made = null;   // トランポリンを先に置く
    while (!made) {
      for (let i = 0; i < 4000 && !made; i++) {
        const r = rng(seed++);
        const st = make(r, k, spec.o);
        st.hoop.rim = RIM_AT(k);
        st.ceil = Math.max(30, Math.round(st.hoop.y - (st.hoop.dy || 0) - GAP_AT(k) - r() * 60));
        st.walls = st.walls || []; st.pegs = st.pegs || [];
        if (!obs.every(kd => kd === 'tramp' ? addTramp(st, r) : addBlocker(st, r, kd))) continue;
        const ratio = solveRatio(st);
        const hi = spec.free ? 1 : HI_AT(k), lo = spec.free ? 0.02 : Math.max(0.003, hi * 0.25);
        if (ratio < lo || ratio > hi) continue;
        // 障害物があるなら、あるとないとで入りやすさが3割以上変わるものだけ（飾りは使わない）
        const hasObs = st.walls.length + st.pegs.length > (spec.o.bank ? 1 : 0);
        if (hasObs) { const bare = bareRatio(st); if (Math.abs(bare - ratio) < 0.25 * Math.max(bare, ratio)) continue; }
        // トランポリンの面は、トランポリンが無いと ほとんど入らないものだけ（飾りにしない）
        if (obs.includes('tramp')) { const noT = solveRatio({ ...st, walls: st.walls.filter(w => w[4] !== 'z') }); if (noT > 0.3 * ratio) continue; }
        // 直前の3面と、同じ打ち方で入ってしまうものは使わない
        st.sol = sampleSol(st);
        if (!st.sol || got.slice(-3).some(o => S.simulate(st, o.sol[0], o.sol[1]).scored || S.simulate(o, st.sol[0], st.sol[1]).scored)) continue;
        st.ratio = +ratio.toFixed(4); made = st;
      }
      if (!made) { const dropped = obs.pop(); notes.push(`${ci + 1}-${si + 1}: 作れなかったので障害物 ${dropped} を外した`); if (!dropped) throw new Error('作れない: ' + ch.name + ' ' + (si + 1)); }
    }
    process.stdout.write(`${ci + 1}-${si + 1} (${(made.ratio * 100).toFixed(1)}%) 輪${made.hoop.rim}\n`);
    got.push(made);
  });
  got.forEach(st => { st.chapter = ci; out.push({ ...st, sol: undefined }); });
});
notes.forEach(n => console.log(n));
const js = '// node _docs/tools/gen_shoot_stages.js で作ったステージ（手で書きかえない）\nwindow.SHOOT_CHAPTERS = ' + JSON.stringify(CHAPTERS.map(c => c.name)) + ';\nwindow.SHOOT_PER = ' + PER + ';\nwindow.SHOOT_STAGES = [\n' + out.map(s => '  ' + JSON.stringify(s)).join(',\n') + '\n];\n';
fs.writeFileSync(path.join(root, 'shoot', 'stages.js'), js);
console.log('書き出し', out.length, '面');
