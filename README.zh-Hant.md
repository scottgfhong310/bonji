# bonji — 悉曇梵字轉換器

[English](./README.md) ｜ [繁體中文](./README.zh-Hant.md) ｜ [日本語](./README.ja.md)

把 **ASCII / IAST 羅馬轉寫**轉成 **悉曇（Siddhaṁ）梵字**、**拉丁轉寫**與 **Unicode 碼位**的單頁 WebApp，全部在瀏覽器內完成。

悉曇轉換引擎採 [mandel59/bonji-input](https://github.com/mandel59/bonji-input)，以 **vendoring（內嵌複製、原樣不改、MIT）** 方式納入，且只透過一層薄薄的防腐層 `SiddhamConverter` 使用。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md`、`WORKFLOW.md`）。

## 功能

- 兩欄版面：左欄輸入、右欄輸出（窄螢幕自動疊起）。
- 可填**標題**＋輸入文字（皆可複製）；邊打邊轉，五項可複製輸出：悉曇文字 · 拉丁轉寫 · ASCII 記法（如 ṁ/ṃ → `;m`）· Unicode 碼位 · **HTML 片段**（`<span class="siddham" data-latin="{latin}">{siddham}</span>`，每行一個，供經文典籍整理）。
- 選項：輸入法（ISO 15919 / Kyoto-Harvard）、拉丁轉寫（ISO 15919 / IAST）、忽略空格與連字號。
- 內嵌 **Noto Sans Siddham** 字型（SIL OFL），無需系統字型也能顯示悉曇。
- 三語介面（`zh-Hant` / `en` / `ja`，預設 `zh-Hant`）；light / dark 主題。
- 各欄位獨立複製鈕（標題、輸入、各輸出）；範例 chips。
- **JSON 匯出** — 把目前結果存到伺服器 `/download/bonji/`，檔名 `bonji-yyyyMMddHHmmss.json`（含 `title`、`options`、輸入與三項輸出）；**下載**鈕會先匯出再下載該 JSON；**`dehaze` 側欄**以降冪列出匯出檔，`delete_sweep` 鈕可清空該夾。
- **載回已存檔** — 點側欄中的項目可把該檔的 `title` / `options` / `input` 載回頁面（該檔的 `sourceFile` 會顯示在 options 下方）；調整後再匯出會產生新檔，並在 `sourceFile` 記下它的來源檔名。
- **對照表頁**（側邊工具、開新分頁）：`table_chart` **字元對照表**（`chart.html`，由引擎導出：記法 → 悉曇 / 拉丁）與 `menu_book` **字型對照表**（`catalog.html`，依 `BonjiInput.xlsx`：母音 / 子音 / 異體字 / 符號 / 體文 / 接續 / 上下接續，每格依其來源字型顯示：Unicode 悉曇 · Mojikyo · Siddham）。點格可複製記法。

> 轉換引擎完全在瀏覽器執行；JSON 匯出／列表用下方的 Node 後端，故這兩項功能需要伺服器（轉換本身不需要）。

## 記法（部分範例）

| 打 | 得 | | 打 | 得 |
|---|---|---|---|---|
| `;m` | ṁ | | `aa` | ā |
| `.h` | ḥ | | `ii` | ī |
| `~m` | m̐ | | `uu` | ū |

例：`siddha;m` → 𑖭𑖰𑖟𑖿𑖠𑖽（`siddhaṁ`）、`na ma.h` → 𑖡𑖦𑖾（`na maḥ`）。

## 執行

```bash
npm install && npm start          # → http://localhost:3000/apps/bonji/
npm test                          # 驗證 vendored 引擎（5 筆案例 + 碼位）
```

以 `PORT` 環境變數覆寫預設的 `3000`。

## API

回應一律用家族的 `{ ok }` 信封。

| Method | Path | 說明 |
|---|---|---|
| `POST` | `/api/bonji/export` | 把 `{ title, options, input, output, sourceFile }` 存成 `public/download/bonji/` 下的 `bonji-yyyyMMddHHmmss.json`（`sourceFile`＝本次內容載自/衍生自的匯出檔，無則 `null`）。回 `{ ok, filename, path }`。 |
| `GET` | `/api/bonji/downloads` | 列出 `public/download/bonji/` 內的 JSON（降冪）。回 `{ ok, files: [{ name, size, mtime }] }`。 |
| `POST` | `/api/bonji/clear` | 清空 `public/download/bonji/` 下所有 JSON（目標寫死在 server）。回 `{ ok, removed }`。 |

匯出檔以 `/download/bonji/<file>` 靜態提供。

## JSON 結構

本專案有兩種 JSON 結構。

**`SiddhamConverter.convert(input)` → 結果** — 瀏覽器內的轉換結果（由 library 回傳，也用來填 UI）：

```jsonc
{
  "input":      "siddhaṃ",           // 原樣回傳的輸入文字
  "ascii":      "siddha;m",          // 共用 ASCII 記法（IAST/ISO 15919 → ASCII，如 ṁ/ṃ → ;m；保留換行）
  "siddham":    "𑖭𑖰𑖟𑖿𑖠𑖽",          // 悉曇文字
  "latin":      "siddhaṃ",           // 拉丁轉寫（預設 IAST；可選 ISO 15919）
  "codepoints": "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"
  //            `siddham` 的 Unicode 碼位，以空格分隔（每行輸入對應一行）
}
```

**`bonji-yyyyMMddHHmmss.json`** — 匯出檔（由 `POST /api/bonji/export` 寫出；檔名時間戳由 server 產生）。把三項輸出收在 `output` 之下，並加上 metadata：

```jsonc
{
  "app":        "bonji",
  "exportedAt": "2026-06-13T01:25:59.123Z", // ISO 8601、UTC
  "sourceFile": "bonji-20260613092011.json",// 本內容載自/衍生自的匯出檔，無則 null
  "title":      "心經種子字",                 // 選填，使用者輸入
  "options": {
    "inputMethod":            "ISO15919",   // "ISO15919" | "KH"
    "transliteration":        "IAST",       // "ISO15919" | "IAST"
    "ignoreSpacesAndHyphens": true
  },
  "input":  "siddha;m",                     // 正規化 ASCII 記法（IAST/ISO 15919 → ASCII，如 ṁ/ṃ → ;m）
  "output": {
    "siddham":    "𑖭𑖰𑖟𑖿𑖠𑖽",
    "latin":      "siddhaṃ",
    "codepoints": "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"
  }
}
```

> 匯出檔的 **`input` 一律存成正規化 ASCII 記法**（如打 `siddhaṃ` 會存成 `siddha;m`），便於攜帶與重打。`output` 是三項輸出（`siddham` / `latin` / `codepoints`）；`app`、`exportedAt`、`sourceFile`、`title`、`options` 是匯出 metadata。（library 的 `convert()` 則回傳原始 `input`，另以 `ascii` 欄提供 ASCII。）

## 目錄結構

```
bonji/
├─ app.js                          # Express：static + /api/bonji +（ / → 302 /apps/bonji/ ）+ PORT||3000
├─ routes/bonji.js                 # POST /export、GET /downloads（{ ok } 信封）
├─ package.json · .gitignore · LICENSE
├─ test/verify-siddham.mjs         # 引擎驗證（npm test）
└─ public/
   ├─ download/bonji/.gitkeep      # 匯出的 JSON 落在這（內容不進版控）
   └─ apps/bonji/
      ├─ index.html · bonji.css · bonji.js     # 轉換頁：結構 / 樣式 / 膠水（ESM module）
      ├─ chart.html · chart.css · chart.js     # 字元對照表（引擎導出）
      ├─ catalog.html · catalog.css · catalog.js   # 字型對照表（依 BonjiInput.xlsx）
      ├─ siddham-converter.js                  # 防腐層（唯一對外悉曇介面）
      ├─ config.json                           # 後端開關 { backend: true|false }
      ├─ data/{catalog.json, BonjiInput.xlsx}  # catalog 資料（catalog.json 由 xlsx 生成）
      ├─ vendor/bonji-input/{siddham.js, LICENSE, SOURCE.md}   # vendored 引擎（MIT，未改動）
      ├─ fonts/{NotoSansSiddham-Regular.woff2 + OFL.txt, Mojikm13.TTF, Siddham.ttf}   # 悉曇 / Mojikyo / Siddham（catalog 字型約 7.5 MB）
      ├─ i18n.js · locales/{zh-Hant,en,ja}.js
      └─ side-tool.css · materialize-dark.css
```

## 使用核心（`SiddhamConverter`）

`siddham-converter.js` 是 app **唯一**會 import 的轉換介面，不直接碰 vendored 引擎內部。它是零依賴的 ES module：

```js
import { SiddhamConverter } from "./siddham-converter.js";

const converter = new SiddhamConverter();           // 預設：輸入法 ISO15919、拉丁轉寫 IAST、忽略空格
const { input, ascii, siddham, latin, codepoints } = converter.convert("siddhaṃ");
// input:      "siddhaṃ"    （原樣回傳傳入的文字）
// ascii:      "siddha;m"   （共用 ASCII 記法；IAST/ISO 15919 → ASCII，如 ṁ/ṃ → ;m；保留換行）
// siddham:    "𑖭𑖰𑖟𑖿𑖠𑖽"
// latin:      "siddhaṃ"    （IAST 預設用 ṃ；ISO15919 則為 ṁ）
// codepoints: "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"

converter.setOptions({ transliteration: "ISO15919" });  // → 拉丁轉寫改用 ṁ（取代 ṃ）
```

### 日後更新 vendored 引擎

釘選的上游 commit 見 `public/apps/bonji/vendor/bonji-input/SOURCE.md`。軟同步：把上游與釘選 commit 做 diff，只挑與引擎相關的修正套回 `vendor/bonji-input/`，重跑 `npm test`，更新 `SOURCE.md`。因為 app 只相依 `SiddhamConverter`，即使上游內部 API 變動，最多只需調整該 wrapper。

## 授權

MIT © 2026 Scott G.F. Hong。內含 **bonji-input** 悉曇引擎（MIT，© 2021 Ryusei Yamaguchi）與 **Noto Sans Siddham**（SIL OFL 1.1）。見 [LICENSE](./LICENSE)、vendored 的 `LICENSE`/`SOURCE.md` 與 `fonts/OFL.txt`。
