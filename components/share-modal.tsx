"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Copy, ExternalLink, Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react"
import { toast } from "sonner"
import { sanitizeImageUrl } from "@/lib/image-security"

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  imageUrl: string
  shareUrl: string
}

export function ShareModal({ isOpen, onClose, title, subtitle, imageUrl, shareUrl }: ShareModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const resolvedShareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return shareUrl
    }

    if (!shareUrl) {
      return window.location.href
    }

    try {
      const url = new URL(shareUrl, window.location.origin)
      return url.toString()
    } catch (error) {
      return window.location.href
    }
  }, [shareUrl])

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(resolvedShareUrl)
      } else {
        if (typeof document === "undefined") {
          throw new Error("Clipboard API unavailable")
        }

        const textarea = document.createElement("textarea")
        textarea.value = resolvedShareUrl
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setCopiedKey("link")
      toast.success("Link copied to clipboard")
      setTimeout(() => {
        setCopiedKey((previous) => (previous === "link" ? null : previous))
      }, 2000)
    } catch (error) {
      toast.error("Unable to copy to clipboard")
    }
  }

  const handleSystemShare = async () => {
    if (!navigator?.share) {
      await handleCopy()
      return
    }

    try {
      await navigator.share({
        title,
        text: subtitle || title,
        url: resolvedShareUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      toast.error("Unable to share from this device")
    }
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Check out: ${title}`)
    const body = encodeURIComponent(`I thought you might be interested in this:\n${resolvedShareUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Check out: ${title}\n${resolvedShareUrl}`)
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  const handleMessengerShare = () => {
    const url = encodeURIComponent(resolvedShareUrl)
    window.open(`https://www.messenger.com/new?link=${url}`, "_blank", "noopener,noreferrer")
  }

  const handleFacebookShare = () => {
    const url = encodeURIComponent(resolvedShareUrl)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer")
  }

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`Check out: ${title}`)
    const url = encodeURIComponent(resolvedShareUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer")
  }

  const displaySubtitle = subtitle?.trim() ? subtitle.trim() : ""

  const shareActions = [
    { key: "copy", label: copiedKey === "link" ? "Copied!" : "Copy link", icon: Copy, onClick: handleCopy },
    { key: "email", label: "E-mail", icon: Mail, onClick: handleEmailShare },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, onClick: handleWhatsAppShare },
    { key: "messenger", label: "Messenger", icon: MessageCircle, onClick: handleMessengerShare },
    { key: "facebook", label: "Facebook", icon: Share2, onClick: handleFacebookShare },
    { key: "twitter", label: "X", icon: ExternalLink, onClick: handleTwitterShare },
  ] as const

  if (!isOpen) return null

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">Share</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Project preview card — discover card style */}
        <div style={{ marginBottom: 24 }}>
          <div className="discover-card-image-wrap" style={{ borderRadius: 5, marginBottom: 10 }}>
            <div className="discover-card-image-layer">
              <Image
                src={sanitizeImageUrl(imageUrl, "/placeholder.svg")}
                alt={title}
                width={600}
                height={450}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
          <h4 className="discover-card-title">{title}</h4>
          {displaySubtitle ? <p className="discover-card-sub">{displaySubtitle}</p> : null}
        </div>

        {/* Native share — primary action */}
        <button type="button" className="btn-secondary" onClick={handleSystemShare} style={{ width: "100%", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ExternalLink style={{ width: 16, height: 16 }} />
          Share
        </button>

        {/* Share options — pill buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {shareActions.map(({ key, label, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              className="filter-pill"
              onClick={onClick}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
