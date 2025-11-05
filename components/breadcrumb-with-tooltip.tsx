"use client"

import Link from "next/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type BreadcrumbItem = {
  label: string
  href?: string | null
}

type BreadcrumbWithTooltipProps = {
  items: BreadcrumbItem[]
  maxLabelLength?: number
}

const truncateLabel = (label: string, maxLength: number): { truncated: string; needsTooltip: boolean } => {
  if (label.length <= maxLength) {
    return { truncated: label, needsTooltip: false }
  }

  return {
    truncated: label.slice(0, maxLength) + "...",
    needsTooltip: true
  }
}

export function BreadcrumbWithTooltip({ items, maxLabelLength = 30 }: BreadcrumbWithTooltipProps) {
  return (
    <nav className="text-sm text-text-secondary" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, index) => {
          const { truncated, needsTooltip } = truncateLabel(item.label, maxLabelLength)
          const isLast = index === items.length - 1

          return (
            <li key={index} className="flex items-center gap-2">
              {needsTooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {item.href ? (
                      <Link href={item.href} className="hover:text-foreground transition-colors">
                        {truncated}
                      </Link>
                    ) : (
                      <span className={isLast ? "text-foreground" : ""}>
                        {truncated}
                      </span>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <>
                  {item.href ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors">
                      {truncated}
                    </Link>
                  ) : (
                    <span className={isLast ? "text-foreground" : ""}>
                      {truncated}
                    </span>
                  )}
                </>
              )}
              {!isLast && (
                <span className="text-muted-foreground" aria-hidden="true">&gt;</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
