import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function ProfessionalsSidebar() {
  const professionals = [
    {
      name: "Teus van den Berg Aannemers & Timmerwerken B.V.",
      type: "Visit",
      color: "bg-red-500",
    },
    {
      name: "Visser In- en Exterieur",
      type: "Visit",
      color: "bg-red-500",
    },
    {
      name: "FX Domotica",
      type: "Visit",
      color: "bg-red-500",
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-6 sticky top-24 z-10">
        <h3 className="text-lg font-semibold">Professionals who built it</h3>

        <div className="space-y-4">
          {professionals.map((professional, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{professional.name}</p>
              </div>
              <Button size="sm" className={`${professional.color} text-white hover:opacity-90`}>
                {professional.type}
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full bg-transparent">
          Show all professionals
        </Button>
      </Card>
    </div>
  )
}
