import { Instagram, Linkedin, Twitter } from "lucide-react"
import Link from "next/link"

const footerLinks = {
  Products: ["Projects", "Professionals"], // Removed "Products" from the Products array
  "For Business": ["List with us", "Pricing"], // Removed "Partner" from "For Business"
  Arco: ["About", "Help center"], // Removed "Blog" from "Arco"
}

interface FooterProps {
  maxWidth?: string;
}

export function Footer({ maxWidth = "max-w-[1800px]" }: FooterProps = {}) {
  return (
    <footer className="bg-white border-t border-gray-200 py-12 px-4 md:px-8">
      <div className={`${maxWidth} mx-auto`}>
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <Link
              href="/"
              className="mb-6 block hover:opacity-80 transition-opacity"
            >
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco Logo"
                className="h-4 w-auto"
              />
            </Link>
            <div className="flex gap-4">
              <Instagram className="h-5 w-5 text-gray-600 hover:text-gray-900 cursor-pointer" />
              <Linkedin className="h-5 w-5 text-gray-600 hover:text-gray-900 cursor-pointer" />
              <Twitter className="h-5 w-5 text-gray-600 hover:text-gray-900 cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h3 className="font-semibold text-gray-900 mb-4">{category}</h3>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      {link === "Pricing" ? (
                        <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                          {link}
                        </Link>
                      ) : link === "Projects" ? (
                        <Link href="/projects" className="text-gray-600 hover:text-gray-900 transition-colors">
                          {link}
                        </Link>
                      ) : link === "About" ? (
                        <Link href="/about" className="text-gray-600 hover:text-gray-900 transition-colors">
                          {link}
                        </Link>
                      ) : link === "Help center" ? (
                        <Link href="/help-center" className="text-gray-600 hover:text-gray-900 transition-colors">
                          {link}
                        </Link>
                      ) : link === "Professionals" ? (
                        <Link href="/professionals" className="text-gray-600 hover:text-gray-900 transition-colors">
                          {link}
                        </Link>
                      ) : link === "List with us" ? (
                        <Link href="/list-with-us" className="text-gray-600 hover:text-gray-900 transition-colors">
                          {link}
                        </Link>
                      ) : (
                        <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
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

        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
          <div>©2025 ArcoGlobal BV. All rights reserved.</div>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
