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
├─ assist.js · assist.css                     # 輔助輸入字形選盤（嵌轉換頁、三個群；DESIGN §7.4）
├─ composition.js                             # Composition 欄（classic → window.BonjiComposition；DESIGN §7.6）
├─ siddham-converter.js                       # 防腐層：唯一對外悉曇介面（ESM、不碰 DOM）
├─ config.json                                # 後端開關 { backend: true|false }
├─ data/{catalog.json, BonjiInput.xlsx}       # 預設群資料（catalog.json 由 xlsx 生成、xlsx 為來源）
├─ data/element-catalog.json                  # Cbeta / Mojikyo 兩群；**產物、不手改**，由 db_siddham 匯出（DESIGN §7.5）
#  └ 排序＝單一 CBETA 字母表（體文參考母音、上下接續參考子音、`_u` 掛 `u` 後面），見 DESIGN §7.5
├─ vendor/bonji-input/{siddham.js, LICENSE, SOURCE.md}   # vendored 引擎（MIT、勿改邏輯）
├─ font-availability.js                       # 本機字型偵測＋缺字型說明（classic → window.BonjiFonts）
├─ fonts/{NotoSansSiddham-Regular.woff2 + OFL.txt}       # 只收可散布的那一支（OFL）；Mojikyo/Siddam 讀本機安裝，見 DESIGN §11
├─ side-tool.css · side-tool.js · materialize-dark.css   # 家族共用側鍵（樣式＋setIconDone 行為；權威版＝家族 repo，§5.5）
├─ filter-clear.css · filter-clear.js         # 家族共用：搜尋框清除鈕（權威版不在家族 repo 根，見 SHARED_LIBRARY_GUIDELINES §4）
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
- **字型（重要）**：分兩種取得方式，分野是「這支准不准我們再散布」。①**隨程式附上**：`Noto Sans Siddham`（`@font-face` 內嵌，CDN 無可靠來源，否則輸出是缺字方塊；SIL OFL，授權寫在字型自己身上）。②**讀本機安裝**：`Mojikyo M119` / `Siddam`（`src: local(...)`，**repo 內不放字型檔、git 歷史也已清除**）——⚠️ 本 repo 是 public，而那兩支一支明示保留權利、一支完全沒有授權條款；**`fsType` 講的是能不能嵌進 PDF，不是散布許可**，**沒有條款 ≠ 可以散布**。判定見 `DESIGN.md` §11.1 與家族 `My Projects/Siddham/SIDDHAM_DOMAIN_GOVERNANCE.md` §9.2。⚠️ `local()` 要用字型的**真名不是檔名**（`Mojikyo M119` / `Siddam`〔一個 h〕；舊的 `'Mojikyo M13'` / `'Siddham'` 是照檔名取的別名，對 `local()` 找不到）。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`，三語齊備。
- **API（`routes/bonji.js`，`{ ok }` 信封）**：`POST /api/bonji/export` 把 `{ title, options, input, output, sourceFile }` 存成 `public/download/bonji/bonji-yyyyMMddHHmmss.json`（檔名由 server 產生；options 即三選項，非 `parameters`；**`input` 一律存正規化 ASCII 記法**＝`convert()` 的 `ascii`，如 ṁ/ṃ → ;m，故 `output` 只有 siddham/latin/codepoints、不另存 ascii；`sourceFile` 記來源檔名、server 端 `basename` 後存入、無則 `null`）；`GET /api/bonji/downloads` 降冪列出該夾；`POST /api/bonji/clear` 清空該夾（目標寫死在 server，前端 `confirm()` 二次確認）。匯出檔以 `/download/bonji/<file>` 靜態提供。**側邊「下載」鈕＝先 export 再下載剛產生的 JSON**。**點清單項目＝把該檔 title/options/input 載回頁面並重算**；前端以 `loadedFrom`（載入或上次匯出的檔名）追蹤血緣，再匯出時寫進新檔的 `sourceFile`。因有此 API，**轉換可純前端，但匯出 / 列表需要本 Node server**（非純靜態 / 非 GitHub Pages）。
- **後端開關 `config.json`**：`public/apps/bonji/config.json` 的 `{ "backend": true|false }` 由 `bonji.js` 在 `init` 讀取（`loadConfig`）。`true`（預設）＝用後端（匯出/清單/載回/清空、下載＝先匯出再下載）；`false`＝純前端（隱藏 `setting-downloads`/`setting-export`/`setting-clear-downloads` 三工具、下載改 Blob、不打 `/api`），可純靜態託管。讀不到 config 視為 `false`（無伺服器）。後端 route 永遠掛著、`false` 時閒置不被呼叫。（沿用 tibetan-siddham 的做法。）
- **UI**：左欄有「標題」textarea ＋輸入 textarea（皆可複製；輸入框右上角另有「清除輸入」`#clear-input`，2026-08-22 自側鍵列移來與複製並排，見 `DESIGN.md` §10）；options 下方有 `#source-row`，載入匯出檔時顯示該檔的 `sourceFile`（無來源則隱藏）。`SiddhamConverter.convert()` 回傳 `{ input, ascii, siddham, latin, codepoints }`（`ascii` ＝正規化共用記法，如 ṁ/ṃ → ;m、保留換行）。UI 五項可複製輸出：悉曇 / 拉丁 / ASCII 記法 / Unicode 碼位 / **HTML 片段**（每行 `<span class="siddham" data-latin="{latin}">{siddham}</span>`，供經文整理；由 `bonji.js` 的 `buildSpanHtml` 組出，**屬呈現層、不放進 converter**）。右側工具列用 flex 容器 `.side-tools`（與 tibetan-siddham 對齊，隱藏工具不留空位）。
- **兩支對照表頁**（皆新分頁開啟，DESIGN §7）：`chart.html`（引擎即時導出）與 `catalog.html`（**依 `BonjiInput.xlsx`** 策展，含異體字/上下接續，跨三字型）。catalog 的多字型是關鍵：`fd_group` = `siddham`(Noto Sans Siddham) / `mojikyo119`(**Mojikyo M119**，fd_char 是 CJK 碼位、在該字型內顯示為悉曇) / `uniSiddham`(**Siddam**)；以 `@font-face` + class 套用。改 catalog 資料＝改 `data/BonjiInput.xlsx` → 重生 `data/catalog.json`（Python stdlib zip+xml，無 openpyxl）。**注意：`Mojikyo M119` / `Siddam` 讀使用者本機安裝的版本、不隨 repo 散布（DESIGN §11.1），故沒有東西要下載——舊的「7.5 MB、lazy 載入」已不成立。⚠️ 那兩支的 `fd_char` 是真的 CJK 碼位，沒裝時字格會顯示成一般漢字（不是缺字方塊）——看起來正常卻是錯的字，故偵測不到時除了出說明還要把受影響的字格標出來（§11.2）——**catalog 頁 151 格、轉換頁 497 格**（`body.font-missing-*` 是 body 層 class，命中該頁所有 `.f-mojikyo` / `.f-unisiddham`，含輔助輸入新兩群與 Composition 欄）。**
- **輔助輸入**（`keyboard` 側邊工具、DESIGN §7.4）：轉換頁**固定在右側**的字形選盤（可開關），**三個群、兩份資料**——預設群（`data/catalog.json`，與 catalog 同源、8 類 **278** 格）＋ **`Cbeta` 156 格**與 **`Mojikyo 今昔` 191 格**（`data/element-catalog.json`，由 `db_siddham` 匯出，見 §7.5），合計 **625** 格。**兩排 chips ＝ 群 × 類兩個獨立的軸**，交集才顯示。**排序是單一名次表**〔owner 2026-08-31〕：五類全部掛到 CBETA 的字母次第上（體文參考母音、上下接續參考子音），`_` 開頭的替代形掛在本體後面（`_u` 緊接 `u`、`_uu` 緊接 `uu`），**複合接續掛在它第一個子音後面**（`;nk`→`;n`、`kv`／`ktr`→`k`、`tr`／`t,r`→`t`、`y_u`→`y`；上／下接續與接續擴充三類一起套），`~m`／`:-` 掛在 xlsx `#` 序裡前一個對得上的後面。**同一記法多格時以字形自己的碼決勝、不是 xlsx 列號**（列號會因來源插列而整段位移）；記法未定者也走同一把碼、排在該段最後（現況 0 格）。⚠️ **`tb_siddham_element.fd_sort` 不是主鍵**——那份 `#` 把 `_u`／`_uu` 編在最後。點字 → 把記法插入 `#bonji-input` 游標處並派發 `input` 事件即時重轉；後兩群另外把該格的**載體字**記進 Composition 欄（§7.6）。⚠️ 「不可插入」有兩種、訊息要分得開：預設群的**異體字**（`assist.noinput`）與新兩群的**記法未定**（`assist.nonotation`；⚠️ **現況 0 格**——`暇` 自 2026-08-31 起由 owner 裁定為 `jh`，那條路刻意留著備用）。`assist.js` 是 **classic IIFE、不 import 模組**、與控制器解耦（只碰 `#bonji-input` / `#setting-assist`，靠 DOM 事件）。那兩支字型讀本機安裝的版本、**沒有東西要下載**（舊的「面板首開才 lazy 載入」已不成立）；偵測不到時面板內出說明並把受影響的字格加刪節線——⚠️ 這裡尤其要標，因為面板的用途就是「認出字形」，而沒裝時認出來的會是錯的字。開關狀態存 `localStorage`。dock 底固定一排輔助鈕：空格 / 換行 / 連字號（插入 ` ` / `\n` / `-`）。
- **Composition 欄**（輸入欄下方、DESIGN §7.6）：記 `Cbeta` / `Mojikyo 今昔` 兩群點過的**載體字**（記法同時進輸入欄）。⚠️⚠️ **一格一個 `<span>`、字型逐格指定**——兩套造字共用 CJK 碼位，整欄設一個 `font-family` 會讓 Mojikyo 的字被 `Siddam` 先接走、**畫成別的悉曇字而看起來完全正常**。唯讀（手打的字沒有出身、對映不到字型）；右上角 複製 / 退一格 / 清除，**退一格先確認輸入欄結尾真的是那一格的記法**才動它，否則只退本欄並講出來。`clearAll()` 一併清空。**進匯出 JSON**〔owner 2026-08-31〕：`composition: [{ char, font, family, code }]`，沒組字給 `[]` 不給 `null`；載回時一併還原（舊檔沒這個鍵 ⇒ 清空）。⚠️⚠️ **`routes/bonji.js` 的 `POST /export` 是逐欄重建 record 的（白名單）**——前端多送一個鍵，後端沒接就會**安靜地被丟掉、而畫面上匯出是成功的**（本次實際踩到）。**加欄位兩邊都要改，而且要拿磁碟上那個檔驗收。**⚠️ `family` 取自 `font-availability.js` 的 `FONTS`（**不另抄一份對照表**）。版面：`position: fixed` 覆蓋式釘在右緣（`right:12`）、**不推主畫面**；開啟時隱藏 side-tools（`body.assist-open`），面板標題列 ⋮ 鈕切換 side-tools（`body.assist-tools`，顯示時 dock 讓到 `right:70`）、× 關閉。
- **更新引擎**：見 `vendor/bonji-input/SOURCE.md`（釘選 commit `0a7eadd…`）與 README 的「更新 vendored 引擎」。
