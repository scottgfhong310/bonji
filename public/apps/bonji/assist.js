/**
 * assist.js — 輔助輸入字形選盤（index.html）。
 *
 * 依 data/catalog.json（與 catalog.html 同源）渲染一個字形選盤：整理文獻時看著來源字形、
 * 在面板裡認出它、點一下就把它的 ASCII 記法（fd_code）插進 #bonji-input 游標處。
 *
 * 與 bonji.js 解耦：只操作 #bonji-input 並派發 'input' 事件——bonji.js 既有的
 * `$input.addEventListener('input', convert)` 會自動即時重轉。本檔不 import 任何模組，
 * 用全域 I18n / M（classic script，置於 locales 之後、bonji.js module 之前）。
 */
(function () {
  'use strict';

  var OPEN_KEY = 'bonji-assist-open';
  var FONT_CLASS = { siddham: 'f-siddham', mojikyo119: 'f-mojikyo', uniSiddham: 'f-unisiddham' };

  var panel, body, search, catsEl, input;
  var loaded = false;
  var activeCat = 'all';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 插入記法到輸入框游標處 ---------- */

  function insertAtCursor(text) {
    var s = input.selectionStart, e = input.selectionEnd, v = input.value;
    input.value = v.slice(0, s) + text + v.slice(e);
    var p = s + text.length;
    input.focus();
    try { input.setSelectionRange(p, p); } catch (err) {}
    if (window.M) {
      if (M.textareaAutoResize) M.textareaAutoResize(input);
      if (M.updateTextFields) M.updateTextFields();
    }
    input.dispatchEvent(new Event('input', { bubbles: true })); // → bonji.js 即時重轉
  }

  /* ---------- 渲染 ---------- */

  function render(data) {
    var cats = data.categories || [];

    var chips = ['<span class="assist-cat active" data-cat="all" data-i18n="assist.cat.all">全部</span>'];
    cats.forEach(function (c) {
      chips.push('<span class="assist-cat" data-cat="' + c.id + '" data-i18n="catalog.cat.' + c.id + '">' + c.id + '</span>');
    });
    catsEl.innerHTML = chips.join('');

    var html = '';
    cats.forEach(function (c) {
      html += '<section class="assist-section" data-cat="' + c.id + '">' +
        '<div class="assist-section-title" data-i18n="catalog.cat.' + c.id + '">' + c.id + '</div>' +
        '<div class="assist-grid">';
      c.entries.forEach(function (en) {
        var fc = FONT_CLASS[en.group] || 'f-siddham';
        var has = !!en.code;
        html += '<a href="#!" class="ia' + (has ? '' : ' noinput') + '"' +
          ' data-code="' + escapeHtml(en.code) + '"' +
          ' data-search="' + escapeHtml((en.code || '').toLowerCase()) + '"' +
          ' title="' + escapeHtml(en.code || en.group) + '">' +
          '<span class="ia-char ' + fc + '">' + escapeHtml(en.char) + '</span>' +
          '<span class="ia-code">' + (has ? escapeHtml(en.code) : '·') + '</span>' +
          '</a>';
      });
      html += '</div></section>';
    });
    body.innerHTML = html;
    if (window.I18n && I18n.apply) I18n.apply(panel);
  }

  function applyFilter() {
    var q = (search.value || '').trim().toLowerCase();
    var sections = body.querySelectorAll('.assist-section');
    var total = 0;
    sections.forEach(function (sec) {
      var catOk = activeCat === 'all' || sec.getAttribute('data-cat') === activeCat;
      var any = false;
      sec.querySelectorAll('.ia').forEach(function (cell) {
        var show = catOk && (!q || cell.getAttribute('data-search').indexOf(q) !== -1);
        cell.hidden = !show;
        if (show) { any = true; total++; }
      });
      sec.hidden = !any;
    });
    var empty = body.querySelector('.assist-empty');
    if (total === 0 && !empty) {
      body.insertAdjacentHTML('beforeend', '<p class="assist-empty" data-i18n="assist.empty">' + (window.I18n ? I18n.t('assist.empty') : '查無') + '</p>');
    } else if (total > 0 && empty) {
      empty.remove();
    }
  }

  function load() {
    if (loaded) return Promise.resolve();
    return fetch('./data/catalog.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) { render(d); loaded = true; applyFilter(); })
      .catch(function (err) {
        body.innerHTML = '<p class="assist-empty">' + escapeHtml(err.message) + '</p>';
      });
  }

  /* ---------- 開關 ---------- */

  function setOpen(open) {
    panel.hidden = !open;
    document.body.classList.toggle('assist-open', open); // 開啟時隱藏 side-tools（assist.css）；dock 覆蓋、不推主畫面
    if (!open) {
      // 關閉：恢復 side-tools、重置「工具列」切換鈕狀態
      document.body.classList.remove('assist-tools');
      var tt = document.getElementById('assist-toggle-tools');
      if (tt) tt.classList.remove('active');
    }
    var tool = document.getElementById('setting-assist');
    if (tool) tool.classList.toggle('active', open);
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (e) {}
    if (open) load().then(function () { if (search) search.focus(); });
  }

  /* ---------- 初始化 ---------- */

  function init() {
    panel = document.getElementById('assist-panel');
    if (!panel) return;
    body = document.getElementById('assist-body');
    search = document.getElementById('assist-search');
    catsEl = document.getElementById('assist-cats');
    input = document.getElementById('bonji-input');

    document.getElementById('setting-assist').addEventListener('click', function () {
      setOpen(panel.hidden);
    });

    // 面板自帶關閉鈕（side-tools 隱藏時仍能關）
    document.getElementById('assist-close').addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(false);
    });

    // 面板上的「工具列」切換鈕：顯示 / 隱藏 side-tools（顯示時 dock 自動讓出空間，見 assist.css）
    document.getElementById('assist-toggle-tools').addEventListener('click', function (e) {
      e.preventDefault();
      var shown = document.body.classList.toggle('assist-tools');
      this.classList.toggle('active', shown);
    });

    catsEl.addEventListener('click', function (e) {
      var chip = e.target.closest('.assist-cat');
      if (!chip) return;
      activeCat = chip.getAttribute('data-cat');
      catsEl.querySelectorAll('.assist-cat').forEach(function (c) {
        c.classList.toggle('active', c === chip);
      });
      applyFilter();
    });

    search.addEventListener('input', applyFilter);

    body.addEventListener('click', function (e) {
      var cell = e.target.closest('.ia');
      if (!cell) return;
      e.preventDefault();
      var code = cell.getAttribute('data-code');
      if (!code) {
        if (window.M) M.toast({ html: I18n.t('assist.noinput') });
        return;
      }
      insertAtCursor(code);
    });

    // 底部輔助按鈕：插入 空格 / 換行 / 連字號
    var INS = { space: ' ', newline: '\n', dash: '-' };
    var controls = document.querySelector('.assist-controls');
    if (controls) {
      controls.addEventListener('click', function (e) {
        var btn = e.target.closest('.assist-ctrl');
        if (!btn) return;
        e.preventDefault();
        var ch = INS[btn.getAttribute('data-ins')];
        if (ch != null) insertAtCursor(ch);
      });
    }

    // 還原上次開關狀態（預設關，故預設不抓大字型）
    var wasOpen = false;
    try { wasOpen = localStorage.getItem(OPEN_KEY) === '1'; } catch (e) {}
    if (wasOpen) setOpen(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
