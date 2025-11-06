import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function UnauthorizedError() {
  return (
    <div className="flex items-center justify-center bg-background py-20">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">401</h1>
          <h2 className="text-2xl font-semibold">Unauthorized</h2>
          <p className="text-muted-foreground">
            You need to be logged in to access this page.
          </p>
        </div>
        
        <div className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/login">
              Sign In
            </Link>
          </Button>
          
          <Button variant="quaternary" size="quaternary" asChild className="w-full">
            <Link href="/">
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
