import type { ReactNode } from "react"

// Persoonlijke pagina's: altijd per bezoek renderen, nooit prerenderen.
// De layout van [locale] leest geen sessie meer, dus elke tak die de
// kijker nodig heeft zegt dat zelf.
export const dynamic = "force-dynamic"

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
