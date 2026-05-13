import { EventsOverview } from "./events-client"

export const dynamic = "force-dynamic"

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <EventsOverview />
        </div>
      </div>
    </div>
  )
}
