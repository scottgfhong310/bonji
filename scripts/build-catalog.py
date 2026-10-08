#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build-catalog.py — data/BonjiInput.xlsx → data/catalog.json（Python 標準函式庫，zip ＋ xml，無 openpyxl）。

用法：  python3 scripts/build-catalog.py           → 比對（不寫）：產物與磁碟上的 catalog.json 逐位元組相同才 exit 0
        python3 scripts/build-catalog.py --write   → 寫出 data/catalog.json
        python3 scripts/build-catalog.py --stdout  → 印到 stdout

DESIGN §7.2 一直描述著這條管線（「以 Python stdlib 抽出」），但那支腳本**從來不在 repo 裡**——
2026-10-08 為了替 xlsx 加異體字而補上。⚠️ 補上時先證明：對**當時**的 xlsx，產物與 repo 裡的
catalog.json **逐位元組相同**（`python3 scripts/build-catalog.py` exit 0），才去改 xlsx。

規則（全部照當時的產物反推、而後以逐位元組相同驗證）：
- 類別順序＝ workbook 的 sheet 順序；類別 id ＝ sheet 名，**而且必須等於每一列的 fd_catalog**（不等就中止）。
- 一列一筆 `{code, char, group}`，順序＝列順序；`fd_idx` 只當作「這一列存在」的記號，不輸出。
- `fonts` 不在 xlsx 裡，是本檔的常數（三支字型怎麼取得；⚠️ Mojikyo／Siddam 讀本機安裝、不隨 repo 散布）。
- 輸出：`json.dumps(indent=1, ensure_ascii=False)`，結尾**沒有**換行（與既有檔案相同）。
"""
import json
import pathlib
import sys
import zipfile
import xml.etree.ElementTree as ET

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / 'public' / 'apps' / 'bonji' / 'data'
XLSX = DATA / 'BonjiInput.xlsx'
OUT = DATA / 'catalog.json'

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
FONTS = {
    'siddham': 'Noto Sans Siddham (Unicode, bundled)',
    'mojikyo119': 'Mojikyo M119 (local install)',
    'uniSiddham': 'Siddam (local install)',
}
FIELDS = ['fd_idx', 'fd_catalog', 'fd_group', 'fd_code', 'fd_char']


def col_of(ref):
    return ''.join(ch for ch in ref if ch.isalpha())


def read(xlsx):
    z = zipfile.ZipFile(xlsx)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    rels = {r.get('Id'): r.get('Target')
            for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels')).findall('rel:Relationship', NS)}
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    cats = []
    for sh in wb.find('m:sheets', NS).findall('m:sheet', NS):
        name = sh.get('name')
        target = rels[sh.get('{%s}id' % NS['r'])].lstrip('/')
        path = target if target.startswith('xl/') else 'xl/' + target
        rows = []
        for row in ET.fromstring(z.read(path)).find('m:sheetData', NS).findall('m:row', NS):
            vals = {}
            for c in row.findall('m:c', NS):
                t = c.get('t')
                if t == 's':
                    v = shared[int(c.find('m:v', NS).text)]
                elif t == 'inlineStr':
                    v = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                else:
                    ve = c.find('m:v', NS)
                    v = ve.text if ve is not None else ''
                vals[col_of(c.get('r'))] = v
            rows.append(vals)
        header = [rows[0].get(k, '') for k in 'ABCDE']
        if header != FIELDS:
            sys.exit('✗ %s：表頭是 %s，應為 %s' % (name, header, FIELDS))
        entries = []
        for i, r in enumerate(rows[1:], start=2):
            rec = dict(zip(FIELDS, [r.get(k, '') for k in 'ABCDE']))
            if not rec['fd_idx']:
                continue
            if rec['fd_catalog'] != name:
                sys.exit('✗ %s 第 %d 列：fd_catalog = %r，與 sheet 名不同' % (name, i, rec['fd_catalog']))
            entries.append({'code': rec['fd_code'], 'char': rec['fd_char'], 'group': rec['fd_group']})
        cats.append({'id': name, 'entries': entries})
    return {'source': XLSX.name, 'fonts': FONTS, 'categories': cats}


def main():
    argv = sys.argv[1:]
    unknown = [a for a in argv if a not in ('--write', '--stdout')]
    if unknown:
        print('✗ 未知旗標：%s（可用 --write／--stdout；不帶旗標＝比對）' % ' '.join(unknown)); return 2
    text = json.dumps(read(XLSX), indent=1, ensure_ascii=False)
    if '--stdout' in argv:
        sys.stdout.write(text); return 0
    if '--write' in argv:
        OUT.write_text(text, encoding='utf-8'); print('✓ 寫出 %s' % OUT.relative_to(REPO)); return 0
    same = OUT.read_text(encoding='utf-8') == text
    print('✓ 與 data/catalog.json 逐位元組相同' if same else '✗ 與 data/catalog.json 不同（要寫出請加 --write）')
    return 0 if same else 1


if __name__ == '__main__':
    sys.exit(main())
