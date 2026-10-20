# はなりきしゲームズ

はなりきしのミニゲーム集。GitHub Pages で公開しています。

- 公開URL: https://hanarikishi.github.io/hanarikishi-game/
- ゲーム一覧ページ（`index.html`）は `games.json` を読んで自動で組み立てます。

## フォルダ構成

```
.
├─ index.html            ゲーム一覧ページ（games.json を読んで表示）
├─ games.json            ゲームの一覧（ここに1つ足せば一覧に載る）
├─ manifest.webmanifest  一覧ページのアプリ設定
├─ parts/                全ゲーム共通の画像（はなりきしの絵、アイコン）
├─ thumbs/               一覧ページ用のサムネイル（360x600 の jpg）
├─ _docs/PLANS.md        これから作るゲームと、必要な素材のメモ（公開されません）
├─ _template/            新しいゲームの雛形（名前が _ で始まるフォルダは公開されません）
├─ suika/                はなりきし出世（パズル）
├─ flappy/               はなりきしフラッピー
├─ crossy/               はなりきしクロッシー
├─ stack/                はなりきしスタック
├─ survivors/            はなりきしサバイバーズ
├─ shogi/                はなりきし将棋
├─ tachiai/              はなりきし 立ち合い（ステージは levels.js）
├─ shoot/                はなりきしシュート（横画面。ステージは _docs/tools/gen_shoot_stages.js で作る）
└─ _chanko/              はなりきし ちゃんこダンジョン（非公開。公開するときは chanko/ に戻し、
                          thumb.jpg を thumbs/chanko.jpg へ移して games.json に足す）
```

## 新しいゲームを追加する手順

1. `_template/` をフォルダごとコピーして、ゲーム名のフォルダにします（例: `cooking/`）。
2. `index.html` を作り込みます。画像は `../parts/` から読みます。
3. `manifest.webmanifest` の名前と、`sw.js` の `VERSION`（例: `cooking-v1`）を書き換えます。
4. サムネイルを `thumbs/cooking.jpg`（縦長 3:5 ・ 360x600 程度）として置きます。
5. `games.json` に1件足します。

```json
{
  "id": "cooking",
  "title": "はなりきしクッキング",
  "desc": "一覧に出る短い説明",
  "path": "cooking/",
  "thumb": "thumbs/cooking.jpg",
  "tags": ["アクション"],
  "added": "2026-11-01",
  "best": { "key": "sumo-cooking-best", "type": "number", "unit": "点" }
}
```

- `tags`: ジャンル。同じ文字のタグが自動で絞り込みボタンになります。
- `added`: 追加日。新しい順に並び、3週間は「NEW」が付きます。
- `best`: 一覧に出すベスト記録（省略可）。`key` はゲームが `localStorage` に保存しているキー。
  - `type: "number"` … 数字をそのまま表示（`unit` で単位）。
  - `type: "time"` … `{"time": 秒}` の形で保存している場合に `mm:ss` で表示。

6. `git add -A` → `git commit` → `git push`。1〜2分で公開されます。

## ゲームを作るときの約束

- 画面は縦長 `420x700`（実際の描画は2倍の `840x1400`）で作り、`touch-action: none` にします。
  - 例外: はなりきしシュート（`shoot/`）は横画面 `700x420`。スマホを縦に持つと「横にしてね」と出ます。
- 番付（前相撲 → 横綱）は全ゲーム共通の名前と色を使います（`_template/index.html` の `RANKS`）。
- ベスト記録の `localStorage` キーは `sumo-<ゲームid>-best` にします。サイト全体で共有されるので、他のゲームと重ならないようにします。
- ゲームを更新したら `sw.js` の `VERSION` を上げます。`sw.js` は「ネット優先」なので、オンラインなら基本的に常に最新が出ます。
- 遊んでいないとき（タイトル・ゲームオーバー・ポーズ）は、左下に「◀ ゲーム一覧」ボタンを出します（雛形に入っています。出す条件はゲームの `frame` の先頭の `toList.hidden`）。
- 共通の画像は `parts/` に置きます。ゲーム専用の画像は、そのゲームのフォルダに置きます。

## 手元で動かす

```
python -m http.server 8765
```

ブラウザで http://localhost:8765/ を開きます。
