import { redirect } from "next/navigation"
import Image from "next/image"

export default function ComponentsPage() {
  // Only allow access in development and preview deployments
  if (process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    redirect("/")
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '60px 40px' }}>
        
        {/* HEADER */}
        <div style={{ paddingBottom: '40px', marginBottom: '60px', borderBottom: '1px solid var(--rule)' }}>
          <h1 style={{ 
            fontFamily: 'var(--serif)', 
            fontSize: '56px', 
            fontWeight: 400, 
            letterSpacing: '-0.5px', 
            marginBottom: '12px' 
          }}>
            Component Library
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--mid)', maxWidth: '700px' }}>
            Live examples of all Arco components. Use this page to test changes, maintain consistency, and copy working code.
          </p>
        </div>

        {/* NAVIGATION */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Navigation</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Header, footer, and navigation components from your app</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Header - Black Background</h4>
            <div style={{ background: '#1c1c1a', padding: '0', borderRadius: '6px', overflow: 'hidden' }}>
              {/* Simplified header demo */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr auto 1fr', 
                alignItems: 'center',
                padding: '16px 40px',
                gap: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ width: '18px', height: '1.5px', background: 'white' }}></span>
                    <span style={{ width: '18px', height: '1.5px', background: 'white' }}></span>
                    <span style={{ width: '18px', height: '1.5px', background: 'white' }}></span>
                  </div>
                  <a href="#" style={{ fontSize: '15px', fontWeight: 400, color: 'white', textDecoration: 'none' }}>Projects</a>
                  <a href="#" style={{ fontSize: '15px', fontWeight: 400, color: 'white', textDecoration: 'none' }}>Professionals</a>
                </div>
                <div style={{ justifySelf: 'center', fontSize: '20px', fontFamily: 'var(--serif)', color: 'white' }}>
                  Arco
                </div>
                <div style={{ justifySelf: 'end' }}>
                  <button className="btn-secondary" style={{ fontSize: '14px', padding: '8px 18px' }}>Log in</button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Footer - Dark Background</h4>
            <div style={{ background: '#161614', padding: '40px', borderRadius: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '40px', paddingBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ fontSize: '20px', fontFamily: 'var(--serif)', color: 'white', marginBottom: '12px' }}>Arco</div>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.75 }}>The professional network architects trust.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>DISCOVER</div>
                    <a href="#" style={{ display: 'block', fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textDecoration: 'none' }}>Projects</a>
                    <a href="#" style={{ display: 'block', fontSize: '14px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Professionals</a>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>COMPANY</div>
                    <a href="#" style={{ display: 'block', fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textDecoration: 'none' }}>About</a>
                    <a href="#" style={{ display: 'block', fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textDecoration: 'none' }}>Privacy</a>
                    <a href="#" style={{ display: 'block', fontSize: '14px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Terms</a>
                  </div>
                </div>
              </div>
              <div style={{ paddingTop: '28px' }}>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.25)' }}>© 2025 Arco. All rights reserved.</span>
              </div>
            </div>
          </div>
        </div>

        {/* HERO SECTIONS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Hero Sections</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Homepage and landing page hero components</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Homepage Hero</h4>
            <div style={{ 
              background: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&h=900&fit=crop)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '6px',
              padding: '80px 60px',
              minHeight: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center', maxWidth: '800px' }}>
                <h1 className="arco-hero-title" style={{ color: 'white', marginBottom: '24px' }}>
                  Exceptional architecture.<br/>Trusted professionals.
                </h1>
                <p className="arco-body-text" style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '32px', fontSize: '17px' }}>
                  Discover leading architects and the professionals they work with.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="btn-primary">Explore Projects</button>
                  <button className="btn-secondary">Find Professionals</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PROJECT CARDS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Project Cards</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Card components used throughout the app</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Standard Project Card</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
              {[
                { title: 'Contemporary Villa on the Amstel', location: 'Amsterdam', year: '2024' },
                { title: 'Canal House Restoration', location: 'Utrecht', year: '2023' },
                { title: 'Urban Loft Conversion', location: 'Rotterdam', year: '2024' }
              ].map((project, i) => (
                <a key={i} href="#" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '4/3', 
                    background: 'var(--surface)', 
                    borderRadius: '3px', 
                    marginBottom: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: '100%', 
                      height: '100%',
                      background: 'linear-gradient(135deg, #e5e5e4 0%, #f5f5f4 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--mid)',
                      fontSize: '14px'
                    }}>
                      Image {i + 1}
                    </div>
                  </div>
                  <h4 className="arco-card-title" style={{ marginBottom: '4px' }}>{project.title}</h4>
                  <p className="arco-card-subtitle">{project.location} · {project.year}</p>
                </a>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Professional Card</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '30px' }}>
              {['Studio A', 'Studio B', 'Studio C', 'Studio D'].map((name, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div className="credit-icon" style={{ marginBottom: '16px' }}>
                    <span className="credit-icon-initials">{name.charAt(name.length - 1)}</span>
                  </div>
                  <h4 className="arco-h4" style={{ marginBottom: '6px' }}>{name}</h4>
                  <p className="arco-card-subtitle" style={{ marginBottom: '12px' }}>Amsterdam, NL</p>
                  <a href="#" className="text-link-plain">View Portfolio →</a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BUTTONS & FORMS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Buttons & Forms</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Interactive elements and form controls</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Button States</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'grid', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Default</span>
                  <button className="btn-primary">Primary</button>
                  <button className="btn-secondary">Secondary</button>
                  <button className="btn-tertiary">Tertiary</button>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Disabled</span>
                  <button className="btn-primary" disabled>Primary</button>
                  <button className="btn-secondary" disabled>Secondary</button>
                  <button className="btn-tertiary" disabled>Tertiary</button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Form Controls</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ maxWidth: '500px', display: 'grid', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>Text Input</label>
                  <input type="text" placeholder="Enter text..." style={{ width: '100%', maxWidth: '400px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>Email Input</label>
                  <input type="email" placeholder="email@example.com" style={{ width: '100%', maxWidth: '400px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>Textarea</label>
                  <textarea placeholder="Enter description..." rows={4} style={{ width: '100%', maxWidth: '400px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>Disabled Input</label>
                  <input type="text" placeholder="Disabled..." disabled style={{ width: '100%', maxWidth: '400px' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Category Tags</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <button className="category-tag active">All</button>
                <button className="category-tag">Exterior</button>
                <button className="category-tag">Living</button>
                <button className="category-tag">Kitchen</button>
                <button className="category-tag">Bedroom</button>
                <button className="category-tag">Bathroom</button>
              </div>
            </div>
          </div>
        </div>

        {/* PROJECT DETAIL COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Project Detail Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Components specific to project detail pages</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Project Header</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '60px 40px', textAlign: 'center' }}>
              <h1 className="arco-page-title" style={{ marginBottom: '12px' }}>Contemporary Villa on the Amstel</h1>
              <p className="architect-attribution">
                by <a href="#">Studio Modijefsky</a>
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Specifications Bar</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div className="specifications-bar">
                <div className="spec-item">
                  <span className="arco-eyebrow">LOCATION</span>
                  <div className="arco-card-title">Amsterdam</div>
                </div>
                <div className="spec-item">
                  <span className="arco-eyebrow">YEAR</span>
                  <div className="arco-card-title">2024</div>
                </div>
                <div className="spec-item">
                  <span className="arco-eyebrow">TYPE</span>
                  <div className="arco-card-title">Villa</div>
                </div>
                <div className="spec-item">
                  <span className="arco-eyebrow">SIZE</span>
                  <div className="arco-card-title">450 m²</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Photo Gallery Layout</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div className="photo-gallery">
                <div className="photo-gallery-large" style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid)' }}>
                  Large Image (3:2)
                </div>
                <div className="photo-gallery-grid">
                  <div className="photo-gallery-small" style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid)' }}>
                    Small (4:3)
                  </div>
                  <div className="photo-gallery-small" style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mid)' }}>
                    Small (4:3)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION PATTERNS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Section Patterns</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Common layout patterns used across pages</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Section Header with Link</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '28px' }}>
                <h2 className="arco-section-title">Recently Published</h2>
                <a href="#" className="text-link-plain">View all projects →</a>
              </div>
              <p className="arco-small-text">Content goes here...</p>
            </div>
          </div>
        </div>

        {/* USAGE NOTES */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Usage Notes</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>How to use this page</p>

          <div style={{ background: '#fff8e6', border: '1px solid #f5d668', borderRadius: '6px', padding: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#8b6914' }}>💡 How to Use This Page</h4>
            <ul style={{ fontSize: '14px', lineHeight: 1.8, color: '#8b6914', paddingLeft: '20px' }}>
              <li>Use this page to <strong>test changes</strong> - see how CSS updates affect all components at once</li>
              <li><strong>Copy examples</strong> - right-click and &quot;Inspect&quot; to see the exact code</li>
              <li><strong>Maintain consistency</strong> - ensure all components follow the same patterns</li>
              <li><strong>Onboard developers</strong> - show this to new team members as a reference</li>
              <li><strong>Spot regressions</strong> - quickly see if something breaks after changes</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
