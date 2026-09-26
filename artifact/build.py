#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build.py — 把 bonji 的前端組成可發佈到 Claude Artifacts 的一份。

用法：  python3 artifact/build.py            → 輸出到 artifact/dist/（不進版控）
        python3 artifact/build.py --out DIR  → 輸出到別的地方

形制照 `coffee-deposit/artifact/build.py`：**本目錄不放逐字複製件**，建置時從
`public/apps/bonji/` 現抓，差異一律以下面的 PATCHES 表達——那張表就是
「Express 版與 Artifact 版差在哪」的權威說明。
⚠️ 每一處錨點都要求**恰好命中一次**，否則 exit 1：app 那一側改了而補丁沒跟上時，
   建置會當場失敗，而不是安靜地少打一個補丁。

bonji 本來就有純前端模式（`config.json` 的 `backend:false`，DESIGN §8），
所以 Artifact 版只差五件事：
  ① `config.json` → `{ "backend": false }`：沒有 `/api/bonji`，匯出／清單／清空三個工具隱藏。
  ② `materialize.min.css` 自己託管（vendor/）：Artifact 的 CSP 只允許 fonts.googleapis.com
     當外部樣式表來源，**cdnjs 的樣式表會被擋掉而且不報錯**。
     來源 https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css（MIT），
     與 coffee-deposit/artifact/vendor/ 那份逐位元組相同。
  ③ 下載：沙盒會擋掉 `<a download>`（blob: 也一樣）⇒ 改走 `downloads` capability
     （發佈時要宣告 `capabilities: {downloads: true}`）。拿不到就講出來，不假裝下載了。
  ④ 兩張對照表改成**同一個框架內換頁**：`window.open` 對組織外的人一律回 null，
     具名 target 也開不出新分頁 ⇒ 拿掉 target 與 window.open，「回轉換器」改指 `./index.html`。
     ⚠️ 代價：換頁回來輸入內容不會保留（Express 版是兩個分頁，不會有這個問題）。
  ⑤ 不帶 `data/BonjiInput.xlsx`（那是 catalog.json 的來源，執行期用不到）與 `.DS_Store`。

⚠️ 字型：只有 Noto Sans Siddham（OFL）隨附；`Mojikyo M119`／`Siddam` 照舊走
   `local()`——**一個位元組都不送**，那是 DESIGN §11.1 的禁令，Artifact 版不得鬆動。
   `verify()` 在最後擋著：dist 裡出現 Noto 以外的字型檔就 exit 1。
"""
import json
import pathlib
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent
APP = REPO / 'public' / 'apps' / 'bonji'

EXCLUDE_NAMES = {'.DS_Store', 'config.json'}
EXCLUDE_REL = {'data/BonjiInput.xlsx'}

CDN_CSS = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css" />'
LOCAL_CSS = '<link rel="stylesheet" href="./materialize.min.css" />'

DOWNLOAD_OLD = """  function downloadText(name, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name || 'download.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }"""

# Artifact 版：沙盒擋掉 <a download> ⇒ 走 downloads capability。
# ⚠️ 呼叫端在同步流程裡接著就跳「已下載」toast，但這裡是非同步、而且使用者可以拒絕
#    ⇒ 成敗由本函式自己講，呼叫端那一則 toast 由下面的 DOWNLOAD_TOAST 補丁拿掉。
DOWNLOAD_NEW = """  function downloadText(name, text) {
    name = name || 'download.json';
    var use = window.claude && window.claude.use;
    (use ? window.claude.use('downloads') : Promise.resolve(null)).then(function (dl) {
      if (!dl) throw new Error('downloads unavailable');
      return dl.save({ filename: name, data: text }).then(function () {
        M.toast({ html: I18n.t('toast.downloaded', { n: name }), classes: 'teal' });
      });
    }).catch(function (err) {
      if (err && err.code === 'declined') return;   // 使用者自己按了取消，不是錯誤
      M.toast({ html: I18n.t('toast.exportFail', { m: (err && (err.message || err.code)) || String(err) }), classes: 'red' });
    });
  }"""

DOWNLOAD_TOAST_OLD = """    downloadText(name, JSON.stringify(out, null, 2));
    setIconDone(document.getElementById('setting-download'));
    M.toast({ html: I18n.t('toast.downloaded', { n: name }), classes: 'teal' });"""
DOWNLOAD_TOAST_NEW = """    downloadText(name, JSON.stringify(out, null, 2));
    setIconDone(document.getElementById('setting-download'));"""

OPEN_OLD = """    document.getElementById('setting-chart').addEventListener('click', function (e) {
      e.preventDefault();
      window.open(this.href, 'bonji-chart');
    });
    document.getElementById('setting-catalog').addEventListener('click', function (e) {
      e.preventDefault();
      window.open(this.href, 'bonji-catalog');
    });"""
OPEN_NEW = """    // Artifact 版：window.open 對組織外的人回 null ⇒ 兩張對照表改成同框架換頁（見 artifact/build.py ④）"""

# (相對路徑, 舊, 新)
PATCHES = [
    ('index.html', CDN_CSS, LOCAL_CSS),
    ('chart.html', CDN_CSS, LOCAL_CSS),
    ('catalog.html', CDN_CSS, LOCAL_CSS),
    ('index.html', 'href="./chart.html" target="bonji-chart" rel="opener"', 'href="./chart.html"'),
    ('index.html', 'href="./catalog.html" target="bonji-catalog" rel="opener"', 'href="./catalog.html"'),
    ('chart.html', '<a id="setting-home" class="side-tool" href="./"', '<a id="setting-home" class="side-tool" href="./index.html"'),
    ('catalog.html', '<a id="setting-home" class="side-tool" href="./"', '<a id="setting-home" class="side-tool" href="./index.html"'),
    ('bonji.js', OPEN_OLD, OPEN_NEW),
    ('bonji.js', DOWNLOAD_OLD, DOWNLOAD_NEW),
    ('bonji.js', DOWNLOAD_TOAST_OLD, DOWNLOAD_TOAST_NEW),
]

FONT_EXT = {'.ttf', '.otf', '.ttc', '.dfont', '.woff', '.woff2', '.eot'}
FONT_ALLOWED = {'fonts/NotoSansSiddham-Regular.woff2'}


def main():
    out = pathlib.Path(sys.argv[sys.argv.index('--out') + 1]).resolve() \
        if '--out' in sys.argv else HERE / 'dist'
    if not APP.is_dir():
        print('✗ 找不到 app 目錄：%s' % APP); return 2
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    print('輸出：%s\n' % out)

    print('① 自 app 取檔')
    n = 0
    for src in sorted(APP.rglob('*')):
        if not src.is_file():
            continue
        rel = src.relative_to(APP).as_posix()
        if src.name in EXCLUDE_NAMES or rel in EXCLUDE_REL:
            continue
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        n += 1
    (out / 'config.json').write_text('{\n  "backend": false\n}\n', encoding='utf-8')
    shutil.copy2(HERE / 'vendor' / 'materialize.min.css', out / 'materialize.min.css')
    print('  ✓ %d 個檔 ＋ config.json ＋ materialize.min.css' % n)

    print('② 補丁（每一處恰好命中一次）')
    for rel, old, new in PATCHES:
        p = out / rel
        s = p.read_text(encoding='utf-8')
        c = s.count(old)
        if c != 1:
            print('  ✗ %s：錨點命中 %d 次（應為 1）——app 那側改了而補丁沒跟上\n    %s' % (rel, c, old.splitlines()[0]))
            return 1
        p.write_text(s.replace(old, new), encoding='utf-8')
    print('  ✓ %d 處' % len(PATCHES))

    print('③ 檢查')
    bad = []
    for p in out.rglob('*'):
        rel = p.relative_to(out).as_posix()
        if p.is_file() and p.suffix.lower() in FONT_EXT and rel not in FONT_ALLOWED:
            bad.append('不可散布的字型：' + rel)
        if p.is_file() and p.suffix in {'.html', '.js', '.css'}:
            t = p.read_text(encoding='utf-8')
            if '\x00' in t:
                bad.append('含 NUL：' + rel)
            if p.suffix == '.html' and 'cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/' in t:
                bad.append('仍引用 cdnjs 樣式表：' + rel)
    if json.loads((out / 'config.json').read_text())['backend'] is not False:
        bad.append('config.json 不是 backend:false')
    if bad:
        for b in bad:
            print('  ✗ ' + b)
        return 1
    print('  ✓ 沒有 Noto 以外的字型、沒有 cdnjs 樣式表、backend:false')

    print('\n✓ 建置完成。發佈時宣告 capabilities: {downloads: true}。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
