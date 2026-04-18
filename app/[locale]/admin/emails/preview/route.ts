import { NextRequest, NextResponse } from 'next/server'
import { renderEmailTemplate, type EmailLocale, type EmailTemplate } from '@/lib/email-service'

const TEST_VARS = {
  firstname: 'Niek',
  project_title: 'Villa Oisterwijk',
  project_name: 'Villa Oisterwijk',
  project_owner: 'Marco van Veldhuizen',
  project_type: 'Villa',
  project_location: 'Oisterwijk',
  project_link: 'https://arcolist.com/projects/villa-oisterwijk',
  project_image: 'https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg',
  service_category: 'Villa',
  dashboard_link: 'https://arcolist.com/dashboard',
  confirmUrl: 'https://arcolist.com/dashboard/listings',
  rejection_reason: 'The project photos do not meet our quality guidelines. Please upload higher resolution images and resubmit.',
  company_name: 'Marco van Veldhuizen',
  code: '847291',
  businessname: 'Studio Architectuur',
  company_page_url: 'https://arcolist.com/professionals/marco-van-veldhuizen',
  claim_url: 'https://arcolist.com/businesses/professionals?inviteEmail=info@marcovanveldhuizen.nl',
  hero_image_url: 'https://marcovanveldhuizen.nl/cms/wp-content/uploads/2022/12/MARCO-VAN-VELDHUIZEN_OISTERWIJK-3501-HR-min.jpg',
  logo_url: 'https://ogvobdcrectqsegqrquz.supabase.co/storage/v1/object/public/company-logos/marco-van-veldhuizen.png',
  company_subtitle: 'Architect · Naarden',
}

// Map admin template IDs to email-service template names for auth emails.
// This lets the preview use the same locale-aware renderers as production.
const AUTH_TEMPLATE_MAP: Record<string, EmailTemplate> = {
  "magic-link": "auth-magic-link",
  "signup": "auth-confirm-signup",
  "password-reset": "auth-recovery",
}

export async function GET(request: NextRequest) {
  const template = request.nextUrl.searchParams.get('template')
  if (!template) return new NextResponse('Template not found', { status: 404 })

  const origin = request.nextUrl.origin

  // Optional ?locale=nl / ?locale=en — lets the admin preview both
  // languages side by side. Ignored (undefined → renderer default) for
  // templates that don't branch on locale yet.
  const rawLocale = request.nextUrl.searchParams.get('locale')
  const locale: EmailLocale | undefined =
    rawLocale === 'nl' || rawLocale === 'en' ? rawLocale : undefined

  // ?meta=1 → return JSON { subject } instead of the rendered HTML. The
  // preview popup header fetches this to show the real (locale-aware)
  // subject without having to parse the HTML response or hit Resend.
  const wantsMeta = request.nextUrl.searchParams.get('meta') === '1'

  // Auth templates — render via the same locale-aware renderers used in production
  if (AUTH_TEMPLATE_MAP[template]) {
    const authResult = await renderEmailTemplate(AUTH_TEMPLATE_MAP[template], { ...TEST_VARS }, origin, locale)
    if (authResult) {
      if (wantsMeta) {
        return NextResponse.json({ subject: authResult.subject })
      }
      return new NextResponse(authResult.html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
  }

  // App transactional templates
  const vars: Record<string, any> = { ...TEST_VARS }

  // For templates that render live featured projects/professionals, pull
  // the same data the cron uses for real sends so the preview matches
  // what a real recipient would see. Without this the renderer falls back
  // to its hardcoded sample arrays and the preview looks wrong
  // (e.g. grey initials instead of actual company logos).
  if (template === 'welcome-homeowner' || template === 'discover-projects') {
    try {
      const { fetchFeaturedProjectsForEmail, fetchFeaturedProfessionalsForEmail } = await import(
        '@/lib/email-featured-data'
      )
      const projectLimit = template === 'welcome-homeowner' ? 4 : 3
      const [projects, professionals] = await Promise.all([
        fetchFeaturedProjectsForEmail(projectLimit),
        template === 'welcome-homeowner'
          ? fetchFeaturedProfessionalsForEmail()
          : Promise.resolve([] as Awaited<ReturnType<typeof fetchFeaturedProfessionalsForEmail>>),
      ])
      if (projects.length > 0) vars.projects = projects
      if (template === 'welcome-homeowner' && professionals.length > 0) {
        vars.professionals = professionals
      }
    } catch (err) {
      console.error('[emails/preview] Failed to load featured data:', err)
    }
  }

  const result = await renderEmailTemplate(template as EmailTemplate, vars, origin, locale)
  if (!result) return new NextResponse('Template not found', { status: 404 })

  if (wantsMeta) {
    return NextResponse.json({ subject: result.subject })
  }

  return new NextResponse(result.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
