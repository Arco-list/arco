"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export function ProfessionalSubNav() {
  const [activeSection, setActiveSection] = useState<string>('projects')
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down')

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Detect scroll direction
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down')
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up')
      }
      lastScrollY = currentScrollY

      // Find active section (top third of viewport)
      const sections = ['projects', 'contact']
      let active = 'projects'

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= window.innerHeight / 3 && rect.bottom >= 0) {
            active = sectionId
            break
          }
        }
      }

      setActiveSection(active)
    }

    let timeout: NodeJS.Timeout
    const debouncedScroll = () => {
      clearTimeout(timeout)
      timeout = setTimeout(handleScroll, 10)
    }

    window.addEventListener('scroll', debouncedScroll, { passive: true })
    handleScroll() // Initial check

    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      clearTimeout(timeout)
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault()
    const element = document.getElementById(sectionId)
    if (element) {
      const offsetTop = element.offsetTop - 120 // Account for sticky nav
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="sub-nav">
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            <Link href="/professionals" className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </Link>
            
            <div className="sub-nav-links">
              <a
                href="#projects"
                onClick={(e) => handleClick(e, 'projects')}
                className={`sub-nav-link arco-nav-text ${
                  activeSection === 'projects' 
                    ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                    : ''
                }`}
              >
                Projects
              </a>
              <a
                href="#contact"
                onClick={(e) => handleClick(e, 'contact')}
                className={`sub-nav-link arco-nav-text ${
                  activeSection === 'contact'
                    ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                    : ''
                }`}
              >
                Contact
              </a>
            </div>
          </div>

          <div className="sub-nav-actions">
            <button className="tag-button" aria-label="Save professional">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M12 14L8 11L4 14V3C4 2.44772 4.44772 2 5 2H11C11.5523 2 12 2.44772 12 3V14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save
            </button>
            <button className="tag-button" aria-label="Share professional">
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
