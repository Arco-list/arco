import { test } from "node:test"
import assert from "node:assert/strict"

import { isEntitled, isEntitledNow } from "./entitlement.ts"

/**
 * Who may use Pro.
 *
 * Every case here is one this project actually reached, most of them on
 * the day the rule was written. They are kept as cases rather than as
 * prose because the rule changed four times in an afternoon and each
 * change was argued from an example.
 */

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

test("a paid subscription entitles", () => {
  assert.equal(isEntitledNow("active", null), true)
  assert.equal(isEntitledNow("trialing", null), true)
})

test("past_due entitles, because a SEPA debit takes days", () => {
  // Stripe marks a subscription past_due the moment a collection does
  // not settle instantly, which for a direct debit is always. Taking
  // the product away there punishes people for using the method we
  // steer them towards.
  assert.equal(isEntitledNow("past_due", null), true)
})

test("past_due entitles whatever the company did before", () => {
  // A counter once withheld this from anyone who had failed to pay
  // before. The rule worked and was still the wrong trade — see
  // migration 252 — so the history no longer reaches this function at
  // all, and there is no parameter left to pass it through.
  assert.equal(isEntitledNow.length, 2)
})

test("unpaid does not entitle on its own", () => {
  assert.equal(isEntitledNow("unpaid", null), false)
  assert.equal(isEntitledNow("unpaid", undefined), false)
})

test("unpaid entitles while a repair payment is travelling", () => {
  // The deadline is written when a replaced mandate starts collecting.
  // Without it, somebody who did exactly what was asked sat on Free
  // for the days the debit spent in transit.
  assert.equal(isEntitledNow("unpaid", inDays(9)), true)
})

test("an expired repair deadline stops entitling", () => {
  // Deliberately a deadline rather than a flag: a flag cleared only by
  // a webhook that confirms success would grant Pro forever on a
  // failure nobody hears about.
  assert.equal(isEntitledNow("unpaid", inDays(-1)), false)
})

test("a refused first payment does not entitle", () => {
  assert.equal(isEntitledNow("incomplete", null), false)
  assert.equal(isEntitledNow("incomplete_expired", null), false)
})

test("a cancelled subscription does not entitle", () => {
  assert.equal(isEntitledNow("canceled", null), false)
  // Not even with a deadline left over from an earlier repair.
  assert.equal(isEntitledNow("canceled", inDays(9)), false)
})

test("nothing at all does not entitle", () => {
  assert.equal(isEntitledNow(null, null), false)
  assert.equal(isEntitledNow(undefined, null), false)
  assert.equal(isEntitledNow("", null), false)
})

test("isEntitled ignores the repair deadline", () => {
  // The narrow question — is this status one of the entitled three —
  // asked by callers that have no invoice context to offer.
  assert.equal(isEntitled("past_due"), true)
  assert.equal(isEntitled("unpaid"), false)
  assert.equal(isEntitled(null), false)
})
