"use client"

import { useMemo, useState } from "react"
import { Award, MessageCircle, Shield, Star, X } from "lucide-react"

import type { ProfessionalRatingsBreakdown, ProfessionalReviewSummary } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const PLACEHOLDER_AVATAR = "/placeholder.svg?height=40&width=40"

type ProfessionalReviewsProps = {
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
            : "text-gray-300"
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

export function ProfessionalReviews({ professionalName, ratings, reviews, id }: ProfessionalReviewsProps) {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [reviewText, setReviewText] = useState("")
  const [overallRating, setOverallRating] = useState(0)
  const [qualityRating, setQualityRating] = useState(0)
  const [reliabilityRating, setReliabilityRating] = useState(0)
  const [communicationRating, setCommunicationRating] = useState(0)
  const [workCarriedOut, setWorkCarriedOut] = useState<boolean | null>(null)

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

  const handleSubmitReview = () => {
    // Placeholder implementation – integrate review submission once available.
    setIsReviewModalOpen(false)
    setReviewText("")
    setOverallRating(0)
    setQualityRating(0)
    setReliabilityRating(0)
    setCommunicationRating(0)
    setWorkCarriedOut(null)
  }

  return (
    <div id={id} className="w-full bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-[0]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-black text-black" />
            <span className="text-xl font-semibold">{ratingHeadline}</span>
          </div>
          <Button variant="outline" onClick={() => setIsReviewModalOpen(true)} className="px-6 py-2">
            Write a review
          </Button>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <Award className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="mb-1 font-medium text-gray-900">Quality of work</h3>
            <p className="text-2xl font-semibold">{formatRating(ratings.quality)}</p>
          </div>
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <Shield className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="mb-1 font-medium text-gray-900">Reliability</h3>
            <p className="text-2xl font-semibold">{formatRating(ratings.reliability)}</p>
          </div>
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <MessageCircle className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="mb-1 font-medium text-gray-900">Communication</h3>
            <p className="text-2xl font-semibold">{formatRating(ratings.communication)}</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          {reviews.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              Reviews will appear here once homeowners share feedback.
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={review.reviewerAvatarUrl || PLACEHOLDER_AVATAR}
                    alt={review.reviewerName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-medium text-gray-900">{review.reviewerName}</h4>
                    {typeof review.yearsOnPlatform === "number" ? (
                      <p className="text-sm text-gray-500">
                        {review.yearsOnPlatform} year{review.yearsOnPlatform === 1 ? "" : "s"} on Arco
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                  {review.createdAt ? (
                    <span className="text-sm text-gray-500">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(review.createdAt))}
                    </span>
                  ) : null}
                </div>

                {review.title ? <h5 className="text-sm font-semibold text-gray-900">{review.title}</h5> : null}

                <div>
                  <p className="text-gray-700">
                    {review.comment && review.comment.length > 160 && !expandedReviews.has(review.id)
                      ? `${review.comment.substring(0, 160)}…`
                      : review.comment}
                  </p>
                  {review.comment && review.comment.length > 160 ? (
                    <button
                      onClick={() => toggleExpanded(review.id)}
                      className="mt-1 text-sm font-medium text-gray-900 underline hover:no-underline"
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
          <Button variant="outline" className="bg-transparent px-6 py-2" disabled={reviews.length === 0}>
            Show all reviews
          </Button>
          <button className="text-sm text-gray-500 underline hover:no-underline">Learn how reviews work</button>
        </div>

        <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-lg">
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold">How was your experience with {professionalName}?</h2>
                <button onClick={() => setIsReviewModalOpen(false)} className="rounded-full p-1 hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  {renderStars(overallRating, true, setOverallRating, "red")}
                </div>
                {overallRating > 0 ? (
                  <p className="text-lg font-medium text-gray-900">{getRatingLabel(overallRating)}</p>
                ) : null}
              </div>

              <hr className="mb-6 border-gray-200" />

              <div className="mb-6">
                <h3 className="mb-3 font-medium text-gray-900">Was any work carried out?</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWorkCarriedOut(true)}
                    className={`rounded-full px-4 py-2 border ${
                      workCarriedOut === true
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setWorkCarriedOut(false)}
                    className={`rounded-full px-4 py-2 border ${
                      workCarriedOut === false
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <hr className="mb-6 border-gray-200" />

              <div className="mb-6">
                <h3 className="mb-2 font-medium text-gray-900">Rate your experience in these areas</h3>
                <p className="mb-4 text-sm text-gray-500">
                  You’ve provided an overall rating. Let them know what they did great and where they can improve.
                </p>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-gray-900">Quality of work</span>
                    </div>
                    {renderStars(qualityRating, true, setQualityRating, "red")}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-gray-900">Reliability</span>
                    </div>
                    {renderStars(reliabilityRating, true, setReliabilityRating, "red")}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-gray-900">Communication</span>
                    </div>
                    {renderStars(communicationRating, true, setCommunicationRating, "red")}
                  </div>
                </div>
              </div>

              <hr className="mb-6 border-gray-200" />

              <div className="mb-6">
                <h3 className="mb-3 font-medium text-gray-900">Tell us about your experience</h3>
                <Textarea
                  placeholder="Please share more to help understand your rating"
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  className="min-h-[120px] resize-none"
                  maxLength={500}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-400">{reviewText.length}/500</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsReviewModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={overallRating === 0 || workCarriedOut === null}
                  className="flex-1 bg-black hover:bg-gray-800"
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
