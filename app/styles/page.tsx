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
        <div style={{ paddingBottom: '40px', marginBottom: '60px', borderBottom: '1px solid var(--rule)' }}>
          <h1 className="arco-page-title" style={{ marginBottom: '12px' }}>
            Arco Design System
          </h1>
          <p className="arco-body-text" style={{ maxWidth: '700px' }}>
            Visual reference for the Arco design system. All colors, typography, components, and patterns.
          </p>
        </div>

        {/* COLORS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Color Palette</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Core Arco Colors</p>

          {/* Primary Colors */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Primary Colors</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ height: '100px', background: '#FAFAF9', borderRadius: '6px', marginBottom: '12px', border: '2px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>White</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#FAFAF9</div>
                <div className="arco-small-text">Main background color for pages, cards, and content areas.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#1c1c1a', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>Black</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#1c1c1a</div>
                <div className="arco-small-text">Primary text color. Also used for secondary buttons and active states.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#016D75', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>Accent (Teal)</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#016D75</div>
                <div className="arco-small-text">Primary buttons, link hovers, focus rings. Use sparingly.</div>
              </div>
            </div>
          </div>

          {/* Secondary Colors */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Secondary Colors</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ height: '100px', background: '#f5f5f4', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>Surface</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#f5f5f4</div>
                <div className="arco-small-text">Elevated surfaces, card backgrounds.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#6b6b68', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>Mid Gray</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#6b6b68</div>
                <div className="arco-small-text">Body text, descriptions.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#a1a1a0', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>Light Gray</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#a1a1a0</div>
                <div className="arco-small-text">Metadata, subtitles, disabled states.</div>
              </div>
              <div>
                <div style={{ height: '100px', background: '#e5e5e4', borderRadius: '6px', marginBottom: '12px', border: '1px solid var(--rule)' }}></div>
                <div className="arco-card-title" style={{ marginBottom: '4px' }}>Rule</div>
                <div className="arco-small-text" style={{ fontFamily: 'Monaco, monospace', marginBottom: '8px' }}>#e5e5e4</div>
                <div className="arco-small-text">Borders, dividers, separators.</div>
              </div>
            </div>
          </div>
        </div>

        {/* TYPOGRAPHY */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Typography</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Arco Typography Classes</p>

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
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H4 (Headings) — .arco-h4 — 15px, Sans, 500</div>
              <h4 className="arco-h4">Primary Colors</h4>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>H4 (Cards) — .arco-card-title — 15px, Sans, 400</div>
              <h4 className="arco-card-title">Contemporary Villa on the Amstel</h4>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Body — .arco-body-text — 15px, Sans, 300, Mid Gray</div>
              <p className="arco-body-text">Arco is where leading architects publish their residential work and credential the professionals they collaborate with.</p>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Nav — .arco-nav-text — 15px, Sans, 400</div>
              <p className="arco-nav-text">Projects · Professionals · About</p>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Subtitle — .arco-card-subtitle — 14px, Sans, 400, Light Gray</div>
              <p className="arco-card-subtitle">by Studio Modijefsky · Amsterdam · 2024</p>
            </div>

            <div style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--rule)' }}>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Small — .arco-small-text — 14px, Sans, 400, Mid Gray</div>
              <p className="arco-small-text">Footer links, captions, secondary information</p>
            </div>

            <div>
              <div className="arco-eyebrow" style={{ marginBottom: '12px' }}>Eyebrow — .arco-eyebrow — 11px, Sans, 500, Uppercase</div>
              <p className="arco-eyebrow">ARCHITECT · AMSTERDAM · 2024</p>
            </div>
          </div>
        </div>

        {/* BUTTONS & LINKS - UPDATED */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Buttons & Links</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Interactive elements and CTAs</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Buttons</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                <span className="arco-small-text" style={{ minWidth: '100px' }}>Default</span>
                <button className="btn-primary">Primary Button</button>
                <button className="btn-secondary">Secondary Button</button>
                <button className="btn-tertiary">Tertiary Button</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                <span className="arco-small-text" style={{ minWidth: '100px' }}>Disabled</span>
                <button className="btn-primary" disabled>Primary Button</button>
                <button className="btn-secondary" disabled>Secondary Button</button>
                <button className="btn-tertiary" disabled>Tertiary Button</button>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li className="arco-small-text" style={{ lineHeight: 1.7, paddingLeft: '16px', position: 'relative', marginBottom: '8px' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                  <strong>Primary (Teal):</strong> Single most important action — 15px, Sans, 400
                </li>
                <li className="arco-small-text" style={{ lineHeight: 1.7, paddingLeft: '16px', position: 'relative', marginBottom: '8px' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                  <strong>Secondary (Black):</strong> Alternative important actions — 15px, Sans, 400
                </li>
                <li className="arco-small-text" style={{ lineHeight: 1.7, paddingLeft: '16px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--accent)', fontWeight: 'bold' }}>•</span>
                  <strong>Tertiary (Outline):</strong> Subtle actions, cancel buttons — 15px, Sans, 400
                </li>
              </ul>
            </div>
          </div>

          {/* NEW: Navigation Links */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Navigation Links</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <a href="#" className="arco-nav-text">Projects</a>
                <span style={{ margin: '0 12px', color: 'var(--mid)' }}>·</span>
                <a href="#" className="arco-nav-text">Professionals</a>
                <span style={{ margin: '0 12px', color: 'var(--mid)' }}>·</span>
                <a href="#" className="arco-nav-text">About</a>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                Uses .arco-nav-text — 15px, Sans, 400 → Teal on hover
              </p>
            </div>
          </div>

          {/* NEW: Footer Links */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Footer Links</h4>
            <div style={{ background: '#1c1c1a', border: '1px solid #333', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <a href="#" className="footer-link">About</a>
                <span style={{ margin: '0 12px', color: '#6b6b68' }}>·</span>
                <a href="#" className="footer-link">Help Center</a>
                <span style={{ margin: '0 12px', color: '#6b6b68' }}>·</span>
                <a href="#" className="footer-link">Privacy Policy</a>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                Uses .footer-link — 14px, Sans, 400, Mid Gray → White on hover
              </p>
            </div>
          </div>

          {/* View All Link */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>View All Link</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <a href="#" className="view-all-link">View all projects →</a>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">Uses .view-all-link — 14px, Sans, 400, Light Gray → Teal on hover</p>
            </div>
          </div>

          {/* Inline Links */}
          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Inline Links</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <p className="arco-body-text" style={{ maxWidth: '600px' }}>
                Arco is where leading architects publish their residential work. We help <a href="#">discerning clients</a> discover exceptional teams.
              </p>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">Inline links inherit color, underline with gray → Teal color + underline on hover</p>
            </div>
          </div>
        </div>

        {/* FORM ELEMENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Form Elements</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Input styles and form components</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Text Input</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
                <div>
                  <label className="arco-small-text" style={{ display: 'block', marginBottom: '8px' }}>Default Input (Gray Outline)</label>
                  <input 
                    type="text" 
                    placeholder="Enter text..." 
                    className="input-base input-default"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="arco-small-text" style={{ display: 'block', marginBottom: '8px' }}>Focused Input (Black Outline)</label>
                  <input 
                    type="text" 
                    placeholder="Click to focus..." 
                    className="input-base"
                    style={{ 
                      width: '100%',
                      border: '1px solid var(--arco-black)'
                    }}
                  />
                </div>
                <div>
                  <label className="arco-small-text" style={{ display: 'block', marginBottom: '8px', color: 'var(--destructive)' }}>Error Input (Red Outline)</label>
                  <input 
                    type="text" 
                    placeholder="Invalid input..." 
                    className="input-base input-error"
                    style={{ width: '100%' }}
                  />
                  <p className="arco-small-text" style={{ marginTop: '4px', color: 'var(--destructive)' }}>This field is required</p>
                </div>
                <div>
                  <label className="arco-small-text" style={{ display: 'block', marginBottom: '8px' }}>Disabled Input</label>
                  <input 
                    type="text" 
                    placeholder="Disabled..." 
                    disabled
                    className="input-base input-disabled"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Textarea</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ maxWidth: '500px' }}>
                <label className="arco-small-text" style={{ display: 'block', marginBottom: '8px' }}>Message</label>
                <textarea 
                  placeholder="Enter your message..." 
                  rows={4}
                  className="input-base input-default"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Select Dropdown</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ maxWidth: '500px' }}>
                <label className="arco-small-text" style={{ display: 'block', marginBottom: '8px' }}>Project Type</label>
                <select 
                  className="input-base input-default"
                  style={{ width: '100%', cursor: 'pointer' }}
                >
                  <option>Select a type...</option>
                  <option>Villa</option>
                  <option>Townhouse</option>
                  <option>Apartment</option>
                  <option>Extension</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* CATEGORY TAGS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Category Tags</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Filter pills for galleries and navigation</p>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Filter Tags</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <button className="category-tag active">All</button>
                <button className="category-tag">Exterior</button>
                <button className="category-tag">Living</button>
                <button className="category-tag">Kitchen</button>
                <button className="category-tag">Bedroom</button>
                <button className="category-tag">Bathroom</button>
              </div>
              <p className="arco-small-text">
                <strong>Active:</strong> Black fill, white text, 500 weight, black outline<br/>
                <strong>Inactive:</strong> Transparent, black text, 400 weight, gray outline<br/>
                <strong>Hover:</strong> Black outline
              </p>
            </div>
          </div>
        </div>

        {/* CARDS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Cards</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Project and content card components</p>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Project Cards</h4>
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
                      justifyContent: 'center'
                    }}>
                      <span className="arco-small-text">Image {i}</span>
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
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Title and action patterns</p>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Header with View All</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '28px' }}>
                <h2 className="arco-section-title">Recently Published</h2>
                <a href="#" className="view-all-link">View all projects →</a>
              </div>
              <p className="arco-small-text">Uses .arco-section-title + .view-all-link</p>
            </div>
          </div>
        </div>

        {/* LAYOUT COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Layout Components</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Section and container patterns</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>How It Works Grid</h4>
            <div style={{ background: 'var(--surface)', padding: '40px', borderRadius: '6px' }}>
              <div className="how-grid">
                <div className="how-card">
                  <div className="how-number">01</div>
                  <h3 className="how-title">First Step</h3>
                  <p className="how-body">This demonstrates the how-grid layout with proper spacing and typography.</p>
                </div>
                <div className="how-card">
                  <div className="how-number">02</div>
                  <h3 className="how-title">Second Step</h3>
                  <p className="how-body">Numbers use 36px serif, titles use 15px sans 500, body uses 15px sans mid gray.</p>
                </div>
                <div className="how-card">
                  <div className="how-number">03</div>
                  <h3 className="how-title">Third Step</h3>
                  <p className="how-body">Grid uses repeat(3, 1fr) with 40px gap, stacks on mobile.</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Editorial Grid (Recent Projects)</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <p className="arco-small-text" style={{ marginBottom: '16px' }}>
                <strong>Row 1:</strong> 2fr 1fr grid (large card + 2 stacked cards)<br/>
                <strong>Row 2:</strong> repeat(3, 1fr) grid (3 equal cards)<br/>
                <strong>Gap:</strong> 20px consistent<br/>
                <strong>Typography:</strong> .ed-name (15px, sans, 400), .ed-by (14px, light gray)
              </p>
            </div>
          </div>
        </div>

        {/* RESPONSIVE */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Responsive Breakpoints</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Mobile, tablet, and desktop layouts</p>

          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="arco-h4" style={{ minWidth: '120px' }}>Desktop</span>
                <span className="arco-small-text">1024px and up</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="arco-h4" style={{ minWidth: '120px' }}>Tablet</span>
                <span className="arco-small-text">768px - 1023px</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="arco-h4" style={{ minWidth: '120px' }}>Mobile</span>
                <span className="arco-small-text">0px - 767px</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
