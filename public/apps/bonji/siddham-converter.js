// SPDX-License-Identifier: MIT
// Wraps the vendored bonji-input engine (Copyright (c) 2021 Ryusei Yamaguchi, MIT).
// 這是本 App 的唯一悉曇轉換介面（anti-corruption layer）。
// App 其餘程式只 import 本檔，不得直接 import vendor/bonji-input/siddham.js。

import { ascii2latin, ascii2siddham, ascii2symbol, latin2ascii } from "./vendor/bonji-input/siddham.js"

/**
 * @typedef {Object} SiddhamOptions
 * @property {"ISO15919" | "KH"}   inputMethod
 * @property {"ISO15919" | "IAST"} transliteration
 * @property {boolean}             ignoreSpacesAndHyphens
 */

/**
 * @typedef {Object} SiddhamResult
 * @property {string} input      輸入文字（原樣回傳）
 * @property {string} siddham    悉曇文字
 * @property {string} latin      拼音字元（拉丁轉寫）
 * @property {string} codepoints 悉曇文字對應的 Unicode 碼位
 */

export class SiddhamConverter {
    /** @type {SiddhamOptions} */
    static defaultOptions = {
        inputMethod: "ISO15919",
        transliteration: "IAST",
        ignoreSpacesAndHyphens: true,
    }

    /** @param {Partial<SiddhamOptions>} [options] */
    constructor(options = {}) {
        /** @type {SiddhamOptions} */
        this.options = { ...SiddhamConverter.defaultOptions, ...options }
    }

    /** @param {Partial<SiddhamOptions>} patch @returns {this} */
    setOptions(patch) {
        this.options = { ...this.options, ...patch }
        return this
    }

    /** @param {string} input @returns {SiddhamResult} */
    convert(input) {
        const { inputMethod, transliteration, ignoreSpacesAndHyphens } = this.options
        const ascii = latin2ascii(ascii2symbol(input), { inputMethod })
        const siddham = SiddhamConverter.toSiddham(ascii, ignoreSpacesAndHyphens)
        const latin = ascii2latin(ascii, { transliteration })
        const codepoints = SiddhamConverter.toCodepoints(siddham)
        return { input, siddham, latin, codepoints }
    }

    /**
     * ascii → 悉曇字串（引擎本身不修改，邊界語意在此層處理）。
     *
     * - 連字號「-」＝「詞組分隔」：在悉曇輸出中一律算一個空格（兩組子音字以空格分開），
     *   不論 ignore 與否。拉丁轉寫則保留「-」（由 ascii2latin 處理，本函式不碰）。
     * - 空格：ignore=true 時移除「可見空格」但仍視為 token 邊界（故「n a」→𑖡𑖿𑖀＝
     *   子音+獨立母音，而非併成音節 𑖡）；ignore=false 時交給引擎保留為字面空格。
     *
     * @param {string} ascii
     * @param {boolean} ignore
     * @returns {string}
     */
    static toSiddham(ascii, ignore) {
        return ascii.split(/-+/)
            .map((group) => {
                group = group.trim()
                if (!group) return ""
                return ignore
                    ? group.split(/ +/).filter(Boolean).map((seg) => ascii2siddham(seg)).join("")
                    : ascii2siddham(group, { ignoreSpacesAndHyphens: false })
            })
            .filter((s) => s !== "")
            .join(" ")
    }

    /**
     * 原始 ascii → 拉丁轉寫（不經輸入前處理，直接轉；給字元對照表等需以「輸入記法」
     * 直接取讀音的場合用。和 toSiddham 對稱）。
     * @param {string} ascii
     * @param {"ISO15919" | "IAST"} [transliteration]
     * @returns {string}
     */
    static toLatin(ascii, transliteration = "IAST") {
        return ascii2latin(ascii, { transliteration })
    }

    /** @param {string} text @returns {string} */
    static toCodepoints(text) {
        return text.split("\n")
            .map(line =>
                Array.from(line)
                    .map(ch =>
                        `U+${/** @type {number} */ (ch.codePointAt(0))
                            .toString(16)
                            .toUpperCase()
                            .padStart(4, "0")}`
                    )
                    .join(" ")
            )
            .join("\n")
    }
}
