/**
 * catalog.js — 悉曇字型對照表（依 data/catalog.json，源自 BonjiInput.xlsx）。ESM module。
 *
 * 一類一欄；每格依 fd_group 套字型顯示 fd_char（siddham=Noto Sans Siddham〔內嵌〕、
 * mojikyo119=Mojikyo M119、uniSiddham=Siddam〔後兩者讀**本機安裝**的版本，見 DESIGN.md §11〕），
 * 並列出輸入記法 fd_code。純資料頁，不經 SiddhamConverter（glyph 直接取自表）。
 */

(function () {
  'use strict';

  var THEME_KEY = 'bonji-theme';
  var FONT_CLASS = { siddham: 'f-siddham', mojikyo119: 'f-mojikyo', uniSiddham: 'f-unisiddham' };
  var FONT_LABEL = { siddham: '', mojikyo119: 'Mojikyo', uniSiddham: 'Siddham' };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 渲染 ---------- */

  function render(data) {
    var root = document.getElementById('catalog-cols');
    root.innerHTML = '';
    (data.categories || []).forEach(function (cat) {
      var col = document.createElement('section');
      col.className = 'catalog-col card';

      var h = document.createElement('h2');
      h.className = 'catalog-col-title';
      h.setAttribute('data-i18n', 'catalog.cat.' + cat.id);
      h.textContent = cat.id;
      col.appendChild(h);

      var sub = document.createElement('p');
      sub.className = 'catalog-col-sub';
      sub.textContent = cat.entries.length + '';
      col.appendChild(sub);

      var grid = document.createElement('div');
      grid.className = 'cat-grid';
      cat.entries.forEach(function (e) {
        var copy = e.code || e.char;
        var fontCls = FONT_CLASS[e.group] || 'f-siddham';
        var label = FONT_LABEL[e.group] || '';
        var cell = document.createElement('a');
        cell.className = 'gc';
        cell.href = '#!';
        cell.setAttribute('data-copy', copy);
        cell.title = (e.code ? e.code + ' · ' : '') + e.group;
        cell.innerHTML =
          '<span class="gc-char ' + fontCls + '">' + escapeHtml(e.char) + '</span>' +
          '<span class="gc-code">' + (e.code ? escapeHtml(e.code) : '·') + '</span>' +
          '<span class="gc-group">' + escapeHtml(label) + '</span>';
        grid.appendChild(cell);
      });
      col.appendChild(grid);
      root.appendChild(col);
    });
    I18n.apply(document); // 翻譯欄標題 / 文件標題
  }

  /* ---------- 本機字型 ----------
   * 缺字型時字格會顯示成一般漢字（不是缺字方塊），故除了說明區塊還要把受影響的
   * 字格標出來——兩件事都由 BonjiFonts 統一決定，見 font-availability.js 檔頭。 */

  function checkFonts(data) {
    if (!window.BonjiFonts) return;
    var counts = BonjiFonts.countByGroup(data);
    BonjiFonts.detect().then(function (results) {
      BonjiFonts.markMissing(results);
      var host = document.getElementById('font-notice');
      if (host) host.innerHTML = BonjiFonts.noticeHtml(results, counts);
    });
  }

  function load() {
    var root = document.getElementById('catalog-cols');
    fetch('./data/catalog.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) { render(data); checkFonts(data); })
      .catch(function (err) {
        root.innerHTML = '<p class="catalog-col-sub">' + I18n.t('catalog.loadFail', { m: escapeHtml(err.message) }) + '</p>';
      });
  }

  /* ---------- 複製 ---------- */

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
    load();

    document.getElementById('setting-mode').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('setting-lang').addEventListener('click', cycleLang);

    // 回轉換器：由轉換頁以新分頁開啟（有 opener）→ 聚焦並關閉本頁；否則就地導回
    document.getElementById('setting-home').addEventListener('click', function (e) {
      if (window.opener && !window.opener.closed) {
        e.preventDefault();
        window.opener.focus();
        window.close();
      }
    });

    // 點任一格 → 複製其輸入記法（無記法則複製字）
    document.getElementById('catalog-cols').addEventListener('click', function (e) {
      var cell = e.target.closest('.gc');
      if (!cell) return;
      e.preventDefault();
      var v = cell.getAttribute('data-copy');
      copyText(v)
        .then(function () { M.toast({ html: I18n.t('chart.copied', { n: v }), classes: 'teal' }); })
        .catch(function () { M.toast({ html: I18n.t('toast.copyFail'), classes: 'red' }); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
