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

export function buildNewsFlexFromItems(keyword: string, items: NewsItem[]) {
  if (!Array.isArray(items) || items.length === 0) {
    // 空清單時給單卡提示，避免 messages 為空
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `找不到相關新聞：${keyword}`, weight: 'bold', size: 'md', wrap: true },
          { type: 'text', text: '請換個關鍵字再試試。', size: 'sm', color: '#666' }
        ]
      }
    }
  }

  const bubbles = items.slice(0, 5).map((n) => ({
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: n.title || '(無標題)', wrap: true, weight: 'bold', size: 'sm' },
        { type: 'text', text: `${n.source ?? ''}${n.source && n.publishedAt ? '・' : ''}${n.publishedAt ? new Date(n.publishedAt).toLocaleString('zh-TW', { hour12: false }) : ''}`, size: 'xs', color: '#888888', wrap: true }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        n.url
          ? { type: 'button', style: 'link', action: { type: 'uri', label: '閱讀全文', uri: n.url } }
          : { type: 'button', style: 'secondary', action: { type: 'message', label: '更多新聞', text: `新聞 ${keyword}` } }
      ]
    }
  }))

  return { type: 'carousel', contents: bubbles }
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
