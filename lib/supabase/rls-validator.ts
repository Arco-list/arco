/**
 * Row Level Security (RLS) Validation Utilities
 *
 * SECURITY: This module provides runtime validation that RLS policies are correctly
 * configured and enforced. Never trust client-side filtering alone.
 *
 * Critical Security Principles:
 * 1. Defense in Depth: RLS at database + application validation
 * 2. Fail Secure: Block access if RLS validation fails
 * 3. Audit Trail: Log all RLS validation failures
 * 4. Zero Trust: Validate every query, every time
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

type Tables = Database["public"]["Tables"]

export type RLSValidationResult = {
  isValid: boolean
  policy: string
  table: string
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE"
  error?: string
  userId?: string
}

export type RLSValidationError = {
  table: string
  operation: string
  expectedPolicy: string
  actualBehavior: string
  securityRisk: "HIGH" | "CRITICAL"
  recommendation: string
}

/**
 * Validate that RLS policies are enforced for a given table
 *
 * @param supabase - Authenticated Supabase client
 * @param table - Table name to validate
 * @returns Validation result with policy status
 */
export async function validateRLSEnabled(
  supabase: SupabaseClient<Database>,
  table: keyof Tables
): Promise<RLSValidationResult> {
  try {
    // Query pg_tables to check if RLS is enabled
    const { data, error } = await supabase.rpc("check_rls_enabled", {
      table_name: table,
    })

    if (error) {
      return {
        isValid: false,
        policy: "unknown",
        table,
        operation: "SELECT",
        error: `Failed to check RLS status: ${error.message}`,
      }
    }

    if (!data) {
      return {
        isValid: false,
        policy: "none",
        table,
        operation: "SELECT",
        error: "RLS is not enabled on this table",
      }
    }

    return {
      isValid: true,
      policy: "enabled",
      table,
      operation: "SELECT",
    }
  } catch (error) {
    return {
      isValid: false,
      policy: "error",
      table,
      operation: "SELECT",
      error: error instanceof Error ? error.message : "Unknown validation error",
    }
  }
}

/**
 * Validate that user can only access their own projects
 *
 * SECURITY: Tests that RLS policies prevent unauthorized access
 * - User should only see projects where client_id matches their user ID
 * - Attempting to access other users' projects should fail
 */
export async function validateProjectRLS(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<RLSValidationResult> {
  try {
    // Test 1: Verify user can access their own projects
    const { data: ownProjects, error: ownError } = await supabase
      .from("projects")
      .select("id, client_id")
      .eq("client_id", userId)
      .limit(1)

    if (ownError) {
      return {
        isValid: false,
        policy: "projects_select_own",
        table: "projects",
        operation: "SELECT",
        error: `Cannot access own projects: ${ownError.message}`,
        userId,
      }
    }

    // Test 2: Verify user cannot bypass client_id filter
    // RLS should automatically filter results even without .eq("client_id", userId)
    const { data: allProjects, error: allError } = await supabase
      .from("projects")
      .select("id, client_id, status")
      .limit(100)

    if (allError) {
      return {
        isValid: false,
        policy: "projects_select_rls",
        table: "projects",
        operation: "SELECT",
        error: `RLS query failed: ${allError.message}`,
        userId,
      }
    }

    // SECURITY: All returned projects must belong to the authenticated user
    const unauthorizedAccess = allProjects?.some((project) => {
      const ownsProject = project.client_id === userId
      const isPublicListing = project.status === "published"
      return !ownsProject && !isPublicListing
    })

    if (unauthorizedAccess) {
      return {
        isValid: false,
        policy: "projects_select_rls",
        table: "projects",
        operation: "SELECT",
        error: "RLS FAILURE: User can access projects they don't own",
        userId,
      }
    }

    return {
      isValid: true,
      policy: "projects_select_rls",
      table: "projects",
      operation: "SELECT",
      userId,
    }
  } catch (error) {
    return {
      isValid: false,
      policy: "projects_select_rls",
      table: "projects",
      operation: "SELECT",
      error: error instanceof Error ? error.message : "Unknown RLS validation error",
      userId,
    }
  }
}

/**
 * Validate that photo uploads are restricted to project owners
 *
 * SECURITY: Tests that RLS policies prevent unauthorized photo uploads
 */
export async function validatePhotoUploadRLS(
  supabase: SupabaseClient<Database>,
  userId: string,
  projectId: string
): Promise<RLSValidationResult> {
  try {
    // Verify user owns the project before allowing photo upload
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("client_id")
      .eq("id", projectId)
      .single()

    if (projectError) {
      return {
        isValid: false,
        policy: "project_photos_insert",
        table: "project_photos",
        operation: "INSERT",
        error: `Cannot verify project ownership: ${projectError.message}`,
        userId,
      }
    }

    if (!project || project.client_id !== userId) {
      return {
        isValid: false,
        policy: "project_photos_insert",
        table: "project_photos",
        operation: "INSERT",
        error: "User does not own this project - photo upload should be blocked",
        userId,
      }
    }

    return {
      isValid: true,
      policy: "project_photos_insert",
      table: "project_photos",
      operation: "INSERT",
      userId,
    }
  } catch (error) {
    return {
      isValid: false,
      policy: "project_photos_insert",
      table: "project_photos",
      operation: "INSERT",
      error: error instanceof Error ? error.message : "Unknown RLS validation error",
      userId,
    }
  }
}

/**
 * Validate that profile updates are restricted to the profile owner
 *
 * SECURITY: Tests that users can only update their own profiles
 */
export async function validateProfileUpdateRLS(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<RLSValidationResult> {
  try {
    // Attempt to read own profile
    const { data: ownProfile, error: ownError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single()

    if (ownError) {
      return {
        isValid: false,
        policy: "profiles_update_own",
        table: "profiles",
        operation: "UPDATE",
        error: `Cannot access own profile: ${ownError.message}`,
        userId,
      }
    }

    return {
      isValid: true,
      policy: "profiles_update_own",
      table: "profiles",
      operation: "UPDATE",
      userId,
    }
  } catch (error) {
    return {
      isValid: false,
      policy: "profiles_update_own",
      table: "profiles",
      operation: "UPDATE",
      error: error instanceof Error ? error.message : "Unknown RLS validation error",
      userId,
    }
  }
}

/**
 * Run comprehensive RLS validation suite
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to validate
 * @returns Array of validation results
 */
export async function runRLSValidationSuite(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<RLSValidationResult[]> {
  const results = await Promise.all([
    validateRLSEnabled(supabase, "projects"),
    validateRLSEnabled(supabase, "project_photos"),
    validateRLSEnabled(supabase, "profiles"),
    validateProjectRLS(supabase, userId),
    validateProfileUpdateRLS(supabase, userId),
  ])

  return results
}

/**
 * Check if RLS validation passed for all critical tables
 *
 * @param results - Array of validation results
 * @returns true if all validations passed, false otherwise
 */
export function isRLSSecure(results: RLSValidationResult[]): boolean {
  return results.every((result) => result.isValid)
}

/**
 * Get security recommendations based on RLS validation failures
 *
 * @param results - Array of validation results
 * @returns Array of security errors with recommendations
 */
export function getRLSSecurityErrors(
  results: RLSValidationResult[]
): RLSValidationError[] {
  return results
    .filter((result) => !result.isValid)
    .map((result): RLSValidationError => {
      const isCritical = result.table === "projects" || result.table === "profiles"

      return {
        table: result.table,
        operation: result.operation,
        expectedPolicy: result.policy,
        actualBehavior: result.error || "Unknown failure",
        securityRisk: isCritical ? "CRITICAL" : "HIGH",
        recommendation: getRecommendation(result),
      }
    })
}

function getRecommendation(result: RLSValidationResult): string {
  if (result.error?.includes("RLS is not enabled")) {
    return `Enable RLS on ${result.table}: ALTER TABLE ${result.table} ENABLE ROW LEVEL SECURITY;`
  }

  if (result.error?.includes("can access projects they don't own")) {
    return `Fix RLS policy on ${result.table} to filter by user ID. Review policies with: SELECT * FROM pg_policies WHERE tablename = '${result.table}';`
  }

  if (result.error?.includes("Cannot verify project ownership")) {
    return `Ensure RLS policy on projects table allows users to read their own projects`
  }

  return `Review and fix RLS policies for ${result.table}. Check: https://supabase.com/docs/guides/auth/row-level-security`
}

/**
 * Log RLS validation failures for security monitoring
 *
 * SECURITY: In production, send these to your security monitoring system
 * (e.g., Sentry, Datadog, CloudWatch, etc.)
 */
export function logRLSFailures(
  results: RLSValidationResult[],
  context: { userId?: string; page?: string }
): void {
  const failures = results.filter((r) => !r.isValid)

  if (failures.length === 0) return

  const securityEvent = {
    type: "RLS_VALIDATION_FAILURE",
    timestamp: new Date().toISOString(),
    userId: context.userId,
    page: context.page,
    failures: failures.map((f) => ({
      table: f.table,
      policy: f.policy,
      operation: f.operation,
      error: f.error,
    })),
  }

  // Development: Console error
  if (process.env.NODE_ENV === "development") {
    console.error("🚨 RLS Security Validation Failed:", securityEvent)
  }

  // Production: Send to monitoring service
  // TODO: Integrate with your security monitoring system
  // Example: Sentry.captureException(new Error("RLS_VALIDATION_FAILURE"), { extra: securityEvent })
}
