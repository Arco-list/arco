import { test } from "node:test"
import assert from "node:assert/strict"

import { isValidVatNumber, normaliseVatNumber } from "./vat-number.ts"

/**
 * Does this look like a VAT number?
 *
 * Format only — whether it exists is VIES's answer, asked by Stripe.
 * What this guards against is silence: a malformed number is refused
 * when the tax ID is written, and that write is best-effort, so the
 * subscription went through and the number never reached the invoice.
 */

test("a Dutch VAT number is accepted", () => {
  assert.equal(isValidVatNumber("NL123456789B01"), true)
  assert.equal(isValidVatNumber("NL001234567B01"), true)
})

test("case and spacing do not matter", () => {
  assert.equal(isValidVatNumber("nl123456789b01"), true)
  assert.equal(isValidVatNumber("NL 1234 56789 B01"), true)
  assert.equal(isValidVatNumber(" NL123456789B01 "), true)
})

test("prose is not a VAT number", () => {
  // The case that started this: typed into the field and accepted,
  // because nothing checked and Stripe's refusal was swallowed.
  assert.equal(isValidVatNumber("Dit werkt ook"), false)
  assert.equal(isValidVatNumber(""), false)
})

test("the shape is exact", () => {
  assert.equal(isValidVatNumber("NL123456789"), false, "no B block")
  assert.equal(isValidVatNumber("NL12345678B01"), false, "a digit short")
  assert.equal(isValidVatNumber("NL1234567890B01"), false, "a digit over")
  assert.equal(isValidVatNumber("NL123456789B1"), false, "check digits short")
  assert.equal(isValidVatNumber("XNL123456789B01"), false, "junk in front")
  assert.equal(isValidVatNumber("NL123456789B01X"), false, "junk behind")
})

test("other countries are refused, because we do not sell there", () => {
  // Not a gap: the checkout offers only the Netherlands until reverse
  // charge exists, so a Belgian number on a Dutch invoice would be the
  // wrong tax, not a missing feature.
  assert.equal(isValidVatNumber("BE0123456789"), false)
  assert.equal(isValidVatNumber("DE123456789"), false)
})

test("normalising is what Stripe is given", () => {
  assert.equal(normaliseVatNumber(" nl123456789b01 "), "NL123456789B01")
  assert.equal(normaliseVatNumber("NL.1234 56789.B01"), "NL123456789B01")
})
