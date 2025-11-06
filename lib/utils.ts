import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSiteUrl(): string {
  // Vercel automatically provides these environment variables
  // NEXT_PUBLIC_VERCEL_ENV: 'production' | 'preview' | 'development'
  // NEXT_PUBLIC_VERCEL_URL: The deployment URL (e.g., 'project-git-branch.vercel.app')

  // In Vercel preview deployments, automatically use the preview URL
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' && process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  // For production and local dev, use configured URL
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return url.replace(/\/$/, '')
}

export function getSupportEmail(type: 'privacy' | 'legal' = 'privacy'): string {
  const defaultEmails = {
    privacy: 'privacy@arcolist.com',
    legal: 'legal@arcolist.com'
  }

  if (type === 'privacy') {
    return process.env.NEXT_PUBLIC_PRIVACY_EMAIL || defaultEmails.privacy
  }

  return process.env.NEXT_PUBLIC_LEGAL_EMAIL || defaultEmails.legal
}

// Shared button styles
export const textButtonStyles = "inline-block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
