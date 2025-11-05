"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  listingType: "project" | "professional"
}

export function ReportModal({ isOpen, onClose, listingType }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState("")
  const [description, setDescription] = useState("")

  const reasons = [
    "Inappropriate content",
    "Spam or misleading information",
    "Copyright infringement",
    "Fake listing",
    "Offensive language or behavior",
    "Other",
  ]

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
          <DialogTitle>Report this {listingType}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Why are you reporting this {listingType}?</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {reasons.map((reason) => (
                <div key={reason} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason} id={reason} />
                  <Label htmlFor={reason} className="text-sm">
                    {reason}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2 block">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Please provide more details about your report..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="tertiary" size="tertiary" onClick={onClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedReason} className="flex-1">
              Send Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
