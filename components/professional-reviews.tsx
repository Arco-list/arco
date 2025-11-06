"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Award, ChevronDown, MessageCircle, Shield, Star, X } from "lucide-react"
import { toast } from "sonner"

import type { ProfessionalRatingsBreakdown, ProfessionalReviewSummary } from "@/lib/professionals/types"
import { createReviewAction } from "@/app/professionals/[slug]/actions"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const PLACEHOLDER_AVATAR = "/placeholder.svg?height=40&width=40"

type ProfessionalReviewsProps = {
  companyId: string
  professionalName: string
  ratings: ProfessionalRatingsBreakdown
  reviews: ProfessionalReviewSummary[]
  id?: string
}

const formatRating = (value: number) => Number.isFinite(value) ? value.toFixed(2) : "0.00"

const renderStars = (
  rating: number,
  interactive = false,
  onRatingChange?: (rating: number) => void,
  color = "black",
) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`h-5 w-5 ${
          star <= rating
            ? color === "red"
              ? "fill-red-500 text-red-500"
              : "fill-black text-black"
            : "text-border"
        } ${interactive ? "cursor-pointer hover:text-red-500" : ""}`}
        onClick={interactive && onRatingChange ? () => onRatingChange(star) : undefined}
      />
    ))}
  </div>
)

const getRatingLabel = (rating: number) => {
  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"]
  return labels[rating] || ""
}

export function ProfessionalReviews({ companyId, professionalName, ratings, reviews, id }: ProfessionalReviewsProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [reviewText, setReviewText] = useState("")
  const [overallRating, setOverallRating] = useState(0)
  const [qualityRating, setQualityRating] = useState(0)
  const [reliabilityRating, setReliabilityRating] = useState(0)
  const [communicationRating, setCommunicationRating] = useState(0)
  const [workCarriedOut, setWorkCarriedOut] = useState<boolean | null>(null)
  const [isSubmitting, startTransition] = useTransition()
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">("recent")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { ensureAuth, isAuthenticated } = useRequireAuth()

  const toggleExpanded = (reviewId: string) => {
    const next = new Set(expandedReviews)
    if (next.has(reviewId)) {
      next.delete(reviewId)
    } else {
      next.add(reviewId)
    }
    setExpandedReviews(next)
  }

  const ratingHeadline = useMemo(() => {
    const reviewCount = ratings.total
    if (!reviewCount || reviewCount <= 0) {
      return "No reviews yet"
    }

    return `${formatRating(ratings.overall)} · ${reviewCount} review${reviewCount === 1 ? "" : "s"}`
  }, [ratings.overall, ratings.total])

  const sortedReviews = useMemo(() => {
    const sorted = [...reviews]
    switch (sortBy) {
      case "highest":
        return sorted.sort((a, b) => b.rating - a.rating)
      case "lowest":
        return sorted.sort((a, b) => a.rating - b.rating)
      case "recent":
      default:
        // Already sorted by date from the query
        return sorted
    }
  }, [reviews, sortBy])

  useEffect(() => {
    const intent = searchParams?.get("intent")

    if (intent !== "write-review") {
      return
    }

    if (!isAuthenticated) {
      return
    }

    setIsReviewModalOpen(true)

    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("intent")
    const next = params.toString()
    const url = `${pathname}${next ? `?${next}` : ""}`
    router.replace(url, { scroll: false })
  }, [isAuthenticated, pathname, router, searchParams])

  const handleOpenReviewModal = () => {
    if (!isAuthenticated) {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("intent", "write-review")
      const next = params.toString()
      const url = `${pathname}${next ? `?${next}` : ""}`
      router.replace(url, { scroll: false })
    }

    if (!ensureAuth()) {
      return
    }

    setIsReviewModalOpen(true)
  }

  const handleSubmitReview = () => {
    if (!ensureAuth()) {
      return
    }

    if (workCarriedOut === null) {
      toast.error("Review incomplete", {
        description: "Let us know if any work was carried out.",
      })
      return
    }

    const payload = {
      companyId,
      overallRating,
      qualityRating: qualityRating > 0 ? qualityRating : null,
      reliabilityRating: reliabilityRating > 0 ? reliabilityRating : null,
      communicationRating: communicationRating > 0 ? communicationRating : null,
      workCarriedOut,
      comment: reviewText.trim().length > 0 ? reviewText.trim() : undefined,
    }

    startTransition(async () => {
      const result = await createReviewAction(payload)

      if (!result.success) {
        toast.error("Unable to submit review", {
          description: result.error,
        })
        return
      }

      toast.success("Review submitted", {
        description: "Thanks for the feedback! We'll publish it once it's approved.",
      })

      setIsReviewModalOpen(false)
      setReviewText("")
      setOverallRating(0)
      setQualityRating(0)
      setReliabilityRating(0)
      setCommunicationRating(0)
      setWorkCarriedOut(null)
      setExpandedReviews(new Set())
      router.refresh()
    })
  }

  return (
    <div id={id} className="w-full bg-white py-8 px-4 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-black">
            <Star className="h-5 w-5 fill-black text-black inline-block mr-2 -mt-1" />
            {ratingHeadline}
          </h2>
          <div className="flex items-center gap-3">
            {reviews.length > 0 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-foreground"
                  onClick={() => setIsSortDropdownOpen((open) => !open)}
                >
                  Sort: {sortBy === "recent" ? "Most recent" : sortBy === "highest" ? "Highest rated" : "Lowest rated"}
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {isSortDropdownOpen && (
                  <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-border bg-white shadow-lg">
                    <div className="py-1">
                      <button
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface"
                        onClick={() => {
                          setSortBy("recent")
                          setIsSortDropdownOpen(false)
                        }}
                      >
                        Most recent
                      </button>
                      <button
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface"
                        onClick={() => {
                          setSortBy("highest")
                          setIsSortDropdownOpen(false)
                        }}
                      >
                        Highest rated
                      </button>
                      <button
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface"
                        onClick={() => {
                          setSortBy("lowest")
                          setIsSortDropdownOpen(false)
                        }}
                      >
                        Lowest rated
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button
              variant="tertiary"
              size="tertiary"
              onClick={handleOpenReviewModal}
            >
              Write a review
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-text-secondary" />
            <span className="text-sm text-text-secondary">Quality of work</span>
            <span className="text-sm font-semibold text-foreground">{formatRating(ratings.quality)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-text-secondary" />
            <span className="text-sm text-text-secondary">Reliability</span>
            <span className="text-sm font-semibold text-foreground">{formatRating(ratings.reliability)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-text-secondary" />
            <span className="text-sm text-text-secondary">Communication</span>
            <span className="text-sm font-semibold text-foreground">{formatRating(ratings.communication)}</span>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          {sortedReviews.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-secondary">
              Reviews will appear here once homeowners share feedback.
            </div>
          ) : (
            sortedReviews.map((review) => (
              <div key={review.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={review.reviewerAvatarUrl || PLACEHOLDER_AVATAR}
                    alt={review.reviewerName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="text-sm font-medium leading-[1.2] tracking-[0] text-foreground">{review.reviewerName}</h4>
                    {typeof review.yearsOnPlatform === "number" && review.yearsOnPlatform > 0 ? (
                      <p className="text-sm text-text-secondary">
                        {review.yearsOnPlatform} year{review.yearsOnPlatform === 1 ? "" : "s"} on Arco
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                  {review.createdAt ? (
                    <span className="text-sm text-text-secondary">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(review.createdAt))}
                    </span>
                  ) : null}
                </div>

                {review.title ? <h5 className="text-sm font-semibold text-foreground">{review.title}</h5> : null}

                <div>
                  <p className="text-foreground">
                    {review.comment && review.comment.length > 160 && !expandedReviews.has(review.id)
                      ? `${review.comment.substring(0, 160)}…`
                      : review.comment}
                  </p>
                  {review.comment && review.comment.length > 160 ? (
                    <button
                      onClick={() => toggleExpanded(review.id)}
                      className="mt-1 text-sm font-medium text-foreground underline hover:no-underline"
                    >
                      {expandedReviews.has(review.id) ? "Show less" : "Show more"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="tertiary"
            size="tertiary"
            disabled={sortedReviews.length === 0}
          >
            Show all reviews
          </Button>
          <button className="text-sm text-text-secondary underline hover:no-underline">Learn how reviews work</button>
        </div>

        <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">How was your experience with {professionalName}?</h2>
                <button onClick={() => setIsReviewModalOpen(false)} className="rounded-full p-1 hover:bg-surface">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  {renderStars(overallRating, true, setOverallRating, "red")}
                </div>
                {overallRating > 0 ? (
                  <p className="text-lg font-medium text-foreground">{getRatingLabel(overallRating)}</p>
                ) : null}
              </div>

              <hr className="mb-6 border-border" />

              <div className="mb-6">
                <h3 className="mb-3 font-medium text-foreground">Was any work carried out?</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWorkCarriedOut(true)}
                    className={`rounded-full px-4 py-2 border ${
                      workCarriedOut === true
                        ? "border-black bg-black text-white"
                        : "border-border bg-white text-foreground hover:border-foreground"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setWorkCarriedOut(false)}
                    className={`rounded-full px-4 py-2 border ${
                      workCarriedOut === false
                        ? "border-black bg-black text-white"
                        : "border-border bg-white text-foreground hover:border-foreground"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <hr className="mb-6 border-border" />

              <div className="mb-6">
                <h3 className="mb-2 font-medium text-foreground">Rate your experience in these areas</h3>
                <p className="mb-4 text-sm text-text-secondary">
                  You’ve provided an overall rating. Let them know what they did great and where they can improve.
                </p>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-foreground">Quality of work</span>
                    </div>
                    {renderStars(qualityRating, true, setQualityRating, "red")}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-foreground">Reliability</span>
                    </div>
                    {renderStars(reliabilityRating, true, setReliabilityRating, "red")}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-foreground">Communication</span>
                    </div>
                    {renderStars(communicationRating, true, setCommunicationRating, "red")}
                  </div>
                </div>
              </div>

              <hr className="mb-6 border-border" />

              <div className="mb-6">
                <h3 className="mb-3 font-medium text-foreground">Tell us about your experience</h3>
                <Textarea
                  placeholder="Please share more to help understand your rating"
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  className="min-h-[120px] resize-none"
                  maxLength={500}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{reviewText.length}/500</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="quaternary" size="quaternary" onClick={() => setIsReviewModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting || overallRating === 0 || workCarriedOut === null}
                  variant="secondary"
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
