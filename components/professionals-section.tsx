"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Link from "next/link"

export function ProfessionalsSection() {
  const [showModal, setShowModal] = useState(false)

  const professionals = [
    {
      name: "Teus van den Berg Aannemers & Timmerwerken B.V.",
      slug: "teus-van-den-berg-aannemers-timmerwerken",
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      name: "Visser In- en Exterieur",
      slug: "visser-in-en-exterieur",
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      name: "FX Domotica",
      slug: "fx-domotica",
      image: "/placeholder.svg?height=200&width=300",
    },
  ]

  const modalProfessionals = [
    { name: "Teus van den Berg", title: "General Contractor", slug: "teus-van-den-berg-aannemers-timmerwerken" },
    { name: "Visser", title: "Interior & Exterior", slug: "visser-in-en-exterieur" },
    { name: "FX Domotica", title: "Home Automation", slug: "fx-domotica" },
    { name: "Marco van Veldhuizen", title: "Architect", slug: "marco-van-veldhuizen" },
    { name: "Jan de Vries", title: "Structural Engineer", slug: "jan-de-vries" },
    { name: "Lisa Bakker", title: "Landscape Architect", slug: "lisa-bakker" },
  ]

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-black">Professionals who built it</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {professionals.map((professional, index) => (
            <Link
              key={index}
              href={`/professionals/${professional.slug}`}
              className="space-y-2 block hover:opacity-80 transition-opacity"
            >
              <img
                src={professional.image || "/placeholder.svg"}
                alt={professional.name}
                className="w-full h-48 object-cover rounded-lg"
              />
              <p className="text-sm font-medium text-gray-900">{professional.name}</p>
            </Link>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
          Show all professionals
        </Button>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">Professionals who built it</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {modalProfessionals.map((professional, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">{professional.name}</p>
                  <p className="text-sm text-gray-500">{professional.title}</p>
                </div>
                <Link href={`/professionals/${professional.slug}`}>
                  <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white px-4">
                    Visit
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
