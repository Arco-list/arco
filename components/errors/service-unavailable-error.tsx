import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ServiceUnavailableError() {
  return (
    <div className="flex items-center justify-center bg-background py-20">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">503</h1>
          <h2 className="text-2xl font-semibold">Service Unavailable</h2>
          <p className="text-muted-foreground">
            The service is temporarily unavailable. Please try again later.
          </p>
        </div>
        
        <div className="space-y-4">
          <Button onClick={() => window.location.reload()} className="w-full">
            Try Again
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link href="/">
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
