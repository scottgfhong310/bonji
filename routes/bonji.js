/**
 * routes/bonji.js — bonji 專屬 API（信封一律 { ok }）
 *
 *   POST /api/bonji/export    — 把一次轉換結果存成 JSON 到 public/download/bonji/
 *                               檔名由 server 產生：bonji-yyyyMMddHHmmss.json
 *   GET  /api/bonji/downloads — 列出 public/download/bonji/ 內的 JSON（依檔名降冪）
 *   POST /api/bonji/clear     — 清空 public/download/bonji/ 下的所有 JSON
 *
 * 檔案存於 public/ 下，故可由 express.static 以 /download/bonji/<file> 直接取回。
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// 資料目錄寫死在 server 端（不接受任意路徑參數）
const DATA_DIR = path.join(__dirname, '..', 'public', 'download', 'bonji');

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }

// 時間工具（內建 padStart，不依賴 lodash）
function pad2(n) { return String(n).padStart(2, '0'); }
function timestamp(d) {
  d = d || new Date();
  return String(d.getFullYear()) + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
    pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

// POST /api/bonji/export
router.post('/export', (req, res) => {
  try {
    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title : '';
    const input = typeof body.input === 'string' ? body.input : '';
    const output = (body.output && typeof body.output === 'object') ? body.output : {};
    const options = (body.options && typeof body.options === 'object') ? body.options : {};
    // 來源檔名（只記錄進 JSON、不用於檔案系統）：取 basename 去掉任何路徑成分
    const sourceFile = (typeof body.sourceFile === 'string' && body.sourceFile)
      ? path.basename(body.sourceFile) : null;

    /* Composition（DESIGN §7.6／§9）：一格一筆 { char, font, family, code }。
     * ⚠️ **本 route 是逐欄重建 record 的（白名單）**——前端多送一個鍵，這裡沒接就會
     *    **安靜地被丟掉，而畫面上匯出是成功的**。加欄位時兩邊都要改。
     * ⚠️ 這是 request body ＝ 外部輸入且會寫進磁碟 ⇒ 逐筆檢型別：沒有 `char` 的丟掉、
     *    其餘欄位不是字串一律存 null。**不設筆數上限**——靜默截斷會讓匯出檔看起來完整；
     *    大小由 app 層的 `express.json({ limit })` 擋。
     * ⚠️ **`font` 不在這裡比對白名單**：route 不認得字型，而它存的是「當時畫面上是什麼」。
     *    認不認得是前端渲染時的事（見 composition.js 的 `set()`）。 */
    const composition = Array.isArray(body.composition)
      ? body.composition.reduce((acc, e) => {
          if (!e || typeof e !== 'object' || typeof e.char !== 'string' || e.char === '') return acc;
          acc.push({
            char: e.char,
            font: typeof e.font === 'string' ? e.font : null,
            family: typeof e.family === 'string' ? e.family : null,
            code: typeof e.code === 'string' ? e.code : null
          });
          return acc;
        }, [])
      : [];

    // ⚠️ 與前端 hasContent() 同一組條件——只組了 Composition 而沒打字也算有內容，
    //    不然那條路會拿到一個說不出理由的 400。
    if (!input && !(output.siddham || output.latin || output.codepoints) && !composition.length) {
      return res.status(400).json({ ok: false, error: 'Nothing to export' });
    }

    ensureDir();
    const filename = `bonji-${timestamp()}.json`;
    const abs = path.join(DATA_DIR, filename);
    // 落點檢查（filename 由 server 產生，仍雙重保險擋穿越）
    if (!abs.startsWith(DATA_DIR + path.sep)) {
      return res.status(400).json({ ok: false, error: 'Bad path' });
    }

    const record = {
      app: 'bonji',
      exportedAt: new Date().toISOString(),
      sourceFile: sourceFile,
      title: title,
      options: {
        inputMethod: options.inputMethod || null,
        transliteration: options.transliteration || null,
        ignoreSpacesAndHyphens: !!options.ignoreSpacesAndHyphens
      },
      input: input,
      output: {
        siddham: output.siddham || '',
        latin: output.latin || '',
        codepoints: output.codepoints || ''
      },
      // 沒組字時給 []（不是 null）——「這次沒組字」與「舊版沒有這個欄位」要分得出來
      composition: composition
    };

    fs.writeFileSync(abs, JSON.stringify(record, null, 2), 'utf8');
    console.log(`[bonji] exported ${filename}`);
    return res.json({ ok: true, filename: filename, path: `/download/bonji/${filename}` });
  } catch (e) {
    console.error('[bonji] export failed:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/bonji/downloads
router.get('/downloads', (req, res) => {
  try {
    ensureDir();
    const files = fs.readdirSync(DATA_DIR)
      .filter((n) => n.toLowerCase().endsWith('.json'))
      .map((n) => {
        const st = fs.statSync(path.join(DATA_DIR, n));
        return { name: n, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => b.name.localeCompare(a.name)); // 降冪（檔名含時間戳）
    return res.json({ ok: true, files: files });
  } catch (e) {
    console.error('[bonji] list failed:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/bonji/clear — 清空 public/download/bonji/ 下的所有 JSON（目標寫死在 server）
router.post('/clear', (req, res) => {
  try {
    ensureDir();
    const names = fs.readdirSync(DATA_DIR).filter((n) => n.toLowerCase().endsWith('.json'));
    let removed = 0;
    for (const n of names) {
      const abs = path.join(DATA_DIR, n);
      if (abs.startsWith(DATA_DIR + path.sep)) { fs.unlinkSync(abs); removed++; }
    }
    console.log(`[bonji] cleared ${removed} file(s)`);
    return res.json({ ok: true, removed: removed });
  } catch (e) {
    console.error('[bonji] clear failed:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
