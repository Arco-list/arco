import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-200 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        // Primary - Main CTA (Design System: 16px, 12px/24px padding)
        default:
          "bg-primary text-primary-foreground text-base hover:bg-primary-hover disabled:bg-border disabled:text-primary-foreground disabled:opacity-100 disabled:cursor-not-allowed",
        primary:
          "bg-primary text-primary-foreground text-base hover:bg-primary-hover disabled:bg-border disabled:text-primary-foreground disabled:opacity-100 disabled:cursor-not-allowed",
        // Secondary - Important actions (Design System: 14px, 12px/16px padding)
        secondary:
          "bg-secondary text-secondary-foreground text-sm hover:bg-secondary-hover disabled:bg-border disabled:text-secondary-foreground disabled:opacity-100 disabled:cursor-not-allowed",
        // Tertiary - Subtle actions (Design System: 14px, 12px/16px padding)
        tertiary:
          "bg-tertiary text-tertiary-foreground text-sm hover:bg-tertiary-hover disabled:bg-transparent disabled:border disabled:border-border disabled:text-border disabled:opacity-100 disabled:cursor-not-allowed",
        // Quaternary - Outlined minimal (Design System: 14px, 6px/12px padding)
        quaternary:
          "bg-transparent border border-border text-foreground text-sm font-normal hover:bg-tertiary data-[state=on]:border-foreground aria-pressed:border-foreground disabled:bg-transparent disabled:border-border disabled:text-border disabled:opacity-100 disabled:cursor-not-allowed",
        // Text Button - No background (Design System: 14px, 6px/12px padding)
        ghost:
          "bg-transparent text-foreground text-sm font-medium hover:bg-tertiary active:text-primary",
        // Text Button Listed - Footer/menu variant (Design System: 14px, 6px/12px padding)
        link:
          "bg-transparent text-foreground text-sm font-normal hover:bg-tertiary hover:text-text-secondary active:text-primary",

        // ========================================
        // LEGACY VARIANTS - AVOID IN NEW CODE
        // ========================================
        // @deprecated Use variant="primary" with custom destructive styling if needed
        // Kept for backward compatibility - Will be removed in future version
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50",
        // @deprecated Use variant="quaternary" instead
        // Kept for backward compatibility - Will be removed in future version
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
      },
      size: {
        // Primary size: 12px/24px padding
        default: "py-3 px-6",
        lg: "py-3 px-6", // Alias for primary
        // Secondary/Tertiary size: 12px/16px padding
        sm: "py-3 px-4",
        // Quaternary/Text size: 6px/12px padding
        xs: "py-1.5 px-3",
        // Icon button
        icon: "size-9",

        // ========================================
        // LEGACY SIZES - REDUNDANT WITH VARIANTS
        // ========================================
        // @deprecated Redundant - variant="tertiary" already implies correct size (sm)
        // Kept for backward compatibility - Can be removed safely
        tertiary: "py-3 px-4",
        // @deprecated Redundant - variant="quaternary" already implies correct size (xs)
        // Kept for backward compatibility - Can be removed safely
        quaternary: "py-1.5 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
