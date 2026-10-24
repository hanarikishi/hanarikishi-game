// はなりきしシュートの物理（ゲーム本体と、ステージを作る道具の両方から使う）
// ステージ: { shooter: x, ceil（天井の高さ。省くと天井なし）, hoop: { x, y, board: 'R' | 'L' | null, dx, dy, period, rim（輪の半幅。省くと27） }, walls: [[x1, y1, x2, y2, 種類]], pegs: [[x, y, r]] }
//   walls の種類: 'w' 板（ふつうに跳ね返る）  'z' トランポリン（強くはねる。当たった向きの速さが 1.3倍になって返る）
(function (root) {
  'use strict';
  const C = { W: 700, H: 420, FLOOR: 384, BALL_R: 13, G: 1300, RIM_HALF: 27, MAX_SPEED: 1150, PULL_K: 6, DT: 1 / 240, WALL_T: 5 };

  function hoopAt(st, t) {
    const h = st.hoop, k = h.period ? Math.sin(t * 2 * Math.PI / h.period) : 0;
    return { x: h.x + (h.dx || 0) * k, y: h.y + (h.dy || 0) * k, rim: h.rim || C.RIM_HALF };
  }
  function boardSeg(st, hp) {
    if (st.hoop.board === null) return null;
    const bx = st.hoop.board === 'L' ? hp.x - hp.rim - 8 : hp.x + hp.rim + 8;
    return [bx, hp.y - 95, bx, hp.y + 12, 'b'];
  }
  const ballHome = st => ({ x: st.shooter + 12, y: C.FLOOR - 64 });

  function hitPoint(b, px, py, rad, bounce, kind, onHit) {
    const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy), min = C.BALL_R + rad;
    if (d >= min || d === 0) return;
    const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
    b.x = px + nx * min; b.y = py + ny * min;
    if (vn < 0) { b.vx -= (1 + bounce) * vn * nx; b.vy -= (1 + bounce) * vn * ny; b.vx *= 0.94; if (onHit) onHit(kind, -vn); }
  }
  function hitSeg(b, s, onHit) {
    const [x1, y1, x2, y2, type] = s, ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey;
    let k = L2 ? ((b.x - x1) * ex + (b.y - y1) * ey) / L2 : 0;
    k = Math.max(0, Math.min(1, k));
    const bounce = type === 'z' ? 1.3 : 0.55;
    hitPoint(b, x1 + ex * k, y1 + ey * k, C.WALL_T, bounce, type === 'z' ? 'zabuton' : type === 'b' ? 'board' : 'wall', onHit);
  }

  // 1歩すすめる。t はステージの時間（動くゴール用）
  function step(b, st, t, onHit) {
    const dt = C.DT;
    b.vy += C.G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > C.FLOOR - C.BALL_R) { const v = b.vy; b.y = C.FLOOR - C.BALL_R; b.vy = -b.vy * 0.6; b.vx *= 0.85; if (onHit && v > 0) onHit('floor', v); }
    if (st.ceil !== undefined && b.y < st.ceil + C.BALL_R && b.vy < 0) { const v = -b.vy; b.y = st.ceil + C.BALL_R; b.vy = v * 0.45; b.vx *= 0.9; if (onHit) onHit('wall', v); }
    if (b.x > C.W - C.BALL_R) { const v = b.vx; b.x = C.W - C.BALL_R; b.vx = -b.vx * 0.5; if (onHit) onHit('wall', Math.abs(v)); }
    for (const s of st.walls || []) hitSeg(b, s, onHit);
    for (const [px, py, r] of st.pegs || []) hitPoint(b, px, py, r, 0.6, 'peg', onHit);
    const hp = hoopAt(st, t), bs = boardSeg(st, hp);
    if (bs) hitSeg(b, bs, onHit);
    hitPoint(b, hp.x - hp.rim, hp.y, 3, 0.6, 'rim', onHit);
    hitPoint(b, hp.x + hp.rim, hp.y, 3, 0.6, 'rim', onHit);
    return hp;
  }
  // 輪を上から下へ通ったか
  function through(prevY, b, hp) {
    return prevY < hp.y && b.y >= hp.y && b.vy > 0 && b.x > hp.x - hp.rim + 3 && b.x < hp.x + hp.rim - 3;
  }

  // 打った球が入るかを最後まで計算する
  function simulate(st, vx, vy, t0 = 0) {
    const h = ballHome(st), b = { x: h.x, y: h.y, vx, vy }, info = { scored: false, touched: false };
    for (let i = 0, n = 5 / C.DT; i < n; i++) {
      const py = b.y;
      const hp = step(b, st, t0 + i * C.DT, k => { if (k !== 'floor') info.touched = true; });
      if (through(py, b, hp)) { info.scored = true; break; }
      if (b.x < -40) break;
      if (b.y >= C.FLOOR - C.BALL_R - 0.5 && Math.abs(b.vy) < 30 && Math.abs(b.vx) < 30) break;
    }
    return info;
  }
  // 最初に何かへ当たるまでの軌道
  function guide(st, vx, vy, t0 = 0) {
    const h = ballHome(st), b = { x: h.x, y: h.y, vx, vy }, pts = [[b.x, b.y]];
    let hit = null;
    for (let i = 0; i < 4 / C.DT && !hit; i++) {
      step(b, st, t0 + i * C.DT, k => { hit = k; });
      if (i % 6 === 0 || hit) pts.push([b.x, b.y]);
      if (b.x < -40 || b.y < -400) break;
    }
    return { pts, hit };
  }
  // 引っぱった量から打つ速さへ
  function aimToVel(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 16) return null;
    const sp = Math.min(C.MAX_SPEED, len * C.PULL_K);
    return { vx: dx / len * sp, vy: dy / len * sp, power: sp / C.MAX_SPEED };
  }

  root.SHOOT = { C, hoopAt, boardSeg, ballHome, step, through, simulate, guide, aimToVel };
})(typeof window !== 'undefined' ? window : globalThis);
