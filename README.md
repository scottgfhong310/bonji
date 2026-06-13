# bonji — Siddhaṁ Converter

[English](./README.md) ｜ [繁體中文](./README.zh-Hant.md) ｜ [日本語](./README.ja.md)

A single-page WebApp that converts **ASCII / IAST romanization** into **Siddhaṁ (悉曇梵字) script**, its **Latin transliteration**, and **Unicode code points** — entirely in the browser.

The Siddhaṁ engine is the [mandel59/bonji-input](https://github.com/mandel59/bonji-input) engine, **vendored** (copied in, unmodified, MIT) and used only through a thin anti-corruption layer, `SiddhamConverter`.

Part of the **nodeapp WebApp family** — shared conventions and workflow live at
<https://github.com/scottgfhong310/nodeapp-webapp-family> (`DESIGN_GUIDELINES.md`, `WORKFLOW.md`).

## Features

- Two-column layout: input on the left, output on the right (stacks on narrow screens).
- An optional **title** field plus the input text (both copyable); live conversion as you type — Siddhaṁ script · Latin transliteration · Unicode code points.
- Options: input method (ISO 15919 / Kyoto-Harvard), transliteration (ISO 15919 / IAST), ignore spaces & hyphens.
- Bundled **Noto Sans Siddham** webfont (SIL OFL) so the script renders without a system font.
- Trilingual UI (`zh-Hant` / `en` / `ja`, default `zh-Hant`); light / dark theme.
- Per-field copy buttons (title input + each output); example chips.
- **JSON export** — save the current result to the server as `bonji-yyyyMMddHHmmss.json` under `/download/bonji/` (captures `title`, `options`, input and the three outputs); the **download** button exports first and then downloads that JSON; a **`dehaze` side panel** lists exports newest-first and a `delete_sweep` button clears the folder.
- **Round-trip a saved export** — click an entry in the panel to load its `title` / `options` / `input` back into the page (the loaded file's `sourceFile` is shown below the options); tweak and export again to get a new file that records the file it came from in `sourceFile`.

> The conversion engine runs entirely in the browser. JSON export / listing use the Node backend below, so those two features need the server (the converter itself does not).

## Notation (a few examples)

| type | get | | type | get |
|---|---|---|---|---|
| `;m` | ṁ | | `aa` | ā |
| `.h` | ḥ | | `ii` | ī |
| `~m` | m̐ | | `uu` | ū |

e.g. `siddha;m` → 𑖭𑖰𑖟𑖿𑖠𑖽 (`siddhaṁ`), `na ma.h` → 𑖡𑖦𑖾 (`na maḥ`).

## Run

```bash
npm install && npm start          # → http://localhost:3000/apps/bonji/
npm test                          # verify the vendored engine (5 cases + code points)
```

`PORT` env var overrides the default `3000`.

## API

All responses use the family `{ ok }` envelope.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/bonji/export` | Save `{ title, options, input, output, sourceFile }` as `bonji-yyyyMMddHHmmss.json` in `public/download/bonji/` (`sourceFile` = the export this was loaded/derived from, or `null`). Returns `{ ok, filename, path }`. |
| `GET` | `/api/bonji/downloads` | List the JSON files in `public/download/bonji/`, sorted descending. Returns `{ ok, files: [{ name, size, mtime }] }`. |
| `POST` | `/api/bonji/clear` | Delete all JSON files in `public/download/bonji/` (target hard-wired server-side). Returns `{ ok, removed }`. |

Exported files are served statically at `/download/bonji/<file>`.

## JSON shapes

Two JSON structures appear in this project.

**`SiddhamConverter.convert(input)` → result** — the in-browser conversion result (returned by the library; also drives the UI):

```jsonc
{
  "input":      "siddha;m",          // the input text, echoed back
  "siddham":    "𑖭𑖰𑖟𑖿𑖠𑖽",          // Siddhaṁ script
  "latin":      "siddhaṃ",           // Latin transliteration (IAST by default; ISO 15919 optional)
  "codepoints": "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"
  //            code points of `siddham`, space-separated (one line per input line)
}
```

**`bonji-yyyyMMddHHmmss.json`** — an exported record (written by `POST /api/bonji/export`; the filename timestamp is server-generated). It nests the three outputs under `output` and adds metadata:

```jsonc
{
  "app":        "bonji",
  "exportedAt": "2026-06-13T01:25:59.123Z", // ISO 8601, UTC
  "sourceFile": "bonji-20260613092011.json",// the export this was loaded/derived from, or null
  "title":      "心經種子字",                 // optional, user-entered
  "options": {
    "inputMethod":            "ISO15919",   // "ISO15919" | "KH"
    "transliteration":        "IAST",       // "ISO15919" | "IAST"
    "ignoreSpacesAndHyphens": true
  },
  "input":  "siddha;m",
  "output": {
    "siddham":    "𑖭𑖰𑖟𑖿𑖠𑖽",
    "latin":      "siddhaṃ",
    "codepoints": "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"
  }
}
```

> `output` holds the three outputs from `convert()` (`siddham` / `latin` / `codepoints`); `input` stays at the top level. `app`, `exportedAt`, `sourceFile`, `title` and `options` are metadata added by the export.

## Structure

```
bonji/
├─ app.js                          # Express: static + /api/bonji + ( / → 302 /apps/bonji/ ) + PORT||3000
├─ routes/bonji.js                 # POST /export, GET /downloads ({ ok } envelope)
├─ package.json · .gitignore · LICENSE
├─ test/verify-siddham.mjs         # engine verification (npm test)
└─ public/
   ├─ download/bonji/.gitkeep      # exported JSON lands here (contents gitignored)
   └─ apps/bonji/
      ├─ index.html · bonji.css · bonji.js     # structure / styles / glue (ESM module)
      ├─ siddham-converter.js                  # anti-corruption layer (the ONLY Siddhaṁ interface)
      ├─ vendor/bonji-input/{siddham.js, LICENSE, SOURCE.md}   # vendored engine (MIT, unmodified)
      ├─ fonts/{NotoSansSiddham-Regular.woff2, OFL.txt}
      ├─ i18n.js · locales/{zh-Hant,en,ja}.js
      └─ side-tool.css · materialize-dark.css
```

## Using the core (`SiddhamConverter`)

`siddham-converter.js` is the **only** module the app imports for conversion; it never reaches into the vendored engine directly. It is a zero-dependency ES module:

```js
import { SiddhamConverter } from "./siddham-converter.js";

const converter = new SiddhamConverter();           // defaults: ISO15919 input, IAST transliteration, ignore spaces
const { input, siddham, latin, codepoints } = converter.convert("siddha;m");
// input:      "siddha;m"   (the text passed in, echoed back)
// siddham:    "𑖭𑖰𑖟𑖿𑖠𑖽"
// latin:      "siddhaṃ"    (IAST default; ṃ — ISO15919 would be ṁ)
// codepoints: "U+115AD U+115B0 U+1159F U+115BF U+115A0 U+115BD"

converter.setOptions({ transliteration: "ISO15919" });  // → latin uses ṁ instead of ṃ
```

### Updating the vendored engine

See `public/apps/bonji/vendor/bonji-input/SOURCE.md` for the pinned upstream commit. To soft-sync, diff upstream against the pinned commit, apply only engine-relevant fixes into `vendor/bonji-input/`, re-run `npm test`, and update `SOURCE.md`. Because the app only depends on `SiddhamConverter`, upstream internal changes at most require touching that wrapper.

## License

MIT © 2026 Scott G.F. Hong. Bundles the **bonji-input** Siddhaṁ engine (MIT, © 2021 Ryusei Yamaguchi) and **Noto Sans Siddham** (SIL OFL 1.1). See [LICENSE](./LICENSE), the vendored `LICENSE`/`SOURCE.md`, and `fonts/OFL.txt`.
