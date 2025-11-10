// api/line/webhook.ts
import type { IncomingMessage, ServerResponse } from 'http'
import crypto from 'node:crypto'

// 公用格式器
const fmt = {
  n: (x: number) => (isFinite(x) ? x.toFixed(2) : '-'),
  pct: (x: number) => (isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}%` : '-'),
  chg: (x: number) => (isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(2)}` : '-'),
  time: () => new Date().toLocaleString('zh-TW', { hour12: false }),
  trend: (x: number) => (x >= 0 ? { arrow: '▲', color: '#D32F2F' } : { arrow: '▼', color: '#1976D2' })
}


/* ---------- utils ---------- */
function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifyLineSignature(raw: Buffer, signature: string | string[] | undefined, secret: string): boolean {
  if (!signature || Array.isArray(signature)) return false
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('base64')
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac)) } catch { return false }
}

/* ---------- reply helpers ---------- */
const REPLY_URL = 'https://api.line.me/v2/bot/message/reply'

async function replyText(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!replyToken || !token) return
  const payload = { replyToken, messages: [{ type: 'text', text: text || '通知' }] }
  const r = await fetch(REPLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  if (!r.ok) console.error('LINE replyText error', r.status, await r.text())
}

async function replyFlex(replyToken: string, altText: string, flex: any) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!replyToken || !token) return

  // 防呆：altText 不能空、contents 必須是 bubble 或 carousel
  if (!altText || typeof altText !== 'string') altText = '通知'
  if (!flex || typeof flex !== 'object') return replyText(replyToken, altText)
  const t = flex?.type
  if (t !== 'bubble' && t !== 'carousel') return replyText(replyToken, altText)

  const payload = { replyToken, messages: [{ type: 'flex', altText, contents: flex }] }

  // 調試：檢查 messages 有值
  // console.log('replyFlex payload', JSON.stringify(payload))

  const r = await fetch(REPLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  const text = await r.text()
  if (!r.ok) console.error('LINE replyFlex error', r.status, text)
}

/* ---------- minimal Flex templates ---------- */
function buildPriceFlex(symbol: string) {
  // 先用 mock。之後接真實數據直接對應欄位即可。
  const data = { name: '示範公司', symbol, price: 123.45, change: -1.23, percent: -0.99, open: 125, prevClose: 124.68, high: 128.3, low: 121.9 }
  const t = fmt.trend(data.change)

  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: `${data.name}（${data.symbol}）`, weight: 'bold', size: 'md' },
        { type: 'text', text: fmt.n(data.price), weight: 'bold', size: '3xl', color: t.color },
        { type: 'text', text: `${t.arrow} ${fmt.chg(data.change)}（${fmt.pct(data.percent)}）`, size: 'sm', color: t.color },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#F7F7F7',
          cornerRadius: 'lg',
          paddingAll: '10px',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '今開', size: 'sm', color: '#666666', flex: 2 },
                { type: 'text', text: fmt.n(data.open), size: 'sm', color: '#111111', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '昨收', size: 'sm', color: '#666666', flex: 2 },
                { type: 'text', text: fmt.n(data.prevClose), size: 'sm', color: '#111111', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '最高', size: 'sm', color: '#666666', flex: 2 },
                { type: 'text', text: fmt.n(data.high), size: 'sm', color: '#111111', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '最低', size: 'sm', color: '#666666', flex: 2 },
                { type: 'text', text: fmt.n(data.low), size: 'sm', color: '#111111', align: 'end', flex: 3 }
              ]
            }
          ]
        },
        { type: 'text', text: `更新：${fmt.time()}`, size: 'xs', color: '#999999' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'button', style: 'primary', color: '#2E7D32', action: { type: 'message', label: '查看新聞', text: `新聞 ${symbol}` } },
        { type: 'button', style: 'secondary', action: { type: 'message', label: '加入自選', text: `+自選 ${symbol}` } }
      ]
    }
  }
}


function buildNewsFlex(keyword: string) {
  const items = [
    { title: `${keyword} 市場動態：需求回溫`, source: 'FinDaily', time: '2 小時前' },
    { title: `${keyword} 供應鏈：庫存趨正常`, source: 'TechBiz', time: '5 小時前' },
    { title: `${keyword} 法說重點與展望`, source: 'MoneyNews', time: '昨天' }
  ]

  const bubbles = items.map((n, idx) => ({
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        { type: 'text', text: n.title, wrap: true, weight: 'bold', size: 'sm' },
        { type: 'text', text: `${n.source}・${n.time}`, size: 'xs', color: '#888888' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'button', style: 'link', action: { type: 'message', label: '更多同主題', text: `新聞 ${keyword}` } },
        ...(idx === items.length - 1
          ? [{ type: 'button', style: 'secondary', action: { type: 'message', label: '回股價', text: `股價 2330` } }]
          : [])
      ]
    }
  }))

  return { type: 'carousel', contents: bubbles }
}


/* ---------- command parsing ---------- */
function parseCommand(text: string): { cmd: string; args: string } {
  const t = text.trim()
  const [head, ...rest] = t.split(/\s+/)
  return { cmd: (head || '').toLowerCase(), args: rest.join(' ') }
}

function buildHelpFlex() {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '可用指令', weight: 'bold', size: 'lg' },
        { type: 'text', text: '• 股價 <代號>\n• 新聞 <關鍵字>\n• help', wrap: true }
      ]
    }
  }
}

/* ---------- main handler ---------- */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return }

  const raw = await readRawBody(req)

  const skip = process.env.DEBUG === 'True'
  if (skip) {
    const secret = process.env.LINE_CHANNEL_SECRET || ''
    const signature = req.headers['x-line-signature'] as string | undefined
    if (!secret || !verifyLineSignature(raw, signature, secret)) {
      res.statusCode = 401; res.end('Invalid signature'); return
    }
  }

  let payload: any
  try { payload = JSON.parse(raw.toString('utf8')) } catch { res.statusCode = 400; res.end('Bad JSON'); return }

  const events: any[] = Array.isArray(payload?.events) ? payload.events : []
  for (const ev of events) {
    if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
      const { cmd, args } = parseCommand(String(ev.message.text || ''))

      if (cmd === 'help' || cmd === '/help' || cmd === '？') {
        await replyFlex(ev.replyToken, '可用指令', buildHelpFlex())
      } else if (cmd === '股價' || cmd === 'price') {
        await replyFlex(ev.replyToken, `股價 ${args}`, buildPriceFlex(args || '2330'))
      } else if (cmd === '新聞' || cmd === 'news') {
        await replyFlex(ev.replyToken, `新聞 ${args}`, buildNewsFlex(args || '半導體'))
      } else {
        await replyText(ev.replyToken, '輸入「help」查看指令。')
      }
    }
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true }))
}
