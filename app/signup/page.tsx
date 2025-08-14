import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Signup1 } from "@/components/signup1"

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Signup1
          heading="Join Arco"
          logo={{
            url: "/",
            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
            alt: "Arco logo",
            title: "arco",
          }}
          buttonText="Create Account"
          signupText="Already have an account?"
          signupUrl="/login"
        />
      </main>
      <Footer />
    </div>
  )
}
