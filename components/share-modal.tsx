"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Copy, ExternalLink, Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react"
import { toast } from "sonner"
import { sanitizeImageUrl } from "@/lib/image-security"
import { useTranslations } from "next-intl"
import { trackProjectShared, trackProfessionalShared } from "@/lib/tracking"

/**
 * Tag the shared URL with utm_source=share + utm_medium=<channel>
 * so PostHog can attribute the recipient's pageview back to a share
 * (regardless of which messenger / mail client delivered it).
 *
 * Without this, share-driven visits get bucketed by the recipient's
 * arrival channel — WhatsApp's mobile webview reads as Direct, Gmail
 * web reads as Email, an Apple Mail link reads as Direct again —
 * making it impossible to measure shares as a growth loop. The cache
 * key `client_visitors_share` reads $current_url for these UTMs.
 *
 * Preserves any existing query params on the URL.
 */
function withShareUtm(url: string, channel: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set("utm_source", "share")
    u.searchParams.set("utm_medium", channel)
    return u.toString()
  } catch {
    // Malformed URL — fall back to the original so sharing doesn't break.
    return url
  }
}

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  imageUrl: string
  shareUrl: string
  shareType?: "project" | "professional"
}

export function ShareModal({ isOpen, onClose, title, subtitle, imageUrl, shareUrl, shareType = "project" }: ShareModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const t = useTranslations("share")

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
    const taggedUrl = withShareUtm(resolvedShareUrl, "link")
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(taggedUrl)
      } else {
        if (typeof document === "undefined") {
          throw new Error("Clipboard API unavailable")
        }

        const textarea = document.createElement("textarea")
        textarea.value = taggedUrl
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setCopiedKey("link")
      trackShare("link")
      toast.success(t("link_copied"))
      setTimeout(() => {
        setCopiedKey((previous) => (previous === "link" ? null : previous))
      }, 2000)
    } catch (error) {
      toast.error(t("copy_failed"))
    }
  }

  const slug = resolvedShareUrl.split("/").pop() ?? ""
  const trackShare = (channel: string) => {
    if (shareType === "professional") {
      trackProfessionalShared(slug, channel)
    } else {
      trackProjectShared(slug, channel)
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
        url: withShareUtm(resolvedShareUrl, "system"),
      })
      trackShare("system")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      toast.error(t("share_failed"))
    }
  }

  const handleEmailShare = () => {
    const taggedUrl = withShareUtm(resolvedShareUrl, "email")
    const subject = encodeURIComponent(`Check out: ${title}`)
    const body = encodeURIComponent(`I thought you might be interested in this:\n${taggedUrl}`)
    trackShare("email")
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleWhatsAppShare = () => {
    const taggedUrl = withShareUtm(resolvedShareUrl, "whatsapp")
    const text = encodeURIComponent(`Check out: ${title}\n${taggedUrl}`)
    trackShare("whatsapp")
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  const handleMessengerShare = () => {
    const url = encodeURIComponent(withShareUtm(resolvedShareUrl, "messenger"))
    trackShare("messenger")
    window.open(`https://www.messenger.com/new?link=${url}`, "_blank", "noopener,noreferrer")
  }

  const handleFacebookShare = () => {
    const url = encodeURIComponent(withShareUtm(resolvedShareUrl, "facebook"))
    trackShare("facebook")
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer")
  }

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`Check out: ${title}`)
    const url = encodeURIComponent(withShareUtm(resolvedShareUrl, "x"))
    trackShare("x")
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer")
  }

  const displaySubtitle = subtitle?.trim() ? subtitle.trim() : ""

  const shareActions = [
    { key: "copy", label: copiedKey === "link" ? t("copied") : t("copy_link"), icon: Copy, onClick: handleCopy },
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
          <h3 className="arco-section-title">{t("title")}</h3>
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
          {t("share_button")}
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
