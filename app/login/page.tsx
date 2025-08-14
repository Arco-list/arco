import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Login1 } from "@/components/login1"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Login1
          heading="Welcome back"
          logo={{
            url: "/",
            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
            alt: "Arco Logo",
            title: "Arco - World's finest architectural constructions",
          }}
          buttonText="Sign in"
          signupText="Don't have an account?"
          signupUrl="/signup"
        />
      </main>
      <Footer />
    </div>
  )
}
