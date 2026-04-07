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

