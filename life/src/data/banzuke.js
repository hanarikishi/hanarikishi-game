const BANZUKE_RANKS = [
  { id: 0, name: '序ノ口', short: '序口', boutCount: 7,  promoteAt: 4, bigAt: 6 },
  { id: 1, name: '序二段', short: '序二', boutCount: 7,  promoteAt: 4, bigAt: 6 },
  { id: 2, name: '三段目', short: '三段', boutCount: 7,  promoteAt: 4, bigAt: 6 },
  { id: 3, name: '幕下',   short: '幕下', boutCount: 7,  promoteAt: 4, bigAt: 7 },
  { id: 4, name: '十両',   short: '十両', boutCount: 15, promoteAt: 8, bigAt: 11 },
  { id: 5, name: '前頭',   short: '前頭', boutCount: 15, promoteAt: 8, bigAt: 10 },
  { id: 6, name: '小結',   short: '小結', boutCount: 15, promoteAt: 8, bigAt: 11 },
  { id: 7, name: '関脇',   short: '関脇', boutCount: 15, promoteAt: 8, bigAt: 11 },
  { id: 8, name: '大関',   short: '大関', boutCount: 15, promoteAt: 8, bigAt: 13 },
  { id: 9, name: '横綱',   short: '横綱', boutCount: 15, promoteAt: 999, bigAt: 999 },
];

function getRankName(rankId) {
  return (BANZUKE_RANKS[rankId] || BANZUKE_RANKS[0]).name;
}

function getBoutCount(rankId) {
  return (BANZUKE_RANKS[rankId] || BANZUKE_RANKS[0]).boutCount;
}

function calcNewRank(rankId, wins, losses) {
  const rank = BANZUKE_RANKS[rankId] || BANZUKE_RANKS[0];
  const half = Math.floor(rank.boutCount / 2); // 7→3, 15→7

  if (wins >= rank.bigAt)    return Math.min(9, rankId + 2);
  if (wins >= rank.promoteAt) return Math.min(9, rankId + 1);
  if (wins <= half - 2 && rankId > 0) return Math.max(0, rankId - 2);
  if (wins <= half - 1 && rankId > 0) return Math.max(0, rankId - 1);
  return rankId;
}
