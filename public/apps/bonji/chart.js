/**
 * chart.js — 悉曇字元對照表（一欄一組對照）。ESM module。
 *
 * 資料全部經 SiddhamConverter（toSiddham / toLatin，皆吃「原始輸入記法 ascii」、
 * 不經輸入前處理）導出——不直接 import 引擎，符合家族邊界紀律。
 *
 * 欄（組）：子音 / 獨立母音 / 母音符號 / 符號。每格：悉曇字 + 輸入記法 + 拉丁(IAST)。
 */

import { SiddhamConverter } from "./siddham-converter.js";

(function () {
  'use strict';

  var THEME_KEY = 'bonji-theme';
  var DOTTED = '◌'; // ◌ 用來承載結合用記號（母音符號 / 符號 / virama）

  // 經防腐層取得（原始 ascii，不前處理）
  function sid(ascii) { return SiddhamConverter.toSiddham(ascii, false); }
  function lat(ascii) { return SiddhamConverter.toLatin(ascii, 'IAST'); }

  // 子音：以「子音 + a」示其本字（akshara）
  var CONSONANTS = ["k", "kh", "g", "gh", ";n", "c", "ch", "j", "jh", "~n",
    ".t", ".th", ".d", ".dh", ".n", "t", "th", "d", "dh", "n",
    "p", "ph", "b", "bh", "m", "y", "r", "l", "v", ";s", ".s", "s", "h",
    "z", "f", "w", ".l"];
  // 獨立母音
  var IVOWELS = ["a", "aa", "i", "ii", "u", "uu", ",r", ",rr", ",l", ",ll", "e", "ai", "o", "au"];
  // 母音符號（附於子音；以 ka 示範，"a" 為固有母音不另標）
  var DVOWELS = ["aa", "i", "ii", "u", "uu", ",r", ",rr", "e", "ai", "o", "au"];
  // 符號
  var SIGNS = ["~m", ";m", ".h"];
  var VIRAMA = Array.from(sid("k")).pop(); // 從「k」(=𑖎𑖿) 取末碼位 = virama

  // 一組欄位定義：{ titleKey, entries: [{ glyph, ascii, latin }] }
  function buildGroups() {
    return [
      {
        titleKey: 'chart.col.consonants',
        entries: CONSONANTS.map(function (k) {
          return { glyph: sid(k + 'a'), ascii: k, latin: lat(k + 'a') };
        })
      },
      {
        titleKey: 'chart.col.ivowels',
        entries: IVOWELS.map(function (k) {
          return { glyph: sid(k), ascii: k, latin: lat(k) };
        })
      },
      {
        titleKey: 'chart.col.dvowels',
        noteKey: 'chart.note.dvowels',
        entries: DVOWELS.map(function (k) {
          return { glyph: sid('k' + k), ascii: k, latin: lat(k) };
        })
      },
      {
        titleKey: 'chart.col.signs',
        entries: SIGNS.map(function (k) {
          return { glyph: DOTTED + sid(k), ascii: k, latin: lat(k) };
        }).concat([
          { glyph: DOTTED + VIRAMA, ascii: '(virama)', latin: '—' }
        ])
      }
    ];
  }

  /* ---------- 渲染 ---------- */

  function render() {
    var root = document.getElementById('chart-cols');
    var groups = buildGroups();
    root.innerHTML = '';
    groups.forEach(function (g) {
      var col = document.createElement('section');
      col.className = 'chart-col card';

      var h = document.createElement('h2');
      h.className = 'chart-col-title';
      h.setAttribute('data-i18n', g.titleKey);
      col.appendChild(h);

      if (g.noteKey) {
        var note = document.createElement('p');
        note.className = 'chart-col-note';
        note.setAttribute('data-i18n', g.noteKey);
        col.appendChild(note);
      }

      var grid = document.createElement('div');
      grid.className = 'chart-grid';
      g.entries.forEach(function (e) {
        var cell = document.createElement('a');
        cell.className = 'glyph-cell';
        cell.href = '#!';
        cell.setAttribute('data-copy', e.ascii);
        cell.title = e.ascii;
        cell.innerHTML =
          '<span class="g-glyph siddham-text">' + e.glyph + '</span>' +
          '<span class="g-ascii mono">' + escapeHtml(e.ascii) + '</span>' +
          '<span class="g-latin">' + escapeHtml(e.latin) + '</span>';
        grid.appendChild(cell);
      });
      col.appendChild(grid);
      root.appendChild(col);
    });
    I18n.apply(document); // 翻譯標題 / 註記 / 文件標題
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 複製記法 ---------- */

  function copyText(text) {
    function fallback() {
      return new Promise(function (resolve, reject) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.focus(); ta.select();
          var ok = document.execCommand('copy'); document.body.removeChild(ta);
          ok ? resolve() : reject(new Error('execCommand copy failed'));
        } catch (e) { reject(e); }
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(fallback);
    }
    return fallback();
  }

  /* ---------- 主題 / 語系 ---------- */

  function applyTheme(theme) {
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark-mode', theme === 'dark');
    root.classList.toggle('light-mode', theme === 'light');
    var icon = document.querySelector('#setting-mode i');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  }

  function cycleLang() {
    var next = I18n.cycle();
    M.toast({ html: I18n.t('toast.lang', { name: I18n.name(next) }), classes: 'teal' });
  }

  /* ---------- 初始化 ---------- */

  function init() {
    applyTheme(currentTheme());
    render();

    document.getElementById('setting-mode').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('setting-lang').addEventListener('click', cycleLang);

    // 回轉換器：若由某個 index.html 以新分頁開啟（有 opener）→ 聚焦該分頁並關閉本頁；
    // 否則（直接開啟）沿用 href="./" 在本分頁導回 index。
    document.getElementById('setting-home').addEventListener('click', function (e) {
      if (window.opener && !window.opener.closed) {
        e.preventDefault();
        window.opener.focus();
        window.close();
      }
    });

    // 點任一格 → 複製其輸入記法
    document.getElementById('chart-cols').addEventListener('click', function (e) {
      var cell = e.target.closest('.glyph-cell');
      if (!cell) return;
      e.preventDefault();
      var ascii = cell.getAttribute('data-copy');
      copyText(ascii)
        .then(function () { M.toast({ html: I18n.t('chart.copied', { n: ascii }), classes: 'teal' }); })
        .catch(function () { M.toast({ html: I18n.t('toast.copyFail'), classes: 'red' }); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
