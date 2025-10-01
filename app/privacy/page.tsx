import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Arco collects, uses, and protects your personal information. Read our comprehensive privacy policy.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white py-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-black mb-8">Privacy Policy</h1>

          <div className="prose prose-lg max-w-none text-black space-y-6">
            <p>
              At Arco, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use,
              and safeguard your information when you use our website and services.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, contact us, or use
              our services. This may include your name, email address, phone number, and other contact information.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to provide, maintain, and improve our services, communicate with you,
              and comply with legal obligations. We may also use your information to send you marketing communications,
              but you can opt out at any time.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">3. Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties without your
              consent, except as described in this Privacy Policy or as required by law.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information against unauthorized
              access, alteration, disclosure, or destruction. However, no method of transmission over the internet is
              100% secure.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">5. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information. You may also have the right to
              restrict or object to certain processing of your information.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">6. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at privacy@arco.com.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
