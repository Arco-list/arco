"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <p className="arco-eyebrow" style={{ marginBottom: 16 }}>Error</p>
            <h1 className="arco-page-title" style={{ marginBottom: 12 }}>Something went wrong</h1>
            <p className="arco-body" style={{ marginBottom: 24 }}>
              An unexpected error occurred. Please try refreshing the page or go back to try again.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details style={{ marginBottom: 24, textAlign: "left" }}>
                <summary style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                  Error details (development only)
                </summary>
                <pre style={{ marginTop: 8, fontSize: 12, background: "var(--arco-surface, #f5f5f4)", padding: 12, borderRadius: 3, overflow: "auto", maxHeight: 160 }}>
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => window.history.back()}
                className="btn-tertiary"
                style={{ flex: 1, maxWidth: 200 }}
              >
                Go back
              </button>
              <button
                onClick={this.handleReset}
                className="btn-secondary"
                style={{ flex: 1, maxWidth: 200 }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
