// api/line/webhook.ts
import type { IncomingMessage, ServerResponse } from 'http'
import crypto from 'node:crypto'

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
  // 最小合法 bubble；先避免可空欄位造成非法
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `價格卡 ${symbol || ''}`, weight: 'bold', size: 'lg' },
        { type: 'text', text: '這是範例 Flex 卡', size: 'sm', color: '#666666', wrap: true }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'button', style: 'link', action: { type: 'message', label: '查看新聞', text: `新聞 ${symbol || ''}` } }
      ]
    }
  }
}

function buildNewsFlex(keyword: string) {
  return {
    type: 'carousel',
    contents: [
      {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: `新聞 ${keyword || ''}`, weight: 'bold', size: 'lg' },
            { type: 'text', text: '示範卡 1', size: 'sm' }
          ]
        }
      }
    ]
  }
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
