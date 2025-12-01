// lib/schemas.ts
import { z } from 'zod'

/**
 * Quote schema with runtime validation
 */
export const QuoteSchema = z.object({
  symbol: z.string().min(1, 'Symbol must be non-empty'),
  marketSymbol: z.string(),
  name: z.string().optional(),
  price: z.number().finite('Price must be a finite number'),
  change: z.number().finite('Change must be a finite number'),
  changePercent: z.number().finite('Change percent must be a finite number'),
  open: z.number().finite().optional(),
  high: z.number().finite().optional(),
  low: z.number().finite().optional(),
  prevClose: z.number().finite().optional(),
  currency: z.string().optional(),
  marketTime: z.string().optional(),
  delayed: z.boolean().optional()
})

export type Quote = z.infer<typeof QuoteSchema>

/**
 * NewsItem schema with runtime validation
 */
export const NewsItemSchema = z.object({
  title: z.string().min(1, 'Title must be non-empty'),
  url: z.string().url('URL must be valid'),
  source: z.string().optional(),
  publishedAt: z.string().optional(),
  imageUrl: z.string().url().optional()
})

export type NewsItem = z.infer<typeof NewsItemSchema>

/**
 * Command schema
 */
export const CommandSchema = z.object({
  cmd: z.enum(['price', 'news', 'help']),
  args: z.string()
})

export type Command = z.infer<typeof CommandSchema>

/**
 * Provider event/log schema
 */
export const ProviderEventSchema = z.object({
  provider: z.string(),
  status: z.enum(['success', 'error', 'fallback']),
  latencyMs: z.number(),
  error: z.string().optional()
})

export type ProviderEvent = z.infer<typeof ProviderEventSchema>

/**
 * FuzzyMatchResult schema for symbol resolution
 */
export const FuzzyMatchResultSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  confidence: z.number().min(0).max(100),
  score: z.number().min(0).max(1).optional()
})

export type FuzzyMatchResult = z.infer<typeof FuzzyMatchResultSchema>

/**
 * LogEntry schema for structured logging
 */
export const LogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string().min(1),
  requestId: z.string().optional(),
  userId: z.string().optional(),
  providerName: z.string().optional(),
  latency: z.number().nonnegative().optional(),
  details: z.record(z.string(), z.any()).optional(),
  error: z.string().optional(),
  stack: z.string().optional()
})

export type LogEntry = z.infer<typeof LogEntrySchema>
