"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

interface ProjectsNavigationProps {
  activeTab: "projects" | "professionals"
}

export function ProjectsNavigation({ activeTab }: ProjectsNavigationProps) {
  return (
    <div className="bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-[0]">
        <nav className="flex space-x-8 px-8">
          <Link
            href="/projects"
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "projects"
                ? "border-black text-black"
                : "border-transparent text-text-secondary hover:text-foreground hover:border-border",
            )}
          >
            Projects
          </Link>
          <Link
            href="/professionals"
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "professionals"
                ? "border-black text-black"
                : "border-transparent text-text-secondary hover:text-foreground hover:border-border",
            )}
          >
            Professionals
          </Link>
        </nav>
      </div>
    </div>
  )
}
