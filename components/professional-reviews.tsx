"use client"

import { useState } from "react"
import { Star, Award, Shield, MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Review {
  id: string
  name: string
  avatar: string
  yearsOnPlatform: number
  rating: number
  date: string
  text: string
  isExpanded?: boolean
}

const reviews: Review[] = [
  {
    id: "1",
    name: "René",
    avatar: "/placeholder.svg?height=40&width=40",
    yearsOnPlatform: 8,
    rating: 5,
    date: "3 weeks ago",
    text: "Perfect stay",
  },
  {
    id: "2",
    name: "Mathias",
    avatar: "/placeholder.svg?height=40&width=40",
    yearsOnPlatform: 9,
    rating: 5,
    date: "March 2025",
    text: "Had a lovely weekend at Stian's cabin. All amenities in place and throughout a high standard. Only a few meters walk away to groomed cross country tracks (could probably be excited...",
  },
  {
    id: "3",
    name: "Erik",
    avatar: "/placeholder.svg?height=40&width=40",
    yearsOnPlatform: 8,
    rating: 5,
    date: "March 2025",
    text: "Fantastic great cabin. We were 8 adults and 6 children who had a lovely weekend on the slopes. Ski in, ski out suited us perfectly.",
  },
  {
    id: "4",
    name: "Øivind",
    avatar: "/placeholder.svg?height=40&width=40",
    yearsOnPlatform: 11,
    rating: 5,
    date: "February 2025",
    text: "Great cabin, big and spacious and good kitchen facilities",
  },
  {
    id: "5",
    name: "Astrid",
    avatar: "/placeholder.svg?height=40&width=40",
    yearsOnPlatform: 7,
    rating: 5,
    date: "December 2024",
    text: "The cabin was exceptionally beautiful, spacious, well outfitted, and well appointed. It was very comfortable and we felt right at home. A Christmas tree had been put up and we...",
  },
  {
    id: "6",
    name: "Kurt",
    avatar: "/placeholder.svg?height=40&width=40",
    yearsOnPlatform: 9,
    rating: 5,
    date: "October 2024",
    text: "Great place and location. About a 10 minute drive from the local town. Straight out on to the trail within minutes. Accommodation was very clean and user friendly.",
  },
]

export function ProfessionalReviews() {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [reviewText, setReviewText] = useState("")
  const [overallRating, setOverallRating] = useState(0)
  const [qualityRating, setQualityRating] = useState(0)
  const [reliabilityRating, setReliabilityRating] = useState(0)
  const [communicationRating, setCommunicationRating] = useState(0)
  const [workCarriedOut, setWorkCarriedOut] = useState<boolean | null>(null)

  const toggleExpanded = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews)
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId)
    } else {
      newExpanded.add(reviewId)
    }
    setExpandedReviews(newExpanded)
  }

  const handleSubmitReview = () => {
    console.log("Review submitted:", {
      overallRating,
      qualityRating,
      reliabilityRating,
      communicationRating,
      workCarriedOut,
      text: reviewText,
    })
    setIsReviewModalOpen(false)
    setReviewText("")
    setOverallRating(0)
    setQualityRating(0)
    setReliabilityRating(0)
    setCommunicationRating(0)
    setWorkCarriedOut(null)
  }

  const renderStars = (
    rating: number,
    interactive = false,
    onRatingChange?: (rating: number) => void,
    color = "black",
  ) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
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
  }

  const getRatingLabel = (rating: number) => {
    const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"]
    return labels[rating] || ""
  }

  return (
    <div className="w-full bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-[0]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-black text-black" />
            <span className="text-xl font-semibold">4.92 · 24 reviews</span>
          </div>
          <Button variant="outline" onClick={() => setIsReviewModalOpen(true)} className="px-6 py-2">
            Write a review
          </Button>
        </div>

        {/* Rating Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Award className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Quality of work</h3>
            <p className="text-2xl font-semibold">4.9</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Shield className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Reliability</h3>
            <p className="text-2xl font-semibold">4.6</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <MessageCircle className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Communication</h3>
            <p className="text-2xl font-semibold">4.6</p>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={review.avatar || "/placeholder.svg"}
                  alt={review.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h4 className="font-medium text-gray-900">{review.name}</h4>
                  <p className="text-sm text-gray-500">{review.yearsOnPlatform} years on Arco</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {renderStars(review.rating)}
                <span className="text-sm text-gray-500">{review.date}</span>
              </div>

              <div>
                <p className="text-gray-700">
                  {expandedReviews.has(review.id) || review.text.length <= 100
                    ? review.text
                    : `${review.text.substring(0, 100)}...`}
                </p>
                {review.text.length > 100 && (
                  <button
                    onClick={() => toggleExpanded(review.id)}
                    className="text-sm font-medium text-gray-900 underline mt-1 hover:no-underline"
                  >
                    {expandedReviews.has(review.id) ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center gap-4">
          <Button variant="outline" className="px-6 py-2 bg-transparent">
            Show all 23 reviews
          </Button>
          <button className="text-sm text-gray-500 underline hover:no-underline">Learn how reviews work</button>
        </div>

        {/* Review Modal */}
        <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">How was your experience with Marco van Veldhuizen?</h2>
                <button onClick={() => setIsReviewModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Professional Info */}
              <div className="flex items-center gap-3 mb-6">
                <img
                  src="/placeholder.svg?height=48&width=48"
                  alt="Niek van Leeuwen"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-medium text-gray-900">Niek van Leeuwen</h3>
                  <p className="text-sm text-gray-500">posting publicly on Arco</p>
                </div>
              </div>

              {/* Overall Rating */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  {renderStars(overallRating, true, setOverallRating, "red")}
                </div>
                {overallRating > 0 && (
                  <p className="text-lg font-medium text-gray-900">{getRatingLabel(overallRating)}</p>
                )}
              </div>

              <hr className="border-gray-200 mb-6" />

              {/* Work Carried Out */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Was any work carried out?</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWorkCarriedOut(true)}
                    className={`px-4 py-2 rounded-full border ${
                      workCarriedOut === true
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setWorkCarriedOut(false)}
                    className={`px-4 py-2 rounded-full border ${
                      workCarriedOut === false
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <hr className="border-gray-200 mb-6" />

              {/* Category Ratings */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Rate your experience in these areas</h3>
                <p className="text-sm text-gray-500 mb-4">
                  You've provided an overall rating. Let them know what they did great and where they can improve.
                </p>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Quality of work</span>
                    </div>
                    {renderStars(qualityRating, true, setQualityRating, "red")}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Reliability</span>
                    </div>
                    {renderStars(reliabilityRating, true, setReliabilityRating, "red")}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">Communication</span>
                    </div>
                    {renderStars(communicationRating, true, setCommunicationRating, "red")}
                  </div>
                </div>
              </div>

              <hr className="border-gray-200 mb-6" />

              {/* Written Review */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Tell us about your experience</h3>
                <Textarea
                  placeholder="Please share more to help understand your rating"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="min-h-[120px] resize-none"
                  maxLength={500}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-400">{reviewText.length}/500</span>
                </div>
              </div>

              {/* Action Buttons */}
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
