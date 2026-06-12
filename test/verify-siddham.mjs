import { SiddhamConverter } from "../public/apps/bonji/siddham-converter.js"

const c = new SiddhamConverter()   // defaults: inputMethod ISO15919, transliteration IAST
const cases = [
  // latin uses IAST (anusvāra = ṃ, not ISO15919 ṁ)
  ["siddha;m", "𑖭𑖰𑖟𑖿𑖠𑖽", "siddhaṃ"],
  ["hrii.h",   "𑖮𑖿𑖨𑖱𑖾", "hrīḥ"],
  ["stva;m",   "𑖭𑖿𑖝𑖿𑖪𑖽", "stvaṃ"],
  ["va~m",     "𑖪𑖼", "vam̐"],
  ["huu~m",    "𑖮𑖳𑖼", "hūm̐"],
]
let pass = true
for (const [inp, eS, eL] of cases) {
  const r = c.convert(inp)
  const ok = r.siddham === eS && r.latin === eL
  pass = pass && ok
  console.log(`${ok ? "OK  " : "FAIL"} ${inp} -> ${r.siddham} | ${r.latin}`)
}
console.log("codepoints(siddha;m):", c.convert("siddha;m").codepoints)
if (!pass) { console.error("VERIFY FAILED"); process.exit(1) }
console.log("VERIFY PASS")
