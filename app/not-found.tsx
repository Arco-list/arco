import NotFoundError from "@/components/errors/not-found-error"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <NotFoundError />
      </main>
      <Footer />
    </div>
  )
}
