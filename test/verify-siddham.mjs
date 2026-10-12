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

// ── 三個半形空格 → 一個全形空格（只在悉曇輸出；DESIGN §5.3）──────────────────────────
// 期望值一律寫成 \u 轉義：全形空格與半形空格在編輯器裡分不出來。
const W = "\u3000"
const KA = "\u{1158E}", MA = "\u{115A6}", NA = "\u{115A1}", A = "\u{11580}", VIRAMA = "\u{115BF}"
const sp = (n) => " ".repeat(n)
const spaceCases = [
  // [輸入, 忽略空格, 悉曇]；拉丁與 ascii 一律要與輸入相同（不動）
  ["ka" + sp(1) + "ma",      true,  KA + MA],                 // 一個：照舊（對照組）
  ["ka" + sp(2) + "ma",      true,  KA + sp(1) + MA],         // 兩個（忽略＝開）→ 一個半形空格（DESIGN §5.5）
  ["ka" + sp(2) + "ma",      false, KA + sp(2) + MA],         // 兩個（忽略＝關）：照舊保留字面，不套用
  ["n" + sp(2) + "a",        true,  NA + VIRAMA + sp(1) + A], // 兩個：兩側各自成組（不併成 na）
  [sp(2) + "ka",             true,  KA],                      // 兩個貼著行首：不輸出（它是「字間」的空格）
  ["ka" + sp(2),             true,  KA],                      // 兩個貼著行尾：不輸出
  ["ka-" + sp(2) + "ma",     true,  KA + sp(1) + MA],         // 兩個貼著連字號：仍只有一個空格
  ["ka:" + sp(2) + "ma",     true,  KA + ":" + sp(1) + MA],   // 冒號後面是空白 ⇒ 仍是字面冒號
  ["ka" + sp(5) + "ma",      true,  KA + W + sp(1) + MA],     // 五個＝一組全形＋剩兩個 → 全形＋一個半形
  ["ka" + sp(2) + "\nma",    true,  KA + "\n" + MA],         // 兩個貼著換行：不輸出、換行還在
  ["ka" + sp(3) + "ma",      true,  KA + W + MA],             // 三個 → 全形
  ["ka" + sp(3) + "ma",      false, KA + W + MA],             // 不論忽略與否
  ["ka" + sp(4) + "ma",      true,  KA + W + MA],             // 四個＝一組＋剩一個（照舊被忽略）
  ["ka" + sp(4) + "ma",      false, KA + W + sp(1) + MA],     // 四個＝一組＋剩一個（照舊保留）
  ["ka" + sp(5) + "ma",      false, KA + W + sp(2) + MA],     // 五個＝一組＋剩兩個
  ["ka" + sp(6) + "ma",      true,  KA + W + W + MA],         // 六個＝兩組
  ["n" + sp(3) + "a",        true,  NA + VIRAMA + W + A],     // 仍是 token 邊界（不併成 na）
  [sp(3) + "ka",             true,  W + KA],                  // 行首不被 trim（可縮排）
  ["ka" + sp(3) + "\nma",    true,  KA + W + "\n" + MA],     // 貼著換行：換行不可以不見
  ["ka\n" + sp(3) + "ma",    true,  KA + "\n" + W + MA],
  ["ka-" + sp(3) + "ma",     true,  KA + sp(1) + W + MA],     // 連字號照舊補一個半形空格，兩者各算各的
  ["ka" + sp(3) + "-ma",     false, KA + W + sp(1) + MA],
  ["ka:" + sp(3) + "ma",     true,  KA + ":" + W + MA],       // 冒號後面是空白 ⇒ 仍是字面冒號（不可以變成分隔符）
]
for (const [inp, ignore, eS] of spaceCases) {
  const r = new SiddhamConverter({ ignoreSpacesAndHyphens: ignore }).convert(inp)
  const ok = r.siddham === eS && r.latin === inp && r.ascii === inp && !/[\u{F0000}-\u{FFFFD}\t]/u.test(r.siddham)
  pass = pass && ok
  console.log(`${ok ? "OK  " : "FAIL"} ${JSON.stringify(inp)} (ignore=${ignore}) -> ${JSON.stringify(r.siddham)}`)
}
// ── 換行永遠留著：悉曇的行數＝輸入的行數（逐行轉；DESIGN §5.4）──────────────────────────
// 改前是整段一起轉，trim() 會把貼著「-」或整段頭尾的換行吃掉。
const lineCases = [
  // [輸入, 忽略空格, 悉曇]
  ["ka-\nma",     true,  KA + "\n" + MA],             // 一行以 - 結尾：換行不可以不見（行尾的 - 不補空格）
  ["ka-\nma",     false, KA + "\n" + MA],
  ["ka\n-ma",     true,  KA + "\n" + MA],             // 下一行以 - 開頭
  ["ka-ma\nka",   true,  KA + sp(1) + MA + "\n" + KA], // 行內的 - 照舊補一個空格
  ["ka-\n\nma",   true,  KA + "\n\n" + MA],          // 空行也留著
  ["\nka",        true,  "\n" + KA],                  // 開頭的空行（少了它，HTML 片段的悉曇與拉丁會整段錯位一行）
  ["ka\n",        true,  KA + "\n"],                  // 結尾的換行
  ["ka \nma",     false, KA + "\n" + MA],             // 每一行各自 trim：行尾的空格不輸出（忽略＝關也一樣）
]
for (const [inp, ignore, eS] of lineCases) {
  const r = new SiddhamConverter({ ignoreSpacesAndHyphens: ignore }).convert(inp)
  const lines = (t) => t.split("\n").length
  const ok = r.siddham === eS && r.latin === inp && lines(r.siddham) === lines(inp) && lines(r.codepoints) === lines(inp)
  pass = pass && ok
  console.log(`${ok ? "OK  " : "FAIL"} ${JSON.stringify(inp)} (ignore=${ignore}) -> ${JSON.stringify(r.siddham)}`)
}
// 碼位欄看得到那個全形空格
{
  const cp = c.convert("ka" + sp(3) + "ma").codepoints
  const ok = cp === "U+1158E U+3000 U+115A6"
  pass = pass && ok
  console.log(`${ok ? "OK  " : "FAIL"} codepoints("ka   ma"): ${cp}`)
}
if (!pass) { console.error("VERIFY FAILED"); process.exit(1) }
console.log("VERIFY PASS")
