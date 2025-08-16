"use client"

import type React from "react"
import { useState } from "react"
import { useParams } from "next/navigation"
import {
  ChevronRight,
  ImageIcon,
  Users,
  FileText,
  MapPin,
  Trash2,
  Bed,
  Bath,
  Car,
  TreePine,
  Utensils,
  Sofa,
  Home,
  Waves,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"

export default function ListingEditorPage() {
  const params = useParams()
  const [activeSection, setActiveSection] = useState("photo-tour")
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [currentStatus, setCurrentStatus] = useState("Listed")
  const [selectedStatus, setSelectedStatus] = useState("Listed")

  // Photo tour state (reused from photo-tour page)
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ id: string; url: string; isCover: boolean }>>([
    { id: "1", url: "/placeholder.svg?height=300&width=400", isCover: false },
    { id: "2", url: "/placeholder.svg?height=300&width=400", isCover: false },
    { id: "3", url: "/placeholder.svg?height=300&width=400", isCover: false },
    { id: "4", url: "/placeholder.svg?height=300&width=400", isCover: false },
    { id: "5", url: "/placeholder.svg?height=300&width=400", isCover: false },
    { id: "6", url: "/placeholder.svg?height=300&width=400", isCover: false },
  ])
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    "building",
    "living-room",
    "kitchen",
    "bathroom",
    "gym",
  ])
  const [featurePhotos, setFeaturePhotos] = useState<Record<string, string[]>>({
    building: ["1", "2", "3"],
    kitchen: ["3", "4", "5"],
    bathroom: ["4", "5", "6"],
    gym: ["2", "3", "4"],
  })
  const [featureCoverPhotos, setFeatureCoverPhotos] = useState<Record<string, string>>({
    building: "1",
    kitchen: "3",
    bathroom: "4",
    gym: "2",
  })
  const [featureTaglines, setFeatureTaglines] = useState<Record<string, string>>({})
  const [featureHighlights, setFeatureHighlights] = useState<Record<string, boolean>>({})
  const [tempTagline, setTempTagline] = useState("")
  const [tempHighlight, setTempHighlight] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPhotoSelector, setShowPhotoSelector] = useState<string | null>(null)
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false)
  const [tempSelectedFeatures, setTempSelectedFeatures] = useState<string[]>([])
  const [tempSelectedPhotos, setTempSelectedPhotos] = useState<string[]>([])
  const [tempCoverPhoto, setTempCoverPhoto] = useState<string>("")
  const [modalDragOver, setModalDragOver] = useState(false)

  // Location state variables
  const [locationData, setLocationData] = useState({
    address: "",
    shareExactLocation: false,
  })

  // Professionals state management
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([
    "architect",
    "interior-designer",
    "general-contractor",
  ])
  const [invitedProfessionals, setInvitedProfessionals] = useState<{
    [key: string]: { name?: string; email?: string; status: "pending" | "invited" }
  }>({
    architect: { email: "architect@example.com", status: "invited" },
    "interior-designer": { status: "pending" },
  })
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [currentInviteProfessional, setCurrentInviteProfessional] = useState<string>("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({})

  const features = [
    { id: "building", name: "Building", icon: Home },
    { id: "bedroom", name: "Bedroom", icon: Bed },
    { id: "bathroom", name: "Bathroom", icon: Bath },
    { id: "garage", name: "Garage", icon: Car },
    { id: "garden", name: "Garden", icon: TreePine },
    { id: "kitchen", name: "Kitchen", icon: Utensils },
    { id: "living-room", name: "Living room", icon: Sofa },
    { id: "office", name: "Office", icon: Home },
    { id: "pool", name: "Pool", icon: Waves },
    { id: "gym", name: "Gym", icon: Home },
  ]

  const sidebarItems = [
    { id: "photo-tour", name: "Photo tour", icon: ImageIcon },
    { id: "professionals", name: "Professionals", icon: Users },
    { id: "details", name: "Details", icon: FileText },
    { id: "location", name: "Location", icon: MapPin },
  ]

  const statusOptions = [
    {
      id: "live",
      name: "Live on page",
      description: "Upgrade to add this project to your company page",
      color: "green",
    },
    {
      id: "listed",
      name: "Listed",
      description: "You are visible on the project page",
      color: "green",
    },
    {
      id: "unlisted",
      name: "Unlisted",
      description: "You won't be visible on the project page as contributor",
      color: "gray",
    },
  ]

  // Professional Services Data
  const professionalServices = [
    {
      id: "architect",
      name: "Architect",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      id: "interior-designer",
      name: "Interior Designer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4 4 4 0 004-4V5z"
          />
        </svg>
      ),
    },
    {
      id: "general-contractor",
      name: "General contractor",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: "structural-engineer",
      name: "Structural Engineer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
    },
    {
      id: "landscape-architect",
      name: "Landscape Architect",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
    },
    {
      id: "electrician",
      name: "Electrician",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: "plumber",
      name: "Plumber",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m2 6H3m15.364 6.364l-.707-.707L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
    },
    {
      id: "hvac-specialist",
      name: "HVAC Specialist",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m2 6H3m15.364 6.364l-.707-.707L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
    },
    {
      id: "roofer",
      name: "Roofer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: "flooring-specialist",
      name: "Flooring Specialist",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
      ),
    },
    {
      id: "painter",
      name: "Painter",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      ),
    },
    {
      id: "mason",
      name: "Mason",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
  ]

  // Photo tour functions (reused from photo-tour page)
  const getFeaturePhotoCount = (featureId: string) => {
    return featurePhotos[featureId]?.length || 0
  }

  const getFeatureCoverPhoto = (featureId: string) => {
    const coverPhotoId = featureCoverPhotos[featureId]
    if (coverPhotoId) {
      const photo = uploadedPhotos.find((p) => p.id === coverPhotoId)
      return photo?.url || null
    }

    const photoIds = featurePhotos[featureId]
    if (!photoIds || photoIds.length === 0) return null
    const photo = uploadedPhotos.find((p) => p.id === photoIds[0])
    return photo?.url || null
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newPhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: e.target?.result as string,
            isCover: false,
          }
          setUploadedPhotos((prev) => [...prev, newPhoto])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleModalFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newPhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: e.target?.result as string,
            isCover: false,
          }
          setUploadedPhotos((prev) => [...prev, newPhoto])
          setTempSelectedPhotos((prev) => [...prev, newPhoto.id])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setModalDragOver(false)
    handleModalFileUpload(e.dataTransfer.files)
  }

  const handleModalDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setModalDragOver(true)
  }

  const handleModalDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setModalDragOver(false)
  }

  const togglePhotoSelection = (photoId: string) => {
    setTempSelectedPhotos((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]))
  }

  const openPhotoSelector = (featureId: string) => {
    setShowPhotoSelector(featureId)
    setTempSelectedPhotos(featurePhotos[featureId] || [])
    setTempCoverPhoto(featureCoverPhotos[featureId] || "")
    setTempTagline(featureTaglines[featureId] || "")
    setTempHighlight(featureHighlights[featureId] || false)
  }

  const saveSelectedPhotos = () => {
    if (showPhotoSelector) {
      setFeaturePhotos((prev) => ({
        ...prev,
        [showPhotoSelector]: tempSelectedPhotos,
      }))
      if (tempCoverPhoto) {
        setFeatureCoverPhotos((prev) => ({
          ...prev,
          [showPhotoSelector]: tempCoverPhoto,
        }))
      }
      setFeatureTaglines((prev) => ({
        ...prev,
        [showPhotoSelector]: tempTagline,
      }))
      setFeatureHighlights((prev) => ({
        ...prev,
        [showPhotoSelector]: tempHighlight,
      }))
    }
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
    setTempTagline("")
    setTempHighlight(false)
  }

  const cancelPhotoSelection = () => {
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
    setTempTagline("")
    setTempHighlight(false)
  }

  const deleteFeature = (featureId: string) => {
    setSelectedFeatures((prev) => prev.filter((id) => id !== featureId))
    setFeaturePhotos((prev) => {
      const newFeaturePhotos = { ...prev }
      delete newFeaturePhotos[featureId]
      return newFeaturePhotos
    })
    setFeatureCoverPhotos((prev) => {
      const newCoverPhotos = { ...prev }
      delete newCoverPhotos[featureId]
      return newCoverPhotos
    })
    setFeatureTaglines((prev) => {
      const newTaglines = { ...prev }
      delete newTaglines[featureId]
      return newTaglines
    })
    setFeatureHighlights((prev) => {
      const newHighlights = { ...prev }
      delete newHighlights[featureId]
      return newHighlights
    })
    setShowPhotoSelector(null)
  }

  const toggleTempFeature = (featureId: string) => {
    setTempSelectedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    )
  }

  const saveNewFeatures = () => {
    setSelectedFeatures((prev) => [...new Set([...prev, ...tempSelectedFeatures])])
    setShowAddFeatureModal(false)
    setTempSelectedFeatures([])
  }

  // Professional Management Functions
  const handleInviteProfessional = (professionalId: string) => {
    setCurrentInviteProfessional(professionalId)
    setInviteEmail("")
    setShowInviteModal(true)
  }

  const handleSendInvite = () => {
    if (inviteEmail.trim()) {
      setInvitedProfessionals((prev) => ({
        ...prev,
        [currentInviteProfessional]: {
          email: inviteEmail,
          status: "invited",
        },
      }))
      setShowInviteModal(false)
      setInviteEmail("")
    }
  }

  const toggleMenu = (professionalId: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [professionalId]: !prev[professionalId],
    }))
  }

  const deleteProfessional = (professionalId: string) => {
    setSelectedProfessionals((prev) => prev.filter((id) => id !== professionalId))
    setInvitedProfessionals((prev) => {
      const updated = { ...prev }
      delete updated[professionalId]
      return updated
    })
    setOpenMenus((prev) => ({
      ...prev,
      [professionalId]: false,
    }))
  }

  const cancelInvitation = (professionalId: string) => {
    setInvitedProfessionals((prev) => {
      const updated = { ...prev }
      delete updated[professionalId]
      return updated
    })
    setOpenMenus((prev) => ({
      ...prev,
      [professionalId]: false,
    }))
  }

  const toggleProfessional = (professionalId: string) => {
    setSelectedProfessionals((prev) =>
      prev.includes(professionalId) ? prev.filter((id) => id !== professionalId) : [...prev, professionalId],
    )
  }

  const handleStatusSave = () => {
    setCurrentStatus(selectedStatus)
    setShowStatusModal(false)
  }

  // Location input change handler
  const handleLocationInputChange = (field: string, value: string | boolean) => {
    setLocationData({ ...locationData, [field]: value })
  }

  // Location toggle handler
  const handleLocationToggleChange = (field: string, value: boolean) => {
    setLocationData({ ...locationData, [field]: value })
  }

  const renderPhotoTourSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900 font-medium">Photo tour</h2>
          <p className="text-gray-500 mt-1">Description</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="bg-gray-900 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            <span className="text-xl font-light">+</span>
          </button>

          {showAddMenu && (
            <div className="absolute top-12 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10 min-w-[140px]">
              <label className="block">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <span className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer block">
                  Add photos
                </span>
              </label>
              <button
                onClick={() => setShowAddFeatureModal(true)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Add feature
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {selectedFeatures.map((featureId) => {
          const feature = features.find((f) => f.id === featureId)
          if (!feature) return null

          const photoCount = getFeaturePhotoCount(featureId)
          const coverPhoto = getFeatureCoverPhoto(featureId)

          return (
            <div key={featureId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => openPhotoSelector(featureId)}
                className="w-full text-left hover:bg-gray-50 transition-colors"
              >
                <div className="aspect-square bg-gray-100 relative">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto || "/placeholder.svg"}
                      alt={feature.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-400 mb-4" />
                      <span className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer block">
                        Select photos
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-medium text-gray-900 mb-1">{feature.name}</h3>
                  <p className="text-sm text-gray-500">{photoCount > 0 ? `${photoCount} photos` : "Add photos"}</p>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Location section render function
  const renderLocationSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-gray-900 font-medium">Location</h2>
        <p className="text-gray-500 mt-1">Where is the project located?</p>
      </div>

      <div className="space-y-8">
        {/* Map Container */}
        <div className="relative">
          <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden relative">
            {/* Map placeholder with embedded Google Maps */}
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d387191.33750346623!2d-73.97968099999999!3d40.6974881!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c24fa5d33f083b%3A0xc80b8f06e177fe62!2sNew%20York%2C%20NY%2C%20USA!5e0!3m2!1sen!2sus!4v1703123456789!5m2!1sen!2sus"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0"
            />

            {/* Address search input overlay */}
            <div className="absolute top-4 left-4 right-4 z-10">
              <input
                type="text"
                value={locationData.address}
                onChange={(e) => handleLocationInputChange("address", e.target.value)}
                placeholder="Enter your address"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Search for your project location or click on the map to select it
          </p>
        </div>

        {/* Share exact location toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-1">Share the exact location of the project</h3>
            <p className="text-sm text-gray-500">Allow others to see the precise location of your project</p>
          </div>
          <button
            type="button"
            onClick={() => handleLocationToggleChange("shareExactLocation", !locationData.shareExactLocation)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
              locationData.shareExactLocation ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                locationData.shareExactLocation ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )

  // Professionals section render function
  const renderProfessionalsSection = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-gray-900 font-medium">Professionals</h2>
          <p className="text-gray-500 mt-1">Manage professionals working on this project</p>
        </div>
        <button className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Professional Services Selection */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add Professional Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {professionalServices.map((professional) => (
            <button
              key={professional.id}
              onClick={() => toggleProfessional(professional.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all duration-200 hover:shadow-md ${
                selectedProfessionals.includes(professional.id)
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="text-gray-900">{professional.icon}</div>
                <span className="font-medium text-gray-900">{professional.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Professionals */}
      {selectedProfessionals.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Project Professionals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedProfessionals.map((professionalId) => {
              const professional = professionalServices.find((p) => p.id === professionalId)
              const invitation = invitedProfessionals[professionalId]

              return (
                <div key={professionalId} className="p-6 rounded-lg border border-gray-200 bg-white relative">
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => toggleMenu(professionalId)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </button>

                    {openMenus[professionalId] && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[160px]">
                        {invitation?.status === "invited" ? (
                          <button
                            onClick={() => cancelInvitation(professionalId)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Cancel invite
                          </button>
                        ) : null}
                        <button
                          onClick={() => deleteProfessional(professionalId)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete professional
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 mb-4">
                    <div className="text-gray-900">{professional?.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{professional?.name}</span>
                        {invitation?.status === "invited" && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Invited
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {invitation?.status === "invited" ? (
                    <div className="space-y-2">
                      <div className="text-sm text-orange-600 font-medium">Will be invited</div>
                      <div className="text-sm text-gray-600">{invitation.email}</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleInviteProfessional(professionalId)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                    >
                      Invite professional
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <DashboardHeader />

      <div className="flex-1 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 p-6">
              <div className="space-y-6">
                {/* Status Selector */}
                <div>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${currentStatus === "Listed" ? "bg-green-500" : "bg-gray-400"}`}
                        />
                        <span className="font-medium text-gray-900">{currentStatus}</span>
                      </div>
                      <p className="text-sm text-red-500 mt-1">List your project</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-2">
                  {sidebarItems.map((item) => {
                    const IconComponent = item.icon
                    const isActive = activeSection === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span className="font-medium">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
              {activeSection === "photo-tour" && renderPhotoTourSection()}
              {activeSection === "professionals" && renderProfessionalsSection()}
              {activeSection === "details" && (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Details</h2>
                  <p className="text-gray-500">Details section coming soon...</p>
                </div>
              )}
              {activeSection === "location" && renderLocationSection()}
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Listing status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <img
                src="/placeholder.svg?height=60&width=60"
                alt="Villa Mel"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div>
                <h3 className="font-medium text-gray-900">Villa Mel</h3>
                <p className="text-sm text-gray-500">Modern Villa in Huizen</p>
              </div>
            </div>

            <div className="space-y-3">
              {statusOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedStatus(option.name)}
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    selectedStatus === option.name
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-2 h-2 rounded-full ${option.color === "green" ? "bg-green-500" : "bg-gray-400"}`}
                    />
                    <span className="font-medium text-gray-900">{option.name}</span>
                  </div>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowStatusModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleStatusSave} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Feature Modal */}
      {showAddFeatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Add feature</h2>
                <button
                  onClick={() => setShowAddFeatureModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {features.map((feature) => {
                  const IconComponent = feature.icon
                  const isSelected = tempSelectedFeatures.includes(feature.id)
                  const isAlreadyAdded = selectedFeatures.includes(feature.id)

                  return (
                    <button
                      key={feature.id}
                      onClick={() => !isAlreadyAdded && toggleTempFeature(feature.id)}
                      disabled={isAlreadyAdded}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isAlreadyAdded
                          ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <IconComponent className="w-6 h-6 text-gray-700 mb-2" />
                      <p className="font-medium text-gray-900 text-sm">{feature.name}</p>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddFeatureModal(false)}
                  className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNewFeatures}
                  disabled={tempSelectedFeatures.length === 0}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Selector Modal */}
      {showPhotoSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select photos for {features.find((f) => f.id === showPhotoSelector)?.name}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => deleteFeature(showPhotoSelector!)}
                    className="text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete feature
                  </button>
                  <button onClick={cancelPhotoSelection} className="text-gray-400 hover:text-gray-600 text-2xl">
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Tagline</label>
                  <input
                    type="text"
                    value={tempTagline}
                    onChange={(e) => setTempTagline(e.target.value)}
                    placeholder="Tagline"
                    maxLength={80}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">{tempTagline.length} / 80 characters</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">Highlight this feature</h3>
                    <p className="text-sm text-gray-500">
                      Features with at least one photo can be highlighted on the project page
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTempHighlight(!tempHighlight)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                      tempHighlight ? "bg-gray-900" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tempHighlight ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    modalDragOver ? "border-gray-400 bg-gray-50" : "border-gray-300"
                  }`}
                  onDrop={handleModalDrop}
                  onDragOver={handleModalDragOver}
                  onDragLeave={handleModalDragLeave}
                >
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-900 font-medium mb-1">Upload new photos</p>
                  <p className="text-gray-500 text-sm mb-4">Drag and drop or browse for photos</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleModalFileUpload(e.target.files)}
                    />
                    <span className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer">
                      Browse Files
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {uploadedPhotos.map((photo) => {
                  const isSelected = tempSelectedPhotos.includes(photo.id)
                  const isCoverPhoto = tempCoverPhoto === photo.id

                  return (
                    <div key={photo.id} className="relative">
                      <button
                        onClick={() => togglePhotoSelection(photo.id)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative w-full ${
                          isSelected
                            ? "border-gray-900 ring-2 ring-gray-900 ring-offset-2"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={photo.url || "/placeholder.svg"}
                          alt="Project photo"
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="bg-gray-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium shadow-lg">
                              ✓
                            </div>
                          </div>
                        )}
                        {isCoverPhoto && (
                          <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                            Cover
                          </div>
                        )}
                      </button>

                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setTempCoverPhoto(isCoverPhoto ? "" : photo.id)
                          }}
                          className={`absolute bottom-2 left-2 right-2 text-xs py-1 px-2 rounded font-medium transition-colors ${
                            isCoverPhoto
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {isCoverPhoto ? "Cover photo" : "Set as cover"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={cancelPhotoSelection}
                  className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSelectedPhotos}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Save Selection ({tempSelectedPhotos.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Professional Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invite Professional</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={!inviteEmail.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
