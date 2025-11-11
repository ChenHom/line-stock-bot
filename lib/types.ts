export type Quote = {
  symbol: string
  marketSymbol: string
  name?: string
  price: number
  change: number
  changePercent: number
  open?: number
  high?: number
  low?: number
  prevClose?: number
  currency?: string
  marketTime?: string
  delayed?: boolean
}

export type NewsItem = {
  title: string
  url: string
  source?: string
  publishedAt?: string
}
