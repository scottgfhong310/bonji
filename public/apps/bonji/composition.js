/**
 * composition.js — 「Composition」欄（index.html，輸入欄下方）。
 *
 * 它記的是**你在輔助輸入的 Cbeta / Mojikyo 今昔 兩群點過哪些字**：每點一格，
 * 這裡追加該格的載體字（Char），同時 assist.js 把對應的記法（Notation）插進
 * `#bonji-input`。兩邊是同一次點擊的兩個產物。
 *
 * ⚠️⚠️ **一格一個 `<span>`，字型逐格指定——不可以整欄設一個 font-family。**
 *    兩套造字都以 CJK 碼位當載體，而**同一個碼位在兩支字型裡多半都畫得出東西**
 *    （只是畫成不同的悉曇字）。整欄設 `font-family: 'Siddam','Mojikyo M119'` 的話，
 *    Mojikyo 那些字會被 Siddam 先接走 ⇒ **畫面上有字、而且看起來很正常，但那是別的字**。
 *    這與 §11.2「沒裝字型時字格顯示一般漢字」是同一種壞法：不報錯、只是錯。
 *
 * ⚠️ **本欄唯讀（不可鍵盤輸入）**，理由同上：字型是逐格記住的，手打進來的字沒有出身、
 *    對映不到任何一支。要修改請用右上角的「退一格」與「清除」。
 *
 * ⚠️ **它與 `#bonji-input` 可能對不起來**——手動編輯輸入框、或用範例 chip 覆蓋輸入時，
 *    本欄不會跟著變。「退一格」因此**先確認輸入框結尾真的是那一格的記法**才動它；
 *    不是的話只退本欄、並講出來（見 undo()）。**靜靜退掉一個對不上的東西比不退更糟。**
 *
 * classic IIFE、不 import 任何模組（與 assist.js 同形，用全域 I18n / M）。
 * 對外只有 window.BonjiComposition，供 assist.js（追加）與 bonji.js（clearAll）呼叫。
 */
(function () {
  'use strict';

  /* 群 → CSS class。與 assist.js / assist.css 同一份對映；那兩支字型的 @font-face
   * 宣告在 assist.css（`src: local()`，本 repo 不散布字型）。 */
  var FONT_CLASS = { siddham: 'f-siddham', mojikyo119: 'f-mojikyo', uniSiddham: 'f-unisiddham' };

  var box, empty;
  var stack = [];   // [{ char, code, font }]，一格一筆；code 可為 null（記法未定）

  function t(key, params) { return (window.I18n && I18n.t) ? I18n.t(key, params) : key; }
  function toast(key, cls, params) {
    if (window.M && M.toast) M.toast({ html: t(key, params), classes: cls || '' });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render() {
    if (!box) return;
    box.innerHTML = stack.map(function (it) {
      return '<span class="comp-ch ' + (FONT_CLASS[it.font] || '') + '"' +
        ' title="' + escapeHtml(it.code == null ? it.char : it.code + '　' + it.char) + '">' +
        escapeHtml(it.char) + '</span>';
    }).join('');
    // 空狀態的提示字：**不是留白**——留白會讓人以為這個欄位壞了或不會動
    if (empty) empty.hidden = stack.length > 0;
    box.classList.toggle('is-empty', stack.length === 0);
  }

  /** 這一欄的純文字（＝載體字串，不含任何標記）。 */
  function text() { return stack.map(function (it) { return it.char; }).join(''); }

  /**
   * 這一欄的字型家族名（`@font-face` 宣告的那個真名）。
   * ⚠️ **不在本檔另抄一份對照表**——權威在 `font-availability.js` 的 `FONTS`
   *    （那份的 `css` 就是宣告名，並註明「檔名會誤導」：`Siddham.ttf` 的 family 是 `Siddam`）。
   *    抄一份的話兩邊遲早各自漂，而漂掉的那一邊照樣印得出一個看起來很像的名字。
   * @returns {string|null} 查不到回 null——**不要猜一個名字**，那會讓匯出檔說一件假話。
   */
  function familyOf(font) {
    var F = window.BonjiFonts && BonjiFonts.FONTS;
    return (F && F[font] && F[font].css) || null;
  }

  /** 匯出用：一格一筆 `{ char, font, family, code }`（順序 ＝ 畫面順序）。 */
  function entries() {
    return stack.map(function (it) {
      return { char: it.char, font: it.font, family: familyOf(it.font), code: it.code };
    });
  }

  var API = {
    /**
     * 追加一格。
     * @param {string} char 載體字（CJK 碼位）
     * @param {string} font 群的字型鍵（uniSiddham / mojikyo119 / siddham）
     * @param {string|null} code 該格的記法；記法未定時為 null
     */
    add: function (char, font, code) {
      if (!char) return;
      stack.push({ char: char, font: font, code: code == null ? null : code });
      render();
    },

    /** 退一格：本欄一定退；輸入框只在「結尾真的是那個記法」時才跟著退。 */
    undo: function () {
      if (!stack.length) { toast('toast.compEmpty', 'grey'); return; }
      var last = stack.pop();
      render();
      var input = document.getElementById('bonji-input');
      if (last.code && input && input.value.slice(-last.code.length) === last.code) {
        input.value = input.value.slice(0, -last.code.length);
        syncInput(input);
        toast('toast.compUndone', 'grey');
      } else {
        // 輸入框已被手動改過（或那一格本來就沒有記法）⇒ 只退本欄，並講出來
        toast('toast.compUndoneOnly', 'grey');
      }
    },

    clear: function (opts) {
      var had = stack.length;
      stack = [];
      render();
      if (had && !(opts && opts.silent)) toast('toast.cleared', 'grey');
      return had;
    },

    /**
     * 由匯出檔還原（`loadFile`）。**整批取代，不是追加。**
     * ⚠️ 這是**外部輸入**（使用者手上的 JSON 可以是任何東西）⇒ 逐筆檢查：
     *    沒有 `char` 的丟掉、`code` 不是字串一律當 null。
     * ⚠️ **`font` 認不得時照實留著、不猜一個**——留著至少 `title` 還講得出它的記法，
     *    而猜一個會讓那一格用**別支字型**畫出一個看起來完全正常的字（本檔開頭那件事）。
     *    `render()` 對認不得的 font 不掛 class，於是它會用預設字型畫、看得出來不一樣。
     * @returns {number} 實際收下的格數（**與傳進來的長度不一定相等**，差額就是被丟掉的）
     */
    set: function (list) {
      stack = (Array.isArray(list) ? list : []).reduce(function (acc, e) {
        if (!e || typeof e.char !== 'string' || e.char === '') return acc;
        acc.push({ char: e.char, font: e.font, code: typeof e.code === 'string' ? e.code : null });
        return acc;
      }, []);
      render();
      return stack.length;
    },

    text: text,
    entries: entries,
    familyOf: familyOf,
    count: function () { return stack.length; },
    isEmpty: function () { return stack.length === 0; }
  };

  /**
   * 改完 `#bonji-input.value` 之後一定要做的三件事，`undo()` 與清除鈕共用。
   * ⚠️ 缺 `dispatchEvent` 的話值變了而**輸出停在上一次的轉換結果**——畫面看起來完全正常；
   *    缺 `textareaAutoResize` 則 textarea 維持原高、`updateTextFields` 則 label 停在浮起狀態。
   */
  function syncInput(input) {
    if (!input) return;
    if (window.M) {
      if (M.textareaAutoResize) M.textareaAutoResize(input);
      if (M.updateTextFields) M.updateTextFields();
    }
    input.dispatchEvent(new Event('input', { bubbles: true })); // → bonji.js 重轉
  }

  function copy() {
    var s = text();
    if (!s) { toast('toast.nothingToCopy', 'grey'); return; }
    var done = function () { toast('toast.copied', 'grey'); };
    var fail = function () { toast('toast.copyFail', 'red'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(done, function () { fallback(s) ? done() : fail(); });
    } else { fallback(s) ? done() : fail(); }
  }
  // 後備：clipboard API 不存在或被拒（非 HTTPS／無使用者手勢／視窗不在前景）
  function fallback(s) {
    try {
      var ta = document.createElement('textarea');
      ta.value = s;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function init() {
    box = document.getElementById('bonji-composition');
    if (!box) return;
    empty = document.getElementById('comp-empty');
    render();

    var c = document.getElementById('copy-comp');
    if (c) c.addEventListener('click', function (e) { e.preventDefault(); copy(); });
    var u = document.getElementById('undo-comp');
    if (u) u.addEventListener('click', function (e) { e.preventDefault(); API.undo(); });
    var x = document.getElementById('clear-comp');
    if (x) x.addEventListener('click', function (e) {
      e.preventDefault();
      /* ⚠️ 「連輸入欄一起清」寫在**這顆鈕的處理器**、不寫進 `clear()`：
       *    `clear()` 有兩個呼叫端，而 `bonji.js` 的 `clearAll()` 是在**自己清完輸入之後**
       *    才呼叫它（`silent`）——放進 `clear()` 的話那條路會多派發一次 `input`、
       *    在 `clearAll()` 還沒收尾時多跑一次 `convert()`。`undo()` 可以直接碰輸入，
       *    是因為它只有這一個呼叫端；`clear()` 沒有那個條件。 */
      var had = API.clear({ silent: true });
      /* ⚠️ 本欄是空的就**什麼都不做**，不可以順手把輸入清掉——使用者按的是 Composition 的鈕，
       *    而那些字與本欄無關（同 `undo()` 那條：靜靜清掉一個對不上的東西比不清更糟）。 */
      if (!had) { toast('toast.compEmpty', 'grey'); return; }
      var input = document.getElementById('bonji-input');
      if (input) { input.value = ''; syncInput(input); }
      toast('toast.compCleared', 'grey');
    });
  }

  window.BonjiComposition = API;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
