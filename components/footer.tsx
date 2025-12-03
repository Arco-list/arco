import { Instagram, Linkedin, Twitter } from "lucide-react"
import Link from "next/link"

const footerLinks = {
  Products: ["Projects", "Professionals"], // Removed "Products" from the Products array
  "For Business": ["List with us" /*, "Pricing" */], // Removed "Partner" from "For Business", Pricing commented out (Issue 8)
  Arco: ["About", "Help center"], // Removed "Blog" from "Arco"
}

interface FooterProps {
  maxWidth?: string;
}

export function Footer({ maxWidth = "max-w-[1800px]" }: FooterProps = {}) {
  return (
    <footer className="bg-[#F5F5F5] border-t border-border py-12 px-4 md:px-8">
      <div className={`${maxWidth} mx-auto`}>
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <Link href="/" className="mb-6 block">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco Logo"
                className="h-4 w-auto"
              />
            </Link>
            <div className="flex gap-4">
              <Instagram className="h-5 w-5 text-text-secondary hover:text-foreground cursor-pointer" />
              <Linkedin className="h-5 w-5 text-text-secondary hover:text-foreground cursor-pointer" />
              <Twitter className="h-5 w-5 text-text-secondary hover:text-foreground cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 md:gap-8">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h6 className="text-foreground mb-4 px-2 text-sm md:text-base md:px-3">{category}</h6>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      {/* COMMENTED OUT: Pricing link (Issue 8)
                      {link === "Pricing" ? (
                        <Link href="/pricing" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </Link>
                      ) : */}
                      {link === "Projects" ? (
                        <Link href="/projects" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </Link>
                      ) : link === "About" ? (
                        <Link href="/about" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </Link>
                      ) : link === "Help center" ? (
                        <Link href="/help-center" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </Link>
                      ) : link === "Professionals" ? (
                        <Link href="/professionals" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </Link>
                      ) : link === "List with us" ? (
                        <Link href="/list-with-us" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </Link>
                      ) : (
                        <a href="#" className="inline-block text-xs md:text-sm text-foreground px-2 md:px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
                          {link}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-secondary">
          <div>©2025 ArcoGlobal BV. All rights reserved.</div>
          <div className="flex gap-6">
            <Link href="/terms" className="text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
