"use client"

import Link from "next/link"
import Image from "next/image"

export function Footer() {
  return (
    <>
      <style jsx global>{`
        /* Footer custom styles */
        .footer-container {
          max-width: 1680px;
          margin: 0 auto;
          padding: 0 80px;
        }

        .footer-top-grid {
          display: grid;
          grid-template-columns: 1.2fr 1.8fr;
          gap: 40px;
          padding-bottom: 40px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 28px;
        }

        .footer-links-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 48px;
        }

        .footer-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .footer-bottom-flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .footer-container {
            padding: 0 40px !important;
          }
        }

        @media (max-width: 768px) {
          .footer-container {
            padding: 0 24px !important;
          }
          
          .footer-top-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          
          .footer-links-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 32px !important;
          }
          
          .footer-bottom-flex {
            flex-direction: column !important;
            gap: 16px;
            text-align: center;
          }
        }

        @media (max-width: 480px) {
          .footer-container {
            padding: 0 16px !important;
          }
          
          .footer-links-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      
      <footer className="bg-[#161614] text-white/50 py-12 pb-8">
        <div className="footer-container">
          
          {/* Top section */}
          <div className="footer-top-grid">
            
            {/* Brand */}
            <div>
              <div className="mb-3">
                <Image 
                  src="/images/arco-logo-white.svg" 
                  alt="Arco" 
                  width={60}
                  height={21}
                  className="h-auto w-[60px]"
                />
              </div>
              <p className="arco-small-text text-white/50 max-w-[200px]">
                The professional network architects trust.
              </p>
            </div>

            {/* Links */}
            <div className="footer-links-grid">
              
              {/* Discover */}
              <div className="footer-col">
                <h4 className="arco-eyebrow text-white/35 mb-1.5">
                  Discover
                </h4>
                <Link href="/projects" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Projects
                </Link>
                <Link href="/professionals" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Professionals
                </Link>
              </div>

              {/* For Businesses */}
              <div className="footer-col">
                <h4 className="arco-eyebrow text-white/35 mb-1.5">
                  For Businesses
                </h4>
                <Link href="/architects" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Architects
                </Link>
                <Link href="/list-with-us" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Professionals
                </Link>
                <Link href="/editorial-standards" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Editorial standards
                </Link>
              </div>

              {/* Company */}
              <div className="footer-col">
                <h4 className="arco-eyebrow text-white/35 mb-1.5">
                  Company
                </h4>
                <Link href="/about" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  About
                </Link>
                <Link href="/privacy" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="arco-small-text text-white/50 hover:text-white transition-colors">
                  Terms
                </Link>
              </div>
              
            </div>
          </div>

          {/* Bottom section */}
          <div className="footer-bottom-flex">
            <span className="arco-small-text text-white/25">
              © 2025 Arco. All rights reserved.
            </span>
          </div>
          
        </div>
      </footer>
    </>
  )
}
