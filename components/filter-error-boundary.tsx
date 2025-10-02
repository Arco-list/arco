"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

interface FilterErrorBoundaryProps {
  fallback?: ReactNode
  children: ReactNode
}

interface FilterErrorBoundaryState {
  hasError: boolean
}

export class FilterErrorBoundary extends Component<
  FilterErrorBoundaryProps,
  FilterErrorBoundaryState
> {
  state: FilterErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): FilterErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Filter stack failed", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="py-16 text-center text-sm text-gray-500">
            We couldn’t load the filters. Please refresh the page.
          </div>
        )
      )
    }

    return this.props.children
  }
}
