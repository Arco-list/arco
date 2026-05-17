import { SyncButton } from "./sync-button"

export const dynamic = "force-dynamic"

export default function SyncOutboundPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-medium text-[#1c1c1a]">Sync Outbound to Notion</h1>
      <p className="mt-2 text-sm text-[#6b6b68]">
        Pushes the latest Outbound funnel data from the platform into the Notion
        Outbound database. Funnel rows (Visitor → Listed) come from{" "}
        <a className="underline" href="/admin/sales">
          admin/sales
        </a>
        . Any Notion row whose <em>Website</em> matches a company in{" "}
        <a className="underline" href="/admin/professionals">
          admin/companies
        </a>{" "}
        but isn’t in the funnel gets enriched and tagged{" "}
        <strong>Channel = Direct</strong>.
      </p>
      <p className="mt-2 text-sm text-[#6b6b68]">
        Manual rep-owned fields (Contact status, Last contacted, Scheduled,
        Notes) are never overwritten.
      </p>

      <div className="mt-8">
        <SyncButton />
      </div>
    </div>
  )
}
