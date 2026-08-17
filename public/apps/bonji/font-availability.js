/**
 * font-availability.js — 偵測「本機有沒有裝這支字型」，並產生缺字型時的說明區塊。
 *
 * 為什麼需要這支：catalog / 輔助輸入的字格分三種來源字型，其中兩支（Mojikyo M119、
 * Siddam）**授權不允許隨 repo 散布**（見 DESIGN.md §11），故改成
 * `@font-face { src: local(...) }` 讀使用者本機安裝的版本。沒裝就得講清楚，不能留白。
 *
 * ⚠️ 為什麼失敗模式比「豆腐字」嚴重：那兩支字型的 fd_char 是**真的 CJK 碼位**
 * （乾 U+4E7E、侃 U+4F83、焐 U+7110…），只在該字型內才長成悉曇字形。沒裝時字格
 * 不會變成缺字方塊，而是顯示**一般漢字**——看起來完全正常、卻是錯的字。所以偵測
 * 不是裝飾，缺字型時必須同時把受影響的字格標出來（`body.font-missing-*`）。
 *
 * ⚠️ 為什麼不用 canvas 量寬度：那是偵測字型的常見手法，但**在這裡會靜默給出錯的答案**
 * ——漢字字形幾乎一律是全形（advance = 1em），同一個 CJK 碼位在 Mojikyo M119 與在
 * 任何一支後備漢字字型裡量到的寬度**相同**，於是「沒裝」會被判成「有裝」。
 * 改用 FontFace + local()：載得起來就是有裝，載不起來就是沒裝，不靠啟發式。
 *
 * classic IIFE → window.BonjiFonts（**不是 ESM**）：assist.js 依 DESIGN §7.4 是 classic
 * script、不 import 模組，兩個取用者要共用同一份規則就只能走全域。不碰 DOM 元素，
 * 產生說明區塊的是回傳字串的純函式（同家族 buildSpanHtml / buildSheetTable 的做法）。
 */
(function () {
  'use strict';

  /* 一支字型一格。`local` 列的是**字型自己 name table 裡的名字**（實查 TTF 得出，
   * 不是檔名）：full name 與 PostScript name 都列，因為不同平台曝出來的名字不同。
   * ⚠️ 檔名會誤導——`Mojikm13.TTF` 的 family 其實是 `Mojikyo M119`（catalog.json 的
   * group 名 `mojikyo119` 才是對的），`Siddham.ttf` 的 family 是 `Siddam`（一個 h）。 */
  var FONTS = {
    mojikyo119: {
      css: 'Mojikyo M119',                       // @font-face 宣告的名字（= 真名，不另取別名）
      local: ['Mojikyo M119', 'Mojikyo_M119'],
      descKey: 'font.mojikyo.desc',
      linkHref: null,                            // 見 descKey：官方管道已不存在，故無連結
      linkKey: null,
      bodyClass: 'font-missing-mojikyo'
    },
    uniSiddham: {
      css: 'Siddam',
      local: ['Siddam'],
      descKey: 'font.siddam.desc',
      linkHref: 'https://archive2.cbeta.org/download/cbreader.php',
      linkKey: 'font.siddam.link',
      bodyClass: 'font-missing-siddam'
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function t(key, params) {
    return (window.I18n && I18n.t) ? I18n.t(key, params) : key;
  }

  /**
   * 這支字型在本機裝了沒有。
   * @returns {Promise<boolean|null>} true=有、false=沒有、null=**測不出來**（環境無 FontFace API）
   *
   * ⚠️ null 不可以當成 false：那會對著一個其實看得到字形的使用者喊「你沒裝字型」。
   * 三態分開，呼叫端只在確定是 false 時才出說明。
   */
  function probe(names) {
    if (typeof window.FontFace !== 'function') return Promise.resolve(null);
    var src = names.map(function (n) { return 'local("' + n + '")'; }).join(', ');
    var face;
    try {
      // 只是拿來問「載不載得起來」，**刻意不加進 document.fonts**——不需要它參與排版。
      face = new FontFace('__bonji_probe__', src);
    } catch (e) {
      return Promise.resolve(null);
    }
    return face.load().then(function () { return true; }, function () { return false; });
  }

  /**
   * 全部測一遍。
   * @returns {Promise<Object>} { <group>: true|false|null }
   */
  function detect() {
    var keys = Object.keys(FONTS);
    return Promise.all(keys.map(function (k) { return probe(FONTS[k].local); }))
      .then(function (results) {
        var out = {};
        keys.forEach(function (k, i) { out[k] = results[i]; });
        return out;
      });
  }

  /**
   * 把「哪幾支沒裝」標到 <body> 上，讓 CSS 去標記受影響的字格。
   * 只有明確 false 才標——null（測不出來）不標，見 probe() 的註解。
   */
  function markMissing(results, doc) {
    var d = doc || document;
    Object.keys(FONTS).forEach(function (k) {
      d.body.classList.toggle(FONTS[k].bodyClass, results[k] === false);
    });
  }

  /**
   * 缺字型的說明區塊（純字串，呼叫端自己決定插哪裡）。
   * @param {Object} results  detect() 的結果
   * @param {Object} counts   { <group>: 受影響的字格數 } — 讓「缺了什麼」是具體的數字而非形容詞
   * @returns {string} 沒有任何一支確定缺席時回空字串
   */
  function noticeHtml(results, counts) {
    var missing = Object.keys(FONTS).filter(function (k) { return results[k] === false; });
    if (!missing.length) return '';

    var items = missing.map(function (k) {
      var f = FONTS[k];
      var n = counts && counts[k];
      var line =
        '<li class="fontnote-item">' +
        '<span class="fontnote-name">' + escapeHtml(f.css) + '</span>' +
        (n ? ' <span class="fontnote-count">' + escapeHtml(t('font.notice.cells', { n: n })) + '</span>' : '') +
        // 全部走 escapeHtml：這幾條文案沒有 markup，統一跳脫才不會有人日後往裡塞 HTML
        '<span class="fontnote-desc">' + escapeHtml(t(f.descKey)) + '</span>';
      if (f.linkHref) {
        line += ' <a class="fontnote-link" href="' + escapeHtml(f.linkHref) +
          '" target="_blank" rel="noopener">' + escapeHtml(t(f.linkKey)) + '</a>';
      }
      return line + '</li>';
    }).join('');

    return '<aside class="fontnote" role="note">' +
      '<div class="fontnote-head">' +
      '<i class="material-icons">font_download_off</i>' +
      '<span class="fontnote-title">' + escapeHtml(t('font.notice.title')) + '</span>' +
      '</div>' +
      '<p class="fontnote-intro">' + escapeHtml(t('font.notice.intro')) + '</p>' +
      '<ul class="fontnote-list">' + items + '</ul>' +
      '<p class="fontnote-foot">' + escapeHtml(t('font.notice.reload')) + '</p>' +
      '</aside>';
  }

  /** 依 catalog 資料數出每支字型影響幾格（不寫死數字——資料會長大）。 */
  function countByGroup(data) {
    var out = {};
    (data && data.categories || []).forEach(function (cat) {
      (cat.entries || []).forEach(function (e) {
        out[e.group] = (out[e.group] || 0) + 1;
      });
    });
    return out;
  }

  window.BonjiFonts = {
    FONTS: FONTS,
    detect: detect,
    markMissing: markMissing,
    noticeHtml: noticeHtml,
    countByGroup: countByGroup
  };
})();
