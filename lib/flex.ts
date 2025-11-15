import { Quote, NewsItem } from './types'

const fmt = {
  n: (x: number | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(2) : '-'),
  pct: (x: number | undefined) =>
    typeof x === 'number' && Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '-',
  chg: (x: number | undefined) =>
    typeof x === 'number' && Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}` : '-',
  time: (x: string | undefined) =>
    (x ? new Date(x) : new Date()).toLocaleString('zh-TW', { hour12: false }),
  trend: (x: number | undefined) =>
    (typeof x === 'number' && x < 0)
      ? { arrow: '▼', color: '#1976D2' }
      : { arrow: '▲', color: '#D32F2F' }
}

const HELP_COMMANDS = [
  {
    title: '股價 <代號或名稱>',
    description: '查詢即時股價，支援代號或公司名稱，並會自動套用模糊比對。',
    example: '股價 2330'
  },
  {
    title: '新聞 <公司或產業>',
    description: '取得指定公司或產業的最新新聞，建議輸入具體關鍵字。',
    example: '新聞 半導體'
  },
  {
    title: 'help / 幫助',
    description: '顯示所有支援的指令與使用範例，適合新使用者快速上手。',
    example: 'help'
  }
]

export function createStockQuoteMessage(quote: Quote, options?: { isStale?: boolean }) {
  const { isStale } = options || {}
  const trend = fmt.trend(quote.change)

  const headerLine = `${quote.name ?? '股票'}（${quote.symbol}）`
  const updatedAt = fmt.time(quote.marketTime)
  const canvas = {
    type: 'bubble' as const,
    size: 'mega',
    body: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'md' as const,
      contents: [
        { type: 'text', text: headerLine, weight: 'bold', size: 'md', wrap: true },
        { type: 'text', text: fmt.n(quote.price), weight: 'bold', size: '3xl', color: trend.color },
        { type: 'text', text: `${trend.arrow} ${fmt.chg(quote.change)}（${fmt.pct(quote.changePercent)}）`, size: 'sm', color: trend.color },
        buildQuoteStatBox(quote),
        buildUpdateRow(updatedAt, isStale)
      ]
    },
    footer: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'sm' as const,
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#2E7D32',
          action: { type: 'message', label: '查看新聞', text: `新聞 ${quote.symbol}` }
        }
      ]
    }
  }

  return canvas
}

// Backward-compatible helper used by existing webhook handler
export function buildPriceFlexFromData(quote: Quote, options?: { isStale?: boolean }) {
  return createStockQuoteMessage(quote, options)
}

function buildQuoteStatBox(quote: Quote) {
  const rows = [
    ['今開', fmt.n(quote.open)],
    ['昨收', fmt.n(quote.prevClose)],
    ['最高', fmt.n(quote.high)],
    ['最低', fmt.n(quote.low)]
  ]

  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    margin: 'md' as const,
    backgroundColor: '#F7F7F7',
    cornerRadius: 'lg',
    paddingAll: '10px',
    contents: rows.map(([label, value]) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: label, size: 'sm', color: '#666666', flex: 2 },
        { type: 'text', text: value, size: 'sm', color: '#111111', align: 'end', flex: 3 }
      ]
    }))
  }
}

function buildUpdateRow(updatedAt: string, isStale?: boolean) {
  const contents: any[] = [
    { type: 'text', text: `更新：${updatedAt}`, size: 'xs', color: '#999999' }
  ]

  if (isStale) {
    contents.push({
      type: 'text',
      text: '資料可能稍有延遲',
      size: 'xs',
      color: '#F57C00'
    })
  }

  return {
    type: 'box' as const,
    layout: 'vertical' as const,
    spacing: 'xs' as const,
    contents
  }
}

export function createNewsListMessage(keyword: string, items: NewsItem[], options?: { isStale?: boolean }) {
  if (!Array.isArray(items) || items.length === 0) {
    return buildStatusFlex('找不到相關新聞', `關鍵字：${keyword}`, 'info')
  }

  const bubbles = items.slice(0, 5).map((item) => createNewsBubble(keyword, item))

  if (options?.isStale) {
    bubbles.unshift(createStaleNoticeBubble(keyword))
  }

  if (bubbles.length === 1) {
    return bubbles[0]
  }

  return { type: 'carousel', contents: bubbles }
}

export function buildNewsFlexFromItems(keyword: string, items: NewsItem[], options?: { isStale?: boolean }) {
  return createNewsListMessage(keyword, items, options)
}

/**
 * Build a simple error/status message Flex bubble
 */
export function buildStatusFlex(title: string, message: string, type: 'info' | 'warning' | 'error' = 'info') {
  const colors = {
    info: { bg: '#E3F2FD', text: '#1976D2' },
    warning: { bg: '#FFF3E0', text: '#F57C00' },
    error: { bg: '#FFEBEE', text: '#D32F2F' }
  }
  const color = colors[type]

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '20px',
      backgroundColor: color.bg,
      contents: [
        { type: 'text', text: title, weight: 'bold', size: 'lg', color: color.text, wrap: true },
        { type: 'text', text: message, size: 'sm', color: '#666', wrap: true, margin: 'md' }
      ]
    }
  }
}

function createNewsBubble(keyword: string, news: NewsItem) {
  const metaParts: string[] = []
  if (news.source) {
    metaParts.push(news.source)
  }
  if (news.publishedAt) {
    metaParts.push(new Date(news.publishedAt).toLocaleString('zh-TW', { hour12: false }))
  }

  const metaLine = metaParts.join(' ・ ')
  const snippet = news.description ? truncateText(news.description, 120) : undefined
  const bodyContents: any[] = [
    { type: 'text', text: news.title || '(無標題)', wrap: true, weight: 'bold', size: 'sm' }
  ]

  if (metaLine) {
    bodyContents.push({ type: 'text', text: metaLine, size: 'xs', color: '#888888', wrap: true })
  }

  if (snippet) {
    bodyContents.push({ type: 'text', text: snippet, size: 'xs', color: '#666666', wrap: true })
  }

  return {
    type: 'bubble' as const,
    size: 'kilo' as const,
    body: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'sm' as const,
      contents: bodyContents
    },
    footer: {
      type: 'box' as const,
      layout: 'vertical' as const,
      contents: [
        news.url
          ? { type: 'button', style: 'link' as const, action: { type: 'uri', label: '閱讀全文', uri: news.url } }
          : { type: 'button', style: 'secondary' as const, action: { type: 'message', label: '更多新聞', text: `新聞 ${keyword}` } }
      ]
    }
  }
}

function createStaleNoticeBubble(keyword: string) {
  return {
    type: 'bubble' as const,
    size: 'kilo' as const,
    body: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'sm' as const,
      contents: [
        { type: 'text', text: `新聞 ${keyword}`, size: 'sm', weight: 'bold', color: '#F57C00', wrap: true },
        { type: 'text', text: '資料可能稍有延遲，提供最近可用的資訊。', size: 'xs', color: '#F57C00', wrap: true }
      ]
    },
    footer: {
      type: 'box' as const,
      layout: 'vertical' as const,
      contents: [
        {
          type: 'button' as const,
          style: 'secondary' as const,
          action: { type: 'message' as const, label: '重新查詢', text: `新聞 ${keyword}` }
        }
      ]
    }
  }
}

function truncateText(value: string, length: number): string {
  if (value.length <= length) return value
  return `${value.slice(0, length - 1)}…`
}

export function createHelpMessage(options?: { title?: string; contextNote?: string }) {
  const title = options?.title ?? '指令使用說明'
  const contextNote = options?.contextNote

  const bodyContents: any[] = [
    { type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true }
  ]

  if (contextNote) {
    bodyContents.push({ type: 'text', text: contextNote, size: 'xs', color: '#F57C00', wrap: true })
  }

  bodyContents.push({ type: 'text', text: '依照下列格式輸入即可快速取得資訊：', size: 'xs', color: '#7A869A', wrap: true })

  bodyContents.push(
    ...HELP_COMMANDS.map((cmd) => ({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: 'md',
      paddingAll: '12px',
      backgroundColor: '#F5F7FB',
      cornerRadius: 'md',
      contents: [
        { type: 'text', text: cmd.title, weight: 'bold', size: 'sm', color: '#0D47A1', wrap: true },
        { type: 'text', text: cmd.description, size: 'xs', color: '#4E5D78', wrap: true },
        { type: 'text', text: `範例：${cmd.example}`, size: 'xs', color: '#90A4AE', wrap: true }
      ]
    }))
  )

  const footerContents: any[] = [
    { type: 'text', text: '快速試試看', size: 'xs', color: '#7A869A' },
    {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'message', label: '查股價', text: '股價 2330' } },
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'message', label: '看新聞', text: '新聞 台積電' } }
      ]
    }
  ]

  return {
    type: 'bubble' as const,
    size: 'mega' as const,
    body: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'sm' as const,
      contents: bodyContents
    },
    footer: {
      type: 'box' as const,
      layout: 'vertical' as const,
      spacing: 'sm' as const,
      contents: footerContents
    }
  }
}
