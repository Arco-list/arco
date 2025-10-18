/**
 * Enhanced error handling for admin actions
 */

import { logger } from "@/lib/logger"

export type ErrorCode = 'VALIDATION' | 'AUTH' | 'DATABASE' | 'BUSINESS_LOGIC' | 'EXTERNAL_SERVICE'

export interface ActionError {
  success: false
  error: {
    message: string
    code: ErrorCode
    details?: Record<string, any>
  }
  warnings?: string[]
}

export interface ActionSuccess<T = any> {
  success: true
  data?: T
  warnings?: string[]
}

export type ActionResult<T = any> = ActionSuccess<T> | ActionError

/**
 * Create a standardized error response with logging
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, any>,
  scope?: string
): ActionError {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  logger.error(
    message,
    {
      scope: scope || 'admin-action',
      errorId,
      code,
      ...details
    }
  )
  
  return {
    success: false,
    error: {
      message,
      code,
      details: {
        errorId,
        timestamp: new Date().toISOString(),
        ...details
      }
    }
  }
}

/**
 * Create a success response with optional warnings
 */
export function createSuccessResponse<T>(
  data?: T,
  warnings?: string[]
): ActionSuccess<T> {
  return {
    success: true,
    data,
    ...(warnings?.length && { warnings })
  }
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    onRetry?: (attempt: number, error: any) => void
  } = {}
): Promise<{ data?: T; error?: any }> {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 2000,
    onRetry
  } = options

  let lastError: any
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await operation()
      return { data }
    } catch (error) {
      lastError = error
      
      if (attempt < maxAttempts) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
        onRetry?.(attempt, error)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  return { error: lastError }
}

/**
 * Extract safe error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unexpected error occurred'
}

/**
 * Determine error code from error type
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return 'AUTH'
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'VALIDATION'
    }
    if (message.includes('database') || message.includes('supabase') || message.includes('query')) {
      return 'DATABASE'
    }
  }
  return 'BUSINESS_LOGIC'
}