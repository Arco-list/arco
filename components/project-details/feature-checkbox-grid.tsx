"use client"

import type { LucideIcon } from "lucide-react"

type CheckboxItem = {
  value: string
  label: string
  icon: LucideIcon
}

type FeatureCheckboxGridProps = {
  title: string
  items: CheckboxItem[]
  selectedValues: string[]
  onChange: (value: string) => void
  error?: string
}

export const FeatureCheckboxGrid = ({ title, items, selectedValues, onChange, error }: FeatureCheckboxGridProps) => (
  <div>
    <label className="block text-base font-medium text-foreground mb-4">
      {title} <span className="text-red-500">*</span>
    </label>
    <div className="grid grid-cols-2 gap-4">
      {items.map((item) => {
        const IconComponent = item.icon
        const isSelected = selectedValues.includes(item.value)

        return (
          <label
            key={item.value}
            className="flex items-center space-x-3 cursor-pointer hover:bg-surface p-2 rounded-md transition-colors"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onChange(item.value)}
              className="w-4 h-4 border-border rounded focus:ring-gray-900 accent-gray-900"
            />
            <IconComponent className="w-5 h-5 text-text-secondary" />
            <span className="text-foreground">{item.label}</span>
          </label>
        )
      })}
    </div>
    {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
  </div>
)
