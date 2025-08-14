"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Bath, Building, Sofa, Waves, Bed, MapPin, Mountain } from "lucide-react"

export function ProjectFeatures() {
  const [showModal, setShowModal] = useState(false)

  const features = [
    { icon: Bath, label: "Bathroom" },
    { icon: Building, label: "Building" },
    { icon: Sofa, label: "Living room" },
    { icon: Waves, label: "Outdoor pool" },
    { icon: Bed, label: "Bedroom" },
    { icon: MapPin, label: "Countryside" },
    { icon: Mountain, label: "Natural Stone" },
  ]

  const modalFeatures = {
    location: [{ icon: MapPin, label: "Countryside" }],
    building: [
      { icon: Bath, label: "Bathroom" },
      { icon: Bed, label: "Bedroom" },
      { icon: Building, label: "Building" },
      { icon: Sofa, label: "Living room" },
      { icon: Waves, label: "Outdoor pool" },
    ],
    materials: [{ icon: Mountain, label: "Natural Stone" }],
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">Features</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center gap-3">
            <feature.icon className="w-5 h-5 text-gray-600" />
            <span className="text-gray-900">{feature.label}</span>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
        Show all features
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold">Features</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Location Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Location</h3>
              <div className="space-y-3">
                {modalFeatures.location.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <feature.icon className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-900 underline">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Building Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Building</h3>
              <div className="grid grid-cols-2 gap-3">
                {modalFeatures.building.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <feature.icon className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-900 underline">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Materials Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Materials</h3>
              <div className="space-y-3">
                {modalFeatures.materials.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <feature.icon className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-900 underline">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
