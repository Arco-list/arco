"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Copy, Mail, MessageCircle, Share2 } from "lucide-react"
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
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy link")
    }
  }

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Check out: ${title}`)
    const body = encodeURIComponent(`I thought you might be interested in this: ${shareUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Check out: ${title} - ${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`)
  }

  const handleMessengerShare = () => {
    const url = encodeURIComponent(shareUrl)
    window.open(`https://www.messenger.com/new?link=${url}`)
  }

  const handleFacebookShare = () => {
    const url = encodeURIComponent(shareUrl)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`)
  }

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`Check out: ${title}`)
    const url = encodeURIComponent(shareUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`)
  }

  const handleEmbedShare = () => {
    const embedCode = `<iframe src="${shareUrl}" width="600" height="400"></iframe>`
    navigator.clipboard.writeText(embedCode)
    toast.success("Embed code copied to clipboard")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Share this project</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Project preview */}
        <div className="flex gap-3 mb-6">
          <img src={imageUrl || "/placeholder.svg"} alt={title} className="w-16 h-16 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm mb-1">Name</h3>
            <p className="text-sm text-gray-600 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Share options grid */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4" />
            <span className="text-sm">Copy link</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleEmailShare}
          >
            <Mail className="h-4 w-4" />
            <span className="text-sm">E-mail</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleMessengerShare}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">Berichten</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleWhatsAppShare}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">WhatsApp</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleMessengerShare}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">Messenger</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleFacebookShare}
          >
            <Share2 className="h-4 w-4" />
            <span className="text-sm">Facebook</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleTwitterShare}
          >
            <Share2 className="h-4 w-4" />
            <span className="text-sm">Twitter</span>
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-start gap-3 h-12 px-4 bg-transparent"
            onClick={handleEmbedShare}
          >
            <Share2 className="h-4 w-4" />
            <span className="text-sm">Invoegen</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
