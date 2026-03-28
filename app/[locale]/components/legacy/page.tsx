import { redirect } from "next/navigation"

export default function LegacyComponentsPage() {
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
          <div style={{ background: '#fff8e6', border: '1px solid #f5d668', borderRadius: '6px', padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: '#8b6914' }}>Legacy Components - Reference Only</h3>
                <p style={{ fontSize: '14px', color: '#8b6914', margin: 0 }}>These components are from the old design. Use for reference during migration, but implement NEW components from /components instead.</p>
              </div>
            </div>
          </div>
          
          <h1 style={{ 
            fontFamily: 'var(--serif)', 
            fontSize: '56px', 
            fontWeight: 400, 
            letterSpacing: '-0.5px', 
            marginBottom: '12px' 
          }}>
            Legacy Component Library
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--mid)', maxWidth: '700px' }}>
            Complete inventory of existing components. Total: <strong>110 components</strong>. Use this page to track migration progress.
          </p>
        </div>

        {/* MIGRATION STATUS */}
        <div style={{ marginBottom: '60px', background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '24px' }}>Migration Progress</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div style={{ textAlign: 'center', padding: '20px', background: '#f0fdf4', borderRadius: '6px' }}>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#16a34a', marginBottom: '8px' }}>0</div>
              <div style={{ fontSize: '14px', color: '#15803d' }}>✅ Redesigned</div>
            </div>
            <div style={{ textAlign: 'center', padding: '20px', background: '#fef9c3', borderRadius: '6px' }}>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#ca8a04', marginBottom: '8px' }}>0</div>
              <div style={{ fontSize: '14px', color: '#a16207' }}>🔄 In Progress</div>
            </div>
            <div style={{ textAlign: 'center', padding: '20px', background: '#fef2f2', borderRadius: '6px' }}>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>110</div>
              <div style={{ fontSize: '14px', color: '#b91c1c' }}>⏳ Needs Redesign</div>
            </div>
          </div>
        </div>

        {/* NAVIGATION & LAYOUT */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Navigation & Layout</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Global navigation, headers, footers, and sidebars</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="header.tsx" path="components/header.tsx" status="needs-redesign" />
              <ComponentItem name="footer.tsx" path="components/footer.tsx" status="needs-redesign" />
              <ComponentItem name="app-sidebar.tsx" path="components/app-sidebar.tsx" status="needs-redesign" />
              <ComponentItem name="admin-sidebar.tsx" path="components/admin-sidebar.tsx" status="needs-redesign" />
              <ComponentItem name="nav-main.tsx" path="components/nav-main.tsx" status="needs-redesign" />
              <ComponentItem name="nav-projects.tsx" path="components/nav-projects.tsx" status="needs-redesign" />
              <ComponentItem name="nav-user.tsx" path="components/nav-user.tsx" status="needs-redesign" />
              <ComponentItem name="dashboard-header.tsx" path="components/dashboard-header.tsx" status="needs-redesign" />
              <ComponentItem name="team-switcher.tsx" path="components/team-switcher.tsx" status="needs-redesign" />
              <ComponentItem name="breadcrumb-with-tooltip.tsx" path="components/breadcrumb-with-tooltip.tsx" status="needs-redesign" />
              <ComponentItem name="projects-navigation.tsx" path="components/projects-navigation.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* HOMEPAGE COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Homepage Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Hero sections, features, and landing page elements</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="hero-section.tsx" path="components/hero-section.tsx" status="needs-redesign" />
              <ComponentItem name="popular-projects.tsx" path="components/popular-projects.tsx" status="needs-redesign" />
              <ComponentItem name="featured-professionals.tsx" path="components/featured-professionals.tsx" status="needs-redesign" />
              <ComponentItem name="featured-companies.tsx" path="components/featured-companies.tsx" status="needs-redesign" />
              <ComponentItem name="features-section.tsx" path="components/features-section.tsx" status="needs-redesign" />
              <ComponentItem name="professionals-section.tsx" path="components/professionals-section.tsx" status="needs-redesign" />
              <ComponentItem name="pricing-section.tsx" path="components/pricing-section.tsx" status="needs-redesign" />
              <ComponentItem name="map-section.tsx" path="components/map-section.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* PROJECT COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Project Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Project cards, galleries, details, and related components</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="project-card.tsx" path="components/project-card.tsx" status="needs-redesign" />
              <ComponentItem name="projects-grid.tsx" path="components/projects-grid.tsx" status="needs-redesign" />
              <ComponentItem name="project-gallery.tsx" path="components/project-gallery.tsx" status="needs-redesign" />
              <ComponentItem name="project-details.tsx" path="components/project-details.tsx" status="needs-redesign" />
              <ComponentItem name="project-info.tsx" path="components/project-info.tsx" status="needs-redesign" />
              <ComponentItem name="project-features.tsx" path="components/project-features.tsx" status="needs-redesign" />
              <ComponentItem name="project-highlights.tsx" path="components/project-highlights.tsx" status="needs-redesign" />
              <ComponentItem name="project-categories.tsx" path="components/project-categories.tsx" status="needs-redesign" />
              <ComponentItem name="project-types.tsx" path="components/project-types.tsx" status="needs-redesign" />
              <ComponentItem name="similar-projects.tsx" path="components/similar-projects.tsx" status="needs-redesign" />
              <ComponentItem name="project-action-buttons.tsx" path="components/project-action-buttons.tsx" status="needs-redesign" />
              <ComponentItem name="project-professional-service-card.tsx" path="components/project-professional-service-card.tsx" status="needs-redesign" />
              <ComponentItem name="project-structured-data.tsx" path="components/project-structured-data.tsx" status="needs-redesign" />
              <ComponentItem name="gallery-grid.tsx" path="components/gallery-grid.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* PROJECT DETAIL FORM COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Project Detail Form Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Project creation and editing form fields</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="project-basics-fields.tsx" path="components/project-details/project-basics-fields.tsx" status="needs-redesign" />
              <ComponentItem name="project-description-editor.tsx" path="components/project-details/project-description-editor.tsx" status="needs-redesign" />
              <ComponentItem name="project-features-fields.tsx" path="components/project-details/project-features-fields.tsx" status="needs-redesign" />
              <ComponentItem name="project-metrics-fields.tsx" path="components/project-details/project-metrics-fields.tsx" status="needs-redesign" />
              <ComponentItem name="project-narrative-fields.tsx" path="components/project-details/project-narrative-fields.tsx" status="needs-redesign" />
              <ComponentItem name="custom-dropdown.tsx" path="components/project-details/custom-dropdown.tsx" status="needs-redesign" />
              <ComponentItem name="feature-checkbox-grid.tsx" path="components/project-details/feature-checkbox-grid.tsx" status="needs-redesign" />
              <ComponentItem name="segmented-progress-bar.tsx" path="components/new-project/segmented-progress-bar.tsx" status="needs-redesign" />
              <ComponentItem name="photo-tour-manager.tsx" path="components/photo-tour-manager.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* PROFESSIONAL COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Professional Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Professional cards, profiles, galleries, and related components</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="professional-card.tsx" path="components/professional-card.tsx" status="needs-redesign" />
              <ComponentItem name="professionals-grid.tsx" path="components/professionals-grid.tsx" status="needs-redesign" />
              <ComponentItem name="professional-details.tsx" path="components/professional-details.tsx" status="needs-redesign" />
              <ComponentItem name="professional-info.tsx" path="components/professional-info.tsx" status="needs-redesign" />
              <ComponentItem name="professional-gallery.tsx" path="components/professional-gallery.tsx" status="needs-redesign" />
              <ComponentItem name="professional-gallery-modal.tsx" path="components/professional-gallery-modal.tsx" status="needs-redesign" />
              <ComponentItem name="professional-projects.tsx" path="components/professional-projects.tsx" status="needs-redesign" />
              <ComponentItem name="professional-categories.tsx" path="components/professional-categories.tsx" status="needs-redesign" />
              <ComponentItem name="professional-action-buttons.tsx" path="components/professional-action-buttons.tsx" status="needs-redesign" />
              <ComponentItem name="professional-contact-sidebar.tsx" path="components/professional-contact-sidebar.tsx" status="needs-redesign" />
              <ComponentItem name="professionals-sidebar.tsx" path="components/professionals-sidebar.tsx" status="needs-redesign" />
              <ComponentItem name="mobile-professionals-button.tsx" path="components/mobile-professionals-button.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Filters & Search</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Filter bars, search, and modal filters</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="filter-bar.tsx" path="components/filter-bar.tsx" status="needs-redesign" />
              <ComponentItem name="filters-modal.tsx" path="components/filters-modal.tsx" status="needs-redesign" />
              <ComponentItem name="professionals-filter-bar.tsx" path="components/professionals-filter-bar.tsx" status="needs-redesign" />
              <ComponentItem name="professionals-filters-modal.tsx" path="components/professionals-filters-modal.tsx" status="needs-redesign" />
              <ComponentItem name="dashboard-listings-filter.tsx" path="components/dashboard-listings-filter.tsx" status="needs-redesign" />
              <ComponentItem name="header-search.tsx" path="components/header-search.tsx" status="needs-redesign" />
              <ComponentItem name="filter-error-boundary.tsx" path="components/filter-error-boundary.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* MODALS & DIALOGS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Modals & Dialogs</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Popup modals and dialog components</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="share-modal.tsx" path="components/share-modal.tsx" status="needs-redesign" />
              <ComponentItem name="report-modal.tsx" path="components/report-modal.tsx" status="needs-redesign" />
              <ComponentItem name="image-upload-dialog.tsx" path="components/image-upload-dialog.tsx" status="needs-redesign" />
              <ComponentItem name="feature-photo-selector-modal.tsx" path="components/feature-photo-selector-modal.tsx" status="needs-redesign" />
              <ComponentItem name="grouped-pictures-modal.tsx" path="components/grouped-pictures-modal.tsx" status="needs-redesign" />
              <ComponentItem name="listing-status-modal.tsx" path="components/listing-status-modal.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* AUTHENTICATION */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Authentication</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Login, signup, and authentication components</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="auth-dialog.tsx" path="components/auth/auth-dialog.tsx" status="needs-redesign" />
              <ComponentItem name="login-form.tsx" path="components/auth/login-form.tsx" status="needs-redesign" />
              <ComponentItem name="signup-form.tsx" path="components/auth/signup-form.tsx" status="needs-redesign" />
              <ComponentItem name="otp-form.tsx" path="components/auth/otp-form.tsx" status="needs-redesign" />
              <ComponentItem name="login1.tsx" path="components/login1.tsx" status="needs-redesign" />
              <ComponentItem name="signup1.tsx" path="components/signup1.tsx" status="needs-redesign" />
              <ComponentItem name="reset-password1.tsx" path="components/reset-password1.tsx" status="needs-redesign" />
              <ComponentItem name="update-password.tsx" path="components/update-password.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* ADMIN COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Admin Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Admin dashboard tables and management tools</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="admin-professionals-companies-table.tsx" path="components/admin-professionals-companies-table.tsx" status="needs-redesign" />
              <ComponentItem name="admin-professional-invites-table.tsx" path="components/admin-professional-invites-table.tsx" status="needs-redesign" />
              <ComponentItem name="admin-onboarding-form.tsx" path="components/admin-onboarding-form.tsx" status="needs-redesign" />
              <ComponentItem name="projects-data-table.tsx" path="components/projects-data-table.tsx" status="needs-redesign" />
              <ComponentItem name="users-data-table.tsx" path="components/users-data-table.tsx" status="needs-redesign" />
              <ComponentItem name="editable-seo-cell.tsx" path="components/editable-seo-cell.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* SETTINGS & FORMS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Settings & Forms</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Account settings and form components</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="account-settings-form.tsx" path="components/account-settings-form.tsx" status="needs-redesign" />
              <ComponentItem name="company-settings-shell.tsx" path="components/company-settings/company-settings-shell.tsx" status="needs-redesign" />
              <ComponentItem name="feature-selection-grid.tsx" path="components/feature-selection-grid.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* ABOUT & FAQ */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>About & FAQ Pages</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Static content pages</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="about-content.tsx" path="components/about-content.tsx" status="needs-redesign" />
              <ComponentItem name="about3.tsx" path="components/about3.tsx" status="needs-redesign" />
              <ComponentItem name="faq1.tsx" path="components/faq1.tsx" status="needs-redesign" />
              <ComponentItem name="faq12.tsx" path="components/faq12.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* ERROR COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Error Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Error pages and error boundaries</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="error-boundary.tsx" path="components/error-boundary.tsx" status="needs-redesign" />
              <ComponentItem name="not-found-error.tsx" path="components/errors/not-found-error.tsx" status="needs-redesign" />
              <ComponentItem name="forbidden-error.tsx" path="components/errors/forbidden-error.tsx" status="needs-redesign" />
              <ComponentItem name="unauthorized-error.tsx" path="components/errors/unauthorized-error.tsx" status="needs-redesign" />
              <ComponentItem name="general-error.tsx" path="components/errors/general-error.tsx" status="needs-redesign" />
              <ComponentItem name="service-unavailable-error.tsx" path="components/errors/service-unavailable-error.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* UI PRIMITIVES (shadcn/ui) */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>UI Primitives (shadcn/ui)</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Base UI components - May keep or redesign</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <ComponentItem name="accordion.tsx" path="components/ui/accordion.tsx" status="needs-redesign" />
              <ComponentItem name="alert-dialog.tsx" path="components/ui/alert-dialog.tsx" status="needs-redesign" />
              <ComponentItem name="avatar.tsx" path="components/ui/avatar.tsx" status="needs-redesign" />
              <ComponentItem name="badge.tsx" path="components/ui/badge.tsx" status="needs-redesign" />
              <ComponentItem name="breadcrumb.tsx" path="components/ui/breadcrumb.tsx" status="needs-redesign" />
              <ComponentItem name="button.tsx" path="components/ui/button.tsx" status="needs-redesign" />
              <ComponentItem name="card.tsx" path="components/ui/card.tsx" status="needs-redesign" />
              <ComponentItem name="checkbox.tsx" path="components/ui/checkbox.tsx" status="needs-redesign" />
              <ComponentItem name="dialog.tsx" path="components/ui/dialog.tsx" status="needs-redesign" />
              <ComponentItem name="dropdown-menu.tsx" path="components/ui/dropdown-menu.tsx" status="needs-redesign" />
              <ComponentItem name="input.tsx" path="components/ui/input.tsx" status="needs-redesign" />
              <ComponentItem name="label.tsx" path="components/ui/label.tsx" status="needs-redesign" />
              <ComponentItem name="radio-group.tsx" path="components/ui/radio-group.tsx" status="needs-redesign" />
              <ComponentItem name="select.tsx" path="components/ui/select.tsx" status="needs-redesign" />
              <ComponentItem name="separator.tsx" path="components/ui/separator.tsx" status="needs-redesign" />
              <ComponentItem name="sheet.tsx" path="components/ui/sheet.tsx" status="needs-redesign" />
              <ComponentItem name="sidebar.tsx" path="components/ui/sidebar.tsx" status="needs-redesign" />
              <ComponentItem name="skeleton.tsx" path="components/ui/skeleton.tsx" status="needs-redesign" />
              <ComponentItem name="switch.tsx" path="components/ui/switch.tsx" status="needs-redesign" />
              <ComponentItem name="table.tsx" path="components/ui/table.tsx" status="needs-redesign" />
              <ComponentItem name="tabs.tsx" path="components/ui/tabs.tsx" status="needs-redesign" />
              <ComponentItem name="textarea.tsx" path="components/ui/textarea.tsx" status="needs-redesign" />
              <ComponentItem name="tooltip.tsx" path="components/ui/tooltip.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

        {/* UTILITY COMPONENTS */}
        <div style={{ marginBottom: '80px' }}>
          <h2 className="arco-section-title" style={{ marginBottom: '8px' }}>Utility Components</h2>
          <p className="arco-small-text" style={{ color: 'var(--mid)', marginBottom: '32px' }}>Providers, wrappers, and utility components</p>
          
          <div style={{ background: 'white', border: '1px solid var(--rule)', borderRadius: '6px', padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <ComponentItem name="root-providers.tsx" path="components/root-providers.tsx" status="needs-redesign" />
              <ComponentItem name="theme-provider.tsx" path="components/theme-provider.tsx" status="needs-redesign" />
              <ComponentItem name="scroll-to-top.tsx" path="components/scroll-to-top.tsx" status="needs-redesign" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// Component item helper
function ComponentItem({ 
  name, 
  path, 
  status 
}: { 
  name: string
  path: string
  status: 'redesigned' | 'in-progress' | 'needs-redesign'
}) {
  const statusConfig = {
    'redesigned': { label: '✅ Redesigned', color: '#16a34a', bg: '#f0fdf4' },
    'in-progress': { label: '🔄 In Progress', color: '#ca8a04', bg: '#fef9c3' },
    'needs-redesign': { label: '⏳ Needs Work', color: '#dc2626', bg: '#fef2f2' }
  }
  
  const config = statusConfig[status]
  
  return (
    <div style={{ 
      padding: '12px 16px', 
      border: '1px solid var(--rule)', 
      borderRadius: '4px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px'
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', fontFamily: 'monospace' }}>{name}</div>
        <div style={{ fontSize: '12px', color: 'var(--mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</div>
      </div>
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 500,
        padding: '4px 8px', 
        borderRadius: '12px',
        background: config.bg,
        color: config.color,
        whiteSpace: 'nowrap'
      }}>
        {config.label}
      </div>
    </div>
  )
}
