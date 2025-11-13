// lib/logger.ts

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  event: string
  source?: string
  details?: Record<string, any>
  error?: string
}

/**
 * Structured logger that emits JSON logs
 */
class Logger {
  private shouldLog(level: LogLevel): boolean {
    const nodeEnv = process.env.NODE_ENV || 'development'
    if (nodeEnv === 'test' && level === 'debug') return false
    return true
  }

  private log(level: LogLevel, event: string, details?: Record<string, any>, error?: Error | string) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      details
    }

    if (error) {
      entry.error = error instanceof Error ? error.message : error
    }

    // In production, emit structured JSON. In development, also pretty-print for readability
    const nodeEnv = process.env.NODE_ENV || 'development'
    if (nodeEnv === 'production') {
      console.log(JSON.stringify(entry))
    } else {
      // Pretty format for development
      const levelEmoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }
      console.log(`${levelEmoji[level]} [${level.toUpperCase()}] ${event}`, details || '', error || '')
    }
  }

  debug(event: string, details?: Record<string, any>) {
    this.log('debug', event, details)
  }

  info(event: string, details?: Record<string, any>) {
    this.log('info', event, details)
  }

  warn(event: string, details?: Record<string, any>, error?: Error | string) {
    this.log('warn', event, details, error)
  }

  error(event: string, details?: Record<string, any>, error?: Error | string) {
    this.log('error', event, details, error)
  }

  // Specific event loggers for common scenarios
  cacheHit(key: string) {
    this.debug('cache_hit', { key })
  }

  cacheMiss(key: string) {
    this.debug('cache_miss', { key })
  }

  cacheError(operation: string, error: Error | string) {
    this.warn('cache_error', { operation }, error)
  }

  providerSuccess(provider: string, latencyMs: number, details?: Record<string, any>) {
    this.info('provider_success', { provider, latencyMs, ...details })
  }

  providerError(provider: string, error: Error | string, details?: Record<string, any>) {
    this.error('provider_error', { provider, ...details }, error)
  }

  providerFallback(from: string, to: string, reason: string) {
    this.warn('provider_fallback', { from, to, reason })
  }

  webhookRequest(method: string, path: string) {
    this.info('webhook_request', { method, path })
  }

  webhookError(error: Error | string, details?: Record<string, any>) {
    this.error('webhook_error', details, error)
  }
}

// Export singleton instance
export const logger = new Logger()
