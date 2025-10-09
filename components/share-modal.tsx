"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Copy, Mail, MessageCircle, MessageSquare, Share2, Share } from "lucide-react"
import { toast } from "sonner"

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

  const handleCopy = async (text: string, key: string, successMessage: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        if (typeof document === "undefined") {
          throw new Error("Clipboard API unavailable")
        }

        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setCopiedKey(key)
      toast.success(successMessage)
      setTimeout(() => {
        setCopiedKey((previous) => (previous === key ? null : previous))
      }, 2000)
    } catch (error) {
      toast.error("Unable to copy to clipboard")
    }
  }

  const handleCopyLink = async () => {
    await handleCopy(resolvedShareUrl, "link", "Link copied to clipboard")
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Check out: ${title}`)
    const body = encodeURIComponent(`I thought you might be interested in this project:\n${resolvedShareUrl}`)
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

  const handleSystemShare = async () => {
    if (!navigator?.share) {
      await handleCopyLink()
      return
    }

    try {
      const shareText = displaySubtitle || title
      await navigator.share({
        title,
        text: shareText,
        url: resolvedShareUrl,
      })
      toast.success("Share sheet opened")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      toast.error("Unable to share from this device")
    }
  }

  const shareOptions = [
    {
      key: "copy",
      label: "Copy link",
      icon: Copy,
      onClick: handleCopyLink,
      status: copiedKey === "link" ? "Copied" : null,
    },
    {
      key: "email",
      label: "E-mail",
      icon: Mail,
      onClick: handleEmailShare,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageSquare,
      onClick: handleWhatsAppShare,
    },
    {
      key: "messenger",
      label: "Messenger",
      icon: MessageCircle,
      onClick: handleMessengerShare,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: Share2,
      onClick: handleFacebookShare,
    },
    {
      key: "twitter",
      label: "X (Twitter)",
      icon: Share2,
      onClick: handleTwitterShare,
    },
  ] as const

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg font-semibold flex items-center justify-between gap-4">
            <span>Share this project</span>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close share dialog">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Quickly share this project with clients or collaborators.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3 mb-6">
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={title}
            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-gray-900 line-clamp-2">{title}</span>
            {displaySubtitle ? <span className="text-xs text-gray-600 line-clamp-2">{displaySubtitle}</span> : null}
          </div>
        </div>

        <Button variant="secondary" className="mb-4 flex w-full items-center justify-center gap-2" onClick={handleSystemShare}>
          <Share className="h-4 w-4" />
          Share with...
        </Button>

        {/* Share options grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shareOptions.map(({ key, label, icon: Icon, onClick, status }) => (
            <Button
              key={key}
              variant="outline"
              className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
              onClick={onClick}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
              {status ? <span className="text-xs text-green-600">{status}</span> : null}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
