/**
 * Server-side logging utility for Next.js
 * Best practices for production logging with structured data
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Development: Pretty print with colors
      const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}:`;
      console.log(prefix, entry.message);

      if (entry.context) {
        console.log('Context:', entry.context);
      }

      if (entry.error) {
        console.error('Error:', entry.error);
      }
    } else {
      // Production: Structured JSON for log aggregation
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.formatLog('debug', message, context);
    this.output(entry);
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    const entry = this.formatLog('info', message, context);
    this.output(entry);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.formatLog('warn', message, context, error);
    this.output(entry);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog('error')) return;
    const entry = this.formatLog('error', message, context, error);
    this.output(entry);
  }

  // Convenience method for auth operations
  auth(operation: string, message: string, context?: LogContext, error?: Error): void {
    const authContext = {
      operation,
      ...context,
    };

    if (error) {
      this.error(message, authContext, error);
    } else {
      this.info(message, authContext);
    }
  }

  // Convenience method for database operations
  db(operation: string, table: string, message: string, context?: LogContext, error?: Error): void {
    const dbContext = {
      operation,
      table,
      ...context,
    };

    if (error) {
      this.error(message, dbContext, error);
    } else {
      this.info(message, dbContext);
    }
  }
}

// Singleton logger instance
export const logger = new Logger();

// Helper function to sanitize sensitive data before logging
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'cookie'];
  const sanitized = { ...data };

  for (const key in sanitized) {
    if (typeof key === 'string' && sensitiveKeys.some(sensitive =>
      key.toLowerCase().includes(sensitive)
    )) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}
