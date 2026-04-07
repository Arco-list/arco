/**
 * React Hook for RLS Validation
 *
 * SECURITY: Use this hook to validate RLS policies are correctly enforced
 * on critical pages that handle sensitive data.
 *
 * Usage:
 * ```tsx
 * const { isSecure, errors, loading } = useRLSValidation()
 *
 * if (!isSecure && !loading) {
 *   return <SecurityError errors={errors} />
 * }
 * ```
 */

import { useEffect, useState } from "react"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  runRLSValidationSuite,
  isRLSSecure,
  getRLSSecurityErrors,
  logRLSFailures,
  type RLSValidationResult,
  type RLSValidationError,
} from "@/lib/supabase/rls-validator"

type UseRLSValidationOptions = {
  /**
   * Enable RLS validation (default: true in development, false in production)
   * Set to true in production for critical pages
   */
  enabled?: boolean

  /**
   * Page identifier for logging
   */
  page?: string

  /**
   * Run validation on mount (default: true)
   */
  runOnMount?: boolean
}

type UseRLSValidationResult = {
  /** Whether all RLS policies are correctly configured */
  isSecure: boolean

  /** Validation is in progress */
  loading: boolean

  /** Security errors if validation failed */
  errors: RLSValidationError[]

  /** Raw validation results */
  results: RLSValidationResult[]

  /** Manually trigger validation */
  validate: () => Promise<void>
}

function useRLSValidation(
  options: UseRLSValidationOptions = {}
): UseRLSValidationResult {
  const {
    enabled = process.env.NODE_ENV === "development",
    page = "unknown",
    runOnMount = true,
  } = options

  const [loading, setLoading] = useState(runOnMount)
  const [results, setResults] = useState<RLSValidationResult[]>([])
  const [errors, setErrors] = useState<RLSValidationError[]>([])
  const [isSecure, setIsSecure] = useState(true)

  const validate = async () => {
    if (!enabled) {
      setIsSecure(true)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const supabase = getBrowserSupabaseClient()
      const { data: authData } = await supabase.auth.getUser()

      if (!authData?.user) {
        setLoading(false)
        return
      }

      const validationResults = await runRLSValidationSuite(
        supabase,
        authData.user.id
      )

      const secure = isRLSSecure(validationResults)
      const securityErrors = getRLSSecurityErrors(validationResults)

      setResults(validationResults)
      setIsSecure(secure)
      setErrors(securityErrors)

      // Log failures for security monitoring
      if (!secure) {
        logRLSFailures(validationResults, {
          userId: authData.user.id,
          page,
        })
      }
    } catch (error) {
      console.error("RLS validation failed:", error)
      // Fail secure: Assume insecure if validation throws
      setIsSecure(false)
      setErrors([
        {
          table: "unknown",
          operation: "VALIDATION",
          expectedPolicy: "n/a",
          actualBehavior: error instanceof Error ? error.message : "Validation error",
          securityRisk: "CRITICAL",
          recommendation: "Contact security team immediately",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (runOnMount && enabled) {
      void validate()
    }
  }, [enabled, runOnMount])

  return {
    isSecure,
    loading,
    errors,
    results,
    validate,
  }
}

/**
 * React Hook for validating specific table RLS policies
 *
 * Use when you need granular validation for a specific operation
 */
export function useTableRLSValidation(
  table: "projects" | "project_photos" | "profiles",
  options: { enabled?: boolean } = {}
): Pick<UseRLSValidationResult, "isSecure" | "loading" | "validate"> {
  const { enabled = process.env.NODE_ENV === "development" } = options

  const [loading, setLoading] = useState(false)
  const [isSecure, setIsSecure] = useState(true)

  const validate = async () => {
    if (!enabled) {
      setIsSecure(true)
      return
    }

    setLoading(true)

    try {
      const supabase = getBrowserSupabaseClient()
      const { data: authData } = await supabase.auth.getUser()

      if (!authData?.user) {
        setLoading(false)
        return
      }

      // Import validation function based on table
      let result: RLSValidationResult

      if (table === "projects") {
        const { validateProjectRLS } = await import("@/lib/supabase/rls-validator")
        result = await validateProjectRLS(supabase, authData.user.id)
      } else if (table === "profiles") {
        const { validateProfileUpdateRLS } = await import("@/lib/supabase/rls-validator")
        result = await validateProfileUpdateRLS(supabase, authData.user.id)
      } else {
        // project_photos requires projectId, skip for now
        setIsSecure(true)
        setLoading(false)
        return
      }

      setIsSecure(result.isValid)

      if (!result.isValid) {
        console.error(`RLS validation failed for ${table}:`, result.error)
      }
    } catch (error) {
      console.error(`RLS validation error for ${table}:`, error)
      setIsSecure(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (enabled) {
      void validate()
    }
  }, [enabled, table])

  return {
    isSecure,
    loading,
    validate,
  }
}
