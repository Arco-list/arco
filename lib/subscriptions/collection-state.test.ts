import { test } from "node:test"
import assert from "node:assert/strict"

import { collectionState, hasUnpaidInvoice, isCollectionFailing } from "./collection-state.ts"
import type { InvoiceSummary } from "./billing-details-types.ts"

/**
 * Where a company's money stands.
 *
 * This answer contradicted itself on screen three times in one day —
 * "Betaling openstaand" above a row reading "In behandeling", a Pro
 * plan beside a red warning, a repair offered for a subscription that
 * no longer existed. Each contradiction is a case below.
 */

const inv = (status: string, processing = false): InvoiceSummary =>
  ({ status, processing } as InvoiceSummary)

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

test("nothing owed is settled", () => {
  assert.equal(collectionState("active", [inv("paid")]), "settled")
  assert.equal(collectionState("active", []), "settled")
})

test("an open invoice nobody is paying is failing", () => {
  assert.equal(collectionState("active", [inv("open")]), "failing")
  assert.equal(collectionState("past_due", [inv("open"), inv("paid")]), "failing")
})

test("money in transit is not a failure", () => {
  // The first contradiction: Stripe marks the subscription past_due
  // while a SEPA debit travels, and the banner read that field while
  // the invoice row beneath it read the payment.
  assert.equal(collectionState("past_due", [inv("open", true)]), "processing")
  assert.equal(collectionState("active", [inv("open", true)]), "processing")
})

test("a stuck invoice outranks one in transit", () => {
  // Still money owed that nothing is being done about, even while
  // another debit is on its way.
  assert.equal(collectionState("past_due", [inv("open"), inv("open", true)]), "failing")
})

test("paid invoices beat a stale subscription status", () => {
  // Invoices are fetched live from Stripe; the status is a row in our
  // own table that only hears of a recovery by webhook. On a machine
  // with no webhook that never arrives, and the mirror said past_due
  // above a table of paid invoices.
  assert.equal(collectionState("past_due", [inv("paid"), inv("paid")]), "settled")
})

test("unpaid still warns, because it has already cost access", () => {
  // The one place the mirror is allowed to win: `unpaid` has taken the
  // product away, and leaving that unexplained is worse than a warning
  // that turns out to be stale.
  assert.equal(collectionState("unpaid", [inv("paid")]), "failing")
})

test("unpaid stops warning while a repair is in transit", () => {
  assert.equal(collectionState("unpaid", [inv("paid")], inDays(9)), "settled")
  assert.equal(collectionState("unpaid", [inv("open", true)], inDays(9)), "processing")
})

test("an expired repair deadline warns again", () => {
  assert.equal(collectionState("unpaid", [inv("paid")], inDays(-1)), "failing")
})

test("hasUnpaidInvoice ignores anything being paid", () => {
  assert.equal(hasUnpaidInvoice([inv("open")]), true)
  assert.equal(hasUnpaidInvoice([inv("open", true)]), false)
  assert.equal(hasUnpaidInvoice([inv("paid"), inv("void")]), false)
})

test("isCollectionFailing is the narrow question", () => {
  assert.equal(isCollectionFailing("past_due", [inv("open")]), true)
  assert.equal(isCollectionFailing("past_due", [inv("open", true)]), false)
  assert.equal(isCollectionFailing("active", [inv("paid")]), false)
})
