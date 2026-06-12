/**
 * bonji — 獨立執行的 Express 伺服器（極簡）
 *
 * 悉曇（Siddhaṁ）轉換器：轉換邏輯都在瀏覽器（vendored bonji-input 引擎，包在
 * SiddhamConverter 防腐層之後）。後端負責靜態檔，外加 bonji 專屬的匯出 / 列表 API。
 *
 * 提供：
 *   - 靜態檔（public/）→ 應用在 /apps/bonji/；匯出檔在 /download/bonji/
 *   - bonji API：/api/bonji（routes/bonji.js）：POST /export、GET /downloads、POST /clear
 *   - 根路徑 / → 302 /apps/bonji/
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/bonji/
 */

const express = require('express');
const path = require('path');
const logger = require('morgan');

const bonjiRouter = require('./routes/bonji');

const app = express();

app.use(logger('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/bonji', bonjiRouter);

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/bonji/'));

// 404（API 回 JSON，其餘回純文字）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).type('text/plain').send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[bonji] →  http://localhost:${PORT}/apps/bonji/`);
});
