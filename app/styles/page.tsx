import { redirect } from "next/navigation"

export default function StylesPage() {
  // Only allow access in development and preview deployments
  if (process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    redirect("/")
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '60px 40px' }}>
        
        {/* HEADER */}
        <div style={{ paddingBottom: '40px', marginBottom: '60px' }}>
          <h1 style={{ 
            fontFamily: 'var(--serif)', 
            fontSize: '56px', 
            fontWeight: 400, 
            letterSpacing: '-0.5px', 
            marginBottom: '12px' 
          }}>
            Arco Design System
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--mid)', maxWidth: '700px' }}>
            Visual reference for the Arco design system. All colors, typography, components, and patterns.
          </p>
        </div>

        {/* COLORS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Color Palette</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Core Arco Colors</p>

          {/* Primary Colors */}
          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Primary Colors</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ height: '100px', background: '#FAFAF9', borderRadius: '6px', marginBottom: '12px', border: '2px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>White</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#FAFAF9</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Main background color for pages, cards, and content areas.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#1c1c1a', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Black</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#1c1c1a</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Primary text color. Also used for secondary buttons and active states.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#016D75', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Accent (Teal)</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#016D75</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Primary buttons, link hovers, focus rings. Use sparingly.</div>
              </div>
            </div>
          </div>

          {/* Secondary Colors */}
          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Secondary Colors</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ height: '100px', background: '#f5f5f4', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Surface</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#f5f5f4</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Elevated surfaces, card backgrounds.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#6b6b68', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Mid Gray</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#6b6b68</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Body text, descriptions.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#a1a1a0', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Light Gray</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#a1a1a0</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Metadata, subtitles, disabled states.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#e5e5e4', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Rule</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#e5e5e4</div>
                <div style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.5 }}>Borders, dividers, separators.</div>
              </div>
            </div>
          </div>
        </div>

        {/* TYPOGRAPHY */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Typography</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Arco Typography Classes</p>

          <div>
            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H1 — .arco-hero-title — Clamp(42px-72px), Serif, 400</div>
              <h1 className="arco-hero-title">Exceptional architecture.<br/>Trusted professionals.</h1>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H2 — .arco-page-title — 48px, Serif, 300</div>
              <h2 className="arco-page-title">The professional network architects trust</h2>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H3 — .arco-section-title — 34px, Serif, 300</div>
              <h3 className="arco-section-title">Recent Projects</h3>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H4 — .arco-card-title — 15px, Sans, 400</div>
              <h4 className="arco-card-title">Contemporary Villa on the Amstel</h4>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H4 Bold — .arco-h4 — 15px, Sans, 500</div>
              <h4 className="arco-h4">Studio Modijefsky</h4>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Body — .arco-body-text — 15px, Sans, 300</div>
              <p className="arco-body-text">Arco is where leading architects publish their residential work and credential the professionals they collaborate with.</p>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Nav — .arco-nav-text — 15px, Sans, 400</div>
              <p className="arco-nav-text">Projects · Professionals · About</p>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Subtitle — .arco-card-subtitle — 14px, Sans, 400</div>
              <p className="arco-card-subtitle">by Studio Modijefsky · Amsterdam · 2024</p>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Small — .arco-small-text — 14px, Sans, 400</div>
              <p className="arco-small-text">Footer links, captions, secondary information</p>
            </div>

            <div>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Eyebrow — .arco-eyebrow — 11px, Sans, 500, Uppercase</div>
              <p className="arco-eyebrow">ARCHITECT · AMSTERDAM · 2024</p>
            </div>
          </div>
        </div>

        {/* BUTTONS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Buttons & Links</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Interactive elements and CTAs</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Buttons</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Default</span>
                <button className="btn-primary">Primary</button>
                <button className="btn-secondary">Secondary</button>
                <button className="btn-tertiary">Tertiary</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Disabled</span>
                <button className="btn-primary" disabled>Primary</button>
                <button className="btn-secondary" disabled>Secondary</button>
                <button className="btn-tertiary" disabled>Tertiary</button>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li className="arco-small-text" style={{ color: 'var(--mid)', lineHeight: 1.7, paddingLeft: '16px', position: 'relative', marginBottom: '8px' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                  <strong>Primary (Teal):</strong> Single most important action per screen
                </li>
                <li className="arco-small-text" style={{ color: 'var(--mid)', lineHeight: 1.7, paddingLeft: '16px', position: 'relative', marginBottom: '8px' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                  <strong>Secondary (Black):</strong> Alternative important actions
                </li>
                <li className="arco-small-text" style={{ color: 'var(--mid)', lineHeight: 1.7, paddingLeft: '16px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                  <strong>Tertiary (Outline):</strong> Subtle actions, cancel buttons
                </li>
              </ul>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Text Links</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ marginBottom: '24px' }}>
                <a href="#" className="text-link-plain">View all projects →</a>
              </div>
              <div>
                <p className="arco-body-text" style={{ maxWidth: '600px' }}>
                  Arco is where leading architects publish their residential work. We help <a href="#" style={{ textDecoration: 'underline', color: 'var(--mid)' }} className="hover:text-[var(--accent)] transition-colors">discerning clients</a> discover exceptional teams.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM ELEMENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Form Elements</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Input styles and form components</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Text Input</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)' }}>Default</label>
                  <input 
                    type="text" 
                    placeholder="Enter text..." 
                    style={{ 
                      fontFamily: 'var(--sans)', 
                      fontSize: '14px', 
                      padding: '12px 16px', 
                      border: '1px solid var(--rule)', 
                      borderRadius: '3px', 
                      background: 'white', 
                      color: 'var(--black)', 
                      width: '100%',
                      maxWidth: '400px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)' }}>Disabled</label>
                  <input 
                    type="text" 
                    placeholder="Disabled..." 
                    disabled
                    style={{ 
                      fontFamily: 'var(--sans)', 
                      fontSize: '14px', 
                      padding: '12px 16px', 
                      border: '1px solid var(--rule)', 
                      borderRadius: '3px', 
                      background: 'var(--surface)', 
                      color: 'var(--light)', 
                      width: '100%',
                      maxWidth: '400px',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CATEGORY TAGS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Category Tags</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Filter tags for galleries</p>

          <div>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Tag Variants</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
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

        {/* CARDS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Cards</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Project and content card components</p>

          <div>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Project Cards</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div style={{ 
                      width: '100%', 
                      aspectRatio: '4/3', 
                      background: 'var(--surface)', 
                      borderRadius: '3px', 
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--mid)',
                      fontSize: '14px'
                    }}>
                      Image {i}
                    </div>
                    <h4 className="arco-card-title" style={{ marginBottom: '4px' }}>Villa Project {i}</h4>
                    <p className="arco-card-subtitle">Amsterdam · 2024</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION HEADERS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Section Headers</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Title and action patterns</p>

          <div>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Header with View All</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '28px' }}>
                <h2 className="arco-section-title">Recently Published</h2>
                <a href="#" className="text-link-plain">View all projects →</a>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Modal Window</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Overlay dialog pattern</p>

          <div>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Standard Modal</h4>
            <div style={{ background: 'rgba(128, 128, 128, 0.65)', padding: '80px 40px', borderRadius: '6px' }}>
              <div style={{ 
                background: 'white', 
                borderRadius: '6px', 
                maxWidth: '500px', 
                width: '100%', 
                margin: '0 auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  padding: '32px 32px 24px',
                  borderBottom: '1px solid var(--rule)'
                }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: '28px', fontWeight: 400, letterSpacing: '-0.3px' }}>
                    Request an Introduction
                  </h3>
                  <button style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '32px', 
                    lineHeight: 1, 
                    color: 'var(--light)', 
                    cursor: 'pointer', 
                    padding: 0 
                  }}>
                    ×
                  </button>
                </div>
                <div style={{ padding: '32px' }}>
                  <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--mid)', marginBottom: '24px' }}>
                    We&apos;ll connect you with the right professionals from this team based on your specific needs and project scope.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input 
                      type="text" 
                      placeholder="Your name" 
                      style={{ 
                        fontFamily: 'var(--sans)', 
                        fontSize: '14px', 
                        padding: '12px 16px', 
                        border: '1px solid var(--rule)', 
                        borderRadius: '3px', 
                        width: '100%' 
                      }}
                    />
                    <input 
                      type="email" 
                      placeholder="Email address" 
                      style={{ 
                        fontFamily: 'var(--sans)', 
                        fontSize: '14px', 
                        padding: '12px 16px', 
                        border: '1px solid var(--rule)', 
                        borderRadius: '3px', 
                        width: '100%' 
                      }}
                    />
                    <textarea 
                      placeholder="Tell us about your project" 
                      rows={4}
                      style={{ 
                        fontFamily: 'var(--sans)', 
                        fontSize: '14px', 
                        padding: '12px 16px', 
                        border: '1px solid var(--rule)', 
                        borderRadius: '3px', 
                        width: '100%',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '12px', 
                  padding: '24px 32px 32px',
                  borderTop: '1px solid var(--rule)'
                }}>
                  <button className="btn-tertiary">Cancel</button>
                  <button className="btn-primary">Send Request</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PROJECT DETAIL COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Project Detail Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Specialized components for project pages</p>

          {/* Architect Attribution */}
          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Architect Attribution</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', textAlign: 'center' }}>
              <h1 className="arco-page-title" style={{ marginBottom: '12px' }}>Contemporary Villa on the Amstel</h1>
              <p className="architect-attribution">
                by <a href="#">Studio Modijefsky</a>
              </p>
            </div>
          </div>

          {/* Specifications Bar */}
          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Specifications Bar</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div className="specifications-bar">
                <div className="spec-item">
                  <span className="arco-eyebrow">Location</span>
                  <div className="arco-card-title">Amsterdam</div>
                </div>
                <div className="spec-item">
                  <span className="arco-eyebrow">Year</span>
                  <div className="arco-card-title">2024</div>
                </div>
                <div className="spec-item">
                  <span className="arco-eyebrow">Type</span>
                  <div className="arco-card-title">Villa</div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Credit Card */}
          <div>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Professional Credit Card</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ maxWidth: '200px', margin: '0 auto', textAlign: 'center' }}>
                <span className="arco-eyebrow" style={{ display: 'block', marginBottom: '16px' }}>Architect</span>
                <div className="credit-icon">
                  <span className="credit-icon-initials">SM</span>
                </div>
                <h3 className="arco-h4" style={{ marginBottom: '6px' }}>Studio Modijefsky</h3>
                <p className="arco-card-subtitle" style={{ marginBottom: '12px' }}>Amsterdam, NL</p>
                <span className="text-link-plain">View Portfolio →</span>
              </div>
            </div>
          </div>
        </div>

        {/* RESPONSIVE */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Responsive Breakpoints</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Mobile, tablet, and desktop layouts</p>

          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="arco-card-title" style={{ minWidth: '120px', fontWeight: 600 }}>Desktop</span>
                <span className="arco-small-text">1024px and up</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="arco-card-title" style={{ minWidth: '120px', fontWeight: 600 }}>Tablet</span>
                <span className="arco-small-text">768px - 1023px</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="arco-card-title" style={{ minWidth: '120px', fontWeight: 600 }}>Mobile</span>
                <span className="arco-small-text">0px - 767px</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
