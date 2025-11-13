import {Quote, NewsItem} from './types'

// 公用格式器
const fmt = {
  n: (x: number | undefined) => (x ? (isFinite(x) ? x.toFixed(2) : '-') : '-'),
  pct: (x: number) => (isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '-'),
  chg: (x: number) => (isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}` : '-'),
  time: (x: string | undefined) => (x ? new Date(x) : new Date()).toLocaleString('zh-TW', { hour12: false }),
  trend: (x: number) => (x >= 0 ? { arrow: '▲', color: '#D32F2F' } : { arrow: '▼', color: '#1976D2' })
}

export function buildPriceFlexFromData(q: Quote) {
  const t = fmt.trend(q.change)
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: `${q.name ?? ''}（${q.symbol}）`, weight: 'bold', size: 'md', wrap: true },
        { type: 'text', text: fmt.n(q.price), weight: 'bold', size: '3xl', color: t.color },
        { type: 'text', text: `${t.arrow} ${fmt.chg(q.change)}（${fmt.pct(q.changePercent)}）`, size: 'sm', color: t.color },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#F7F7F7',
          cornerRadius: 'lg',
          paddingAll: '10px',
          contents: [
            {
              type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '今開', size: 'sm', color: '#666', flex: 2 },
                { type: 'text', text: fmt.n(q.open), size: 'sm', color: '#111', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '昨收', size: 'sm', color: '#666', flex: 2 },
                { type: 'text', text: fmt.n(q.prevClose), size: 'sm', color: '#111', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '最高', size: 'sm', color: '#666', flex: 2 },
                { type: 'text', text: fmt.n(q.high), size: 'sm', color: '#111', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box', layout: 'horizontal', contents: [
                { type: 'text', text: '最低', size: 'sm', color: '#666', flex: 2 },
                { type: 'text', text: fmt.n(q.low), size: 'sm', color: '#111', align: 'end', flex: 3 }
              ]
            }
          ]
        },
        { type: 'text', text: `更新：${fmt.time(q.marketTime)}`, size: 'xs', color: '#999' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', color: '#2E7D32', action: { type: 'message', label: '查看新聞', text: `新聞 ${q.symbol}` } },
        { type: 'button', style: 'secondary', action: { type: 'message', label: '加入自選', text: `+自選 ${q.symbol}` } }
      ]
    }
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
