"use client"

import { useState, useTransition } from "react"
import { Check, X, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { updateProjectSeoAction, generateProjectSlugAction } from "@/app/admin/projects/actions"

interface EditableSeoCellProps {
  projectId: string
  projectTitle: string
  field: 'slug' | 'seoTitle' | 'seoDescription'
  value: string | null
  onUpdate: () => void
}

export function EditableSeoCell({ projectId, projectTitle, field, value, onUpdate }: EditableSeoCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isPending, startTransition] = useTransition()

  const handleEdit = () => {
    setEditValue(value || '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setIsEditing(false)
  }

  const handleSave = () => {
    const trimmedValue = editValue.trim()
    
    startTransition(async () => {
      const updateData: Record<string, string> = {}
      updateData[field] = trimmedValue

      const result = await updateProjectSeoAction({
        projectId,
        ...updateData
      })

      if (!result.success) {
        toast.error("Failed to update", { 
          description: result.error.message 
        })
        return
      }

      if (result.warnings?.length) {
        result.warnings.forEach(warning => toast.warning(warning))
      }
      toast.success(`${field === 'slug' ? 'Slug' : field === 'seoTitle' ? 'SEO title' : 'SEO description'} updated`)
      setIsEditing(false)
      onUpdate()
    })
  }

  const handleGenerateSlug = () => {
    if (field !== 'slug') return

    startTransition(async () => {
      const result = await generateProjectSlugAction({
        projectId,
        title: projectTitle
      })

      if (!result.success) {
        toast.error("Failed to generate slug", { 
          description: result.error.message 
        })
        return
      }

      setEditValue(result.data?.slug || '')
      toast.success("Slug generated from title")
    })
  }

  const displayValue = value || ''
  const hasValue = Boolean(displayValue)

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {field === 'seoDescription' ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-sm"
              rows={3}
              disabled={isPending}
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-sm"
              disabled={isPending}
            />
          )}
          {field === 'slug' && (
            <Button
                            variant="quaternary" size="quaternary"
              onClick={handleGenerateSlug}
              disabled={isPending}
              className="shrink-0"
            >
              <Wand2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="h-7 px-2"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
                        variant="quaternary" size="quaternary"
            onClick={handleCancel}
            disabled={isPending}
            className="h-7 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {field === 'seoTitle' && (
          <div className="text-xs text-muted-foreground">
            {editValue.length}/60 characters (optimal: 30-60)
          </div>
        )}
        {field === 'seoDescription' && (
          <div className="text-xs text-muted-foreground">
            {editValue.length}/160 characters (optimal: 120-160)
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors min-h-[2rem]",
        !hasValue && "text-muted-foreground italic",
        field === 'seoDescription' && "min-h-[3rem]"
      )}
      onClick={handleEdit}
    >
      {hasValue ? (
        <span className={cn(
          "text-sm block",
          field === 'seoDescription' && "line-clamp-2 break-words"
        )}>
          {displayValue}
        </span>
      ) : (
        <span className="text-sm block">
          {field === 'slug' && 'Click to add slug'}
          {field === 'seoTitle' && 'Click to add meta title'}
          {field === 'seoDescription' && 'Click to add meta description'}
        </span>
      )}
    </div>
  )
}