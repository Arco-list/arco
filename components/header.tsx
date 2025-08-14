"use client"
import { useState, useRef, useEffect } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <header className="border-b border-gray-200 px-4 py-4 md:px-8">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
            alt="Arco Logo"
            className="h-6 w-auto"
          />
        </Link>

        <div className="relative flex items-center space-x-4" ref={menuRef}>
          <Link href="/signup" className="text-sm font-medium text-black hover:text-gray-600 transition-colors">
            List with us
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-gray-100"
            aria-label="Open menu"
            onClick={toggleMenu}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {isMenuOpen && (
            <div className="absolute right-0 top-12 z-50 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="py-1">
                <Link
                  href="/projects"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Projects
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/new-project"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Add new project
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/login"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/signup"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign up
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/signup"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  List with us
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/help-center"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Help center
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
