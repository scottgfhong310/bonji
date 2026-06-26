# bonji — 設計文件（Design）

> 本文記錄 **bonji 這支 app 特有的設計決議**。通用的家族規範（結構 / 後端 / 視覺 / i18n / 安全 / side-tools / 文件規範…）**承襲** [nodeapp WebApp 家族規範](https://github.com/scottgfhong310/nodeapp-webapp-family)（`DESIGN_GUIDELINES.md` / `WORKFLOW.md`），本文**不重複**，只記在其之上的 app 專屬內容；與規範衝突時以最新規範為準。
>
> 面向開發者；使用者導向說明見 `README.md`、單檔 clone 的速覽見 `CLAUDE.md`。

---

## 1. 一句話定位

把**羅馬轉寫的梵字**（ASCII / IAST，如 `siddha;m`）一次轉成 **悉曇（Siddhaṁ）文字 ／ 拉丁轉寫 ／ ASCII 記法 ／ Unicode 碼位**（外加可貼進經文的 **HTML 片段**，共 5 項可複製輸出），全在瀏覽器內完成。另有兩支對照表頁（§7）。bonji 是家族第一支 vendoring [mandel59/bonji-input](https://github.com/mandel59/bonji-input) 悉曇引擎的 app；姊妹作 `tibetan-siddham` 在其上再加藏文核心。

---

## 2. 架構與邊界（Architecture）

三層，由上而下依賴：

```
index.html · chart.html · catalog.html     ← 純結構
  │
bonji.js · chart.js                         ← 控制器（碰 DOM、事件、i18n、主題、導覽、後端）
  │  （只 import↓）                           catalog.js ─→ data/catalog.json（純資料，不經 converter）
siddham-converter.js                        ← 防腐層 ACL：唯一對外轉換介面（純邏輯、不碰 DOM）
  │
vendor/bonji-input/siddham.js               ← vendored 悉曇引擎（MIT、原樣不改）
```

**邊界紀律（硬約束）**：

- 轉換相關的程式（控制器 `bonji.js` / `chart.js`）**只** import `siddham-converter.js`，**絕不**直接 import `vendor/bonji-input/siddham.js`。`catalog.js` 連 converter 都不碰——它只 fetch `data/catalog.json`（純資料頁，§7.2）。
- 升級 vendored 引擎 → 只動 wrapper（ACL）。引擎是外來的、會被整支替換；對 UI 應呈現**單一穩定介面**——這就是 ACL 的職責。
- 釘選版本見 `vendor/bonji-input/SOURCE.md`（commit `0a7eadd…`）。更新＝對上游與釘選 commit 做 diff、只挑引擎相關修正套回 `vendor/`、重跑 `npm test`、更新 `SOURCE.md`。

**`SiddhamConverter` 介面**：

- `new SiddhamConverter(options?)` · `setOptions(patch)` · `convert(input) → { input, ascii, siddham, latin, codepoints }`（`ascii` ＝正規化後的共用記法，如 ṁ/ṃ → ;m、保留換行）
- 靜態（吃**原始 ascii**、不經輸入前處理；給對照表等用）：`toSiddham(ascii, ignore)`、`toLatin(ascii, transliteration)`、`toCodepoints(text)`
- 預設選項：`{ inputMethod: "ISO15919", transliteration: "IAST", ignoreSpacesAndHyphens: true }`（§12）

**偏離家族 §4.2 字面之處**：核心不是 IIFE→`window.XxxLib`，而是**原生 ESM**（converter / 控制器都 `export`，以 `<script type="module">` 載入）。理由：vendored 引擎本身是 ESM 且 canon 禁止改它，故全鏈走 ESM；仍 zero-build、CDN-first。守其**精神**（純核心、零依賴、不碰 DOM），與 `tibetan-siddham` 一致。jQuery / Materialize / Lodash / I18n 仍是 classic CDN globals。

---

## 3. 轉換管線（Pipeline）

`SiddhamConverter.convert(input)`：

```
原文 input
  → ascii2symbol(input)              // 符號正規化（vendored）
  → latin2ascii(…, { inputMethod })  // 羅馬轉寫 → 共用 ascii 記法（vendored）
  = 共用 ascii  ───────────────┬── SiddhamConverter.toSiddham(ascii, ignoreSpacesAndHyphens) → 悉曇（§5）
                               └── ascii2latin(ascii, { transliteration })                   → 拉丁
  → toCodepoints(悉曇)  → codepoints（§6）
```

- **ascii 是樞紐記法**：悉曇與拉丁都從同一份 `ascii` 產生，確保同源不漂移。這份 `ascii` 也**直接對外**（`convert()` 結果的 `ascii` 欄、UI「ASCII 記法」輸出）：把 IAST / ISO 15919 的羅馬字正規化成 bonji-input 記法（如 `ṁ`/`ṃ` → `;m`），並**保留換行**。
- **不含天城體（Devanāgarī）**：引擎的 `devanagari.js`（含 runtime `fetch`）**未 vendored**（`INCLUDE_DEVANAGARI=false`）。故 bonji 只吃 ASCII/IAST，且引擎**無執行期 fetch**、無 async 載入（比 `tibetan-siddham` 少一步 `await ready()`）。
- **HTML 片段＝呈現層**：經文整理用的輸出 `<span class="siddham" data-latin="{latin}">{siddham}</span>`（每行一個、空行略過、屬性與內容皆 HTML escape）由 `bonji.js` 的 `buildSpanHtml(siddham, latin)` 從 `convert()` 的 siddham/latin 組出——**屬呈現格式，不放進 `SiddhamConverter`**（守 ACL「純轉換、不碰呈現」的邊界）。它是 UI 複製輸出，**不**進 `convert()` 結果或匯出 JSON。

---

## 4. 羅馬轉寫記法（Notation）

沿用 bonji-input 的 ASCII 記法（以 ISO 15919 為底）：長母音 `aa`=ā、`ii`=ī、`uu`=ū；記號 `;m`=ṁ(anusvara)、`~m`=m̐(candrabindu)、`.h`=ḥ(visarga)；逆舌音 `.t .th .d .dh .n`；`;s`=ś、`.s`=ṣ；vocalic `,r`=r̥、`,l`=l̥；擴充 `z f w .l`。完整對照見**字元對照表頁**（§7）或 `README.md`。輸入法 `inputMethod` 可選 `ISO15919`（預設）或 `KH`（Kyoto-Harvard）。

> 記法是描述**輸入**的（ISO 15919 基底），與**輸出**拉丁轉寫的選擇（IAST/ISO15919）是兩件事——例如 `;m` 記法寫成 ṁ，但預設輸出 IAST 時 anusvara 顯示為 ṃ。

---

## 5. 空格與連字號政策（Space & hyphen）— 本 app 的核心設計

悉曇是「子音＋子音＋…＋母音」接續成一個字；也有「只有子音、無母音」者（以 virama 收尾）。空格與連字號控制**音節邊界**與**詞組分隔**，但其「可見字元」可被忽略。引擎原生的 `ignoreSpacesAndHyphens` 把兩件事混在一起（連邊界語意也丟掉），故 bonji 在 **ACL（`toSiddham`）做後處理**，引擎本身不動。

### 5.1 對照表（悉曇輸出）

| 輸入 | 忽略空格 = 開 | 忽略空格 = 關 |
|---|---|---|
| `na`（無分隔） | 𑖡（音節 na） | 𑖡 |
| `n a`（空格） | **𑖡𑖿𑖀**（子音 n＋獨立母音 a） | 𑖡𑖿␣𑖀 |
| `n`（單子音） | 𑖡𑖿（bare，含 virama） | 𑖡𑖿 |
| `ka ma la` | 𑖎𑖦𑖩（接連、無空格） | 𑖎␣𑖦␣𑖩 |
| `ti-ru`（連字號） | 𑖝𑖰␣𑖨𑖲（**`-`＝詞組分隔空格**） | 𑖝𑖰␣𑖨𑖲 |

拉丁輸出**保留**空格與 `-`（由 `ascii2latin` 處理，本層不碰）：`ma haa pa ;su pa ti-ru dra` → `ma hā pa śu pa ti-ru dra`。

### 5.2 為什麼這樣寫（實作關鍵）

引擎的 `ignoreSpacesAndHyphens` 在掃描時遇到空格/連字號是 `continue` 跳過、**不清 `cont`（continuation）旗標**，於是 `n`→(仍 cont)→`a` 被併成音節 𑖡——「可見的空格沒了，邊界語意也沒了」。

`SiddhamConverter.toSiddham(ascii, ignore)` 改成：

1. **連字號＝詞組分隔**：先以 `/-+/` 切成數組，組與組之間在輸出補**一個空格**（不論忽略與否）；拉丁則保留 `-`。
2. **組內空格**：
   - `ignore = true` → 以 `/ +/` 再切段、各段用引擎 `ignoreSpacesAndHyphens:false` 轉換、再以**空字串**接合。如此去掉「可見空格」但**保留 token 邊界**（故 `n a` 兩段各自轉成 `𑖡𑖿`、`𑖀`，接合得 𑖡𑖿𑖀）。
   - `ignore = false` → 整組交給引擎（保留字面空格）。

這個拆-轉-接做法的**回歸性**：除了「子音結尾段＋母音開頭段」這一類（即使用者想要的 `n a`），其餘所有情形與引擎舊行為**逐字相同**（`na`、`ka ma la`、`k ta`、`siddha;m` 皆不變）——驗證見 `test/verify-siddham.mjs` 思路與 commit 紀錄。

---

## 6. 碼位（Codepoints）

`SiddhamConverter.toCodepoints(text)`：逐行（以 `\n` 分）、每字輸出 `U+XXXX`（≥4 位、padStart、大寫、空格分隔）。`convert()` 的 `codepoints` 是對**悉曇輸出**算的（詞組空格 U+0020 也會出現在碼位串中）。

---

## 7. 對照表頁（chart.html · catalog.html）

兩支對照表頁，皆以新分頁開啟、樣式承襲轉換頁；**資料來源不同**：chart 由引擎即時導出，catalog 由策展的 `BonjiInput.xlsx` 而來。

### 7.1 chart.html — 字元對照表（引擎導出）

- **版面**：一**欄一組**（子音 / 獨立母音 / 母音符號 / 符號），響應式 grid。每格＝**悉曇字 ＋ 輸入記法 ＋ 拉丁(IAST)**；點格複製其輸入記法。
- **資料來源＝引擎**：全部經 `SiddhamConverter` 導出（**不**直接 import 引擎、**不**複製 maps）：
  - 子音以 `toSiddham(key+"a")` 取本字（akshara）、`toLatin(key+"a")` 取讀音；
  - 獨立母音 `toSiddham(key)`；母音符號以 `toSiddham("k"+key)` 附在 𑖎 ka 示範；
  - 符號 `toSiddham(key)` 前綴點圈 `◌`(U+25CC) 當載體；virama 取 `toSiddham("k")` 末碼位再加 `◌`。
  - **為何用 `toSiddham/toLatin` 而非 `convert()`**：`convert()` 會跑 `latin2ascii` 輸入前處理，會誤判少數原始記法鍵（如 `.l` 被當成 `,l`）；`toSiddham/toLatin` 吃原始 ascii、不前處理，才忠實。

### 7.2 catalog.html — 字型對照表（依 BonjiInput.xlsx）

- **定位**：策展的字元目錄，含 chart 沒有的**異體字 / 上接續 / 下接續**，且**跨三種字型**。八類（一類一欄）：母音 vowel · 子音 consonant · 異體字 variant · 符號 symbol · 體文 bindu · 接續 ligature · 上接續 ligature_u · 下接續 ligature_l。每格＝**字 ＋ 輸入記法 ＋ 字型標**。
- **資料管線**：`BonjiInput.xlsx`（source of truth，8 個 sheet ＝ 8 類；欄位 `fd_idx / fd_catalog / fd_group / fd_code / fd_char`）→ 以 Python stdlib（zip + xml，無 openpyxl）抽出 → `data/catalog.json`（`{categories:[{id, entries:[{code, char, group}]}]}`）。`catalog.js` fetch 此 JSON 渲染（純資料、**不經 converter**）。改資料＝改 xlsx → 重生 catalog.json。`data/BonjiInput.xlsx` 一併附在 repo 作來源。
- **多字型渲染（關鍵）**：`fd_group` 決定字型 ——
  - `siddham` → `Noto Sans Siddham`（Unicode U+115xx）；
  - `mojikyo119` → `Mojikm13.TTF`（**`fd_char` 是 CJK 碼位**，在此字型內顯示為悉曇字形，**非**漢字）；
  - `uniSiddham` → `Siddham.ttf`（**`fd_char` 同為 CJK 碼位**，在此字型內顯示為悉曇字形，**非**漢字）。
  以 `@font-face` 宣告 `'Mojikyo M13'` / `'Siddham'`（TTF，本機無 woff2 工具），CSS class `.f-mojikyo` / `.f-unisiddham` / `.f-siddham` 套到字格。**字型約 7.5 MB（TTF 未子集化）**，僅 catalog 頁載入；主轉換頁不受影響。
- **導覽**：同 chart——轉換頁 `window.open(href, 'bonji-catalog')` 具名新分頁；返回鈕有 `opener` 則 `focus()`＋`close()`。

### 7.3 兩頁共通導覽

轉換頁「對照表」鈕以 `window.open(href, '<name>')`（**具名、script 開啟**）開新分頁——具名可重用同一頁、script 開啟才能被自身 `close()`；子頁「返回」若有 `opener` 就 `focus()`＋`close()` 關回原分頁，否則就地導回 `index.html`。

---

## 8. 後端與 `config.json`（backend 開關）

- **API**（`routes/bonji.js`，`{ ok }` 信封）：`POST /export`（存 `bonji-yyyyMMddHHmmss.json`，檔名 server 產生）、`GET /downloads`（降冪列出）、`POST /clear`（清空，目標寫死 server）。匯出檔以 `/download/bonji/<file>` 靜態提供。安全：目標目錄寫死、`startsWith(DATA_DIR+sep)` 落點檢查、`sourceFile` 以 `basename` 消毒後才存、前端 `confirm()`。
- **下載＝先匯出再下載**：側邊「下載」鈕（後端開啟時）先 `POST /export`、再下載剛產生的 JSON；「匯出」鈕只存伺服器、不下載。
- **血緣（lineage）**：前端以 `loadedFrom` 記「目前內容來自哪個匯出檔」；點清單載回會設 `loadedFrom`、並把載入檔的 `sourceFile` 顯示在 `#source-row`；再匯出時把 `loadedFrom` 寫進新檔的 `sourceFile`。
- **`config.json`（後端開關，沿用 tibetan-siddham 做法）**：`{ "backend": true | false }`，前端 `loadConfig()` 在 `init` 讀。
  - `true`（預設）：用後端。
  - `false`：`applyBackendMode()` 隱藏 downloads/export/clear-downloads 三工具，下載改 **client-side Blob**（不打 `/api`），可純靜態託管；Blob 與匯出檔**同形狀**。
  - 讀不到 config（多半無伺服器）→ 視為 `false`。後端 route **永遠掛著**、`false` 時閒置；開關控的是「前端對後端的依賴」，改 config 重載即可。

---

## 9. 資料結構（Data structures）

兩份對外 JSON 的完整結構見 `README.md`「JSON shapes」一節：(1) `convert()` 回傳 `{ input, ascii, siddham, latin, codepoints }`（`input` 為原始輸入、`ascii` 為正規化記法）、(2) 匯出檔 `bonji-yyyyMMddHHmmss.json`（`app / exportedAt / sourceFile / title / options{…} / input / output{ siddham, latin, codepoints }`）。**匯出檔的 `input` 一律存正規化 ASCII 記法**（即 `convert()` 的 `ascii`，如 ṁ/ṃ → ;m），故不另存 `output.ascii`。純前端模式的 Blob 下載與匯出檔同形狀。

---

## 10. UI（主題 / toast / side-tools）

- **bonji 是家族首個實際採用共用 `materialize-dark.css` 的 app**，並於此踩到並收斂一個坑：它以 **`html.light-mode` class** 標記淺色，且未指定時會跟隨系統 `prefers-color-scheme: dark`。故只設 `data-theme="light"` 不夠——`applyTheme` 與防閃爍開機腳本須**同時** toggle `data-theme` 與 `light-mode`/`dark-mode` class。此發現已回灌家族 `DESIGN_GUIDELINES.md §5.1`。
- **toast 文字色（僅淺色模式調整、底色不動）**：有色彩 class（green/teal/orange/red 以及中灰 `grey` `#9e9e9e`）→ **白字**；無色彩 class 的預設淺灰底（`#eee`，如語言切換）→ **深字**。深色模式維持 materialize-dark 現況。規則放在 `bonji.css`、以 `#toast-container .toast` 提高優先級。
- **side-tools**：用 flex 容器 `.side-tools`（與 `tibetan-siddham` 對齊；**DOM 順序＝排列順序**，隱藏工具不留空位，故 `config.json` 關後端時隱藏三鈕也不錯位）。轉換頁九鈕：清單 `dehaze` · 主題 `dark_mode` · 語言 `translate` · 字元對照表 `table_chart` · 字型對照表 `menu_book` · 匯出 `data_object` · 下載 `download` · 清除輸入 `clear` · 清空匯出夾 `delete_sweep`。對照表頁三鈕：返回 `arrow_back` · 主題 · 語言。

---

## 11. 字型（Fonts）

皆 `@font-face` 內嵌（CDN 無可靠來源），否則缺字方塊：

- **`Noto Sans Siddham`**（**woff2**，~47 KB；SIL OFL，見 `fonts/OFL.txt`）：**所有頁**的 Unicode 悉曇（U+115xx）。
- **`Mojikm13.TTF`**（Mojikyo，~2.7 MB）、**`Siddham.ttf`**（~4.8 MB）：**僅 catalog 頁**載入（§7.2 多字型；`@font-face` 名 `'Mojikyo M13'` / `'Siddham'`）。TTF 未子集化（本機無 woff2 工具）。主轉換頁 / chart 頁不載這兩個。
- ⚠️ **發佈到公開 repo 前須確認 `Mojikm13.TTF` / `Siddham.ttf` 的授權可再散布**（兩者約 7.5 MB）。若不可，選項：catalog 僅留 InProgress、或把 TTF `.gitignore` 不進公開 repo。

---

## 12. 預設值（Defaults）

- **拉丁轉寫預設 IAST**：UI 下拉預設選 IAST，`SiddhamConverter.defaultOptions.transliteration` 亦為 `IAST`（兩層一致）。
- **忽略空格與連字號預設開**、**輸入法預設 ISO 15919**。
- App 行為由 UI 的下拉/開關驅動（`convert()` 前先 `readOptions()` 從控制項讀），library 的 `defaultOptions` 僅在直接 `new SiddhamConverter()` 不傳選項時生效。

---

## 13. 延後 / 未做（Deferred）

- **天城體（Devanāgarī）輸入**：引擎有此可選路徑（`devanagari.js` + 資料，含 runtime fetch），bonji 第一階段**刻意排除**（§3）。日後若要：vendor `devanagari.js`、在 ACL 加一步、並把 fetch→import 內嵌。
- 即時 IME 逐鍵輸入法、螢幕虛擬鍵盤（VK）：見孵化器原型 `InProgress/public/apps/tibetan/`。

---

## 14. 來源（Provenance）

悉曇引擎 vendored 自 [mandel59/bonji-input](https://github.com/mandel59/bonji-input)（commit `0a7eadd75ee475902879245ace39379bca820d36`，2023-01-13），原樣不改；本機鏡像見 `parallelmediator/public/Siddham/bonji-input-main/`。bonji 走家族 WORKFLOW 的 **Path A**（GitHub-first → 回灌 InProgress）。

---

*MIT © 2026 Scott G.F. Hong — 隨 app 成長持續修訂。*
