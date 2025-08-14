"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

interface ProjectsNavigationProps {
  activeTab: "projects" | "professionals"
}

export function ProjectsNavigation({ activeTab }: ProjectsNavigationProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 md:px-[0]">
        <nav className="flex space-x-8">
          <Link
            href="/projects"
            className={cn(
              "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "projects"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
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
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            )}
          >
            Professionals
          </Link>
        </nav>
      </div>
    </div>
  )
}
