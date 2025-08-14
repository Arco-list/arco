import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ResetPassword1 } from "@/components/reset-password1"

export default function ResetPasswordPage() {
  return (
    <>
      <Header />
      <main>
        <ResetPassword1
          logo={{
            url: "/",
            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg",
            alt: "Arco Logo",
            title: "Arco",
          }}
          loginUrl="/login"
        />
      </main>
      <Footer />
    </>
  )
}
