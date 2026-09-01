"use server"

import { acceptCredit, type AcceptOutcome } from "@/lib/invites/accept-credit"

/**
 * Server action behind the "Accepteer vermelding" button.
 *
 * Deliberately an action (a POST) rather than something the emailed link
 * can trigger on its own: a GET from a mail scanner or preview pane must
 * never change a company's public visibility.
 */
export async function acceptCreditAction(token: string): Promise<AcceptOutcome> {
  return acceptCredit(token)
}
