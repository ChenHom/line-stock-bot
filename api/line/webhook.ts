// api/line/webhook.ts
import { getQuoteWithFallback, getIndustryNews } from '../../lib/providers'
import { buildPriceFlexFromData, buildNewsFlexFromItems, buildStatusFlex } from '../../lib/flex'
import { logger } from '../../lib/logger'
import { resolveSymbol } from '../../lib/symbol'

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
  if (!r.ok) {
    const errorText = await r.text()
    logger.error('line_reply_text_failed', { status: r.status, error: errorText })
  }
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
  // logger.debug('replyFlex payload', { payload: JSON.stringify(payload) })

  const r = await fetch(REPLY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  const text = await r.text()
  if (!r.ok) {
    logger.error('line_reply_flex_failed', { status: r.status, error: text })
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
  logger.webhookRequest(req.method || 'UNKNOWN', req.url || '/api/line/webhook')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  const raw = await readRawBody(req)

  const skip = process.env.DEBUG === 'True'
  if (!skip) {
    const secret = process.env.LINE_CHANNEL_SECRET || ''
    const signature = req.headers['x-line-signature'] as string | undefined
    if (!secret || !verifyLineSignature(raw, signature, secret)) {
      logger.warn('webhook_signature_invalid', { hasSecret: !!secret, hasSignature: !!signature })
      res.statusCode = 401
      res.end('Invalid signature')
      return
    }
  }

  let payload: any
  try {
    payload = JSON.parse(raw.toString('utf8'))
  } catch (e) {
    logger.error('webhook_invalid_json', {}, e instanceof Error ? e : String(e))
    res.statusCode = 400
    res.end('Bad JSON')
    return
  }

  const events: any[] = Array.isArray(payload?.events) ? payload.events : []
  for (const ev of events) {
    if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
      const { cmd, args } = parseCommand(String(ev.message.text || ''))
      logger.info('webhook_command', { cmd, args })

      try {
        if (cmd === 'help' || cmd === '/help' || cmd === '？' || cmd === '幫助') {
          await replyFlex(ev.replyToken, '可用指令', buildHelpFlex())
        } else if (cmd === '股價' || cmd === 'price') {
          const resolvedSymbol = resolveSymbol(args || '2330')
          const quote = await getQuoteWithFallback(resolvedSymbol)
          const flex = buildPriceFlexFromData(quote)
          await replyFlex(ev.replyToken, `股價 ${quote.symbol}`, flex)
        } else if (cmd === '新聞' || cmd === 'news') {
          const items = await getIndustryNews(args || '半導體', 5)
          const flex = buildNewsFlexFromItems(args || '半導體', items)
          await replyFlex(ev.replyToken, `新聞 ${args}`, flex)
        } else {
          const helpFlex = buildStatusFlex(
            '未知指令',
            '請輸入「help」查看可用指令。',
            'info'
          )
          await replyFlex(ev.replyToken, '未知指令', helpFlex)
        }
      } catch (error) {
        logger.webhookError(error instanceof Error ? error : String(error), { cmd, args })
        const errorFlex = buildStatusFlex(
          '處理指令時發生錯誤',
          '系統暫時無法處理您的請求，請稍後再試。',
          'error'
        )
        await replyFlex(ev.replyToken, '發生錯誤', errorFlex)
      }
    }
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true }))
}
