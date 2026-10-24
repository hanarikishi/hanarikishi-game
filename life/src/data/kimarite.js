// 決まり手
// 取組の終わり方（どう当たって・どう出たか）で候補をしぼり、実際の出やすさ（統計）と力士の型・能力で重みをつけて選ぶ。
// 実際の割合の目安（2024年ごろ）：押し出し26.7% 寄り切り24.6% 叩き込み約9.5% 突き落とし 寄り倒し4.8% … 上位10手で約85%

// 実績の「◯系制覇」に使う分類（ここに並んだ決まり手を全部出すと制覇）
const KIMARITE = {
  oshi:  ['押し出し', '突き出し', '押し倒し', '突き倒し'],
  yotsu: ['寄り切り', '寄り倒し', '浴びせ倒し', '吊り出し', '送り出し', 'うっちゃり'],
  nage:  ['上手投げ', '下手投げ', '掬い投げ', '小手投げ', '上手出し投げ', '下手出し投げ', '外掛け', '内掛け'],
  hiki:  ['叩き込み', '引き落とし', '突き落とし', '肩透かし', 'とったり'],
};
// 非技（技ではなく、負けた側の自滅で決まる）
const KIMARITE_HIWAZA = ['勇み足', '踏み出し'];

// 実際の出やすさ（%のおおよそ）
const KIMARITE_FREQ = {
  '押し出し': 26.7, '寄り切り': 24.6, '叩き込み': 9.5, '突き落とし': 7.5, '寄り倒し': 4.8,
  '押し倒し': 3.5, '引き落とし': 3.0, '上手投げ': 3.0, '送り出し': 2.0, '突き出し': 2.0,
  '下手投げ': 1.8, '掬い投げ': 1.5, '小手投げ': 1.5, '上手出し投げ': 1.2, '突き倒し': 1.0,
  '勇み足': 0.8, '浴びせ倒し': 0.7, '肩透かし': 0.6, 'とったり': 0.5, '下手出し投げ': 0.5,
  '吊り出し': 0.3, '外掛け': 0.3, '内掛け': 0.3, '踏み出し': 0.2, 'うっちゃり': 0.1,
};

// 決まり手の分類（型による重みづけ用）
const KIMARITE_CAT = Object.fromEntries(Object.entries(KIMARITE).flatMap(([cat, list]) => list.map(k => [k, cat])));

// 型ごとに出やすい分類（押し相撲は押し・引き、四つは寄り・投げ、技は投げ・引き）
const KIMARITE_STYLE_MULT = {
  oshi:  { oshi: 1.6, hiki: 1.2, yotsu: 0.7, nage: 0.6 },
  yotsu: { yotsu: 1.6, nage: 1.3, oshi: 0.7, hiki: 0.8 },
  waza:  { nage: 1.7, hiki: 1.5, oshi: 0.8, yotsu: 0.8 },
};

function kimariteWeightedPick(cands) {
  const total = cands.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [k, w] of cands) { roll -= w; if (roll < 0) return k; }
  return cands[0][0];
}

// ctx: bout.js の kimariteContext() が作る（勝った側の型・能力、最後の当たり、負けた側の勢い など）
function decideKimarite(ctx) {
  const { w, l } = ctx;
  const f = k => KIMARITE_FREQ[k] || 0.5;
  const cands = [];
  const add = (k, mult = 1) => { if (mult > 0) cands.push([k, f(k) * mult]); };

  const fast  = ctx.loserSpeed > 1.1;              // 勢いよく飛ばされた → 「倒し」
  const toshi = fast ? 3 : 0.4, dashi = fast ? 0.5 : 1;

  if (ctx.contact && !ctx.byWinner && !ctx.dodged && ctx.glance <= 0.55) {
    // 突っ込んできた相手を正面から受け止めて押し返した
    add('押し出し', dashi); add('押し倒し', toshi); add('突き出し', dashi * 0.8); add('突き倒し', toshi * 0.6);
    add('叩き込み', 0.15); add('突き落とし', 0.15);
  } else if (!ctx.contact || !ctx.byWinner) {
    // 勝った側が当てずに決まった：かわした・引いた・いなした・相手が勝手に出た
    if (ctx.dodged || ctx.contact) {
      add('叩き込み'); add('突き落とし'); add('引き落とし');
      add('肩透かし', w.waza >= 60 ? 2 : 0.5);
      add('とったり', w.waza >= 50 ? 1.5 : 0.5);
      add('勇み足', ctx.loserLaunched ? 0.6 : 0.2);
    } else {
      // 当たりもかわしも無く、負けた側が自分で土俵を割った
      add('勇み足', ctx.loserLaunched ? 30 : 2);
      add('踏み出し', ctx.loserLaunched ? 2 : 30);
      add('引き落とし', 1);
    }
  } else {
    // 勝った側が当てて出した
    const heavier = (w.taijuu || 0) - (l.taijuu || 0);

    if (ctx.retreating) add('送り出し', 8);          // 背中を向けたところを押した
    if (ctx.winnerAtEdge) add('うっちゃり', 25);      // 土俵際で逆転

    if (ctx.glance > 0.55) {
      // 斜めから・受け流して当てた → 投げ・いなし
      const tech = (w.waza - l.waza) / 50;           // 技が上ほど投げが決まる
      const m = Math.max(0.3, 1 + tech);
      add('上手投げ', m); add('下手投げ', m); add('掬い投げ', m); add('小手投げ', m);
      add('上手出し投げ', m); add('下手出し投げ', m);
      add('外掛け', m * (w.chikara >= 50 ? 1.5 : 0.7)); add('内掛け', m * (w.waza >= 50 ? 1.5 : 0.7));
      add('突き落とし', 1.5);
    } else if (ctx.hits >= 2) {
      // 続けて当てた → 押し
      add('押し出し', dashi); add('押し倒し', toshi); add('突き出し', dashi * 0.8); add('突き倒し', toshi * 0.6);
    } else if (ctx.pow >= 0.7) {
      // 一発の強い当たり → 突き
      add('突き出し', dashi * 4); add('突き倒し', toshi * 4); add('押し出し', dashi * 0.6); add('押し倒し', toshi * 0.5);
    } else {
      // 当たりは弱く、体を寄せて出した → 寄り
      add('寄り切り', dashi); add('寄り倒し', toshi);
      add('浴びせ倒し', fast && heavier >= 20 ? 6 : 0.2);
      add('吊り出し', w.chikara - l.chikara >= 20 && heavier >= 0 ? 8 : 0.3);
      add('押し出し', dashi * 0.3);
    }
  }

  // 型（押し・四つ・技）で出やすさを変える。非技はそのまま
  const sm = KIMARITE_STYLE_MULT[ctx.winnerStyle] || {};
  for (const c of cands) c[1] *= sm[KIMARITE_CAT[c[0]]] || 1;
  return kimariteWeightedPick(cands);
}
