"use client"

import type React from "react"

import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { ChevronRight, User, Camera, ImageIcon, MoreHorizontal, Trash2 } from "lucide-react"

export default function DashboardCompanyPage() {
  const [activeSection, setActiveSection] = useState("profile")
  const [companyPhotos, setCompanyPhotos] = useState<Array<{ id: string; url: string; isCover: boolean }>>([])
  const [dragOver, setDragOver] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newPhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: e.target?.result as string,
            isCover: companyPhotos.length === 0 && index === 0,
          }
          setCompanyPhotos((prev) => [...prev, newPhoto])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const setCoverPhoto = (id: string) => {
    setCompanyPhotos((prev) =>
      prev.map((photo) => ({
        ...photo,
        isCover: photo.id === id,
      })),
    )
    setOpenMenuId(null)
  }

  const deletePhoto = (id: string) => {
    setCompanyPhotos((prev) => {
      const filtered = prev.filter((photo) => photo.id !== id)
      if (filtered.length > 0 && !filtered.some((photo) => photo.isCover)) {
        filtered[0].isCover = true
      }
      return filtered
    })
    setOpenMenuId(null)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl mx-auto py-8 w-full px-0">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Company Status */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      Unlisted
                    </div>
                    <div className="text-xs text-red-500">List your company page</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </Card>

              {/* Navigation Menu */}
              <div className="space-y-2">
                <button
                  onClick={() => setActiveSection("profile")}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSection === "profile" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => setActiveSection("photos")}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSection === "photos" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Photos
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeSection === "profile" && (
              <div className="space-y-8">
                {/* Header */}
                <div>
                  <h1 className="text-xl font-medium text-gray-900">Profile</h1>
                  <p className="text-gray-600 mt-1">Description</p>
                </div>

                {/* Upgrade Banner */}
                <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Upgrade to unlock your company page</h3>
                      <p className="text-gray-600 text-sm">Become findable by thousands of homeowners</p>
                    </div>
                    <Button className="bg-red-500 hover:bg-red-600 text-white">Upgrade</Button>
                  </div>
                </Card>

                {/* Company Logo */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    MvV
                  </div>
                  <Button variant="outline" size="sm">
                    Change logo
                  </Button>
                </div>

                {/* Company Information */}
                <Card className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Company information</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company name</label>
                      <Input placeholder="Company name" />
                      <p className="text-xs text-gray-500 mt-1">Helper</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company description</label>
                      <Textarea placeholder="Select company services" rows={4} className="resize-none" />
                    </div>
                    <div className="flex justify-end">
                      <Button className="bg-black hover:bg-gray-800 text-white">Save</Button>
                    </div>
                  </div>
                </Card>

                {/* Contact Information */}
                <Card className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Contact information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                      <Input placeholder="Website" />
                      <p className="text-xs text-gray-500 mt-1">Use your company domain</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <Input placeholder="Email" />
                      <p className="text-xs text-gray-500 mt-1">This email will be listed on your company page</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <Input placeholder="Phone" />
                      <p className="text-xs text-gray-500 mt-1">Your phone number will be listed on your page</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <Input placeholder="Address" />
                      <p className="text-xs text-gray-500 mt-1">Helper</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Facebook URL</label>
                      <Input />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Instagram URL</label>
                      <Input />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn URL</label>
                      <Input />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pinterest URL</label>
                      <Input />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button className="bg-black hover:bg-gray-800 text-white">Save</Button>
                  </div>
                </Card>

                {/* Services and Features */}
                <Card className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Services and features</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Primary service</label>
                      <Input placeholder="Select company services" />
                      <p className="text-xs text-gray-500 mt-1">Helper</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Other services</label>
                      <Input placeholder="Select company services" />
                      <p className="text-xs text-gray-500 mt-1">Helper</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
                      <Input placeholder="Select languages" />
                      <p className="text-xs text-gray-500 mt-1">Helper</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Certificates</label>
                      <Input placeholder="Select certificates" />
                      <p className="text-xs text-gray-500 mt-1">Helper</p>
                    </div>
                    <div className="flex justify-end">
                      <Button className="bg-black hover:bg-gray-800 text-white">Save</Button>
                    </div>
                  </div>
                </Card>

                {/* Custom Domain */}
                <Card className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Custom domain</h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                          https://arcolist.com/pro/
                        </span>
                        <Input placeholder="Website" className="rounded-l-none" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">XX characters left</p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button className="bg-black hover:bg-gray-800 text-white">Save</Button>
                  </div>
                </Card>

                {/* Account Management */}
                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Deactivate your company account</span>
                      <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 bg-transparent">
                        Deactivate
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Activate your company account</span>
                      <Button
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50 bg-transparent"
                      >
                        Activate
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeSection === "photos" && (
              <div className="space-y-8">
                {/* Header */}
                <div>
                  <h1 className="text-xl font-medium text-gray-900">Photos</h1>
                  <p className="text-gray-600 mt-1">
                    Add 5 photos that are displayed at the top of your company page. The cover photo is displayed in
                    search results.
                  </p>
                </div>

                {/* Upgrade Banner */}
                <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Upgrade to unlock your company page</h3>
                      <p className="text-gray-600 text-sm">Become findable by thousands of homeowners</p>
                    </div>
                    <Button className="bg-red-500 hover:bg-red-600 text-white">Upgrade</Button>
                  </div>
                </Card>

                {/* Photo Upload Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Drag and Drop Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragOver ? "border-gray-400 bg-gray-50" : "border-gray-300"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-900 font-medium mb-1">Drag and drop</p>
                    <p className="text-gray-500 text-sm mb-4">or browse for photos</p>
                    <label className="inline-block">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                      <span className="bg-gray-900 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer">
                        Browse
                      </span>
                    </label>
                  </div>

                  {/* Uploaded Photos */}
                  {companyPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={photo.url || "/placeholder.svg?height=300&width=300&query=modern architecture"}
                          alt="Company photo"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {photo.isCover && (
                        <div className="absolute top-2 left-2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-medium">
                          Cover photo
                        </div>
                      )}

                      <div className="absolute top-2 right-2">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === photo.id ? null : photo.id)}
                          className="bg-white rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-600" />
                        </button>

                        {openMenuId === photo.id && (
                          <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                            <button
                              onClick={() => setCoverPhoto(photo.id)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Set cover photo
                            </button>
                            <button
                              onClick={() => deletePhoto(photo.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Empty Photo Slots */}
                  {Array.from({ length: Math.max(0, 5 - companyPhotos.length) }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="aspect-square rounded-lg border-2 border-dashed border-gray-200 bg-gray-50"
                    ></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
          <Button className="bg-black hover:bg-gray-800 text-white px-8">Save Changes</Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
