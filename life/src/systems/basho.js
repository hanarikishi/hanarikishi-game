const GAME_START_YEAR = 2026;   // ゲームは2026年1月（初場所）から
const BASHO_MONTHS = [1, 3, 5, 7, 9, 11];   // 初場所1月・春場所3月・夏場所5月・名古屋場所7月・秋場所9月・九州場所11月
const BASHO_NAMES =['初場所', '春場所', '夏場所', '名古屋場所', '秋場所', '九州場所'];

function getBashoName(bashoIndex) {
  return BASHO_NAMES[bashoIndex % 6];
}

function generateOpponent(playerRankId) {
  const spread = Math.floor(Math.random() * 3) - 1;
  const opRank = Math.max(0, Math.min(9, playerRankId + spread));
  return createNPC(opRank, rosterWorldLevel(Game.state?.roster));
}

function calcBashoResult(wins, losses, rankId) {
  const rank = BANZUKE_RANKS[rankId] || BANZUKE_RANKS[0];
  const half = Math.floor(rank.boutCount / 2); // 7→3, 15→7

  const verdict = wins > half ? '勝ち越し' : wins === half ? '五分' : '負け越し';
  const newRank  = calcNewRank(rankId, wins, losses);

  const isYusho = rankId >= 4 && wins >= rank.boutCount - 2;
  return {
    verdict,
    newRank,
    boutCount: rank.boutCount,
    promoted:  newRank > rankId,
    demoted:   newRank < rankId,
    unchanged: newRank === rankId,
    isYusho,
  };
}
