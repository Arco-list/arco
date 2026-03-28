"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LinkInputRow } from "@/components/landing"
import { ScrapeModal } from "@/components/scrape-modal"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useAuth } from "@/contexts/auth-context"

export default function ImportPage() {
  const { isLoading } = useAuth()
  const { ensureAuth, isAuthenticated } = useRequireAuth()
  const searchParams = useSearchParams()
  const urlParam = searchParams?.get("url") ?? null
  const [scrapeUrl, setScrapeUrl] = useState<string | null>(null)
  const autoTriggeredRef = useRef(false)

  // When the page loads with a ?url= param, auto-trigger the scraping flow.
  // Wait for auth to finish loading — otherwise isAuthenticated is false
  // even for signed-in users and we'd incorrectly open the login modal.
  useEffect(() => {
    if (!urlParam || autoTriggeredRef.current || isLoading) return
    if (!isAuthenticated) {
      ensureAuth()
      return
    }
    autoTriggeredRef.current = true
    setScrapeUrl(urlParam)
  }, [urlParam, isAuthenticated, isLoading, ensureAuth])

  const handleSubmit = (url: string) => {
    if (!ensureAuth()) return
    setScrapeUrl(url)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-xl text-center">
          <p className="arco-eyebrow mb-5">New project</p>
          <h1 className="arco-section-title mb-4">
            Import a project from your website
          </h1>
          <p className="arco-body-text mb-10 mx-auto max-w-sm">
            Paste a link to a project page on your own website. We'll read the title,
            description, and details — you review and publish.
          </p>

          <div className="landing-hero-cta mx-auto">
            <LinkInputRow
              placeholder="https://yourstudio.com/projects/villa-laren"
              buttonLabel="Generate Page →"
              onSubmit={handleSubmit}
              caption="Takes about 10 seconds"
            />
          </div>
        </div>
      </main>

      <Footer />

      {scrapeUrl && (
        <ScrapeModal url={scrapeUrl} onClose={() => setScrapeUrl(null)} />
      )}
    </div>
  )
}
