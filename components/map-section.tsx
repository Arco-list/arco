export function MapSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">Explore the area</h2>
      <p className="text-gray-600">Nijmegen, Netherlands</p>

      <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
        <img
          src="/placeholder.svg?height=300&width=800"
          alt="Map of Nijmegen, Netherlands"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm">
            <p className="text-sm text-gray-600">This page can't load Google Maps correctly.</p>
            <p className="text-xs text-blue-600 mt-1">Do you own this website?</p>
          </div>
        </div>
      </div>
    </div>
  )
}
