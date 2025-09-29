"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { MoreHorizontal, X, Check, ChevronDown } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function DashboardListingsPage() {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [coverPhotoModalOpen, setCoverPhotoModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [selectedStatus, setSelectedStatus] = useState("")
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<number>(4)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [sortBy, setSortBy] = useState("newest")
  const [filterBy, setFilterBy] = useState("all")
  const router = useRouter()

  const projects = [
    {
      id: 1,
      title: "Villa in Bussum",
      subtitle: "Modern Villa in Bussum",
      status: "Listed",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-green-100 text-green-800",
      createdAt: "2024-01-15",
    },
    {
      id: 2,
      title: "Villa in Huizen",
      subtitle: "Modern Villa in Huizen",
      status: "Listed",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-green-100 text-green-800",
      createdAt: "2024-01-10",
    },
    {
      id: 3,
      title: "Villa in Bussum",
      subtitle: "Modern Villa in Bussum",
      status: "Listed",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-green-100 text-green-800",
      createdAt: "2024-01-20",
    },
    {
      id: 4,
      title: "Villa in Blaricum",
      subtitle: "Modern Villa in Blaricum",
      status: "Listed",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-green-100 text-green-800",
      createdAt: "2024-01-05",
    },
    {
      id: 5,
      title: "Villa in Bussum",
      subtitle: "Modern Villa in Bussum",
      status: "Listed",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-green-100 text-green-800",
      createdAt: "2024-01-25",
    },
    {
      id: 6,
      title: "Villa in Huizen",
      subtitle: "Modern Villa in Huizen",
      status: "Invited",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-blue-100 text-blue-800",
      createdAt: "2024-01-12",
    },
    {
      id: 7,
      title: "Villa in Bussum",
      subtitle: "Modern Villa in Bussum",
      status: "In progress",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-yellow-100 text-yellow-800",
      createdAt: "2024-01-18",
    },
    {
      id: 8,
      title: "Villa in Blaricum",
      subtitle: "Modern Villa in Blaricum",
      status: "Unlisted",
      image: "/placeholder.svg?height=200&width=300",
      statusColor: "bg-gray-100 text-gray-800",
      createdAt: "2024-01-08",
    },
  ]

  const sortOptions = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "title", label: "Title A-Z" },
    { value: "status", label: "Status" },
  ]

  const filterOptions = [
    { value: "all", label: "All projects" },
    { value: "Listed", label: "Listed" },
    { value: "Unlisted", label: "Unlisted" },
    { value: "Invited", label: "Invited" },
    { value: "In progress", label: "In progress" },
  ]

  const getSortedAndFilteredProjects = () => {
    let filtered = projects

    if (filterBy !== "all") {
      filtered = projects.filter((project) => project.status === filterBy)
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "title":
          return a.title.localeCompare(b.title)
        case "status":
          return a.status.localeCompare(b.status)
        default:
          return 0
      }
    })

    return sorted
  }

  const handleUpdateStatus = (project: any) => {
    setSelectedProject(project)
    setSelectedStatus(project.status)
    setStatusModalOpen(true)
    setOpenDropdown(null)
  }

  const handleEditCoverImage = (project: any) => {
    setSelectedProject(project)
    setCoverPhotoModalOpen(true)
    setOpenDropdown(null)
  }

  const handleSaveStatus = () => {
    console.log(`Updating project ${selectedProject.id} status to ${selectedStatus}`)
    setStatusModalOpen(false)
    setSelectedProject(null)
  }

  const handleSaveCoverPhoto = () => {
    console.log(`Updating project ${selectedProject.id} cover photo to ${selectedCoverPhoto}`)
    setCoverPhotoModalOpen(false)
    setSelectedProject(null)
  }

  const handleEditListing = (project: any) => {
    setOpenDropdown(null)
    router.push(`/dashboard/edit/${project.id}`)
  }

  const handleSortChange = (value: string) => {
    setSortBy(value)
    setSortDropdownOpen(false)
  }

  const handleFilterChange = (value: string) => {
    setFilterBy(value)
    setFilterDropdownOpen(false)
  }

  const statusOptions = [
    {
      value: "Live on page",
      label: "Live on page",
      description: "Upgrade to add this project to your company page",
      color: "bg-green-500",
    },
    {
      value: "Listed",
      label: "Listed",
      description: "You are visible on the project page",
      color: "bg-green-500",
    },
    {
      value: "Unlisted",
      label: "Unlisted",
      description: "You won't be visible on the project page as contributor",
      color: "bg-gray-400",
    },
  ]

  const samplePhotos = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    url: "/placeholder.svg?height=200&width=300",
  }))

  const displayedProjects = getSortedAndFilteredProjects()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl mx-auto py-8 w-full px-4 md:px-6 lg:px-0">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-gray-900 font-medium text-xl">Your projects</h1>
          <div className="flex gap-3">
            <div className="relative">
              <Button
                variant="outline"
                size="default"
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center gap-2"
              >
                Sort
                <ChevronDown className="w-4 h-4" />
              </Button>
              {sortDropdownOpen && (
                <div className="absolute right-0 top-12 bg-white rounded-lg shadow-lg border py-2 w-48 z-10">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        sortBy === option.value ? "text-blue-600 bg-blue-50" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <Button
                variant="outline"
                size="default"
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                className="flex items-center gap-2"
              >
                Filter
                <ChevronDown className="w-4 h-4" />
              </Button>
              {filterDropdownOpen && (
                <div className="absolute right-0 top-12 bg-white rounded-lg shadow-lg border py-2 w-48 z-10">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange(option.value)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterBy === option.value ? "text-blue-600 bg-blue-50" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button asChild size="default">
              <Link href="/new-project">Add project</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative">
                <img
                  src={project.image || "/placeholder.svg"}
                  alt={project.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${project.statusColor}`}>
                    {project.status}
                  </span>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="text-xs text-black bg-white px-2 py-1 rounded">Project owner</span>
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === project.id ? null : project.id)}
                      className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    </button>
                    {openDropdown === project.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border py-2 w-40 z-10">
                        <button
                          onClick={() => handleUpdateStatus(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Update status
                        </button>
                        <button
                          onClick={() => handleEditCoverImage(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit cover image
                        </button>
                        <button
                          onClick={() => handleEditListing(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit listing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900">{project.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </main>

      {statusModalOpen && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Listing status</h2>
              <button onClick={() => setStatusModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <img
                src={selectedProject.image || "/placeholder.svg"}
                alt={selectedProject.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <h3 className="font-medium text-gray-900">{selectedProject.title}</h3>
                <p className="text-sm text-gray-500">{selectedProject.subtitle}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedStatus === option.value
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={selectedStatus === option.value}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      <div>
                        <div className="font-medium text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-500">{option.description}</div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveStatus} className="flex-1">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {coverPhotoModalOpen && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit cover photo</h2>
              <button onClick={() => setCoverPhotoModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              This photo will be displayed with the project on your company portfolio
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {samplePhotos.map((photo) => (
                <div key={photo.id} className="relative cursor-pointer" onClick={() => setSelectedCoverPhoto(photo.id)}>
                  <img
                    src={photo.url || "/placeholder.svg"}
                    alt={`Cover option ${photo.id + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  {selectedCoverPhoto === photo.id && (
                    <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                      <Check className="w-4 h-4 text-gray-900" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setCoverPhotoModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCoverPhoto}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
