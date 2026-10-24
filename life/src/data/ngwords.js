// 四股名に使えない言葉（下ネタ・危険な言葉・差別語・Fワードなど）
// 判定はゆるく崩した書き方も拾う：全角半角・カタカナひらがな・大文字小文字をそろえ、空白や記号をはさんでも、伸ばし棒を入れても引っかかる
// 短すぎる言葉はふつうの名前にも混ざるので入れない（例: unko→junko、fuk→fukuoka、ちょん→ちょんまげ）
// 言葉を足すときは ひらがな／漢字／英小文字 で書く（カタカナはひらがなに直して比べるので不要）
const NG_WORDS = [
  // 下ネタ
  'ちんこ', 'ちんぽ', 'ちんちん', 'ちん子', 'まんこ', 'まん子', 'おまんこ', 'せっくす', 'えっち', 'おっぱい',
  'ちくび', '乳首', 'ぱいずり', 'ふぇら', 'くんに', 'おなに', '自慰', 'せいえき', 'せえき', '精液', '射精', 'しゃせい',
  '勃起', 'ぼっき', 'どうてい', '童貞', 'しょじょ', '処女', 'ちかん', '痴漢', 'ごうかん', '強姦', 'れいぷ',
  '売春', 'ばいしゅん', '援交', 'えんこう', '風俗', 'ふうぞく', '淫', 'いんらん', 'へんたい', '変態',
  'うんこ', 'うんち', 'きんたま', '金玉', '睾丸', '陰茎', '陰毛', 'ぺにす', 'ばいぶ', 'あなる',
  'ぶっかけ', 'なかだし', '中出し', 'てこき', '手こき', 'すまた', '素股', 'おしっこ', 'くそ', '糞',
  'chinko', 'chinpo', 'manko', 'sekkusu', 'oppai', 'ecchi',
  // 危険な言葉・犯罪
  '殺', 'ころす', 'しね', '死ね', '氏ね', 'たひね', '自殺', 'じさつ', 'さつじん', '死体',
  'てろりすと', '爆弾', 'ばくだん', '爆破', '麻薬', 'まやく', '覚醒剤', 'かくせいざい', '大麻', '薬物',
  'ひとらー', 'なちす', 'おうむしんり', 'しんりきょう',
  // 差別語
  'がいじ', 'きちがい', '気違い', '基地外', '池沼', 'かたわ', 'めくら', 'つんぼ', '部落', '土人',
  'くろんぼ', '黒んぼ', 'じゃっぷ', 'にがー', '支那',
  // 英語（Fワードほか）
  'fuck', 'ふぁっく', 'ふぁっきゅ', 'fck', 'phuck', 'bullshit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'porn', 'sex',
  'nigger', 'nigga', 'fag', 'whore', 'slut', 'rape', 'penis', 'vagina', 'asshole', 'bastard',
  'retard', 'nazi', 'hitler', 'kill',
];

// 比べやすい形にそろえる
function ngNormalize(text) {
  let s = (text || '').normalize('NFKC').toLowerCase();
  s = s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));   // カタカナ→ひらがな
  s = s.replace(/[0134@$5]/g, c => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', '@': 'a', $: 's', 5: 's' }[c]));
  s = s.replace(/[ぁぃぅぇぉっゃゅょゎ]/g, c => String.fromCharCode(c.charCodeAt(0) + 1));     // 小さい字→大きい字
  s = s.replace(/[\s\p{P}\p{S}ー〜~_]/gu, '');                                               // 空白・記号・伸ばし棒を除く
  return s.replace(/([a-z])\1+/g, '$1');                                                     // fuuuck → fuck
}

const NG_WORDS_NORM = [...new Set(NG_WORDS.map(ngNormalize))];

// 使えない四股名なら理由の文を返す。使えるなら null
// 画面にそのまま差しこむので、HTML をこわす文字は四股名に使えない（読みこみのときも取りのぞく）
const NAME_BAD_CHARS = /[<>&"'`\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g;
function cleanName(s) { return String(s).replace(NAME_BAD_CHARS, ''); }
// セーブの中の四股名・名前から、あぶない文字を取りのぞく（手でセーブを書きかえられても、画面を こわせない）
function sanitizeSaveNames(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 10) return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string') { if (k === 'shikona' || k === 'name') o[k] = cleanName(v); }
    else if (v && typeof v === 'object') sanitizeSaveNames(v, depth + 1);
  }
}

function shikonaNgReason(name) {
  if (/[<>&"'`\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(String(name))) return 'その四股名には使えない文字（< > & " \' `）が入っています';
  const s = ngNormalize(name);
  if (!s) return null;
  // ネタ：ドラクエのロトシリーズで主人公に付けられない名前。ぴったり同じときだけ（ひろと 等は使える）
  if (s === 'ろと' || s === 'roto') return 'その四股名は使えません';
  if (NG_WORDS_NORM.some(w => s.includes(w))) return 'その四股名は使えません。別の名前にしてください';
  return null;
}
