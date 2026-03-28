import { redirect } from "next/navigation"
import { HeroSection, HeroProject } from "@/components/hero-section"
import { BrowseSection, BrowseCard } from "@/components/browse-section"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function ComponentsPage() {
  // Only allow access in development and preview deployments
  if (process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    redirect("/")
  }

  // Mock data for Hero
  const mockHeroProjects: HeroProject[] = [
    {
      id: "1",
      title: "Villa Mel",
      href: "/projects/villa-mel",
      imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2000&h=1200&fit=crop&q=90",
      caption: "Villa Mel · Naarden, NL"
    },
    {
      id: "2",
      title: "Canal House",
      href: "/projects/canal-house",
      imageUrl: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=2000&h=1200&fit=crop&q=90",
      caption: "Canal House · Amsterdam, NL"
    },
    {
      id: "3",
      title: "Modern Villa",
      href: "/projects/modern-villa",
      imageUrl: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=2000&h=1200&fit=crop&q=90",
      caption: "Modern Villa · Rotterdam, NL"
    }
  ]

  // Mock data for Browse Section
  const mockProjects: BrowseCard[] = [
    {
      id: "1",
      title: "Villa",
      href: "/projects?type=villa",
      imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=700&h=520&fit=crop",
      count: "340+ projects"
    },
    {
      id: "2",
      title: "Townhouse",
      href: "/projects?type=townhouse",
      imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&h=520&fit=crop",
      count: "210+ projects"
    },
    {
      id: "3",
      title: "Apartment",
      href: "/projects?type=apartment",
      imageUrl: "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=700&h=520&fit=crop",
      count: "180+ projects"
    },
    {
      id: "4",
      title: "Extension",
      href: "/projects?type=extension",
      imageUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=700&h=520&fit=crop",
      count: "140+ projects"
    },
    {
      id: "5",
      title: "Country House",
      href: "/projects?type=country-house",
      imageUrl: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=700&h=520&fit=crop",
      count: "90+ projects"
    }
  ]

  const mockSpaces: BrowseCard[] = [
    {
      id: "1",
      title: "Kitchen",
      href: "/projects?space=kitchen",
      imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&h=600&fit=crop"
    },
    {
      id: "2",
      title: "Living Room",
      href: "/projects?space=living",
      imageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=500&h=600&fit=crop"
    },
    {
      id: "3",
      title: "Bedroom",
      href: "/projects?space=bedroom",
      imageUrl: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=500&h=600&fit=crop"
    },
    {
      id: "4",
      title: "Outdoor",
      href: "/projects?space=outdoor",
      imageUrl: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=500&h=600&fit=crop"
    },
    {
      id: "5",
      title: "Bathroom",
      href: "/projects?space=bathroom",
      imageUrl: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=500&h=600&fit=crop"
    }
  ]

  const mockProfessionals: BrowseCard[] = [
    {
      id: "1",
      title: "Architects",
      href: "/professionals?role=architect",
      imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&h=600&fit=crop"
    },
    {
      id: "2",
      title: "Builders",
      href: "/professionals?role=builder",
      imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500&h=600&fit=crop"
    },
    {
      id: "3",
      title: "Interior Designers",
      href: "/professionals?role=interior-designer",
      imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&h=600&fit=crop"
    },
    {
      id: "4",
      title: "Landscape Architects",
      href: "/professionals?role=landscape-architect",
      imageUrl: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&h=600&fit=crop"
    },
    {
      id: "5",
      title: "Engineers",
      href: "/professionals?role=engineer",
      imageUrl: "https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=500&h=600&fit=crop"
    }
  ]

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
          <p style={{ fontSize: '16px', color: 'var(--mid)', maxWidth: '700px', marginBottom: '20px' }}>
            Live examples of all Arco components. These are the <strong>actual production components</strong> from your app.
          </p>
          <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '6px', padding: '16px' }}>
            <p style={{ fontSize: '14px', color: '#2e7d32', margin: 0 }}>
              ✅ <strong>Live Components:</strong> This page now uses your real components with mock data. 
              Any changes you make to components will automatically appear here.
            </p>
          </div>
        </div>

        {/* NAVIGATION */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Navigation</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            Header and footer components (live from components/header.tsx and components/footer.tsx)
          </p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Header Component</h4>
            <div style={{ border: '1px solid var(--rule)', borderRadius: '6px', overflow: 'hidden' }}>
              <Header />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
              📁 Source: components/header.tsx
            </p>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Footer Component</h4>
            <div style={{ border: '1px solid var(--rule)', borderRadius: '6px', overflow: 'hidden' }}>
              <Footer />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
              📁 Source: components/footer.tsx
            </p>
          </div>
        </div>

        {/* HERO SECTIONS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Hero Section</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            Homepage hero with carousel (live from components/hero-section.tsx)
          </p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Hero with Carousel</h4>
            <div style={{ border: '1px solid var(--rule)', borderRadius: '6px', overflow: 'hidden' }}>
              <HeroSection projects={mockHeroProjects} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
              📁 Source: components/hero-section.tsx | 🎯 Props: projects (HeroProject[])
            </p>
          </div>
        </div>

        {/* BROWSE SECTION */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Browse Section</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            Three-path browsing (live from components/browse-section.tsx)
          </p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Browse by Project, Space, Professional</h4>
            <div style={{ border: '1px solid var(--rule)', borderRadius: '6px', overflow: 'hidden' }}>
              <BrowseSection 
                projects={mockProjects}
                spaces={mockSpaces}
                professionals={mockProfessionals}
              />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
              📁 Source: components/browse-section.tsx | 🎯 Props: projects, spaces, professionals (BrowseCard[])
            </p>
          </div>
        </div>

        {/* BUTTONS & FORMS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Buttons & Forms</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            Interactive elements styled with globals.css
          </p>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Button States</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ display: 'grid', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Default</span>
                  <button className="btn-primary">Primary</button>
                  <button className="btn-secondary">Secondary</button>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Disabled</span>
                  <button className="btn-primary" disabled>Primary</button>
                  <button className="btn-secondary" disabled>Secondary</button>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ minWidth: '100px', fontSize: '14px', color: 'var(--mid)' }}>Links</span>
                  <a href="#" className="btn-primary">Primary Link</a>
                  <a href="#" className="btn-secondary">Secondary Link</a>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
              🎨 Styles: .btn-primary, .btn-secondary from globals.css
            </p>
          </div>

          <div style={{ marginBottom: '48px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Form Controls</h4>
            <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
              <div style={{ maxWidth: '500px', display: 'grid', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>
                    Text Input
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter text..." 
                    className="input-text"
                    style={{ width: '100%', maxWidth: '400px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>
                    Email Input
                  </label>
                  <input 
                    type="email" 
                    placeholder="email@example.com" 
                    className="input-text"
                    style={{ width: '100%', maxWidth: '400px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--mid)', fontWeight: 500 }}>
                    Disabled Input
                  </label>
                  <input 
                    type="text" 
                    placeholder="Disabled..." 
                    disabled 
                    className="input-text"
                    style={{ width: '100%', maxWidth: '400px' }} 
                  />
                </div>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
              🎨 Styles: .input-text from globals.css
            </p>
          </div>
        </div>

        {/* TYPOGRAPHY */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Typography</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            Typography classes from globals.css
          </p>

          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '40px' }}>
            <div style={{ display: 'grid', gap: '32px' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--light)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  .arco-hero-title
                </p>
                <h1 className="arco-hero-title">Hero Title</h1>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--light)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  .arco-page-title
                </p>
                <h2 className="arco-page-title">Page Title</h2>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--light)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  .arco-section-title
                </p>
                <h3 className="arco-section-title">Section Title</h3>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--light)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  .arco-card-title
                </p>
                <h4 className="arco-card-title">Card Title</h4>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--light)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  .arco-body-text
                </p>
                <p className="arco-body-text">
                  This is body text. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--light)', marginBottom: '8px', fontFamily: 'monospace' }}>
                  .arco-small-text
                </p>
                <p className="arco-small-text">
                  This is small text for captions and metadata.
                </p>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--mid)', marginTop: '12px', fontStyle: 'italic' }}>
            🎨 All typography classes defined in globals.css
          </p>
        </div>

        {/* USAGE NOTES */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Usage Notes</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            How to use this component library
          </p>

          <div style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '6px', padding: '24px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#2e7d32' }}>
              ✅ Live Components
            </h4>
            <ul style={{ fontSize: '14px', lineHeight: 1.8, color: '#2e7d32', paddingLeft: '20px' }}>
              <li><strong>Automatic updates</strong> - Changes to components appear here immediately</li>
              <li><strong>Real production code</strong> - These are your actual components, not demos</li>
              <li><strong>Mock data</strong> - Components use sample data defined in this file</li>
              <li><strong>CSS from globals.css</strong> - All styling comes from your global stylesheet</li>
            </ul>
          </div>

          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', padding: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#856404' }}>
              💡 How to Test Changes
            </h4>
            <ul style={{ fontSize: '14px', lineHeight: 1.8, color: '#856404', paddingLeft: '20px' }}>
              <li><strong>Edit a component</strong> - Make changes to any component file</li>
              <li><strong>See it here</strong> - Visit /components to see the updated component</li>
              <li><strong>Test with real data</strong> - Check your homepage to see it with actual data</li>
              <li><strong>Update mock data</strong> - Edit this file to test different scenarios</li>
            </ul>
          </div>
        </div>

        {/* COMPONENT LIST */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Available Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>
            Components currently in your app
          </p>

          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              {[
                { name: 'Header', file: 'components/header.tsx', props: 'No props' },
                { name: 'HeroSection', file: 'components/hero-section.tsx', props: 'projects: HeroProject[]' },
                { name: 'BrowseSection', file: 'components/browse-section.tsx', props: 'projects, spaces, professionals: BrowseCard[]' },
                { name: 'RecentProjects', file: 'components/recent-projects.tsx', props: 'TBD' },
                { name: 'FeaturedCompanies', file: 'components/featured-companies.tsx', props: 'TBD' },
                { name: 'MembershipCTA', file: 'components/membership-cta.tsx', props: 'No props' },
                { name: 'Footer', file: 'components/footer.tsx', props: 'No props' }
              ].map((component, i) => (
                <div key={i} style={{ 
                  padding: '16px', 
                  background: 'var(--surface)', 
                  borderRadius: '4px',
                  display: 'grid',
                  gridTemplateColumns: '200px 1fr 1fr',
                  gap: '16px',
                  alignItems: 'center'
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 600 }}>
                    {component.name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--mid)' }}>
                    📁 {component.file}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--light)', fontFamily: 'monospace' }}>
                    {component.props}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
