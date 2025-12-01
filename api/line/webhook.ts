// api/line/webhook.ts
import { getQuoteWithFallback, getIndustryNews } from '../../lib/providers'
import {
  createStockQuoteMessage,
  createNewsListMessage,
  buildStatusFlex,
  createHelpMessage,
  buildHelpQuickReplies
} from '../../lib/flex'
import { logger } from '../../lib/logger'
import { fuzzyMatchSymbol } from '../../lib/symbol'

import type { IncomingMessage, ServerResponse } from 'http'
import type { LineQuickReplyItem } from '../../lib/flex'
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

interface ReplyFlexOptions {
  quickReplyItems?: LineQuickReplyItem[]
}

async function replyFlex(replyToken: string, altText: string, flex: any, options?: ReplyFlexOptions) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!replyToken || !token) return

  // 防呆：altText 不能空、contents 必須是 bubble 或 carousel
  if (!altText || typeof altText !== 'string') altText = '通知'
  if (!flex || typeof flex !== 'object') return replyText(replyToken, altText)
  const t = flex?.type
  if (t !== 'bubble' && t !== 'carousel') return replyText(replyToken, altText)

  const message: any = { type: 'flex', altText, contents: flex }
  if (options?.quickReplyItems && options.quickReplyItems.length > 0) {
    message.quickReply = { items: options.quickReplyItems }
  }

  const payload = { replyToken, messages: [message] }

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

/* ---------- main handler ---------- */
const STOCK_CODE_REGEX = /^\d{4}$/
const HELP_ALIASES = new Set(['help', '/help', '幫助', '？'])
const BROAD_NEWS_KEYWORDS = new Set([
  'news',
  '新聞',
  '股票',
  '股價',
  '股市',
  '市場',
  'finance',
  'financial',
  'investment',
  'invest',
  'business',
  'economy',
  '產業',
  '行業',
  'industry'
])

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
      const rawText = typeof ev.message.text === 'string' ? ev.message.text : ''
      const trimmedText = rawText.trim()
      const { cmd, args } = parseCommand(trimmedText)
      logger.info('webhook_command', { cmd, args })

      try {
        if (HELP_ALIASES.has(cmd)) {
          await handleHelpCommand(ev.replyToken)
        } else if (cmd === '股價' || cmd === 'price') {
          await handleStockQuoteCommand(ev.replyToken, args)
        } else if (cmd === '新聞' || cmd === 'news') {
          await handleNewsCommand(ev.replyToken, args)
        } else {
          await handleUnknownCommand(ev.replyToken, trimmedText)
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

async function handleStockQuoteCommand(replyToken: string, rawArgs: string) {
  const query = (rawArgs || '').trim()

  if (!query) {
    await replyFlex(replyToken, '缺少股票代號', buildStatusFlex('請輸入股票代號', '請輸入「股價 <代號或名稱>」再試一次。', 'info'))
    return
  }

  if (/^\d+$/.test(query) && !STOCK_CODE_REGEX.test(query)) {
    await replyFlex(replyToken, '無效股票代號', buildStatusFlex('查無此股票代號', '請輸入 4 位數股票代號，例如「股價 2330」。', 'warning'))
    return
  }

  let resolvedSymbol = query
  let matchedName: string | undefined

  if (!STOCK_CODE_REGEX.test(query)) {
    const match = fuzzyMatchSymbol(query)
    if (!match) {
      await replyFlex(replyToken, '無法識別股票', buildStatusFlex('找不到明確的股票', '找到多筆相似結果，請使用更精確的名稱或股票代號。', 'warning'))
      return
    }
    resolvedSymbol = match.symbol
    matchedName = match.name
  }

  try {
    const quote = await getQuoteWithFallback(resolvedSymbol)
    if (matchedName && !quote.name) {
      quote.name = matchedName
    }
    const flex = createStockQuoteMessage(quote, { isStale: Boolean((quote as any).isStale) })
    await replyFlex(replyToken, `股價 ${quote.symbol}`, flex)
  } catch (error) {
    if (isNotFoundError(error)) {
      await replyFlex(replyToken, '查無此股票', buildStatusFlex('查無此股票代號', '請確認後再試。', 'warning'))
      return
    }
    throw error
  }
}

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /(empty|not\s*found|unknown\s*symbol|invalid\s*symbol)/i.test(message)
}

async function handleNewsCommand(replyToken: string, rawArgs: string) {
  const keyword = normalizeNewsKeyword(rawArgs)

  if (!keyword) {
    await replyFlex(
      replyToken,
      '缺少新聞關鍵字',
      buildStatusFlex('請輸入新聞關鍵字', '請輸入「新聞 <公司或產業>」再試一次。', 'info')
    )
    return
  }

  if (isBroadNewsKeyword(keyword)) {
    await replyFlex(
      replyToken,
      '請輸入更具體的關鍵字',
      buildStatusFlex('關鍵字太廣泛', '請輸入更具體的公司名稱或產業，例如「新聞 台積電」。', 'info')
    )
    return
  }

  try {
    const newsItems = await getIndustryNews(keyword, 5)
    if (!newsItems.length) {
      await replyFlex(
        replyToken,
        `新聞 ${keyword}`,
        buildStatusFlex('找不到相關新聞', '請換個關鍵字或稍後再試。', 'info')
      )
      return
    }

    const flex = createNewsListMessage(keyword, newsItems, {
      isStale: Boolean((newsItems as any).isStale)
    })
    await replyFlex(replyToken, `新聞 ${keyword}`, flex)
  } catch (error) {
    logger.warn('news_command_failed', { keyword }, error instanceof Error ? error : String(error))
    const flex = buildStatusFlex('目前無法取得新聞', '新聞來源暫時不可用，請稍後再試。', 'warning')
    await replyFlex(replyToken, '新聞服務暫時不可用', flex)
  }
}

function normalizeNewsKeyword(input: string): string {
  return (input || '').replace(/\s+/g, ' ').trim()
}

function isBroadNewsKeyword(keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase()
  if (!normalized || normalized.length < 2) {
    return true
  }
  return BROAD_NEWS_KEYWORDS.has(normalized)
}

async function handleHelpCommand(replyToken: string) {
  await replyFlex(replyToken, '可用指令', createHelpMessage(), {
    quickReplyItems: buildHelpQuickReplies()
  })
}

async function handleUnknownCommand(replyToken: string, textInput: string) {
  const helpFlex = createHelpMessage({
    title: '無法識別的指令',
    contextNote: textInput
      ? '可直接點擊下方快速按鈕重新查詢。'
      : '請輸入「help」或直接點選下方範例重新查詢。',
    quickReplyInput: textInput
  })

  const quickReplyItems = buildHelpQuickReplies({ lastInput: textInput })

  if (textInput) {
    logger.info('webhook_unknown_retry_buttons', { sourceInput: textInput })
  }

  await replyFlex(replyToken, '無法識別的指令', helpFlex, { quickReplyItems })
}
