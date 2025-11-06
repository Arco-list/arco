import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { UpdatePassword } from "@/components/update-password"

export const metadata: Metadata = {
  title: "Update Password",
  description: "Set your new Arco account password.",
}

export default function UpdatePasswordPage() {
  return (
    <>
      <Header />
      <main>
        <UpdatePassword
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
