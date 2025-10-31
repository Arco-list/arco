import { Heart, Bed } from "lucide-react"

export default function DesignTestPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Info Banner */}
      <div className="bg-surface border-b-2 border-border py-8 px-8">
        <div className="max-w-6xl mx-auto">
          <h3 className="mb-4">Design System Comparison</h3>
          <p className="text-text-secondary mb-6">Compare Pure Tailwind utilities vs Exact Style Guide specifications. The differences are subtle (1-2px).</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">TAILWIND</span>
                <span className="font-semibold">Pure Tailwind Utilities</span>
              </div>
              <p className="text-sm text-text-secondary mb-2">Standard Tailwind scale - no arbitrary values.</p>
              <ul className="text-xs text-text-secondary space-y-1">
                <li>• Body: text-base (16px)</li>
                <li>• Small: text-sm (14px)</li>
                <li>• Buttons: Standard Tailwind spacing</li>
              </ul>
            </div>
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">STYLE GUIDE</span>
                <span className="font-semibold">Exact Design Specifications</span>
              </div>
              <p className="text-sm text-text-secondary mb-2">Exact pixel values from style guide.</p>
              <ul className="text-xs text-text-secondary space-y-1">
                <li>• Body: 15px (exact)</li>
                <li>• Small: 13px (exact)</li>
                <li>• Buttons: Exact spacing per spec</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - TAILWIND */}
      <section className="bg-gradient-to-b from-surface to-background py-16 px-8 border-b-4 border-blue-500">
        <div className="max-w-6xl mx-auto">
          <div className="inline-block bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
            TAILWIND
          </div>
          <div className="relative inline-block mb-4">
            <h1 className="text-7xl md:text-8xl">World's finest architectural constructions</h1>
            <span className="absolute -top-6 left-0 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">H1: 72px mobile → 96px desktop</span>
          </div>
          <div className="relative inline-block max-w-2xl">
            <p className="text-text-secondary">Experience the beauty of exceptional design and craftsmanship</p>
            <span className="absolute -top-6 left-0 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Body: 16px (text-base)</span>
          </div>
          <div className="flex gap-4 mt-8 flex-wrap">
            <button className="btn btn-primary">Explore Projects</button>
            <button className="btn btn-secondary">Find Professionals</button>
            <button className="btn btn-tertiary">Professionals</button>
            <button className="btn btn-quaternary"><Bed className="h-4 w-4 mr-2" />Bedroom</button>
          </div>
        </div>
      </section>

      {/* Hero Section - STYLE GUIDE */}
      <section className="bg-gradient-to-b from-surface to-background py-16 px-8 border-b-4 border-green-500">
        <div className="max-w-6xl mx-auto">
          <div className="inline-block bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-4">
            STYLE GUIDE
          </div>
          <div className="relative inline-block mb-4">
            <h1 style={{ fontSize: '76px', lineHeight: '1' }} className="font-semibold">World's finest architectural constructions</h1>
            <span className="absolute -top-6 left-0 text-xs bg-green-600 text-white px-2 py-0.5 rounded">H1: 76px</span>
          </div>
          <div className="relative inline-block max-w-2xl">
            <p className="text-text-secondary" style={{ fontSize: '15px' }}>Experience the beauty of exceptional design and craftsmanship</p>
            <span className="absolute -top-6 left-0 text-xs bg-green-600 text-white px-2 py-0.5 rounded">Body: 15px (exact)</span>
          </div>
          <div className="flex gap-4 mt-8 flex-wrap">
            <button className="btn btn-primary-exact">Explore Projects</button>
            <button className="btn btn-secondary-exact">Find Professionals</button>
            <button className="btn btn-tertiary-exact">Professionals</button>
            <button className="btn btn-quaternary-exact"><Bed className="h-4 w-4 mr-2" />Bedroom</button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto p-8 space-y-16">

        {/* Project Cards - TAILWIND */}
        <section className="space-y-6 border-4 border-blue-500 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <h2>Project Cards</h2>
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">TAILWIND</span>
          </div>
          <p className="text-sm text-text-secondary">H5: text-base (16px), body-small: text-sm (14px) — Pure Tailwind utilities</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-surface rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] bg-tertiary flex items-center justify-center">
                <span className="text-text-disabled">Project Image</span>
              </div>
              <div className="p-4 space-y-2">
                <h5>Modern Villa in Amsterdam</h5>
                <p className="body-small text-text-secondary">Contemporary architecture with sustainable design</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="body-small text-text-secondary">Amsterdam, NL</span>
                  <button className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" />
                    <span className="body-small">24</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-surface rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] bg-tertiary flex items-center justify-center">
                <span className="text-text-disabled">Project Image</span>
              </div>
              <div className="p-4 space-y-2">
                <h5>Minimalist Home in Utrecht</h5>
                <p className="body-small text-text-secondary">Clean lines and natural materials</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="body-small text-text-secondary">Utrecht, NL</span>
                  <button className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" />
                    <span className="body-small">18</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-surface rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] bg-tertiary flex items-center justify-center">
                <span className="text-text-disabled">Project Image</span>
              </div>
              <div className="p-4 space-y-2">
                <h5>Luxury Estate in The Hague</h5>
                <p className="body-small text-text-secondary">Timeless elegance meets modern comfort</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="body-small text-text-secondary">The Hague, NL</span>
                  <button className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" />
                    <span className="body-small">42</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Project Cards - STYLE GUIDE */}
        <section className="space-y-6 border-4 border-green-500 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <h2>Project Cards</h2>
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">STYLE GUIDE</span>
          </div>
          <p className="text-sm text-text-secondary">H5: 16px (exact), body-small: 13px (exact) — Exact style guide values</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-surface rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] bg-tertiary flex items-center justify-center">
                <span className="text-text-disabled">Project Image</span>
              </div>
              <div className="p-4 space-y-2">
                <h5 style={{ fontSize: '16px' }}>Modern Villa in Amsterdam</h5>
                <p className="text-text-secondary" style={{ fontSize: '13px', lineHeight: '1.5' }}>Contemporary architecture with sustainable design</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-text-secondary" style={{ fontSize: '13px' }}>Amsterdam, NL</span>
                  <button className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" />
                    <span style={{ fontSize: '13px' }}>24</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-surface rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] bg-tertiary flex items-center justify-center">
                <span className="text-text-disabled">Project Image</span>
              </div>
              <div className="p-4 space-y-2">
                <h5 style={{ fontSize: '16px' }}>Minimalist Home in Utrecht</h5>
                <p className="text-text-secondary" style={{ fontSize: '13px', lineHeight: '1.5' }}>Clean lines and natural materials</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-text-secondary" style={{ fontSize: '13px' }}>Utrecht, NL</span>
                  <button className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" />
                    <span style={{ fontSize: '13px' }}>18</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-surface rounded-lg overflow-hidden border border-border hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] bg-tertiary flex items-center justify-center">
                <span className="text-text-disabled">Project Image</span>
              </div>
              <div className="p-4 space-y-2">
                <h5 style={{ fontSize: '16px' }}>Luxury Estate in The Hague</h5>
                <p className="text-text-secondary" style={{ fontSize: '13px', lineHeight: '1.5' }}>Timeless elegance meets modern comfort</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-text-secondary" style={{ fontSize: '13px' }}>The Hague, NL</span>
                  <button className="flex items-center gap-1 text-text-secondary hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" />
                    <span style={{ fontSize: '13px' }}>42</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Professional Cards - TAILWIND */}
        <section className="space-y-6 border-4 border-blue-500 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <h2>Professional Cards</h2>
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">TAILWIND</span>
          </div>
          <p className="text-sm text-text-secondary">Using Pure Tailwind utilities</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center">
                  <span className="text-text-secondary font-semibold">AB</span>
                </div>
                <div className="flex-1">
                  <h4>Architectural Bureau Amsterdam</h4>
                  <p className="text-text-secondary">Architecture & Interior Design</p>
                  <p className="body-small text-text-secondary mt-1">Amsterdam, Netherlands</p>
                </div>
              </div>
              <p className="text-text-secondary">Specializing in contemporary residential design with over 20 years of experience creating innovative living spaces.</p>
              <div className="flex gap-3">
                <button className="btn btn-primary flex-1">View Profile</button>
                <button className="btn btn-secondary">Contact</button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center">
                  <span className="text-text-secondary font-semibold">DB</span>
                </div>
                <div className="flex-1">
                  <h4>Dutch Builders Group</h4>
                  <p className="text-text-secondary">Construction & Project Management</p>
                  <p className="body-small text-text-secondary mt-1">Rotterdam, Netherlands</p>
                </div>
              </div>
              <p className="text-text-secondary">Full-service construction company delivering high-quality builds with attention to detail and sustainable practices.</p>
              <div className="flex gap-3">
                <button className="btn btn-primary flex-1">View Profile</button>
                <button className="btn btn-secondary">Contact</button>
              </div>
            </div>
          </div>
        </section>

        {/* Professional Cards - STYLE GUIDE */}
        <section className="space-y-6 border-4 border-green-500 p-6 rounded-lg">
          <div className="flex items-center gap-3">
            <h2>Professional Cards</h2>
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">STYLE GUIDE</span>
          </div>
          <p className="text-sm text-text-secondary">Using exact style guide specifications</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center">
                  <span className="text-text-secondary font-semibold">AB</span>
                </div>
                <div className="flex-1">
                  <h4>Architectural Bureau Amsterdam</h4>
                  <p className="text-text-secondary">Architecture & Interior Design</p>
                  <p className="body-small text-text-secondary mt-1">Amsterdam, Netherlands</p>
                </div>
              </div>
              <p className="text-text-secondary">Specializing in contemporary residential design with over 20 years of experience creating innovative living spaces.</p>
              <div className="flex gap-3">
                <button className="btn btn-primary-exact flex-1">View Profile</button>
                <button className="btn btn-secondary-exact">Contact</button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center">
                  <span className="text-text-secondary font-semibold">DB</span>
                </div>
                <div className="flex-1">
                  <h4>Dutch Builders Group</h4>
                  <p className="text-text-secondary">Construction & Project Management</p>
                  <p className="body-small text-text-secondary mt-1">Rotterdam, Netherlands</p>
                </div>
              </div>
              <p className="text-text-secondary">Full-service construction company delivering high-quality builds with attention to detail and sustainable practices.</p>
              <div className="flex gap-3">
                <button className="btn btn-primary-exact flex-1">View Profile</button>
                <button className="btn btn-secondary-exact">Contact</button>
              </div>
            </div>
          </div>
        </section>

        {/* Button Comparison */}
        <section className="space-y-6">
          <h2>Complete Button Comparison</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* TAILWIND COLUMN */}
            <div className="space-y-6">
              <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">TAILWIND</span>
              </div>

              {/* Primary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Primary: text-base (16px), px-6 (24px)</p>
                <button className="btn btn-primary">Explore Projects</button>
              </div>

              {/* Secondary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Secondary: text-sm (14px), px-4 (16px)</p>
                <button className="btn btn-secondary">View Projects</button>
              </div>

              {/* Tertiary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Tertiary: text-sm (14px), px-4 (16px)</p>
                <button className="btn btn-tertiary">Professionals</button>
              </div>

              {/* Quaternary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Quaternary: text-sm (14px), py-1.5 px-3 (6px/12px)</p>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-quaternary">Location</button>
                  <button className="btn btn-quaternary"><Bed className="h-4 w-4 mr-2" />Bedroom</button>
                </div>
              </div>

              {/* Text */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Text: text-sm (14px), no padding → py-1.5 px-3 on hover</p>
                <div className="flex gap-4">
                  <button className="btn btn-text">Projects</button>
                  <button className="btn btn-text">Professionals</button>
                  <button className="btn btn-text">Account</button>
                </div>
              </div>

              {/* Text Listed */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Text Listed: text-sm (14px), font-normal, hover: text-secondary</p>
                <div className="flex flex-col gap-2">
                  <button className="btn btn-text-listed text-left">Projects</button>
                  <button className="btn btn-text-listed text-left">Professionals</button>
                  <button className="btn btn-text-listed text-left">About</button>
                </div>
              </div>

              {/* Disabled States */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Disabled States</p>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-primary" disabled>Primary</button>
                  <button className="btn btn-secondary" disabled>Secondary</button>
                  <button className="btn btn-tertiary" disabled>Tertiary</button>
                  <button className="btn btn-quaternary" disabled>Quaternary</button>
                </div>
              </div>
            </div>

            {/* STYLE GUIDE COLUMN */}
            <div className="space-y-6">
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">STYLE GUIDE</span>
              </div>

              {/* Primary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Primary: 15px text, 12px/24px padding</p>
                <button className="btn btn-primary-exact">Explore Projects</button>
              </div>

              {/* Secondary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Secondary: 13px text, 12px/18px padding</p>
                <button className="btn btn-secondary-exact">View Projects</button>
              </div>

              {/* Tertiary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Tertiary: 13px text, 12px/18px padding</p>
                <button className="btn btn-tertiary-exact">Professionals</button>
              </div>

              {/* Quaternary */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Quaternary: 13px text, 6px/12px padding</p>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-quaternary-exact">Location</button>
                  <button className="btn btn-quaternary-exact"><Bed className="h-4 w-4 mr-2" />Bedroom</button>
                </div>
              </div>

              {/* Text */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Text: 13px, no padding → 6px/12px on hover</p>
                <div className="flex gap-4">
                  <button className="btn btn-text-exact">Projects</button>
                  <button className="btn btn-text-exact">Professionals</button>
                  <button className="btn btn-text-exact">Account</button>
                </div>
              </div>

              {/* Text Listed */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Text Listed: 13px, font-normal (400), hover: text-secondary</p>
                <div className="flex flex-col gap-2">
                  <button className="btn btn-text-listed-exact text-left">Projects</button>
                  <button className="btn btn-text-listed-exact text-left">Professionals</button>
                  <button className="btn btn-text-listed-exact text-left">About</button>
                </div>
              </div>

              {/* Disabled States */}
              <div className="bg-surface p-4 rounded-lg">
                <p className="body-small text-text-secondary mb-3">Disabled States</p>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-primary-exact" disabled>Primary</button>
                  <button className="btn btn-secondary-exact" disabled>Secondary</button>
                  <button className="btn btn-tertiary-exact" disabled>Tertiary</button>
                  <button className="btn btn-quaternary-exact" disabled>Quaternary</button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
