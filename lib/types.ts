// Re-export types from schemas for backward compatibility
export type { Quote, NewsItem, Command, ProviderEvent } from './schemas'

// Stock-related types used by stock-list generation scripts
export interface Stock {
	symbol: string
	name: string
	market: 'twse' | 'tpex'
	aliases?: string[]
}

export interface StockDictionaryEntry {
	symbol: string
	name: string
	aliases?: string[]
}

export type StockAliases = Record<string, string[]>

