"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logger } from "@/lib/logger"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error using proper error monitoring service
    logger.error("ErrorBoundary caught an error", {
      component: "ErrorBoundary",
      componentStack: errorInfo.componentStack,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    }, error)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Something went wrong
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  We encountered an unexpected error while loading this page.
                  Please try refreshing the page or go back to try again.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mb-4">
                    <summary className="text-xs text-text-secondary cursor-pointer hover:text-foreground">
                      Error details (development only)
                    </summary>
                    <pre className="mt-2 text-xs bg-surface p-3 rounded overflow-auto max-h-40">
                      {this.state.error.message}
                      {"\n\n"}
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="quaternary" size="quaternary"
                onClick={() => window.history.back()}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={this.handleReset}
                className="flex-1"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
