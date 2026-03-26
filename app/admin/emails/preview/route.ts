import { NextRequest, NextResponse } from 'next/server'
import { renderEmailTemplate, type EmailTemplate } from '@/lib/email-service'

const TEST_VARS = {
  firstname: 'Niek',
  project_title: 'Villa Oisterwijk',
  project_name: 'Villa Oisterwijk',
  project_owner: 'Marco van Veldhuizen',
  project_location: 'Oisterwijk, Netherlands',
  project_link: 'https://arcolist.com/projects/villa-oisterwijk',
  dashboard_link: 'https://arcolist.com/dashboard',
  confirmUrl: 'https://arcolist.com/dashboard/listings',
  rejection_reason: 'The project photos do not meet our quality guidelines. Please upload higher resolution images and resubmit.',
  company_name: 'Studio Architectuur',
  code: '847291',
  businessname: 'Studio Architectuur',
}

export async function GET(request: NextRequest) {
  const template = request.nextUrl.searchParams.get('template') as EmailTemplate | null
  if (!template) return new NextResponse('Template not found', { status: 404 })

  const result = await renderEmailTemplate(template, TEST_VARS)
  if (!result) return new NextResponse('Template not found', { status: 404 })

  return new NextResponse(result.html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
