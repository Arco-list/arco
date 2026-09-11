"use client"

import type { LucideIcon } from "lucide-react"
import {
  UiHomeIcon,
  UiUsersIcon,
  UiMailIcon,
  UiHeartIcon,
  UiBookmarkIcon,
  UiSettingsIcon,
  UiHelpIcon,
  UiSignOutIcon,
  UiSearchIcon,
  UiCloseIcon,
  UiChevronDownIcon,
  UiShareIcon,
  UiMapPinIcon,
} from "@/lib/icons/ui-icons"

/**
 * The hand-drawn UI icon set, shown at the two sizes the interface
 * actually uses (22px in menus and cards, 16px inline) so small-size
 * legibility is judged here, not in production. Each tile names the
 * lucide icon it is meant to replace — adoption happens per surface
 * once the set is approved.
 */

const ICONS: Array<{ Icon: LucideIcon; name: string; replaces: string }> = [
  { Icon: UiHomeIcon, name: "Home", replaces: "House" },
  { Icon: UiUsersIcon, name: "Professionals", replaces: "Users" },
  { Icon: UiMailIcon, name: "Messages", replaces: "Mail" },
  { Icon: UiHeartIcon, name: "Save", replaces: "Heart" },
  { Icon: UiBookmarkIcon, name: "Saved pros", replaces: "Bookmark" },
  { Icon: UiSettingsIcon, name: "Account", replaces: "Settings" },
  { Icon: UiHelpIcon, name: "Help", replaces: "HelpCircle" },
  { Icon: UiSignOutIcon, name: "Sign out", replaces: "LogOut" },
  { Icon: UiSearchIcon, name: "Search", replaces: "Search" },
  { Icon: UiCloseIcon, name: "Close", replaces: "X" },
  { Icon: UiChevronDownIcon, name: "Chevron", replaces: "ChevronDown" },
  { Icon: UiShareIcon, name: "Share", replaces: "Share" },
  { Icon: UiMapPinIcon, name: "Location", replaces: "MapPin" },
]

export function UiIconsPreview() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 24,
      }}
    >
      {ICONS.map(({ Icon, name, replaces }) => (
        <div
          key={name}
          style={{
            border: "1px solid var(--arco-rule, #e5e5e4)",
            borderRadius: 4,
            padding: "20px 16px 14px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 14, color: "var(--arco-black, #1c1c1a)" }}>
            <Icon size={22} />
            <Icon size={16} />
          </div>
          <div className="arco-card-title" style={{ marginBottom: 2 }}>{name}</div>
          {/* Eyebrow uppercases; the lucide name is a literal, so it keeps
              the eyebrow's size and colour but its own case. */}
          <div className="arco-eyebrow" style={{ textTransform: "none" }}>lucide: {replaces}</div>
        </div>
      ))}
    </div>
  )
}
