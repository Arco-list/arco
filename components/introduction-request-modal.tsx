"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"
import { sendIntroductionRequestAction } from "@/app/professionals/actions"

type ContactOption = {
  id: string
  labelKey: string
  template: string
}

const CONTACT_OPTIONS: ContactOption[] = [
  {
    id: "callback",
    labelKey: "option_callback",
    template: "I'd like to schedule a brief call to discuss my project. Please let me know a convenient time to connect.",
  },
  {
    id: "meeting",
    labelKey: "option_meeting",
    template: "I'd like to arrange a meeting to discuss a potential project. Could we set up a time to meet?",
  },
  {
    id: "quote",
    labelKey: "option_quote",
    template: "I'm interested in getting an estimate for a project. Could you provide a quote based on the details below?\n\n",
  },
  {
    id: "general",
    labelKey: "option_general",
    template: "",
  },
]

interface IntroductionRequestModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  companyName: string
  companyLogoUrl: string | null
  companyInitials: string
  subtitle: string | null
}

export function IntroductionRequestModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  companyLogoUrl,
  companyInitials,
  subtitle,
}: IntroductionRequestModalProps) {
  const { user, profile } = useAuth()
  const { openLoginModal } = useLoginModal()
  const t = useTranslations("introduction")
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [phone, setPhone] = useState("")
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  if (!user) {
    openLoginModal(typeof window !== "undefined" ? window.location.pathname : "/")
    onClose()
    return null
  }

  const senderName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || user.email?.split("@")[0] || ""

  const handleOptionSelect = (option: ContactOption) => {
    setSelectedOption(option.id)
    setMessage(option.template)
  }

  const handleSubmit = () => {
    if (!message.trim() || message.trim().length < 10) {
      toast.error(t("message_too_short"))
      return
    }

    const fullMessage = phone
      ? `${message.trim()}\n\nPhone: ${phone}`
      : message.trim()

    startTransition(async () => {
      const result = await sendIntroductionRequestAction({
        companyId,
        message: fullMessage,
      })
      if (result.success) {
        toast.success(t("message_sent"))
        setMessage("")
        setPhone("")
        setSelectedOption(null)
        onClose()
      } else {
        toast.error(result.error ?? t("send_failed"))
      }
    })
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, padding: 0, display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            background: "var(--arco-off-white)",
            borderRadius: "12px 12px 0 0",
            flexShrink: 0,
          }}
        >
          <h3 className="arco-section-title" style={{ margin: 0 }}>
            {t("title")}
          </h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 28px 28px" }}>

          {/* Company — matching pro-card-info style */}
          <div className="pro-card-info" style={{ marginBottom: 24 }}>
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt="" className="pro-card-logo" />
            ) : (
              <div className="pro-card-logo pro-card-logo-placeholder">
                {companyInitials}
              </div>
            )}
            <div>
              <h3 className="discover-card-title">{companyName}</h3>
              {subtitle && <p className="discover-card-sub">{subtitle}</p>}
            </div>
          </div>

          {/* Sent as */}
          <div style={{ marginBottom: 16 }}>
            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              {t("sent_as")}
            </label>
            <p style={{ fontSize: 14, color: "var(--arco-black)", margin: 0 }}>
              {senderName} ({user.email})
            </p>
          </div>

          {/* Phone (optional) */}
          <div style={{ marginBottom: 16 }}>
            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              {t("phone_label")}
            </label>
            <input
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phone_placeholder")}
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* Contact type pills */}
          <div style={{ marginBottom: 16 }}>
            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>
              {t("reason_label")}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CONTACT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleOptionSelect(option)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 400,
                    borderRadius: 20,
                    border: `1px solid ${selectedOption === option.id ? "#016D75" : "var(--arco-rule)"}`,
                    background: selectedOption === option.id ? "rgba(1,109,117,0.06)" : "var(--background)",
                    color: selectedOption === option.id ? "#016D75" : "var(--arco-black)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: 24 }}>
            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 6 }}>
              {t("message_label")}
            </label>
            <textarea
              className="form-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("message_placeholder")}
              rows={5}
              style={{ marginBottom: 0, resize: "vertical", minHeight: 120 }}
            />
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isPending || message.trim().length < 10}
            style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
          >
            {isPending ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                {t("sending")}
              </span>
            ) : (
              t("send_button")
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
