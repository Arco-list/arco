"use client"

import type { ReactNode } from "react"
import { MailPlus, MoreHorizontal, Pencil, Trash2, XCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"

type InviteStatusMeta = {
  label: string
  className: string
}

type BaseInvite = {
  id: string
  email: string
  status: string
}

type ServiceSummary = {
  id: string
  name: string
  parentName: string | null
  slug?: string | null
}

type ProfessionalServiceCardProps<TInvite extends BaseInvite> = {
  service: ServiceSummary
  invites: TInvite[]
  isBusy: boolean
  onInvite: (serviceId: string, invite?: TInvite) => void
  onDeleteInvite: (invite: TInvite) => void | Promise<void>
  onRemoveService: (serviceId: string) => void | Promise<void>
  getInviteStatusMeta: (invite: TInvite) => InviteStatusMeta
  canEditInvite?: (invite: TInvite) => boolean
  canDeleteInvite?: (invite: TInvite) => boolean
  emptyStateCtaLabel?: ReactNode
}

const DEFAULT_EMPTY_STATE_LABEL = "Invite professional"

export function ProfessionalServiceCard<TInvite extends BaseInvite>({
  service,
  invites,
  isBusy,
  onInvite,
  onDeleteInvite,
  onRemoveService,
  getInviteStatusMeta,
  canEditInvite,
  canDeleteInvite,
  emptyStateCtaLabel,
}: ProfessionalServiceCardProps<TInvite>) {
  const hasInvite = invites.length > 0
  const editableInvite = invites.find((invite) => (canEditInvite ? canEditInvite(invite) : invite.status === "invited"))
  const primaryActionIcon = hasInvite && editableInvite ? Pencil : MailPlus
  const primaryActionLabel = hasInvite
    ? editableInvite
      ? "Edit invite"
      : "Invite already added"
    : "Invite professional"
  const primaryActionDisabled = isBusy || (hasInvite && !editableInvite)

  const IconComponent = resolveProfessionalServiceIcon(service.slug, service.parentName)

  const handlePrimaryAction = () => {
    if (primaryActionDisabled) {
      return
    }
    if (hasInvite) {
      if (editableInvite) {
        onInvite(service.id, editableInvite)
      }
      return
    }
    onInvite(service.id)
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
            <IconComponent aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{service.name}</h2>
            {service.parentName && <p className="text-xs text-gray-500">{service.parentName}</p>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={`Manage actions for ${service.name}`}
              disabled={isBusy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={handlePrimaryAction} disabled={primaryActionDisabled}>
              {primaryActionIcon === Pencil ? <Pencil className="h-4 w-4" /> : <MailPlus className="h-4 w-4" />}
              {primaryActionLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRemoveService(service.id)} disabled={isBusy} variant="destructive">
              <Trash2 className="h-4 w-4" />
              Remove service
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        {invites.length === 0 ? (
          <div className="flex flex-1 flex-col justify-end">
            <button
              type="button"
              onClick={() => onInvite(service.id)}
              disabled={isBusy}
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MailPlus className="h-4 w-4" />
              {emptyStateCtaLabel ?? DEFAULT_EMPTY_STATE_LABEL}
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3">
            <div className="space-y-3">
              {invites.map((invite) => {
                const statusMeta = getInviteStatusMeta(invite)
                const inviteCanEdit = canEditInvite ? canEditInvite(invite) : invite.status === "invited"
                const inviteCanDelete = canDeleteInvite ? canDeleteInvite(invite) : true
                const inviteRecord = invite as Record<string, unknown>
                const companyName =
                  typeof inviteRecord.companyName === "string" && inviteRecord.companyName.trim().length > 0
                    ? (inviteRecord.companyName as string)
                    : null
                const primaryLine = companyName ?? invite.email
                const secondaryLine = companyName ? invite.email : null
                return (
                  <div key={invite.id} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-sm font-medium text-gray-900">{primaryLine}</p>
                    {secondaryLine && <p className="text-xs text-gray-500">{secondaryLine}</p>}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusMeta.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {inviteCanEdit && (
                          <button
                            type="button"
                            onClick={() => onInvite(service.id, invite)}
                            disabled={isBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Edit invite for ${invite.email}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {inviteCanDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              void onDeleteInvite(invite)
                            }}
                            disabled={isBusy}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Remove invite for ${invite.email}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
