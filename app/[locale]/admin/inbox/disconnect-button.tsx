"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { disconnectGmailConnection } from "./actions"

/**
 * Disconnect a connected Gmail mailbox from /admin/inbox. Confirms
 * before firing because the action best-effort revokes the refresh
 * token at Google — re-connecting requires going through the OAuth
 * consent screen again. Inbound emails synced previously stay in the
 * DB so the historical inbox isn't lost.
 */
export function DisconnectButton({ gmailAddress }: { gmailAddress: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const onClick = () => {
    if (!confirm(`Disconnect ${gmailAddress}? Future syncs will stop. You'll need to re-authorise via Google to reconnect.`)) {
      return
    }
    startTransition(async () => {
      const result = await disconnectGmailConnection(gmailAddress)
      if (result.success) {
        toast.success(`Disconnected ${gmailAddress}`)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to disconnect")
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-[11px] text-[#a1a1a0] hover:text-red-700 transition-colors disabled:opacity-50"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  )
}
