"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useTranslations } from "next-intl"

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  listingType: "project" | "professional"
}

export function ReportModal({ isOpen, onClose, listingType }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState("")
  const [description, setDescription] = useState("")
  const t = useTranslations("report")
  const tc = useTranslations("common")

  const reasonKeys = [
    "reason_inappropriate",
    "reason_spam",
    "reason_copyright",
    "reason_fake",
    "reason_offensive",
    "reason_other",
  ] as const

  const handleSubmit = () => {
    if (!selectedReason) return

    // Handle report submission here
    console.log("[v0] Report submitted:", { reason: selectedReason, description, listingType })

    // Reset form and close modal
    setSelectedReason("")
    setDescription("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{listingType === "project" ? t("title_project") : t("title_professional")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="body-small font-medium mb-3 block">
              {listingType === "project" ? t("why_reporting_project") : t("why_reporting_professional")}
            </Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {reasonKeys.map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <RadioGroupItem value={key} id={key} />
                  <Label htmlFor={key} className="body-small">
                    {t(key)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description" className="body-small font-medium mb-2 block">
              {t("additional_details")}
            </Label>
            <Textarea
              id="description"
              placeholder={t("details_placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="tertiary" size="tertiary" onClick={onClose} className="flex-1 bg-transparent">
              {tc("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedReason} className="flex-1">
              {t("send_report")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
