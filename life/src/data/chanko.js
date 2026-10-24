// 勝負ちゃんこ（スキル）：本場所の前に1杯選ぶと、その場所の間だけ能力が上がる
const SHOBU_CHANKO = [
  { stat: 'chikara', name: '醤油ちゃんこ', emoji: '🥘', label: '力' },
  { stat: 'waza',    name: '鶏ちゃんこ',   emoji: '🍗', label: '技' },
  { stat: 'taijuu',  name: 'ちゃんこ鍋',   emoji: '🍲', label: '重さ' },
];
function shobuChankoPct(level) { return level >= 2 ? 10 : level >= 1 ? 5 : 0; }
