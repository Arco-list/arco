import { Heart, Bed, Mail, User, MapPin, Search, Star, Calendar } from "lucide-react"

export default function StylesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="mb-4">Arco Design System</h1>
          <p className="text-lg opacity-90 max-w-2xl">
            A comprehensive style guide documenting all design elements, components, and patterns used in the Arco platform.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-16">

        {/* Color Palette */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-2">Color Palette</h2>
            <p className="text-text-secondary">Brand colors and semantic color system</p>
          </div>

          {/* Primary Colors */}
          <div>
            <h4 className="mb-4">Primary Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  Primary
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Primary</p>
                  <p className="text-text-secondary font-mono text-xs">#FF333A</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-primary</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-primary-hover flex items-center justify-center text-primary-foreground font-semibold">
                  Hover
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Primary Hover</p>
                  <p className="text-text-secondary font-mono text-xs">#EC2D34</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-primary-hover</code>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Colors */}
          <div>
            <h4 className="mb-4">Secondary Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                  Secondary
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Secondary</p>
                  <p className="text-text-secondary font-mono text-xs">#222222</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-secondary</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-secondary-hover flex items-center justify-center text-secondary-foreground font-semibold">
                  Hover
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Secondary Hover</p>
                  <p className="text-text-secondary font-mono text-xs">#000000</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-secondary-hover</code>
                </div>
              </div>
            </div>
          </div>

          {/* Tertiary Colors */}
          <div>
            <h4 className="mb-4">Tertiary Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-tertiary border border-border flex items-center justify-center text-tertiary-foreground font-semibold">
                  Tertiary
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Tertiary</p>
                  <p className="text-text-secondary font-mono text-xs">#F2F2F2</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-tertiary</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-tertiary-hover border border-border flex items-center justify-center text-tertiary-foreground font-semibold">
                  Hover
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Tertiary Hover</p>
                  <p className="text-text-secondary font-mono text-xs">#EBEBEB</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-tertiary-hover</code>
                </div>
              </div>
            </div>
          </div>

          {/* Neutral Colors */}
          <div>
            <h4 className="mb-4">Neutral Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-background border-2 border-border flex items-center justify-center text-foreground font-semibold">
                  Background
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Background</p>
                  <p className="text-text-secondary font-mono text-xs">#FFFFFF</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-background</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-surface border border-border flex items-center justify-center text-foreground font-semibold">
                  Surface
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Surface</p>
                  <p className="text-text-secondary font-mono text-xs">#F5F5F5</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">bg-surface</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg border-4 border-border flex items-center justify-center text-foreground font-semibold">
                  Border
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Border</p>
                  <p className="text-text-secondary font-mono text-xs">#EBEBEB</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">border-border</code>
                </div>
              </div>
            </div>
          </div>

          {/* Text Colors */}
          <div>
            <h4 className="mb-4">Text Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <span className="text-text-primary font-semibold text-xl">Primary</span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Text Primary</p>
                  <p className="text-text-secondary font-mono text-xs">#222222</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">text-primary</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <span className="text-text-secondary font-semibold text-xl">Secondary</span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Text Secondary</p>
                  <p className="text-text-secondary font-mono text-xs">#6A6A6A</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">text-secondary</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-lg bg-surface border border-border flex items-center justify-center">
                  <span className="text-text-disabled font-semibold text-xl">Disabled</span>
                </div>
                <div className="text-sm">
                  <p className="font-semibold">Text Disabled</p>
                  <p className="text-text-secondary font-mono text-xs">#8C8C8C</p>
                  <code className="text-xs bg-surface px-2 py-1 rounded">text-disabled</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-2">Typography</h2>
            <p className="text-text-secondary">Font hierarchy and text styles</p>
          </div>

          <div className="space-y-8 bg-surface p-8 rounded-lg">
            <div className="space-y-2 border-b border-border pb-6">
              <h1>Heading 1 - Hero Image</h1>
              <p className="text-text-secondary text-sm">Font: Figtree Semibold (600) • Size: 72px mobile → 96px desktop</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<h1>Your Text</h1>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <h2>Heading 2 - Category Cards</h2>
              <p className="text-text-secondary text-sm">Font: Figtree Semibold (600) • Size: 48px mobile → 56px desktop</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<h2>Your Text</h2>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <h3>Heading 3 - Page Titles</h3>
              <p className="text-text-secondary text-sm">Font: Figtree Semibold (600) • Size: 36px mobile → 48px desktop</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<h3>Your Text</h3>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <h4>Heading 4 - Section Titles</h4>
              <p className="text-text-secondary text-sm">Font: Figtree Semibold (600) • Size: 16px mobile → 24px desktop</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<h4>Your Text</h4>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <h5>Heading 5 - Card Titles</h5>
              <p className="text-text-secondary text-sm">Font: Figtree Semibold (600) • Size: 12px mobile → 16px desktop</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<h5>Your Text</h5>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <h6>Heading 6 - Regular Headings</h6>
              <p className="text-text-secondary text-sm">Font: Poppins Medium (500) • Size: 16px</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<h6>Your Text</h6>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <p className="h7">Heading 7 - Small Headings</p>
              <p className="text-text-secondary text-sm">Font: Poppins Medium (500) • Size: 14px</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<p className="h7">Your Text</p>'}</code>
            </div>

            <div className="space-y-2 border-b border-border pb-6">
              <p>Body Regular - Default paragraph text</p>
              <p className="text-text-secondary text-sm">Font: Poppins Regular (400) • Size: 16px</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<p>Your Text</p>'}</code>
            </div>

            <div className="space-y-2">
              <p className="body-small">Body Small - Smaller body text</p>
              <p className="text-text-secondary text-sm">Font: Poppins Regular (400) • Size: 14px</p>
              <code className="text-xs bg-background px-2 py-1 rounded">{'<p className="body-small">Your Text</p>'}</code>
            </div>
          </div>

          {/* Font Families */}
          <div className="bg-surface p-6 rounded-lg space-y-4">
            <h4>Font Families</h4>
            <div className="space-y-3">
              <div>
                <p className="font-semibold" style={{ fontFamily: 'Figtree, sans-serif' }}>Figtree (Headings)</p>
                <p className="text-text-secondary text-sm">Used for: H1, H2, H3, H4, H5</p>
                <p className="text-text-secondary text-sm">Weights: Semibold (600)</p>
              </div>
              <div>
                <p className="font-semibold">Poppins (Body & UI)</p>
                <p className="text-text-secondary text-sm">Used for: Body text, buttons, H6, H7</p>
                <p className="text-text-secondary text-sm">Weights: Regular (400), Medium (500), Semibold (600), Bold (700)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-2">Buttons</h2>
            <p className="text-text-secondary">All button variants and states</p>
          </div>

          {/* Primary Button */}
          <div className="bg-background border border-border p-6 rounded-lg space-y-4">
            <div>
              <h4 className="mb-1">Primary Button</h4>
              <p className="text-text-secondary text-sm">Main call-to-action button</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-primary">Default</button>
              <button className="btn btn-primary" disabled>Disabled</button>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<button className="btn btn-primary">Label</button>'}
              </code>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="font-semibold">Size:</span> Font 16px • Padding 12px/24px</p>
              <p><span className="font-semibold">Color:</span> #FF333A (Primary Red)</p>
              <p><span className="font-semibold">Hover:</span> #EC2D34 (Darker Red)</p>
            </div>
          </div>

          {/* Secondary Button */}
          <div className="bg-background border border-border p-6 rounded-lg space-y-4">
            <div>
              <h4 className="mb-1">Secondary Button</h4>
              <p className="text-text-secondary text-sm">Secondary actions, same size as tertiary</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-secondary">Default</button>
              <button className="btn btn-secondary" disabled>Disabled</button>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<button className="btn btn-secondary">Label</button>'}
              </code>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="font-semibold">Size:</span> Font 14px • Padding 12px/16px</p>
              <p><span className="font-semibold">Color:</span> #222222 (Black)</p>
              <p><span className="font-semibold">Hover:</span> #000000 (Pure Black)</p>
            </div>
          </div>

          {/* Tertiary Button */}
          <div className="bg-background border border-border p-6 rounded-lg space-y-4">
            <div>
              <h4 className="mb-1">Tertiary Button</h4>
              <p className="text-text-secondary text-sm">Alternative actions, same size as secondary</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-tertiary">Default</button>
              <button className="btn btn-tertiary" disabled>Disabled</button>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<button className="btn btn-tertiary">Label</button>'}
              </code>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="font-semibold">Size:</span> Font 14px • Padding 12px/16px</p>
              <p><span className="font-semibold">Color:</span> #F2F2F2 (Light Gray)</p>
              <p><span className="font-semibold">Hover:</span> #EBEBEB (Darker Gray)</p>
            </div>
          </div>

          {/* Quaternary Button */}
          <div className="bg-background border border-border p-6 rounded-lg space-y-4">
            <div>
              <h4 className="mb-1">Quaternary Button</h4>
              <p className="text-text-secondary text-sm">Tags, filters, and chip-style buttons</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-quaternary">Filter Tag</button>
              <button className="btn btn-quaternary"><Bed className="h-4 w-4 mr-2" />With Icon</button>
              <button className="btn btn-quaternary" disabled>Disabled</button>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<button className="btn btn-quaternary">Label</button>'}
              </code>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="font-semibold">Size:</span> Font 14px • Padding 6px/12px</p>
              <p><span className="font-semibold">Color:</span> Transparent with border</p>
              <p><span className="font-semibold">Hover:</span> #F2F2F2 (Tertiary)</p>
            </div>
          </div>

          {/* Text Button */}
          <div className="bg-background border border-border p-6 rounded-lg space-y-4">
            <div>
              <h4 className="mb-1">Text Button</h4>
              <p className="text-text-secondary text-sm">Minimal text-only buttons for navigation</p>
            </div>
            <div className="flex gap-4 flex-wrap">
              <button className="btn btn-text">Projects</button>
              <button className="btn btn-text">Professionals</button>
              <button className="btn btn-text">Account</button>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<button className="btn btn-text">Label</button>'}
              </code>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="font-semibold">Size:</span> Font 14px • Padding 6px/12px (always)</p>
              <p><span className="font-semibold">Color:</span> Text foreground</p>
              <p><span className="font-semibold">Hover:</span> Gray background appears (no layout shift)</p>
            </div>
          </div>

          {/* Text Listed Button */}
          <div className="bg-background border border-border p-6 rounded-lg space-y-4">
            <div>
              <h4 className="mb-1">Text Listed Button</h4>
              <p className="text-text-secondary text-sm">For vertical lists in footers and menus</p>
            </div>
            <div className="flex flex-col gap-2 items-start">
              <button className="btn btn-text-listed">Projects</button>
              <button className="btn btn-text-listed">Professionals</button>
              <button className="btn btn-text-listed">About Us</button>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<button className="btn btn-text-listed">Label</button>'}
              </code>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="font-semibold">Size:</span> Font 14px • Padding 6px/12px (always) • Font weight 400 (Regular)</p>
              <p><span className="font-semibold">Hover:</span> Text becomes secondary color, background appears (no layout shift)</p>
            </div>
          </div>
        </section>

        {/* Spacing & Layout */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-2">Spacing & Border Radius</h2>
            <p className="text-text-secondary">Consistent spacing and rounding values</p>
          </div>

          {/* Border Radius */}
          <div className="bg-surface p-6 rounded-lg space-y-4">
            <h4>Border Radius</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-semibold">
                  Small
                </div>
                <p className="text-sm font-semibold">Small (6px)</p>
                <code className="text-xs bg-background px-2 py-1 rounded">rounded-sm</code>
              </div>
              <div className="space-y-2">
                <div className="h-24 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-semibold">
                  Medium
                </div>
                <p className="text-sm font-semibold">Medium (8px)</p>
                <code className="text-xs bg-background px-2 py-1 rounded">rounded-md</code>
              </div>
              <div className="space-y-2">
                <div className="h-24 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold">
                  Large
                </div>
                <p className="text-sm font-semibold">Large (10px)</p>
                <code className="text-xs bg-background px-2 py-1 rounded">rounded-lg</code>
              </div>
              <div className="space-y-2">
                <div className="h-24 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                  Full
                </div>
                <p className="text-sm font-semibold">Full (9999px)</p>
                <code className="text-xs bg-background px-2 py-1 rounded">rounded-full</code>
              </div>
            </div>
          </div>

          {/* Spacing Scale */}
          <div className="bg-surface p-6 rounded-lg space-y-4">
            <h4>Spacing Scale (Padding & Margin)</h4>
            <div className="space-y-3">
              {[
                { name: '1', px: '4px', class: 'p-1 / m-1' },
                { name: '2', px: '8px', class: 'p-2 / m-2' },
                { name: '3', px: '12px', class: 'p-3 / m-3' },
                { name: '4', px: '16px', class: 'p-4 / m-4' },
                { name: '6', px: '24px', class: 'p-6 / m-6' },
                { name: '8', px: '32px', class: 'p-8 / m-8' },
              ].map(({ name, px, class: className }) => (
                <div key={name} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-semibold">{name}</div>
                  <div className="w-20 text-sm text-text-secondary">{px}</div>
                  <code className="text-xs bg-background px-2 py-1 rounded">{className}</code>
                  <div className="flex-1 bg-background h-8 flex items-center">
                    <div className="bg-primary h-full" style={{ width: px }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Icons */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-2">Icons</h2>
            <p className="text-text-secondary">Lucide React icon library</p>
          </div>

          <div className="bg-surface p-6 rounded-lg">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
              <div className="flex flex-col items-center gap-2">
                <Heart className="h-6 w-6" />
                <span className="text-xs text-text-secondary">Heart</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Bed className="h-6 w-6" />
                <span className="text-xs text-text-secondary">Bed</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Mail className="h-6 w-6" />
                <span className="text-xs text-text-secondary">Mail</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <User className="h-6 w-6" />
                <span className="text-xs text-text-secondary">User</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <MapPin className="h-6 w-6" />
                <span className="text-xs text-text-secondary">MapPin</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Search className="h-6 w-6" />
                <span className="text-xs text-text-secondary">Search</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Star className="h-6 w-6" />
                <span className="text-xs text-text-secondary">Star</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Calendar className="h-6 w-6" />
                <span className="text-xs text-text-secondary">Calendar</span>
              </div>
            </div>
            <div className="mt-6 bg-background p-3 rounded">
              <code className="text-xs">
                {'import { Heart, User } from "lucide-react"'}<br />
                {'<Heart className="h-6 w-6" />'}
              </code>
            </div>
          </div>
        </section>

        {/* Component Examples */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-2">Component Examples</h2>
            <p className="text-text-secondary">Real-world component usage</p>
          </div>

          {/* Project Card */}
          <div className="space-y-4">
            <h4>Project Card</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>
          </div>

          {/* Professional Card */}
          <div className="space-y-4">
            <h4>Professional Card</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center">
                    <span className="text-text-secondary font-semibold">AB</span>
                  </div>
                  <div className="flex-1">
                    <h4>Architectural Bureau</h4>
                    <p className="text-text-secondary">Architecture & Design</p>
                    <p className="body-small text-text-secondary mt-1">Amsterdam, NL</p>
                  </div>
                </div>
                <p className="text-text-secondary">Specializing in contemporary residential design with over 20 years of experience.</p>
                <button className="btn btn-primary w-full">View Profile</button>
              </div>
            </div>
          </div>

          {/* Modal Window */}
          <div className="space-y-4">
            <h4>Modal Window</h4>
            <div className="bg-background border border-border rounded-lg p-8 max-w-md space-y-6">
              <div>
                <h4 className="mb-2">Confirm Action</h4>
                <p className="text-text-secondary">Are you sure you want to proceed with this action? This cannot be undone.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button className="btn btn-tertiary">Cancel</button>
                <button className="btn btn-secondary">Save Changes</button>
              </div>
            </div>
            <div className="bg-surface p-3 rounded">
              <code className="text-xs">
                {'<div className="flex gap-3 justify-end">'}<br />
                {'  <button className="btn btn-tertiary">Cancel</button>'}<br />
                {'  <button className="btn btn-secondary">Save</button>'}<br />
                {'</div>'}
              </code>
            </div>
            <p className="text-sm text-text-secondary">
              Modal actions use tertiary (Cancel) and secondary (Save) buttons. Both are the same size (14px font, 12px/16px padding).
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
