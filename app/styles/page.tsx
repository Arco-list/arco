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

        {/* FILTER PILLS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Filter Pills</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Pill buttons used in discover filter bars</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Pill States</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
                <span className="arco-small-text" style={{ minWidth: '80px' }}>Default</span>
                <button className="filter-pill">All filters</button>
                <button className="filter-pill">Space</button>
                <button className="filter-pill">Location</button>
                <button className="filter-pill">Most recent</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '24px' }}>
                <span className="arco-small-text" style={{ minWidth: '80px' }}>Active</span>
                <button className="filter-pill" data-active="true">
                  All filters
                  <span className="filter-pill-badge">3</span>
                </button>
                <button className="filter-pill" data-active="true">Kitchen</button>
                <button className="filter-pill" data-active="true">Amsterdam</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <span className="arco-small-text" style={{ minWidth: '80px' }}>With divider</span>
                <button className="filter-pill">All filters</button>
                <div className="filter-pill-divider" />
                <button className="filter-pill">Type</button>
                <button className="filter-pill">Location</button>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.filter-pill</strong> — 13px, Sans, 400, rounded-full, 1px border<br/>
                <strong>data-active="true"</strong> — black border<br/>
                <strong>.filter-pill-badge</strong> — circular count indicator (black bg, white text)<br/>
                <strong>.filter-pill-divider</strong> — 1px vertical separator
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Filter Dropdown</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button className="filter-pill" data-open="true" data-active="true">
                  Type
                  <span className="filter-pill-badge">1</span>
                  <svg style={{ marginLeft: 2 }} className="filter-pill-chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 3.5l2.5 2.5 2.5-2.5" />
                  </svg>
                </button>
                {/* Shown inline (override position for demo) */}
                <div style={{ position: 'relative', top: 10, left: 0, background: 'var(--background)', border: '1px solid var(--arco-rule)', borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.09)', minWidth: 224, padding: '8px 0' }}>
                  {['Villa', 'Townhouse', 'Apartment', 'Extension'].map((label, i) => (
                    <div key={label} className="filter-dropdown-option" data-checked={i === 0 ? "true" : "false"}>
                      <div className="filter-dropdown-option-left">
                        <div className="filter-checkbox">
                          {i === 0 && (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                              <path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="filter-dropdown-label">{label}</span>
                      </div>
                    </div>
                  ))}
                  <div className="filter-dropdown-search" style={{ marginTop: 4 }}>
                    <input type="text" placeholder="Search…" readOnly />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.filter-dropdown</strong> — absolute panel, animated via data-open="true"<br/>
                <strong>.filter-dropdown-option</strong> — row with checkbox + label, justify-between<br/>
                <strong>.filter-checkbox</strong> — 15px square, black when checked<br/>
                <strong>.filter-dropdown-search</strong> — search input inside dropdown
              </p>
            </div>
          </div>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Active Filter Chips</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
              <div className="discover-chip-strip">
                <div style={{ padding: '0 40px' }}>
                  <div className="discover-chip-strip-inner">
                    <button className="filter-chip">Kitchen <span className="filter-chip-close" aria-hidden="true">✕</span></button>
                    <button className="filter-chip">Amsterdam <span className="filter-chip-close" aria-hidden="true">✕</span></button>
                    <button className="filter-chip">Villa <span className="filter-chip-close" aria-hidden="true">✕</span></button>
                    <button className="filter-chip-clear-all">Clear all</button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.discover-chip-strip</strong> — white bg, border-bottom rule, scrolls with page<br/>
                <strong>.filter-chip</strong> — surface bg pill with label + ✕ icon<br/>
                <strong>.filter-chip-clear-all</strong> — plain text "Clear all" button
              </p>
            </div>
          </div>
        </div>

        {/* DISCOVER CARDS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Discover Cards</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Project and professional cards used in discover grids</p>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Discover Card Anatomy</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="discover-card" style={{ pointerEvents: 'none' }}>
                    <div className="discover-card-image-wrap">
                      <div className="discover-card-image-layer" style={{ background: 'var(--arco-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="arco-small-text">4:3 image</span>
                      </div>
                    </div>
                    <h3 className="discover-card-title">Contemporary Villa {i}</h3>
                    <p className="discover-card-sub">House · Amsterdam</p>
                    <p className="discover-card-professional">Studio Modijefsky</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.discover-card</strong> — block link, no underline<br/>
                <strong>.discover-card-image-wrap</strong> — 4:3 aspect ratio, overflow hidden, 3px radius<br/>
                <strong>.discover-card-title</strong> — 15px, sans, 400, black<br/>
                <strong>.discover-card-sub</strong> — 13px, sans, 400, mid gray<br/>
                <strong>.discover-card-professional</strong> — 13px, sans, 400, light gray
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Discover Grid</h4>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.discover-grid</strong> — repeat(3, 1fr), 28px gap; collapses to 1fr on mobile<br/>
                <strong>.discover-results</strong> — wrapper with 80px bottom padding<br/>
                <strong>.discover-results-meta</strong> — flex row, 36px top / 24px bottom margin<br/>
                <strong>.discover-results-count</strong> — 14px, mid gray; bold count in arco-black
              </p>
            </div>
          </div>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Load More Button</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div className="discover-load-more">
                <button className="discover-load-more-btn">
                  Load more
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.discover-load-more</strong> — centered flex container, 48px top padding<br/>
                <strong>.discover-load-more-btn</strong> — 13px, sans, 400, rule border, rounded-full → black border on hover
              </p>
            </div>
          </div>
        </div>

        {/* DISCOVER DRAWER */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Filter Drawer</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Slide-in panel triggered by "All filters" — used on discover pages</p>

          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Drawer Structure (static preview)</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
              {/* Static mockup of drawer without fixed positioning */}
              <div style={{ borderBottom: '1px solid var(--arco-rule)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>All filters</span>
                <button style={{ width: 32, height: 32, border: '1px solid var(--arco-rule)', borderRadius: '50%', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              <div style={{ padding: '0 24px' }}>
                {/* Drawer sections */}
                {['Space', 'Type', 'Location'].map((title, i) => (
                  <div key={title} className="drawer-section">
                    <div className="drawer-section-header" style={{ cursor: 'default' }}>
                      <div className="drawer-section-header-left">
                        <span className="drawer-section-title">{title}</span>
                        {i === 0 && <span className="drawer-section-badge">1 selected</span>}
                      </div>
                      <svg className="drawer-section-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4l3 3 3-3" />
                      </svg>
                    </div>
                    {i === 0 && (
                      <div className="drawer-section-body">
                        <div className="drawer-option-list">
                          {['Kitchen', 'Bathroom', 'Bedroom'].map((opt, j) => (
                            <div key={opt} className="drawer-option" data-checked={j === 0 ? "true" : "false"} style={{ cursor: 'default' }}>
                              <div className="drawer-option-left">
                                <div className="drawer-option-checkbox">
                                  {j === 0 && (
                                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                      <path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span className="drawer-option-label">{opt}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--arco-rule)', padding: '16px 24px', display: 'flex', gap: 12 }}>
                <button className="discover-drawer-clear" style={{ position: 'static', flex: 1 }}>Clear all</button>
                <button className="discover-drawer-apply" style={{ flex: 1 }}>Show results</button>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.discover-drawer</strong> — fixed right panel, slides in via data-open="true" (z-600)<br/>
                <strong>.discover-drawer-backdrop</strong> — dark overlay, z-500<br/>
                <strong>.drawer-section</strong> — collapsible section with header + body<br/>
                <strong>.drawer-section-badge</strong> — "N selected" pill<br/>
                <strong>.drawer-option</strong> — checkbox row, data-checked="true" for selected<br/>
                <strong>.discover-drawer-clear</strong> — ghost clear button in footer<br/>
                <strong>.discover-drawer-apply</strong> — filled "Show results" button in footer
              </p>
            </div>
          </div>
        </div>

        {/* POPUPS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Popups</h2>
          <p className="arco-body-text" style={{ marginBottom: '32px' }}>Modal overlays for confirmations, status changes, and photo pickers</p>

          {/* Basic Popup */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Popup Card (static preview)</h4>
            <div style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div className="popup-card" style={{ position: 'relative', maxWidth: 380, width: '100%' }}>
                <div className="popup-header">
                  <h3 className="arco-section-title">Popup Title</h3>
                  <button type="button" className="popup-close" style={{ cursor: 'default' }}>✕</button>
                </div>
                <p className="arco-body-text" style={{ marginBottom: '20px' }}>
                  This is the standard popup card layout with header, close button, content area, and action buttons.
                </p>
                <div className="popup-actions">
                  <button type="button" className="btn-tertiary" style={{ flex: 1 }}>Cancel</button>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }}>Save</button>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.popup-overlay</strong> — fixed inset, rgba(0,0,0,0.4), z-500, flex center<br/>
                <strong>.popup-card</strong> — white bg, 12px radius, 28px padding, max-width 600px, 90% width<br/>
                <strong>.popup-header</strong> — flex row, space-between, 20px bottom margin<br/>
                <strong>.popup-close</strong> — 18px, no border/bg, light gray → black on hover<br/>
                <strong>.popup-actions</strong> — flex row, 10px gap
              </p>
            </div>
          </div>

          {/* Status Modal */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Status Modal</h4>
            <div style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div className="popup-card" style={{ position: 'relative', maxWidth: 380, width: '100%' }}>
                <div className="popup-header">
                  <h3 className="arco-section-title">Update status</h3>
                  <button type="button" className="popup-close" style={{ cursor: 'default' }}>✕</button>
                </div>
                <div className="status-modal-options">
                  <button type="button" className="status-modal-option selected" style={{ cursor: 'default' }}>
                    <span className="status-modal-dot" style={{ background: '#22c55e' }} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">Published</span>
                      <span className="status-modal-option-desc">Visible to everyone on Arco</span>
                    </div>
                  </button>
                  <button type="button" className="status-modal-option" style={{ cursor: 'default' }}>
                    <span className="status-modal-dot" style={{ background: '#a1a1a0' }} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">Unlisted</span>
                      <span className="status-modal-option-desc">Only people with the link can view</span>
                    </div>
                  </button>
                  <button type="button" className="status-modal-option" disabled style={{ cursor: 'default' }}>
                    <span className="status-modal-dot" style={{ background: '#eab308' }} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">Featured</span>
                      <span className="status-modal-option-desc">Highlighted on the homepage</span>
                      <span className="status-modal-upgrade" style={{ textDecoration: 'underline' }}>Upgrade to Plus</span>
                    </div>
                  </button>
                </div>
                <div className="popup-actions">
                  <button type="button" className="btn-tertiary" style={{ flex: 1 }}>Cancel</button>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }}>Save</button>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.status-modal-options</strong> — flex column, 8px gap, 20px bottom margin<br/>
                <strong>.status-modal-option</strong> — flex row, 14px padding, 1px border, 8px radius, gap 12px<br/>
                <strong>.status-modal-option.selected</strong> — 2px black border, surface bg<br/>
                <strong>.status-modal-dot</strong> — 10px circle indicator<br/>
                <strong>.status-modal-option-label</strong> — 14px, sans, 500<br/>
                <strong>.status-modal-option-desc</strong> — 13px, sans, 400, mid gray<br/>
                <strong>.status-modal-upgrade</strong> — 12px underline link for gated options
              </p>
            </div>
          </div>

          {/* Popup Banners */}
          <div style={{ marginBottom: '48px' }}>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Popup Banners</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: 380 }}>
                <div className="popup-banner popup-banner--info">
                  <div>
                    <p style={{ fontWeight: 500 }}>Under review by the Arco team</p>
                    <p>We&apos;ll email you once the review is complete.</p>
                  </div>
                </div>
                <div className="popup-banner popup-banner--warn">
                  <div>
                    <p style={{ fontWeight: 500 }}>You&apos;ve reached the Basic plan limit.</p>
                    <p>Unlist another project or upgrade to Plus.</p>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.popup-banner</strong> — flex, 10px 12px padding, 6px radius, 13px text<br/>
                <strong>.popup-banner--info</strong> — blue-tinted background for informational messages<br/>
                <strong>.popup-banner--warn</strong> — amber-tinted background for warnings
              </p>
            </div>
          </div>

          {/* Photo Picker Grid */}
          <div>
            <h4 className="arco-h4" style={{ marginBottom: '20px' }}>Photo Picker Grid</h4>
            <div style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div className="popup-card" style={{ position: 'relative', maxWidth: 600, width: '100%' }}>
                <div className="popup-header">
                  <h3 className="arco-section-title">Select a photo</h3>
                  <button type="button" className="popup-close" style={{ cursor: 'default' }}>✕</button>
                </div>
                <div className="popup-photo-grid" style={{ marginBottom: '20px' }}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="popup-photo-item" style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: i === 1 ? 'var(--arco-black)' : 'transparent' }}>
                      <span className="arco-small-text">Photo {i}</span>
                    </div>
                  ))}
                </div>
                <div className="popup-actions">
                  <button type="button" className="btn-tertiary" style={{ flex: 1 }}>Cancel</button>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }}>Confirm</button>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface)', padding: '16px 20px', borderRadius: '6px' }}>
              <p className="arco-small-text">
                <strong>.popup-photo-grid</strong> — 3-column grid, 10px gap<br/>
                <strong>.popup-photo-item</strong> — 4:3 aspect ratio, 5px radius, 2px transparent border<br/>
                <strong>Selected state:</strong> border-color: var(--arco-black)
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
