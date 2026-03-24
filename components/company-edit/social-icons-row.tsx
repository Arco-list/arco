"use client"

import { useState, useRef, useEffect } from "react"

type Platform = "facebook" | "instagram" | "linkedin" | "pinterest"

interface SocialIconsRowProps {
  socialLinks: Record<Platform, string>
  onSave: (platform: Platform, url: string) => Promise<void>
}

const PLATFORMS: { key: Platform; label: string; icon: JSX.Element }[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    ),
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
  },
  {
    key: "pinterest",
    label: "Pinterest",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="17" y2="22" />
        <path d="M5 12V8a7 7 0 0 1 14 0v4a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5Z" />
      </svg>
    ),
  },
]

export function SocialIconsRow({ socialLinks, onSave }: SocialIconsRowProps) {
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null)
  const [editUrl, setEditUrl] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingPlatform && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editingPlatform])

  const handleIconClick = (platform: Platform) => {
    if (editingPlatform === platform) {
      setEditingPlatform(null)
      return
    }
    setEditUrl(socialLinks[platform] || "")
    setEditingPlatform(platform)
  }

  const handleSave = async () => {
    if (!editingPlatform) return
    const url = editUrl.trim()
    await onSave(editingPlatform, url)
    setEditingPlatform(null)
    setEditUrl("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      setEditingPlatform(null)
    }
  }

  return (
    <div className="social-icons-container">
      <div className="social-icons-row">
        {PLATFORMS.map(({ key, label, icon }) => {
          const hasUrl = Boolean(socialLinks[key])
          const isEditing = editingPlatform === key

          return (
            <button
              key={key}
              className={`social-icon-btn${hasUrl ? " active" : " inactive"}${isEditing ? " editing" : ""}`}
              onClick={() => handleIconClick(key)}
              title={hasUrl ? `${label}: ${socialLinks[key]}` : `Add ${label}`}
              type="button"
            >
              {icon}
            </button>
          )
        })}
      </div>

      {editingPlatform && (
        <div className="social-edit-input-wrap">
          <input
            ref={inputRef}
            type="url"
            className="social-edit-input"
            placeholder={`https://${editingPlatform}.com/...`}
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
    </div>
  )
}
