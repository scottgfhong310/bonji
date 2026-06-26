# bonji — Session context

把 ASCII / IAST 羅馬轉寫轉成悉曇（Siddhaṁ）梵字 + 拉丁轉寫 + Unicode 碼位的單頁 WebApp。**轉換在瀏覽器**（vendored 的 [mandel59/bonji-input](https://github.com/mandel59/bonji-input)，MIT，原樣不改，只透過防腐層 `SiddhamConverter` 使用）；另有 bonji 專屬的**匯出 / 列表 API**（把結果存成 JSON 到 `/download/bonji/`、並列出該夾）。版面為左輸入 / 右輸出兩欄。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

**本 app 特有的設計決議**（承襲家族規範之上）見 [`DESIGN.md`](./DESIGN.md)：架構/邊界、轉換管線、**空格與連字號政策**、對照表、`config.json` 後端開關、主題/toast、預設值、資料結構。改本 app 的轉換/對照表/後端行為前，先讀它。

## 結構

```
app.js                              # Express 入口：port 3000；static + /api/bonji；/ → 302 /apps/bonji/
routes/bonji.js                     # POST /api/bonji/export、GET /api/bonji/downloads（{ ok } 信封）
test/verify-siddham.mjs             # 引擎驗證（npm test）
public/download/bonji/.gitkeep      # 匯出的 JSON 落在這（內容不進版控）
public/apps/bonji/                  # 前端（服務於 /apps/bonji/）
├─ index.html · bonji.css · bonji.js          # 轉換頁：結構 / 樣式 / 膠水（bonji.js 是 ESM module）
├─ chart.html · chart.css · chart.js          # 字元對照表（引擎導出；DESIGN §7.1）
├─ catalog.html · catalog.css · catalog.js    # 字型對照表（依 BonjiInput.xlsx；DESIGN §7.2）
├─ assist.js · assist.css                     # 輔助輸入字形選盤（嵌轉換頁；DESIGN §7.4）
├─ siddham-converter.js                       # 防腐層：唯一對外悉曇介面（ESM、不碰 DOM）
├─ config.json                                # 後端開關 { backend: true|false }
├─ data/{catalog.json, BonjiInput.xlsx}       # catalog 資料（catalog.json 由 xlsx 生成、xlsx 為來源）
├─ vendor/bonji-input/{siddham.js, LICENSE, SOURCE.md}   # vendored 引擎（MIT、勿改邏輯）
├─ fonts/{NotoSansSiddham-Regular.woff2+OFL.txt, Mojikm13.TTF, Siddham.ttf}  # 悉曇/Mojikyo/Siddham 字型
├─ side-tool.css · materialize-dark.css
└─ i18n.js · locales/{zh-Hant,en,ja}.js
```

## 執行 / 驗證

```bash
npm install && node app.js          # → http://localhost:3000/apps/bonji/
npm test                            # 驗證 vendored 引擎（5 筆 OK + 碼位）
```

## 本 app 的 canon 重點 / 注意

- **可嵌入 lib = `siddham-converter.js`**：`SiddhamConverter`（anti-corruption layer），純邏輯不碰 DOM；`bonji.js` 才是碰 DOM 的控制器。**邊界紀律**：app 其餘程式只 import `siddham-converter.js`，**絕不**直接 import `vendor/bonji-input/siddham.js`；升級引擎只動 wrapper。`convert()` 另在此層補上引擎未涵蓋的符號（章節符號 `*1…`、virama `:-`→`◌𑖿`、替代母音符號 `_u`/`_uu`）——用 PUA sentinel 前後處理、不改引擎（DESIGN §4.1）。
- **原生 ESM、零 build**：引擎是純 ESM（`export`），canon 硬約束「不修改 siddham.js」，故 `siddham-converter.js` 與 `bonji.js` 以 `<script type="module">` 載入（仍 zero-build、CDN-first）。這偏離家族 §4.2 的 IIFE→`window.XxxLib` 字面，但守其精神（純核心、零依賴、不碰 DOM）。jQuery / Materialize / Lodash / I18n 仍是 classic CDN globals。
- **主題（重要）**：CSS 變數 light/dark，預設 dark；**materialize-dark.css 以 `html.light-mode` class 標記淺色**（否則系統偏好為深色時會強制深色）。`applyTheme` 同時設 `data-theme` **與** `light-mode`/`dark-mode` class；防閃爍開機腳本也要一起設 class。bonji 是家族首個實際採用共用 `materialize-dark.css` 的 app。
- **字型**：悉曇須內嵌 `Noto Sans Siddham`（`@font-face`，CDN 無可靠來源），否則輸出是缺字方塊。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`，三語齊備。
- **API（`routes/bonji.js`，`{ ok }` 信封）**：`POST /api/bonji/export` 把 `{ title, options, input, output, sourceFile }` 存成 `public/download/bonji/bonji-yyyyMMddHHmmss.json`（檔名由 server 產生；options 即三選項，非 `parameters`；**`input` 一律存正規化 ASCII 記法**＝`convert()` 的 `ascii`，如 ṁ/ṃ → ;m，故 `output` 只有 siddham/latin/codepoints、不另存 ascii；`sourceFile` 記來源檔名、server 端 `basename` 後存入、無則 `null`）；`GET /api/bonji/downloads` 降冪列出該夾；`POST /api/bonji/clear` 清空該夾（目標寫死在 server，前端 `confirm()` 二次確認）。匯出檔以 `/download/bonji/<file>` 靜態提供。**側邊「下載」鈕＝先 export 再下載剛產生的 JSON**。**點清單項目＝把該檔 title/options/input 載回頁面並重算**；前端以 `loadedFrom`（載入或上次匯出的檔名）追蹤血緣，再匯出時寫進新檔的 `sourceFile`。因有此 API，**轉換可純前端，但匯出 / 列表需要本 Node server**（非純靜態 / 非 GitHub Pages）。
- **後端開關 `config.json`**：`public/apps/bonji/config.json` 的 `{ "backend": true|false }` 由 `bonji.js` 在 `init` 讀取（`loadConfig`）。`true`（預設）＝用後端（匯出/清單/載回/清空、下載＝先匯出再下載）；`false`＝純前端（隱藏 `setting-downloads`/`setting-export`/`setting-clear-downloads` 三工具、下載改 Blob、不打 `/api`），可純靜態託管。讀不到 config 視為 `false`（無伺服器）。後端 route 永遠掛著、`false` 時閒置不被呼叫。（沿用 tibetan-siddham 的做法。）
- **UI**：左欄有「標題」textarea ＋輸入 textarea（皆可複製）；options 下方有 `#source-row`，載入匯出檔時顯示該檔的 `sourceFile`（無來源則隱藏）。`SiddhamConverter.convert()` 回傳 `{ input, ascii, siddham, latin, codepoints }`（`ascii` ＝正規化共用記法，如 ṁ/ṃ → ;m、保留換行）。UI 五項可複製輸出：悉曇 / 拉丁 / ASCII 記法 / Unicode 碼位 / **HTML 片段**（每行 `<span class="siddham" data-latin="{latin}">{siddham}</span>`，供經文整理；由 `bonji.js` 的 `buildSpanHtml` 組出，**屬呈現層、不放進 converter**）。右側工具列用 flex 容器 `.side-tools`（與 tibetan-siddham 對齊，隱藏工具不留空位）。
- **兩支對照表頁**（皆新分頁開啟，DESIGN §7）：`chart.html`（引擎即時導出）與 `catalog.html`（**依 `BonjiInput.xlsx`** 策展，含異體字/上下接續，跨三字型）。catalog 的多字型是關鍵：`fd_group` = `siddham`(Noto Sans Siddham) / `mojikyo119`(**Mojikm13.TTF**，fd_char 是 CJK 碼位、在該字型內顯示為悉曇) / `uniSiddham`(Siddham.ttf)；以 `@font-face` + class 套用。改 catalog 資料＝改 `data/BonjiInput.xlsx` → 重生 `data/catalog.json`（Python stdlib zip+xml，無 openpyxl）。**注意：Mojikm13.TTF / Siddham.ttf 約 7.5 MB，catalog 頁載入、轉換頁「輔助輸入」面板首次開啟才 lazy 載入；發佈前確認字型授權可再散布。**
- **輔助輸入**（`keyboard` 側邊工具、DESIGN §7.4）：轉換頁**固定在右側**的字形選盤（可開關），與 catalog 同源（`data/catalog.json`、8 類 278 格，類別 chips + 記法搜尋）。點字 → 把 `fd_code` 插入 `#bonji-input` 游標處並派發 `input` 事件即時重轉；異體字（無 code）僅參考。`assist.js` 是 **classic IIFE、不 import 模組**、與控制器解耦（只碰 `#bonji-input` / `#setting-assist`，靠 DOM 事件）。那兩個 TTF 面板首開才 lazy 載入；開關狀態存 `localStorage`。dock 底固定一排輔助鈕：空格 / 換行 / 連字號（插入 ` ` / `\n` / `-`）。版面：`position: fixed` 覆蓋式釘在右緣（`right:12`）、**不推主畫面**；開啟時隱藏 side-tools（`body.assist-open`），面板標題列 ⋮ 鈕切換 side-tools（`body.assist-tools`，顯示時 dock 讓到 `right:70`）、× 關閉。
- **更新引擎**：見 `vendor/bonji-input/SOURCE.md`（釘選 commit `0a7eadd…`）與 README 的「更新 vendored 引擎」。
