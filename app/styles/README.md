# Arco Design System Style Guide

This is an internal design system documentation page located at `/styles`.

## Purpose

This page provides a comprehensive visual reference for:
- Color palette (primary, secondary, tertiary, neutral, text colors)
- Typography scale (H1-H7, body text)
- Button variants and states
- Spacing and border radius values
- Icon library
- Component examples (cards, modals)

## Access Control

**Internal Use**: This page is accessible in development and preview deployments, but blocked in production.

- ✅ **Development**: Accessible at `http://localhost:3000/styles`
- ✅ **Preview Deployments**: Accessible on Vercel preview links
- ❌ **Production**: Automatically redirects to homepage
- 🤖 **Search Engines**: Blocked via `robots.txt`

## Implementation

The page demonstrates the finalized Tailwind-based design system that was chosen over the exact pixel specifications. All components use standard Tailwind utility classes for consistency and maintainability.

## For Developers

Use this page as a reference when:
- Building new components
- Checking correct button variants
- Verifying color usage
- Understanding typography hierarchy
- Reviewing spacing standards

## Files

- `/app/styles/page.tsx` - The style guide page component
- `/app/globals.css` - CSS variables and button styles
- `/app/robots.ts` - Blocks `/styles` from search engines
