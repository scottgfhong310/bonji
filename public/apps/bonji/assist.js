/**
 * assist.js — 輔助輸入字形選盤（index.html）。
 *
 * 渲染一個字形選盤：整理文獻時看著來源字形、在面板裡認出它、點一下就把它的 ASCII 記法
 * 插進 #bonji-input 游標處。
 *
 * **三個群、兩份資料**：
 *   預設群 default      ← data/catalog.json（與 catalog.html 同源、8 類）
 *   Cbeta               ← data/element-catalog.json（由 db_siddham 匯出，見該檔 source 欄）
 *   Mojikyo 今昔        ← 同上
 * 兩排 chips 是**兩個獨立的軸**（群 × 類）；`groupOf` 把兩份資料正規化成同一個內部形狀，
 * 於是渲染、搜尋、字型偵測都只有一條路。
 *
 * ⚠️ **只有後兩群會寫進 Composition**（`window.BonjiComposition`）：那一欄記的是
 *    「哪一個造字的載體字」，而預設群的 Unicode 悉曇字沒有載體字這回事。
 *
 * 與 bonji.js 解耦：只操作 #bonji-input 並派發 'input' 事件——bonji.js 既有的
 * `$input.addEventListener('input', convert)` 會自動即時重轉。本檔不 import 任何模組，
 * 用全域 I18n / M / BonjiFonts（classic script，置於 locales 之後、bonji.js module 之前）。
 *
 * ⚠️ 舊註解說的「面板首開才 lazy 抓那兩支 TTF」已不成立：字型改讀本機安裝的版本
 * （src: local()），沒有東西要下載。缺字型的處置見 checkFonts()。
 */
(function () {
  'use strict';

  var OPEN_KEY = 'bonji-assist-open';
  var FONT_CLASS = { siddham: 'f-siddham', mojikyo119: 'f-mojikyo', uniSiddham: 'f-unisiddham' };

  var panel, body, search, catsEl, groupsEl, input;
  var loaded = false;
  var activeCat = 'all';
  var activeGroup = 'all';

  /* 內部形狀（兩份來源正規化後）：
   *   groups = [{ id, entries?: n, cats: [{ id, entries: [{ code, char, font }] }] }]
   * `font` 逐格帶著（不是逐群）——預設群的一類之內就混著三支字型。 */
  var groups = [];

  /* 類別 chips 的順序：先照 catalog.json 的既有順序，新來的接在後面（ligature_ext）。 */
  var CAT_ORDER = ['vowel', 'consonant', 'variant', 'symbol', 'bindu',
                   'ligature', 'ligature_u', 'ligature_l', 'ligature_ext'];

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

  /* ---------- 正規化：兩份來源 → 同一個內部形狀 ---------- */

  /* catalog.json：{categories:[{id, entries:[{code,char,group}]}]}，group 逐格 */
  function fromCatalog(d) {
    return {
      id: 'default',
      cats: (d.categories || []).map(function (c) {
        return {
          id: c.id,
          entries: (c.entries || []).map(function (e) {
            return { code: e.code || '', char: e.char, font: e.group };
          })
        };
      })
    };
  }

  /* element-catalog.json：{groups:[{id, font, categories:[{id, entries:[{code,char}]}]}]}，
   * font 逐群 ⇒ 攤平時補到每一格上（內部形狀一律逐格帶 font）。
   * ⚠️ `code` 可能是 null（記法未定，見該檔），照實留成空字串 ＋ 不可插入。 */
  function fromElements(d) {
    return (d.groups || []).map(function (g) {
      return {
        id: g.id,
        cats: (g.categories || []).map(function (c) {
          return {
            id: c.id,
            entries: (c.entries || []).map(function (e) {
              return { code: e.code == null ? '' : e.code, char: e.char, font: g.font };
            })
          };
        })
      };
    });
  }

  /* ---------- 渲染 ---------- */

  function chip(cls, attr, val, i18nKey, fallback) {
    return '<span class="' + cls + '" ' + attr + '="' + val + '" data-i18n="' + i18nKey + '">' +
      escapeHtml(fallback) + '</span>';
  }

  function render() {
    // 第一排：群。只有一個群時仍然畫（它同時是「這裡有幾群」的說明）
    var gc = [chip('assist-cat active', 'data-group', 'all', 'assist.cat.all', '全部')];
    groups.forEach(function (g) {
      gc.push(chip('assist-cat', 'data-group', g.id, 'assist.group.' + g.id, g.id));
    });
    groupsEl.innerHTML = gc.join('');

    // 第二排：類。取三群的聯集，依 CAT_ORDER；沒出現過的不畫
    var seen = {};
    groups.forEach(function (g) { g.cats.forEach(function (c) { seen[c.id] = true; }); });
    var cc = [chip('assist-cat active', 'data-cat', 'all', 'assist.cat.all', '全部')];
    CAT_ORDER.forEach(function (id) {
      if (seen[id]) cc.push(chip('assist-cat', 'data-cat', id, 'catalog.cat.' + id, id));
      delete seen[id];
    });
    Object.keys(seen).forEach(function (id) {   // CAT_ORDER 沒列到的照樣畫出來，不靜默丟掉
      cc.push(chip('assist-cat', 'data-cat', id, 'catalog.cat.' + id, id));
    });
    catsEl.innerHTML = cc.join('');

    var html = '';
    groups.forEach(function (g) {
      html += '<div class="assist-group" data-group="' + g.id + '">' +
        '<div class="assist-group-title" data-i18n="assist.group.' + g.id + '">' + escapeHtml(g.id) + '</div>';
      g.cats.forEach(function (c) {
        html += '<section class="assist-section" data-cat="' + c.id + '">' +
          '<div class="assist-section-title" data-i18n="catalog.cat.' + c.id + '">' + escapeHtml(c.id) + '</div>' +
          '<div class="assist-grid">';
        c.entries.forEach(function (en) {
          var fc = FONT_CLASS[en.font] || 'f-siddham';
          var has = !!en.code;
          html += '<a href="#!" class="ia' + (has ? '' : ' noinput') + '"' +
            ' data-code="' + escapeHtml(en.code) + '"' +
            ' data-char="' + escapeHtml(en.char) + '"' +
            ' data-font="' + escapeHtml(en.font) + '"' +
            ' data-search="' + escapeHtml((en.code || '').toLowerCase()) + '"' +
            ' title="' + escapeHtml(en.code || en.font) + '">' +
            '<span class="ia-char ' + fc + '">' + escapeHtml(en.char) + '</span>' +
            '<span class="ia-code">' + (has ? escapeHtml(en.code) : '·') + '</span>' +
            '</a>';
        });
        html += '</div></section>';
      });
      html += '</div>';
    });
    body.innerHTML = html;
    if (window.I18n && I18n.apply) I18n.apply(panel);
  }

  function applyFilter() {
    var q = (search.value || '').trim().toLowerCase();
    var total = 0;
    body.querySelectorAll('.assist-group').forEach(function (grp) {
      var groupOk = activeGroup === 'all' || grp.getAttribute('data-group') === activeGroup;
      var anyInGroup = false;
      grp.querySelectorAll('.assist-section').forEach(function (sec) {
        var catOk = activeCat === 'all' || sec.getAttribute('data-cat') === activeCat;
        var any = false;
        sec.querySelectorAll('.ia').forEach(function (cell) {
          var show = groupOk && catOk && (!q || cell.getAttribute('data-search').indexOf(q) !== -1);
          cell.hidden = !show;
          if (show) { any = true; total++; }
        });
        sec.hidden = !any;
        if (any) anyInGroup = true;
      });
      // 整群都沒東西時連群標題一起收——留一個空標題會讀成「這一群是空的」
      grp.hidden = !anyInGroup;
    });
    var empty = body.querySelector('.assist-empty');
    if (total === 0 && !empty) {
      body.insertAdjacentHTML('beforeend', '<p class="assist-empty" data-i18n="assist.empty">' + (window.I18n ? I18n.t('assist.empty') : '查無') + '</p>');
    } else if (total > 0 && empty) {
      empty.remove();
    }
  }

  /* 缺本機字型時：說明區塊插在字形區之上，並把受影響的字格標出來。
   * ⚠️ 這裡尤其要標——面板的用途是「看著來源字形、在面板裡認出它」，而沒裝字型時
   * 那些格顯示的是一般漢字，認出來的會是錯的字。規則見 font-availability.js。 */
  function checkFonts() {
    if (!window.BonjiFonts) return;
    /* countByGroup 吃的是 catalog.json 的形狀（categories[].entries[].group）。
     * ⚠️ 這裡做一次形狀轉接、**不改 font-availability.js**——那支的規則只有一份，
     *    再抄一份計數邏輯，兩邊遲早各自漂。 */
    var counts = BonjiFonts.countByGroup({
      categories: groups.reduce(function (acc, g) {
        g.cats.forEach(function (c) {
          acc.push({ entries: c.entries.map(function (e) { return { group: e.font }; }) });
        });
        return acc;
      }, [])
    });
    BonjiFonts.detect().then(function (results) {
      BonjiFonts.markMissing(results);
      var host = document.getElementById('assist-font-notice');
      if (host) host.innerHTML = BonjiFonts.noticeHtml(results, counts);
    });
  }

  function load() {
    if (loaded) return Promise.resolve();
    var get = function (url) {
      return fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(url.replace('./data/', '') + ': HTTP ' + r.status);
        return r.json();
      });
    };
    return Promise.all([get('./data/catalog.json'), get('./data/element-catalog.json')])
      .then(function (res) {
        groups = [fromCatalog(res[0])].concat(fromElements(res[1]));
        render(); loaded = true; applyFilter(); checkFonts();
      })
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
    groupsEl = document.getElementById('assist-groups');
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

    // 兩排 chips 是兩個獨立的軸，故各綁各的、只改自己那一排的 active
    function bindChips(host, attr, set) {
      host.addEventListener('click', function (e) {
        var chip = e.target.closest('.assist-cat');
        if (!chip) return;
        set(chip.getAttribute(attr));
        host.querySelectorAll('.assist-cat').forEach(function (c) {
          c.classList.toggle('active', c === chip);
        });
        applyFilter();
      });
    }
    bindChips(catsEl, 'data-cat', function (v) { activeCat = v; });
    bindChips(groupsEl, 'data-group', function (v) { activeGroup = v; });

    search.addEventListener('input', applyFilter);

    body.addEventListener('click', function (e) {
      var cell = e.target.closest('.ia');
      if (!cell) return;
      e.preventDefault();
      var code = cell.getAttribute('data-code');
      var grp = cell.closest('.assist-group');
      var gid = grp ? grp.getAttribute('data-group') : 'default';

      if (!code) {
        // 無記法者仍要說清楚是哪一種「無」：預設群是異體字，新兩群是來源未指明記法
        if (window.M) {
          M.toast({ html: I18n.t(gid === 'default' ? 'assist.noinput' : 'assist.nonotation') });
        }
        return;
      }
      insertAtCursor(code);
      /* ⚠️ 只有造字那兩群進 Composition：那一欄記的是「哪一個造字的載體字」，
       *    而預設群的 Unicode 悉曇字沒有載體字這回事（它的 char 本身就是悉曇字）。 */
      if (gid !== 'default' && window.BonjiComposition) {
        BonjiComposition.add(cell.getAttribute('data-char'), cell.getAttribute('data-font'), code);
      }
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
