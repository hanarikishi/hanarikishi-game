// 年齢・成長タイプ（プレイヤー／NPC 共用。rikishi オブジェクトだけを扱う）

// growth〜plateau は各段階の最終年齢。decline はその翌年から
const GROWTH_TYPES = {
  soujuku:    { name: '早熟',   prob: 25, growthEnd: 21, peakEnd: 25, plateauEnd: 28, growthMult: 2.0 },
  futsuu:     { name: '普通',   prob: 40, growthEnd: 23, peakEnd: 28, plateauEnd: 31, growthMult: 1.5 },
  bansei:     { name: '晩成',   prob: 25, growthEnd: 26, peakEnd: 31, plateauEnd: 34, growthMult: 1.1 },
  chouBansei: { name: '超晩成', prob: 10, growthEnd: 29, peakEnd: 35, plateauEnd: 38, growthMult: 0.85 },
};

const AGE_PHASE_NAMES = { growth: '伸び盛り', peak: '全盛期', plateau: '伸び止まり', decline: '衰え' };
const GROWTH_REVEAL_AGE = 21;

function rollGrowthType() {
  let roll = Math.random() * 100;
  for (const [key, gt] of Object.entries(GROWTH_TYPES)) {
    roll -= gt.prob;
    if (roll < 0) return key;
  }
  return 'futsuu';
}

function getAgePhase(rikishi) {
  const gt  = GROWTH_TYPES[rikishi.growthType] || GROWTH_TYPES.futsuu;
  const age = rikishi.age || 18;
  if (age <= gt.growthEnd)  return { phase: 'growth',  keikoMult: gt.growthMult };
  if (age <= gt.peakEnd)    return { phase: 'peak',    keikoMult: 1.0 };
  if (age <= gt.plateauEnd) return { phase: 'plateau', keikoMult: 0.4 };
  return { phase: 'decline', keikoMult: 0.15 };
}

function isGrowthRevealed(rikishi) {
  return (rikishi.age || 18) >= GROWTH_REVEAL_AGE;
}

// 年替わりの加齢。衰え期なら力・技・速さを min(8, 2×衰え年数) 下げる
function applyYearlyAging(rikishi) {
  const wasRevealed = isGrowthRevealed(rikishi);
  rikishi.age = (rikishi.age || 18) + 1;

  let statLoss = null;
  const gt = GROWTH_TYPES[rikishi.growthType] || GROWTH_TYPES.futsuu;
  if (getAgePhase(rikishi).phase === 'decline') {
    const declineYears = rikishi.age - gt.plateauEnd;
    const loss = Math.min(8, 2 * declineYears);
    statLoss = {};
    for (const stat of ['chikara', 'waza', 'hayasa']) {
      const before = rikishi.stats[stat];
      rikishi.stats[stat] = Math.max(1, before - loss);
      statLoss[stat] = before - rikishi.stats[stat];
    }
  }

  return {
    newAge:   rikishi.age,
    revealed: !wasRevealed && isGrowthRevealed(rikishi),
    statLoss,
  };
}
