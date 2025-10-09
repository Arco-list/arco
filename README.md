# Arco

Professional services marketplace platform connecting clients with verified professionals for architectural, construction, and design projects.

## Overview

Arco is a comprehensive marketplace platform built with modern web technologies, enabling clients to post projects and professionals to showcase their expertise and apply for opportunities.

### Key Features

- 🏗️ **Project Marketplace**: Browse and post projects across 22+ categories
- 👷 **Professional Profiles**: Verified professionals with portfolios and ratings
- 💬 **Messaging System**: Direct communication between clients and professionals
- ⭐ **Review System**: Multi-dimensional ratings for quality assurance
- 🔍 **Advanced Search**: Filter by location, budget, expertise, and more
- 📱 **Responsive Design**: Optimized for mobile and desktop experiences

## Tech Stack

- **Framework**: Next.js 15 with App Router and Server Components
- **UI**: React 19, Tailwind CSS v4, shadcn/ui (Radix UI primitives)
- **Database**: Supabase (PostgreSQL) with materialized views
- **Authentication**: Supabase Auth with Row Level Security
- **Type Safety**: TypeScript with strict mode
- **Deployment**: Vercel
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase URL and keys

# Run development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
arco/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── dashboard/         # User dashboard
│   ├── professionals/     # Professional listings
│   ├── projects/          # Project listings
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Feature components
├── lib/                  # Utilities and shared logic
│   ├── supabase/         # Database client and types
│   └── utils.ts          # Helper functions
└── supabase/             # Database migrations
    └── migrations/       # SQL migration files
```

## Database Schema

The platform uses a comprehensive Supabase database with:

- 15 core tables (profiles, projects, professionals, reviews, etc.)
- Materialized views for optimized queries
- Full-text search functions
- Row Level Security policies
- Automated refresh triggers

See [CLAUDE.md](CLAUDE.md) for detailed database architecture.

## Development

```bash
# Run development server
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Deployment

The project is deployed on Vercel and synced with v0.app:

- **Production**: [https://vercel.com/tinkso/v0-arco](https://vercel.com/tinkso/v0-arco)
- **v0.app Project**: [https://v0.app/chat/projects/VFadKYHUN1D](https://v0.app/chat/projects/VFadKYHUN1D)

## Contributing

This repository stays in sync with v0.app deployments. Coordinate significant changes with the v0.app workflow to avoid conflicts.

## License

Proprietary - All rights reserved
