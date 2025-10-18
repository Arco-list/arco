import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'https://arco.com'
  // Remove trailing slash if present
  return url.replace(/\/$/, '')
}

export function getSupportEmail(type: 'privacy' | 'legal' = 'privacy'): string {
  const defaultEmails = {
    privacy: 'privacy@arco.com',
    legal: 'legal@arco.com'
  }
  
  if (type === 'privacy') {
    return process.env.NEXT_PUBLIC_PRIVACY_EMAIL || defaultEmails.privacy
  }
  
  return process.env.NEXT_PUBLIC_LEGAL_EMAIL || defaultEmails.legal
}
