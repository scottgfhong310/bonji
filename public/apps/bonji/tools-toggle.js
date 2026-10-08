/**
 * tools-toggle.js — 手機上右上角的「工具列開關」（classic IIFE，三頁共用）。
 *
 * 窄螢幕上 .side-tools 直接壓在內容右緣，所以給一顆 ⋮ 把整排側鍵收起／叫回來。
 * 形制照 `xlsx-viewer` 的 #tools-toggle（`body.tools-hidden`、`active`＝側鍵顯示中）；
 * ⋮ 也與輔助輸入面板標題列那顆「工具列」鈕同一個意思。
 *
 * ⚠️ **「只在手機」只由 CSS 決定**（bonji.css 的 `@media (max-width: 600px)`）：
 *    鈕在桌機上是 display:none，`body.tools-hidden` 的隱藏規則也只寫在那個 media query 裡
 *    ⇒ 手機上收起後換到桌機（或把視窗拉寬），側鍵照樣在。本檔不判斷螢幕寬度，
 *    **不在 JS 裡寫第二個 600**。
 * ⚠️ 不碰共用 side-tool.css／side-tool.js（權威版在家族 repo，這裡的是複製件）。
 *    叫回來時呼叫 `SideTool.refreshOverflow()` 重算溢出收納——隱藏期間量不到高度。
 */
(function (window, document) {
  'use strict';

  var KEY = 'bonji-tools';   // 'on' | 'off'；與主題／語言一樣是每個瀏覽器各自的偏好

  function apply(show, btn) {
    document.body.classList.toggle('tools-hidden', !show);
    if (btn) btn.classList.toggle('active', show);
    try { localStorage.setItem(KEY, show ? 'on' : 'off'); } catch (e) {}
    if (show && window.SideTool && window.SideTool.refreshOverflow) window.SideTool.refreshOverflow();
  }

  function init() {
    var btn = document.getElementById('tools-toggle');
    if (!btn) return;
    var saved = 'on';
    try { saved = localStorage.getItem(KEY) || 'on'; } catch (e) {}
    apply(saved !== 'off', btn);
    function toggle() { apply(document.body.classList.contains('tools-hidden'), btn); }
    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', function (e) {   // role="button" ⇒ Enter／Space 也要能按
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
