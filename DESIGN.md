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

### 4.1 補充符號（引擎未涵蓋者，在 ACL 補上）

`BonjiInput.xlsx` 有些 `fd_code` 不在 vendored 引擎的記法裡，直接餵引擎會被拆散（如 `*1`→`𑗄`+`1`、`o2x`→`𑖌𑗆x`）。引擎**不可改**（canon），故在 `siddham-converter.js` 的 `convert()` 補上一層處理：把這些 code 先換成**私用區 sentinel**（`U+E000…`）餵給引擎（引擎原樣 echo），轉出後再把 sentinel 換回對應的悉曇字 / 拉丁。三類：

- **章節 / 裝飾符號**（`*0`–`*7`、`o2`/`o2x`/`ox2`/`ox3`/`ox4`/`oxx` → `U+115CA…U+115D7`）：獨立、不接字。`latin` 照 bonji 既有慣例＝**悉曇字本身**（如 `--`→latin `𑗁`）；`ascii` 保留 code（可回填）。
- **virama** `:-`（`U+115BF`）：悉曇用 **◌ 載體**顯示（`◌𑖿`，同對照表 §7.1）；`latin` 放 **◌**（virama 無獨立音值，bonji 平常的 virama 也只在裸子音裡、對 latin 零貢獻）。
- **替代母音符號** `_u` / `_uu`（`U+115DC` / `U+115DD`，依附於前一子音）：注入「base 母音 `u`/`uu` + sentinel」讓引擎**正確接到前一子音**（`k_u`→`𑖎𑗜`，而非裸子音 `𑖎𑖿`＋符號），再把產生的常規母音符號換成替代字形；單獨時加 ◌ 載體（`◌𑗜`）。`latin` 用乾淨的 **`u`/`ū`**——替代形的「識別」交給悉曇字 / ASCII 記法（`_u`）/ 碼位（`U+115DC`）三者，不擠進 latin。

只在 `convert()` 處理（轉換器 / 輔助輸入走這條）；靜態 `toSiddham`/`toLatin` 是給引擎導出的 `chart.html` 用、不涉這些 code，故不動。無補充 code 的輸入完全不受影響。

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

兩支對照表頁，皆以新分頁開啟、樣式承襲轉換頁；**資料來源不同**：chart 由引擎即時導出，catalog 由策展的 `BonjiInput.xlsx` 而來。另外，轉換頁內嵌的「輔助輸入」面板（§7.4）也取用同一份 `catalog.json`——但它自 2026-08-31 起**還有第二份資料** `element-catalog.json`（由 `db_siddham` 匯出，§7.5），catalog 頁不吃那一份。

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
  - `mojikyo119` → **`Mojikyo M119`**（**`fd_char` 是 CJK 碼位**，在此字型內顯示為悉曇字形，**非**漢字）；
  - `uniSiddham` → **`Siddam`**（**`fd_char` 同為 CJK 碼位**，在此字型內顯示為悉曇字形，**非**漢字）。
  以 `@font-face { src: local(...) }` 宣告，CSS class `.f-mojikyo` / `.f-unisiddham` / `.f-siddham` 套到字格。
  ⚠️ **後兩支不隨 repo 散布、讀使用者本機安裝的版本**（授權判定見 §11.1）——名字是字型的**真名**不是檔名，
  偵測不到時出說明並把受影響的字格標出來（§11.2）。轉換頁初始只有 47 KB 的 Noto（那兩支本來就不下載）。
- **導覽**：同 chart——轉換頁 `window.open(href, 'bonji-catalog')` 具名新分頁；返回鈕有 `opener` 則 `focus()`＋`close()`。

### 7.3 兩頁共通導覽

轉換頁「對照表」鈕以 `window.open(href, '<name>')`（**具名、script 開啟**）開新分頁——具名可重用同一頁、script 開啟才能被自身 `close()`；子頁「返回」若有 `opener` 就 `focus()`＋`close()` 關回原分頁，否則就地導回 `index.html`。

### 7.4 輔助輸入面板（index.html）— 三個群、兩份資料

整理 / 比對文獻時用的字形選盤，**嵌在轉換頁**（非獨立頁），由 `assist.js` + `assist.css` 實作。整理流程：看著來源字形、在面板認出它、點一下就把記法插進輸入框。

- **三個群、兩份資料**（2026-08-31 起）：

  | 群 | 資料 | 內容 |
  | --- | --- | --- |
  | 預設群 `default` | `data/catalog.json`（同 catalog 頁） | 8 類 **278** 格 |
  | `Cbeta` | `data/element-catalog.json` | 母音 16 · 子音 35 · 體文 22 · 上接續 39 · 下接續 44 ＝ **156** 格 |
  | `Mojikyo 今昔` | 同上 | 母音 16 · 子音 35 · 體文 34 · 上接續 47 · 下接續 44 · 接續擴充 2 ＝ **178** 格 |

  合計 **612** 格。`assist.js` 把兩份來源正規化成同一個內部形狀（`groups[].cats[].entries[]`，**`font` 逐格帶著**），於是渲染、搜尋、字型偵測都只有一條路。
- **兩排 chips ＝ 兩個獨立的軸**：第一排選群、第二排選類，交集才顯示（選 `Cbeta` ＋ `上接續` 就只看那 39 格）。整群都沒東西時**連群標題一起收**——留一個空標題會被讀成「這一群是空的」。
- **`element-catalog.json` 是產物、不手改**：由 `db_siddham` 匯出，見 §7.5。
- **同源不另存**：預設群直接 fetch `data/catalog.json`，與 catalog 頁同資料、不經 converter。記法搜尋（依 `code` 子字串）過濾；異體字（無 `code`）標灰、僅供參考不可插入。
- ⚠️ **「不可插入」有兩種，訊息要分得開**：預設群的異體字（`assist.noinput`「此為異體字，無對應輸入記法」）與新兩群的 **記法未定**（`assist.nonotation`「來源未指明記法，無法插入」，全庫只有 M119 的 `暇` 一格）。併成一句的話，「來源沒說」與「這種字本來就沒有記法」就再也分不出來了。
- **插入即重轉**：點一格 → 把其 `fd_code` 插入 `#bonji-input` 游標處 → **派發 `input` 事件**，`bonji.js` 既有的 `input` 監聽即時重轉（並順手 `M.textareaAutoResize` / `updateTextFields`）。
- **底部輔助鈕**：dock 底固定一排（不隨字形捲動）空格 / 換行 / 連字號，分別插入 `' '` / `'\n'` / `'-'`（`-` 為詞組分隔、`' '` 為音節邊界，見 §5）。走同一條 `insertAtCursor` 路徑。
- **與控制器解耦**：`assist.js` 是 classic IIFE、**不 import 任何模組**（用全域 I18n / M），只碰 `#bonji-input` 與 `#setting-assist`；與 ACL / `bonji.js` 零耦合，純靠 DOM 事件溝通。
- **字型**：那兩支讀本機安裝的版本（§11），**沒有東西要下載**——舊版「面板未開＝不抓 TTF（lazy）」的說法已不成立、也不再需要。偵測不到時，說明區塊插在捲動區內的字形區之上（`#assist-font-notice`），受影響的字格加刪節線。⚠️ **這裡尤其要標**：面板的用途是「看著來源字形、在面板裡認出它」，而沒裝字型時那些格顯示的是一般漢字，認出來的會是**錯的字**。開關狀態存 `localStorage`（`bonji-assist-open`）。
- **版面（固定在右側、覆蓋式）**：`position: fixed`、滿版高、內部捲動，由 `keyboard` 鈕開關、`localStorage` 記狀態。**不推主畫面**（覆蓋右側、輸入區位置不動）；開啟時隱藏 `side-tools`（`body.assist-open`）並貼齊右緣（`right: 12px`）。標題列兩顆鈕：**⋮ 切換工具列**（toggle `body.assist-tools` 顯示/隱藏 side-tools；顯示時 dock 自動讓到 `right: 70px` 以免被工具列蓋住）、**× 關閉**（side-tools 隱藏時仍能關閉面板）。

### 7.5 `element-catalog.json` — 由 `db_siddham` 匯出

`Cbeta` / `Mojikyo 今昔` 兩群的資料**不在本 repo 維護**，由 `My Projects/Siddham/export/bonji-element-export.js` 從 `db_siddham` 倒出來（`--check` 預設 / `--write` / `--help`，未知旗標 exit 2；同時寫獨立 repo 與 InProgress 鏡像）。**bonji 執行期不連任何 DB**——產物進版控、`clone` 下來就能跑，同家族五支色彩 registry 的先例。

- **來源**：體文 / 上下接續 / 接續擴充 ← `rel_element_glyph`（`origin = authority`）＝ `體文接續-V1.xlsx` 的 `Cbeta` / `Mojikyo` 分頁；母音 / 子音 ← `vw_standard_glyph`（每個家族每個音節恰好一個標準字形，兩造各 51、音節集合逐一相同）。
- **為什麼讀 DB 不讀 xlsx**：治理 v1.0 起 `db_siddham` 是 SoR、xlsx 不再是裁判。實查兩者 **232 = 232 列**，唯二差異正是治理 §10.9.32 那兩筆裁決（`科`→`jh`、`骸`→`r`）——DB ＝ xlsx ⊕ 裁決。⚠️ 匯出器**刻意不再實作一份 xlsx 解析**：那條路已由 `import-element.py` 與 `reconcile-mojikyo.py` 守著，再寫一份就是同一條規則的第二份實作。
- **排序**〔owner：依 UnicodeSiddham 的順序〕：體文 / 上下接續 / 接續擴充用 `tb_siddham_element.fd_sort`（＝該分頁的 `#` 欄，1–52，接續擴充 53–58），同一記法多格時以 `rel_element_glyph.fd_sort`（該分頁列號）決勝。
  ⚠️ **母音 / 子音那 51 個字母有 5 個不在該分頁裡**（`,l` `,ll` `a;m` `a.h` `lla;m`），排不完 ⇒ 改用 **CBETA 自己的 Big5 碼序**：實測它與該分頁的 46 個共有記法**零逆序**，且它就是古典字母次第，那 5 個因此有可交代的位置。
  ⚠️⚠️ **兩群都用 CBETA 那一份名次**——M119 自己的碼序與 CBETA **51 個裡有 44 個名次不同**（它把 `lla;m` 排在子音第一、四個成音節流音排在 `a.h` 之後）。兩群並排時要對得起來，而家族既有的決定就是取 CBETA 次第。
- **不含任何字型位元組**：產物只有 CJK 載體字碼位；`Siddam` / `Mojikyo M119` 一律讀本機安裝的版本（§11），本 repo 不散布——這一點不因本檔而改變。

### 7.6 Composition 欄（index.html）

輸入欄下方的一格，記的是**你在 `Cbeta` / `Mojikyo 今昔` 兩群點過哪些字**：每點一格，這裡追加該格的載體字（Char），同時 `assist.js` 把對應的記法（Notation）插進 `#bonji-input`——同一次點擊的兩個產物。由 `composition.js`（classic IIFE，`window.BonjiComposition`）實作。

- ⚠️⚠️ **一格一個 `<span>`，字型逐格指定——不可以整欄設一個 `font-family`**。兩套造字都以 CJK 碼位當載體，而**同一個碼位在兩支字型裡多半都畫得出東西**（只是畫成不同的悉曇字）。整欄設 `font-family: 'Siddam','Mojikyo M119'` 的話，Mojikyo 那些字會被 Siddam 先接走 ⇒ **畫面上有字、而且看起來很正常，但那是別的字**。與 §11.2「沒裝字型時字格顯示一般漢字」是同一種壞法：不報錯、只是錯。
  對映：`Cbeta` → `.f-unisiddham`（`Siddam`）／`Mojikyo 今昔` → `.f-mojikyo`（`Mojikyo M119`）。⚠️ 那三條 `.f-*` 規則在 `assist.css`，**刻意不綁在 `.ia-char` 祖先上**——本欄用的是同一組 class 與同一份 `@font-face`，綁死祖先就得再抄一份。
- ⚠️ **本欄唯讀（不可鍵盤輸入）**，理由同上：字型是逐格記住的，手打進來的字沒有出身、對映不到任何一支。故 label 也不是 Materialize 的浮動 label 而是靜態一行，字級取 `.8rem`（實測 12px ＝ 上面兩個真欄位浮起後的字級，讓它看起來是同一層）。
- **只有造字那兩群會寫進來**：預設群的 Unicode 悉曇字**沒有載體字這回事**（它的 `char` 本身就是悉曇字），點它只插記法。
- **右上角三顆鈕**：複製 / **退一格** / 清除（形制同輸入欄的 `.in-actions`，清除沿用 `--danger` 警示色）。
  ⚠️ **退一格會先確認「輸入欄結尾真的是那一格的記法」才動它**：手動改過輸入、或用範例 chip 覆蓋過，本欄就與輸入對不起來——那時**只退本欄並講出來**（`toast.compUndoneOnly`）。靜靜退掉一個對不上的東西比不退更糟。
- **`clearAll()` 一併清空本欄**（`bonji.js`）：清除是整頁重置（標題 / 輸入 / 來源 / 全部輸出），留著 Composition 就與清空後的輸入對不起來，而畫面上看不出那是上一輪的殘留。
- ⚠️ **本欄不進匯出 JSON**：`currentRecord()` 的形狀是既有的對外契約（`sourceFile / title / options / input / output`），本次未動。要收的話是另一個決定。

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
- **side-tools**：用 flex 容器 `.side-tools`（與 `tibetan-siddham` 對齊；**DOM 順序＝排列順序**，隱藏工具不留空位，故 `config.json` 關後端時隱藏三鈕也不錯位）。轉換頁十一鈕（依 DOM 序）：清單 `dehaze` · 輔助輸入 `keyboard` · 回到頁首 `vertical_align_top` · 跳到拉丁轉寫 `text_fields` · 字元對照表 `table_chart` · 字型對照表 `menu_book` · 匯出 `data_object` · 下載 `file_download` · 清空匯出夾 `delete_sweep` · 主題 `dark_mode` · 語言 `translate`。對照表頁三鈕：返回 `arrow_back` · 主題 · 語言。
- **「回到頁首」`#setting-goto-top`**（2026-08-26）：`window.scrollTo({top:0, behavior:'smooth'})`。捲的是**視窗**——本頁沒有內部捲動區，整份文件就是捲動容器（實測 `documentElement.scrollHeight` 隨輸出長高、`window.scrollY` 會動）。排在「跳到拉丁轉寫」**之前**：兩顆同屬頁內定位，而 `side-tool.js` 的溢出收納是由上而下留、由下而上收，愈前面愈晚被收進 ⋮，這一顆比較通用故排前面。同樣不加 `setIconDone`（見下一條）。
- **「跳到拉丁轉寫」`#setting-goto-latin`**（2026-08-26）：把輸出區的拉丁轉寫那一段捲進畫面。**它是側鍵而不是頁面上的常駐鈕**，因為那個動作在頁面上沒有既有入口（判準同家族 v1.21：側鍵是給「沒有常駐入口的動作」用的）。⚠️ **捲的是整個 `.out-block` 不是 `#out-latin`**——標籤「拉丁轉寫」住在 `.out-head`，只捲值的話落點會把標籤留在畫面外，看起來像捲錯地方。上緣留白由 `bonji.css` 的 `.out-block { scroll-margin-top: 16px }` 給、**不在 JS 裡算數字**（日後若加固定頁首只要改 CSS 一處）。**刻意不加 `setIconDone` 的 check 回饋**：本 app 只有匯出／下載／清空匯出夾三顆用它（那三個的效果看不見），捲動的效果自己看得見；而「按了畫面沒動」這一種情況**恰好只在拉丁轉寫已經在畫面上時發生**（實測空輸出時整頁只有 1135px、按下去該段仍完整可見），所以沒有「什麼都沒發生 ＝ 看起來壞了」的縫。⚠️ **`#out-latin` 的標籤與這顆鍵的 tooltip 是兩個 i18n key**（`out.latin` 與 `tool.gotoLatin`）——en 的標籤是 `Transliteration`（無 "Latin" 字樣），tooltip 照它寫成 `Jump to transliteration`，不要各自照中文直譯。
- **輸入欄位右上角三顆行內動作鈕 `.in-actions`**（複製 / **貼上** / 清除，2026-08-26 加入貼上）：`#paste-input` **＝覆蓋不是插入游標處**。三件要記的——
  ① ⚠️ **讀剪貼簿比寫嚴得多**（寫只要使用者手勢；讀還要 secure context ＋ 權限，而且可能被直接拒絕）⇒ **退路不是選配**：讀不到就 `focus()` ＋ `select()` 把整段選起來並 toast 告知，使用者按 ⌘V／Ctrl+V 就是覆蓋（**選取狀態下貼上＝清除後貼上，與成功路徑同結果**）。這條在 preview pane 裡是**真的跑到的**——`readText()` 當場被拒絕，實測輸入框聚焦、選取 `[0,16]` 恰好等於全長。
  ② ⚠️ **剪貼簿是空的就什麼都不做，不可以順手把欄位清掉**——那是隔壁那顆鈕的職責，而且沒有人會預期按「貼上」把資料弄不見（家族 `data-object-helper` §17 同條）。
  ③ **只動 `#bonji-input`，不碰標題、也不清 `loadedFrom`／`currentSource`**：本 app 既有的約定是「打字改輸入不會動到來源與標題」（只有 `clearAll()` 會），**貼上只是比較大的一次編輯**——這是照著這支 app 已經做的決定走，不是另外發明一條。
  ⚠️ **成功路徑的證據分兩級，刻意分開記**：pane 裡的 `readText()` 一定被拒絕，所以「值真的被覆蓋、轉換跟著跑、textarea 長高、游標落在字尾」那一輪是**用替身**（`navigator.clipboard.readText` 換成 resolve 固定字串）跑出來的——它證明的是**接到文字之後那一段**對；**真正從系統剪貼簿讀進來那一步不是我驗的**。該步由 owner 於 2026-08-26 在 3001 鏡像實測通過（未指明瀏覽器，故不寫）。**併成一句「已驗證」會讓日後的人以為這兩級同級**（家族 v1.34／v1.53 那條）。
  ⚠️⚠️ **i18n key 要先查家族有沒有，再決定要不要偏離——我這一輪是反過來做的。**〔2026-08-26〕
  我先造了 `toast.pasteManual`／`toast.pasteEmpty`，匯入 `meta_i18n` 之後才在 `--report` 上看見：
  家族早就有 **`toast.pasteSelected`**（`data-object-helper`），**同一個情境、三語措辭幾乎一樣**
  ——我等於另立了一個同義 key；而 `toast.pasteEmpty` 既有那支寫得更完整（「…**沒有貼上任何東西**」），
  兩支各一、沒有多數，**這時候採用既有那一種才是不分岔**。兩者皆已改（舊 key 由匯入器標成
  `fd_status = -1` 退役）。**判準：先問「這個 key 家族有沒有」，再問「要不要偏離」**
  ——順序反過來的代價是，同義 key 一旦出貨就得靠一次盤點才看得見。
  ⚠️ 唯一**刻意保留**的是 `toast.pasted`〔owner 2026-08-26 拍板〕：多數 5 支是「已貼上：`{v}`」
  **帶參數**，而本 app 的呼叫端不傳任何參數 ⇒ 照抄會顯示字面的 `{v}`（§6 R4）；語意也真的不同
  （這顆鈕是 `.in-actions` 裡唯一會讓既有輸入消失的動作）。理由已寫進
  `db_inprogress.meta_i18n.fd_note`（`master-data/sql/04_fd_note_2026-08-26.sql`）。
  **✅ owner 於 3001 鏡像實測**〔2026-08-26〕：本輪新增的三顆鈕——側鍵「回到頁首」`vertical_align_top`、
  側鍵「跳到拉丁轉寫」`text_fields`、輸入欄行內「貼上」——**日常使用正常**（未指明瀏覽器，故不寫）。
  ⚠️ **這一條刻意寫明它「不」涵蓋什麼**：`toast.pasteEmpty`（剪貼簿真的空著）與
  `toast.pasteSelected`（瀏覽器擋掉剪貼簿讀取）**只有在失敗路徑才會出現**，正常成功貼上跑的是
  `toast.pasted`。所以「日常使用正常」**不等於那兩句話被看過**——那兩句目前的證據仍只有
  pane 裡的替身與那一次真的被拒絕的 `readText()`。**把實測的範圍寫小一點，比寫成「已驗證」有用**
  （同下一段那條兩級證據）。
  **顏色刻意不另開一個**：`--danger` 在這一組裡標的是「這一下會讓內容不見」——清除按完你手上什麼都沒有，貼上按完你手上是貼進來的東西，而且那是這支 app 的正常用法。故貼上沿用 `.out-copy` 的 muted → accent hover，紅仍然只有清除那一顆（實測 hover 規則：貼上命中 `.out-copy:hover`＝accent、清除命中 `.in-actions .in-clear:hover`＝`--danger`）。
- **「清除輸入」不在側鍵列**（2026-08-22 移出）：它改住輸入欄位右上角、與「複製輸入」並排（`.in-actions`）——那兩個動作的對象都是**那一個輸入框**，放在框上比放在頁面邊緣的通用工具列更接近它作用的地方；側鍵列留下的 `#setting-clear-downloads`（清空匯出夾）對象是伺服器上的資料夾，不是輸入框，故留在原地。⚠️ 搬家後**警示紅要自己補**：共用 `side-tool.css` 的 `#setting-clear:hover{color:#ff6e6e}`（§5.5 警示鍵）是以 id 掛在側鍵上的，元素離開側鍵列後那條規則不再命中，`bonji.css` 的 `.in-clear:hover` 以**逐字相同的值**接手（共用件不動——那條規則對其他成員仍然有效）。⚠️ 選擇器要 **0,3,0**（`.in-actions .in-clear:hover`）：與 `.out-copy:hover`（轉 accent）同為 0,2,0 而後者在檔案更後面 ⇒ **同分後到者勝，紅色會安靜地不生效**（第一版實測 hover 是 accent 藍）。顏色走 `--danger` token，**兩個主題不同值**〔owner 指示〕：dark `#ff6e6e`（沿用共用件的值，對 hover 底 **5.95:1**、對卡片 6.94:1）／light `#d93636`（對 hover 底 **4.09:1**、對卡片 4.63:1）——共用件那個紅在白底上只有 **2.72:1**、過不了非文字元素的 3:1，壓暗一階的處置同 `--warn`（亮色被白色包圍會退成一片糊）。**2026-08-22 同日收尾**：共用 `side-tool.css` 的警示鍵也收成同一組值〔owner 指示〕，於是側鍵 `#setting-clear-downloads` 與這顆行內清除鈕**兩個主題都同紅**（先前這裡記過「淺色下兩顆不同紅」的代價，已不成立）。⚠️ 但**兩處的值各自寫著**：共用件刻意不讀 `--danger`（家族已有 app 拿它當私有警示色且值不同，如 `circle-text` 淺色是 `#c1121f`），所以 `bonji.css` 的 `--danger` 與共用件的字面值**是各自獨立的兩份、目前恰好相等**——改其中一個不會帶動另一個。靜止色 `--muted` 兩個主題皆 6.39:1，紅只是 hover 的**附加**警示、不是唯一識別。

---

## 11. 字型（Fonts）

字型分**兩種取得方式**，而分野就是「這支字型准不准我們再散布」：

- **隨程式附上（bundle）**——`Noto Sans Siddham`（**woff2**，~47 KB）：**所有頁**的 Unicode 悉曇（U+115xx），
  以 `@font-face` 內嵌（CDN 無可靠來源），否則缺字方塊。**它的授權寫在它自己身上**：
  name13 ＝ SIL OFL 1.1、name14 ＝ `https://scripts.sil.org/OFL`，並附 `fonts/OFL.txt`。
- **讀本機安裝（local）**——`Mojikyo M119`、`Siddam`：catalog 頁（§7.2）與轉換頁的「輔助輸入」面板（§7.4）用；
  chart 頁不載。`@font-face { src: local(...) }`，**repo 內不放字型檔**（見下）。

### 11.1 為什麼那兩支不隨 repo 散布〔2026-08-17 定案〕

本 repo 是 **public**。字型是二進位著作物，收進來就是對全世界再散布。逐支查證（一手證據，非推測）：

| 字型 | 字型內說了什麼 | 發佈者說了什麼 |
| --- | --- | --- |
| `Mojikm13.TTF`（family **`Mojikyo M119`**） | name0 ＝ `Copyright(c)1998-2010 AI-NET.Corporation.All rights reserved.`、商標 `Mojikyo` | 文字鏡研究会 **2019-02-12 解散**、官網關閉，**無官方發佈管道** |
| `Siddham.ttf`（family **`Siddam`**，CBETA） | Copyright 欄只有 `CBETA` 四個字，**無條款、無授權 URL** | CBETA 下載頁對該檔**無任何授權條款**（站台的 CC BY-NC-SA 3.0 TW 是**網站**的授權，且為 **NC**，未言明涵蓋字型二進位） |
| `NotoSansSiddham-Regular.woff2` | name13 ＝ SIL OFL 1.1、name14 ＝ OFL URL | — |

⚠️ **兩個容易讀反的地方，各記一次：**

1. **`OS/2 fsType`（本二支為 0x0000 / 0x0008）不是散布許可。** 那一欄回答的是
   「能不能把字型**嵌進文件／PDF**」，**不構成**任何再散布權。
2. **沒有授權條款 ≠ 可以散布。** 著作權預設保留，要有**明示授予**才有散布權。
   **對照就是證據**：可散布的字型會把授權寫在自己身上（Noto 有 name13／name14），這兩支沒有。
   **一個著作權人姓名不是一份授權。**

**Mojikyo 風險等級最高**——它是唯一**明示保留權利**的那一支。

判定依據與家族層級的先例見
`My Projects/Siddham/SIDDHAM_DOMAIN_GOVERNANCE.md` §9.2〔owner 2026-08-17 拍板〕。
兩支字型已自版控**與 git 歷史**移除，並列進 `.gitignore`（理由逐條寫在該檔）。

### 11.2 落地方式與兩個坑

- **`local()` 用的是字型自己 name table 裡的真名，不是檔名**（實查 TTF 得出）：
  `Mojikyo M119`（PostScript `Mojikyo_M119`）、`Siddam`（**一個 `h`**）。
  ⚠️ 舊版 `@font-face` 宣告的 `'Mojikyo M13'` / `'Siddham'` 是**照檔名取的別名**——
  對 `url()` 可行（名字自己取的），對 `local()` 會**完全找不到**。檔名 `Mojikm13.TTF` 本身就誤導；
  `catalog.json` 的 group 名 `mojikyo119` 才一直是對的。full name 與 PostScript name 都列，
  因為不同平台曝出來的名字不同。
- **偵測不到就講清楚，不留白**（`font-availability.js` → `window.BonjiFonts`）：
  catalog 頁與輔助輸入面板各有一個插入點，說明區塊由 `noticeHtml()` 產生（純字串，同家族
  `buildSpanHtml` 的做法）。**Siddam 附 CBETA 下載連結**（那正是 CBETA 自己的散布方式——
  它的下載頁就是叫人裝進系統字型）；**Mojikyo 刻意不附連結**，只說明現況——
  ⚠️ 指向第三方鏡像等於重做我們正在移除的那件事。
- ⚠️ **失敗模式比「豆腐字」嚴重，所以偵測不是裝飾。** 那兩支字型的 `fd_char` 是**真的 CJK 碼位**
  （乾 U+4E7E、侃 U+4F83、焐 U+7110…），只在該字型內才長成悉曇字形。沒裝時字格
  **不會**變成缺字方塊，而是顯示**一般漢字**——看起來完全正常、卻是錯的字。
  故除了說明區塊，還把受影響的 **151 格**（mojikyo 149 ＋ uniSiddham 2）以
  `body.font-missing-*` ＋ 刪節線標出來。
- ⚠️ **不可用 canvas 量寬度偵測**（常見手法，在這裡會**靜默給出錯的答案**）：漢字字形幾乎
  一律全形（advance ＝ 1em），同一個 CJK 碼位在 `Mojikyo M119` 與在任何後備漢字字型裡
  量到的寬度**相同**，於是「沒裝」會被判成「有裝」。改用 `FontFace` ＋ `local()`：
  載得起來就是有裝，載不起來就是沒裝，不靠啟發式。
- **三態不是兩態**：`probe()` 回 `true` / `false` / **`null`（環境無 `FontFace` API，測不出來）**。
  ⚠️ `null` 不可當成 `false`——那會對著一個其實看得到字形的使用者喊「你沒裝字型」。只有確定
  `false` 才出說明、才標字格。
- ⚠️ **`.fontnote-title` / `.fontnote-desc` 的 `color` 要自己寫，不能靠父層繼承**：共用件
  `materialize-dark.css` 有一條 `body, p, span, li, td, th, label, …{ color: var(--mz-text) }`，
  而**直接命中的規則一律勝過繼承值**（與特異性無關）。少了那兩行，標題在淺色下會變成
  `#212121`、深色下變成淺灰，而旁邊的 icon 還是琥珀色（`<i>` 不在那條選擇器裡）——
  **深色下它只是「不夠亮」、不像壞掉，所以只有淺色量得出來**。
- **「面板未開＝不下載字型（lazy）」這條已不成立、也不再需要**：改讀本機安裝後**沒有東西要下載**，
  轉換頁初始成本與面板開不開無關（§7.4 的舊敘述同批改掉）。

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
