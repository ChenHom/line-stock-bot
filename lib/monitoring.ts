// lib/monitoring.ts
import { logger } from './logger'

/**
 * Simple in-memory metrics collector
 * In production, replace with external metrics service (e.g., Datadog, CloudWatch)
 */
class MetricsCollector {
  private metrics: Map<string, number> = new Map()
  private enabled: boolean

  constructor() {
    this.enabled = process.env.MONITORING_ENABLED === 'true'
  }

  increment(metric: string, value: number = 1) {
    if (!this.enabled) return

    const current = this.metrics.get(metric) || 0
    this.metrics.set(metric, current + value)
  }

  get(metric: string): number {
    return this.metrics.get(metric) || 0
  }

  getAll(): Record<string, number> {
    const result: Record<string, number> = {}
    this.metrics.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  reset() {
    this.metrics.clear()
  }

  // Specific metric helpers
  recordCacheHit() {
    this.increment('cache.hits')
  }

  recordCacheMiss() {
    this.increment('cache.misses')
  }

  recordCacheError() {
    this.increment('cache.errors')
  }

  recordProviderSuccess(provider: string) {
    this.increment(`provider.${provider}.success`)
  }

  recordProviderError(provider: string) {
    this.increment(`provider.${provider}.error`)
  }

  recordProviderFallback(from: string, to: string) {
    this.increment(`fallback.${from}_to_${to}`)
  }

  /**
   * Calculate cache hit rate
   */
  getCacheHitRate(): number {
    const hits = this.get('cache.hits')
    const misses = this.get('cache.misses')
    const total = hits + misses
    return total > 0 ? hits / total : 0
  }

  /**
   * Get fallback rate for a specific provider
   */
  getFallbackRate(provider: string): number {
    const success = this.get(`provider.${provider}.success`)
    const errors = this.get(`provider.${provider}.error`)
    const total = success + errors
    return total > 0 ? errors / total : 0
  }

  /**
   * Log current metrics summary
   */
  logSummary() {
    if (!this.enabled) return

    const summary = {
      cache: {
        hits: this.get('cache.hits'),
        misses: this.get('cache.misses'),
        errors: this.get('cache.errors'),
        hitRate: (this.getCacheHitRate() * 100).toFixed(2) + '%'
      },
      providers: this.getProviderMetrics(),
      fallbacks: this.getFallbackMetrics()
    }

    logger.info('monitoring_summary', summary)
  }

  private getProviderMetrics(): Record<string, any> {
    const providers: Record<string, any> = {}
    const providerNames = ['twse', 'yahoo', 'google-rss', 'yahoo-rss']

    for (const name of providerNames) {
      const success = this.get(`provider.${name}.success`)
      const error = this.get(`provider.${name}.error`)
      if (success > 0 || error > 0) {
        providers[name] = {
          success,
          error,
          total: success + error,
          errorRate: ((error / (success + error)) * 100).toFixed(2) + '%'
        }
      }
    }

    return providers
  }

  private getFallbackMetrics(): Record<string, number> {
    const fallbacks: Record<string, number> = {}
    this.metrics.forEach((value, key) => {
      if (key.startsWith('fallback.')) {
        fallbacks[key.replace('fallback.', '')] = value
      }
    })
    return fallbacks
  }
}

// Export singleton instance
export const metrics = new MetricsCollector()

/**
 * Middleware to periodically log metrics summary
 * Call this on app startup in serverless environments
 */
export function startMonitoring(intervalMs: number = 60000) {
  if (process.env.MONITORING_ENABLED !== 'true') {
    logger.info('monitoring_disabled', { message: 'Set MONITORING_ENABLED=true to enable monitoring' })
    return
  }

  logger.info('monitoring_started', { intervalMs })

  setInterval(() => {
    metrics.logSummary()
  }, intervalMs)
}
