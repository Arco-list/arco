import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Phone, Mail, Globe, MapPin } from "lucide-react"

export function ProfessionalContactSidebar() {
  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-6 sticky top-24 z-10">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Contact Marco van Veldhuizen</h3>

          {/* Professional avatar */}
          <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-lg mx-auto">
            MvV
          </div>

          {/* Contact icons */}
          <div className="flex justify-center gap-4">
            <Button variant="ghost" size="sm" className="p-2">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="p-2">
              <Mail className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="p-2">
              <Globe className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="p-2">
              <MapPin className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div>
              <Button variant="link" className="text-blue-600 p-0">
                Show phone number
              </Button>
            </div>
            <div>
              <Button variant="link" className="text-blue-600 p-0">
                Website
              </Button>
            </div>
          </div>

          {/* Main contact button */}
          <Button className="w-full bg-red-500 hover:bg-red-600 text-white">Contact</Button>
        </div>
      </Card>
    </div>
  )
}
