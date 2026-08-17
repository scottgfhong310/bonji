# bonji — 悉曇（梵字）コンバーター

[English](./README.md) ｜ [繁體中文](./README.zh-Hant.md) ｜ [日本語](./README.ja.md)

**ASCII / IAST のローマ字転写**を **悉曇（Siddhaṁ）文字**・**ラテン翻字**・**Unicode コードポイント**に変換する単一ページ WebApp。すべてブラウザ内で動作します。

悉曇エンジンは [mandel59/bonji-input](https://github.com/mandel59/bonji-input) を **vendoring（コピー同梱・無改変・MIT）** し、薄い防腐層 `SiddhamConverter` 経由でのみ利用します。

本アプリは **nodeapp WebApp ファミリー** の一員です。共通規約とワークフローは
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md`、`WORKFLOW.md`）にあります。

## 機能

- 2 カラム構成：左が入力、右が出力（狭い画面では縦積み）。
- 任意の**タイトル**＋入力テキスト（どちらもコピー可）；入力と同時に変換、5 つのコピー可能な出力：悉曇文字 · ラテン翻字 · ASCII 表記（例 ṁ/ṃ → `;m`）· Unicode コードポイント · **HTML スニペット**（`<span class="siddham" data-latin="{latin}">{siddham}</span>`、1 行 1 つ、経典整理用）。
- オプション：入力方式（ISO 15919 / Kyoto-Harvard）、ラテン翻字（ISO 15919 / IAST）、スペースとハイフンを無視。
- **Noto Sans Siddham** フォント（SIL OFL）を同梱し、システムフォントなしでも悉曇を表示。
- 三言語 UI（`zh-Hant` / `en` / `ja`、既定 `zh-Hant`）；ライト / ダークテーマ。
- 各フィールドのコピーボタン（タイトル・入力・各出力）；サンプルチップ。
- **JSON 書き出し** — 現在の結果をサーバーの `/download/bonji/` に `bonji-yyyyMMddHHmmss.json` として保存（`title`・`options`・入力・3 つの出力）；**ダウンロード**ボタンは先に書き出してからその JSON をダウンロード；**`dehaze` サイドパネル**が書き出しを降順で一覧、`delete_sweep` ボタンでフォルダを空に。
- **保存した書き出しの読み戻し** — パネルの項目をクリックすると、その `title` / `options` / `input` をページに読み込み（そのファイルの `sourceFile` はオプションの下に表示）。調整して再度書き出すと新しいファイルになり、`sourceFile` に元のファイル名を記録します。
- **対照表ページ**（サイドツール・新規タブで開く）：`table_chart` **字母対照表**（`chart.html`、エンジン由来：記法 → 悉曇 / ラテン）と `menu_book` **字形対照表**（`catalog.html`、`BonjiInput.xlsx` 準拠：母音 / 子音 / 異体字 / 記号 / 体文 / 接続 / 上下接続、各セルは元フォントで表示：Unicode 悉曇 · Mojikyo M119 · Siddam）。セルをクリックで記法をコピー。後者 2 つは**お使いの端末にインストール済み**のものを参照し、同梱していません（〈フォント〉参照）。
- **入力補助**（`keyboard` サイドツール）：**右側に固定**する字形パレット（開閉可）。`catalog.json` 準拠——カテゴリ別閲覧または記法検索し、字形をクリックでその ASCII 記法をカーソル位置に挿入（即時再変換）。開くとサイドツールを隠して右端に固定——本文は動かさず上に重ねる方式。パネルの ⋮ でツールを再表示、× で閉じる。最下部のボタンでスペース / 改行 / ハイフン（`-` は語群区切り）を挿入。文献の整理・対照時、字形を見て選ぶだけ。対照表フォントはローカルにインストール済みのものを参照するため、ダウンロードは発生しません。

> 変換エンジンはブラウザ内で完結します。JSON の書き出し／一覧は下記の Node バックエンドを使うため、この 2 機能のみサーバーが必要です（変換そのものは不要）。

## 記法（一部の例）

| 入力 | 結果 | | 入力 | 結果 |
|---|---|---|---|---|
| `;m` | ṁ | | `aa` | ā |
| `.h` | ḥ | | `ii` | ī |
| `~m` | m̐ | | `uu` | ū |

例：`siddha;m` → 𑖭𑖰𑖟𑖿𑖠𑖽（`siddhaṁ`）、`na ma.h` → 𑖡𑖦𑖾（`na maḥ`）。

## 実行

```bash
npm install && npm start          # → http://localhost:3000/apps/bonji/
npm test                          # vendored エンジンを検証（5 ケース + コードポイント）
```

`PORT` 環境変数で既定の `3000` を上書きできます。

## API

レスポンスはファミリー共通の `{ ok }` 封筒です。

| Method | Path | 説明 |
|---|---|---|
| `POST` | `/api/bonji/export` | `{ title, options, input, output, sourceFile }` を `public/download/bonji/` の `bonji-yyyyMMddHHmmss.json` として保存（`sourceFile`＝この内容の読み込み元／派生元、無ければ `null`）。`{ ok, filename, path }` を返す。 |
| `GET` | `/api/bonji/downloads` | `public/download/bonji/` 内の JSON を降順で列挙。`{ ok, files: [{ name, size, mtime }] }` を返す。 |
| `POST` | `/api/bonji/clear` | `public/download/bonji/` 内の全 JSON を削除（対象はサーバー側で固定）。`{ ok, removed }` を返す。 |

書き出したファイルは `/download/bonji/<file>` で静的配信されます。

## JSON 構造

本プロジェクトには 2 つの JSON 構造があります。

**`SiddhamConverter.convert(input)` → 結果** — ブラウザ内の変換結果（ライブラリが返し、UI にも反映）：

```jsonc
{
  "input":      "siddhaṃ",           // 渡した入力テキスト（そのまま返す）
  "ascii":      "siddha;m",          // 共通 ASCII 表記（IAST/ISO 15919 → ASCII、例 ṁ/ṃ → ;m；改行も保持）
  "siddham":    "𑖭𑖰𑖟𑖿𑖠𑖽",          // 悉曇文字
  "latin":      "siddhaṃ",           // ラテン翻字（既定 IAST；ISO 15919 も可）
  "codepoints": "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"
  //            `siddham` の Unicode コードポイント、スペース区切り（入力 1 行ごとに 1 行）
}
```

**`bonji-yyyyMMddHHmmss.json`** — 書き出しレコード（`POST /api/bonji/export` が出力；ファイル名のタイムスタンプはサーバー生成）。3 つの出力を `output` にまとめ、メタデータを付加：

```jsonc
{
  "app":        "bonji",
  "exportedAt": "2026-06-13T01:25:59.123Z", // ISO 8601、UTC
  "sourceFile": "bonji-20260613092011.json",// この内容の読み込み元／派生元、無ければ null
  "title":      "心經種子字",                 // 任意、ユーザー入力
  "options": {
    "inputMethod":            "ISO15919",   // "ISO15919" | "KH"
    "transliteration":        "IAST",       // "ISO15919" | "IAST"
    "ignoreSpacesAndHyphens": true
  },
  "input":  "siddha;m",                     // 正規化 ASCII 表記（IAST/ISO 15919 → ASCII、例 ṁ/ṃ → ;m）
  "output": {
    "siddham":    "𑖭𑖰𑖟𑖿𑖠𑖽",
    "latin":      "siddhaṃ",
    "codepoints": "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"
  }
}
```

> 書き出しは **`input` を正規化 ASCII 表記で保存**（例：`siddhaṃ` と打っても `siddha;m` で保存）し、可搬・再入力しやすくします。`output` は 3 出力（`siddham` / `latin` / `codepoints`）；`app`・`exportedAt`・`sourceFile`・`title`・`options` は書き出しメタデータ。（ライブラリの `convert()` は生の `input` を返し、ASCII は別途 `ascii` で提供。）

## ディレクトリ構成

```
bonji/
├─ app.js                          # Express：static + /api/bonji +（ / → 302 /apps/bonji/ ）+ PORT||3000
├─ routes/bonji.js                 # POST /export、GET /downloads（{ ok } 封筒）
├─ package.json · .gitignore · LICENSE
├─ test/verify-siddham.mjs         # エンジン検証（npm test）
└─ public/
   ├─ download/bonji/.gitkeep      # 書き出した JSON はここに（内容は gitignore）
   └─ apps/bonji/
      ├─ index.html · bonji.css · bonji.js     # 変換ページ：構造 / スタイル / グルー（ESM module）
      ├─ chart.html · chart.css · chart.js     # 字母対照表（エンジン由来）
      ├─ catalog.html · catalog.css · catalog.js   # 字形対照表（BonjiInput.xlsx 準拠）
      ├─ siddham-converter.js                  # 防腐層（唯一の悉曇インターフェース）
      ├─ config.json                           # バックエンド切替 { backend: true|false }
      ├─ data/{catalog.json, BonjiInput.xlsx}  # catalog データ（catalog.json は xlsx から生成）
      ├─ vendor/bonji-input/{siddham.js, LICENSE, SOURCE.md}   # vendored エンジン（MIT・無改変）
      ├─ font-availability.js                 # ローカルフォント検出＋不足時の案内（→ window.BonjiFonts）
      ├─ fonts/{NotoSansSiddham-Regular.woff2 + OFL.txt}      # 再配布可能なもののみ同梱（OFL、約 47 KB）
      ├─ i18n.js · locales/{zh-Hant,en,ja}.js
      └─ side-tool.css · materialize-dark.css
```

## コア（`SiddhamConverter`）の利用

`siddham-converter.js` がアプリが import する**唯一**の変換インターフェースで、vendored エンジン内部には直接触れません。依存ゼロの ES module です：

```js
import { SiddhamConverter } from "./siddham-converter.js";

const converter = new SiddhamConverter();           // 既定：入力方式 ISO15919、ラテン翻字 IAST、スペース無視
const { input, ascii, siddham, latin, codepoints } = converter.convert("siddhaṃ");
// input:      "siddhaṃ"    （渡したテキストをそのまま返す）
// ascii:      "siddha;m"   （共通 ASCII 表記；IAST/ISO 15919 → ASCII、例 ṁ/ṃ → ;m；改行も保持）
// siddham:    "𑖭𑖰𑖟𑖿𑖠𑖽"
// latin:      "siddhaṃ"    （IAST 既定は ṃ；ISO15919 なら ṁ）
// codepoints: "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"

converter.setOptions({ transliteration: "ISO15919" });  // → ラテン翻字は ṁ（ṃ の代わり）
```

### vendored エンジンの更新

ピン留めした上流コミットは `public/apps/bonji/vendor/bonji-input/SOURCE.md` を参照。ソフト同期：上流とピン留めコミットを diff し、エンジン関連の修正のみ `vendor/bonji-input/` に適用、`npm test` を再実行、`SOURCE.md` を更新します。アプリは `SiddhamConverter` にのみ依存するため、上流の内部 API 変更があっても、そのラッパーの調整で済みます。

## ライセンス

MIT © 2026 Scott G.F. Hong。**bonji-input** 悉曇エンジン（MIT・© 2021 Ryusei Yamaguchi）と **Noto Sans Siddham**（SIL OFL 1.1）を同梱。[LICENSE](./LICENSE)、vendored の `LICENSE`/`SOURCE.md`、`fonts/OFL.txt` を参照。

### フォント

**`Mojikyo M119` と `Siddam` は本 repo に同梱していません**。`@font-face { src: local(...) }` でお使いのシステムにインストールされたものを参照します。いずれも再配布は許諾されていません——今昔文字鏡フォントは name table 自体に `All rights reserved` と記載され、CBETA のフォントには授権条項が一切ありません。⚠️ 誤読しやすい 2 点——`OS/2 fsType` は**文書／PDF への埋め込み**の可否であって**再配布の許諾ではない**こと、そして**授権条項が無い ≠ 再配布してよい**こと（著作権は既定で留保）。再配布可能なフォントは Noto のように自らライセンスを明記しています。`Siddam` は [CBETA のダウンロードページ](https://archive2.cbeta.org/download/cbreader.php)から入手できます。文字鏡研究会は 2019 年に解散し公式の配布経路はありません。未インストールでも壊れません——該当セルは通常の漢字にフォールバックし、UI 上で明示されます。判断の詳細は [`DESIGN.md`](./DESIGN.md) §11 を参照。
