import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getSupportEmail } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read Arco's terms of service. Understand your rights and responsibilities when using our platform to connect with professionals.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-white py-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-black mb-8">Terms of Service</h1>

          <div className="prose prose-lg max-w-none text-black space-y-6">
            <p>
              Welcome to Arco. These Terms of Service (&ldquo;Terms&rdquo;) govern your use of our website and services. By
              accessing or using our platform, you agree to be bound by these Terms.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this website, you accept and agree to be bound by the terms and provision of this
              agreement. If you do not agree to abide by the above, please do not use this service.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials on Arco’s website for personal,
              non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">3. Disclaimer</h2>
            <p>
              The materials on Arco’s website are provided on an ‘as is’ basis. Arco makes no warranties, expressed or
              implied, and hereby disclaims and negates all other warranties including without limitation, implied
              warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of
              intellectual property or other violation of rights.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">4. Limitations</h2>
            <p>
              In no event shall Arco or its suppliers be liable for any damages (including, without limitation, damages
              for loss of data or profit, or due to business interruption) arising out of the use or inability to use
              the materials on Arco’s website.
            </p>

            <h2 className="text-2xl font-semibold text-black mt-8 mb-4">5. Contact Information</h2>
            <p>If you have any questions about these Terms of Service, please contact us at {getSupportEmail('legal')}.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
