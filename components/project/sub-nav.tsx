"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"

export function SubNav() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down')
  const lastScrollY = useRef(0)

  useEffect(() => {
    const sections = [
      { id: 'photo-tour', element: document.getElementById('photo-tour') },
      { id: 'professionals', element: document.getElementById('professionals') }
    ]

    const updateActiveSection = () => {
      // Detect scroll direction
      const currentScroll = window.scrollY
      const direction = currentScroll > lastScrollY.current ? 'down' : 'up'
      setScrollDirection(direction)
      lastScrollY.current = currentScroll

      // Get scroll position - use top third for better detection
      const scrollPosition = window.scrollY + window.innerHeight / 3

      let newActive: string | null = null

      sections.forEach(({ id, element }) => {
        if (element) {
          const sectionTop = element.offsetTop
          const sectionBottom = sectionTop + element.offsetHeight

          if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            newActive = id
          }
        }
      })

      setActiveSection(newActive)
    }

    // Scroll with debouncing
    let scrollTimeout: number
    const handleScroll = () => {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout)
      }
      scrollTimeout = window.requestAnimationFrame(updateActiveSection)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    updateActiveSection() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      window.scrollTo({
        top: target.offsetTop - 120,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="sub-nav">
      {/* UPDATED: Use .wrap class */}
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            {/* UPDATED: Back button with border-right */}
            <Link href="/projects" className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </Link>
            
            {/* UPDATED: Nav links container with border-left and border-right */}
            <div className="sub-nav-links">
              <a
                href="#photo-tour"
                onClick={(e) => handleClick(e, 'photo-tour')}
                className={`sub-nav-link arco-nav-text ${
                  activeSection === 'photo-tour' 
                    ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                    : ''
                }`}
              >
                Photo Tour
              </a>
              <a
                href="#professionals"
                onClick={(e) => handleClick(e, 'professionals')}
                className={`sub-nav-link arco-nav-text ${
                  activeSection === 'professionals'
                    ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                    : ''
                }`}
              >
                Credited Professionals
              </a>
            </div>
          </div>

          {/* UPDATED: Actions container with border-left */}
          <div className="sub-nav-actions">
            <button className="tag-button" aria-label="Save project">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M12 14L8 11L4 14V3C4 2.44772 4.44772 2 5 2H11C11.5523 2 12 2.44772 12 3V14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save
            </button>
            <button className="tag-button" aria-label="Share project">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
