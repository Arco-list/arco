"use client"

import { useState, useCallback } from "react"

interface LinkInputRowProps {
  placeholder: string
  buttonLabel: string
  caption?: string
  onSubmit: (url: string) => void
}

function LinkIcon() {
  return (
    <svg
      className="link-input-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6.5 9.5l3-3" />
      <path d="M9 10.5l1.5-1.5a2.83 2.83 0 0 0-4-4L5 6.5" />
      <path d="M7 5.5L5.5 7a2.83 2.83 0 0 0 4 4L11 9.5" />
    </svg>
  )
}

export function LinkInputRow({
  placeholder,
  buttonLabel,
  caption,
  onSubmit,
}: LinkInputRowProps) {
  const [url, setUrl] = useState("")
  const [hasError, setHasError] = useState(false)

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim()
    if (!trimmed) {
      setHasError(true)
      setTimeout(() => setHasError(false), 1500)
      return
    }
    onSubmit(trimmed)
  }, [url, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit()
    },
    [handleSubmit]
  )

  return (
    <>
      <div className={`link-input-row${hasError ? " error" : ""}`}>
        <div className="link-input-wrapper">
          <LinkIcon />
          <input
            type="url"
            className="link-input"
            placeholder={placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button className="link-input-submit" onClick={handleSubmit}>
          {buttonLabel}
        </button>
      </div>
      {caption && <p className="link-input-caption">{caption}</p>}
    </>
  )
}
