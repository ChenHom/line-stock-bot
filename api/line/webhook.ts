// 最小可用：驗簽 + 回覆 + help
import type { IncomingMessage, ServerResponse } from 'http'
import crypto from 'node:crypto'

// 讀 raw body，供驗簽與 JSON 解析
function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// LINE 簽章驗證
function verifyLineSignature(raw: Buffer, signature: string | string[] | undefined, secret: string): boolean {
  if (!signature || Array.isArray(signature)) return false
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac))
  } catch {
    return false
  }
}

// 回覆訊息（最小版）
async function replyText(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('Missing LINE_CHANNEL_ACCESS_TOKEN')
    return
  }
  const resp = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    })
  })
  if (!resp.ok) {
    console.error('LINE reply error', resp.status, await resp.text())
  }
}

// 指令解析（最小骨架）
function parseCommand(text: string): { cmd: string; args: string } {
  const t = text.trim()
  const [head, ...rest] = t.split(/\s+/)
  return { cmd: head?.toLowerCase() || '', args: rest.join(' ') }
}

function helpText(): string {
  return [
    '可用指令：',
    '• help：顯示說明',
    '• 股價 <代號>：查單檔報價（MVP 待接）',
    '• 新聞 <產業|代號>：查產業新聞（MVP 待接）',
    '• +自選 <代號> / -自選 <代號>（MVP 待接）'
  ].join('\n')
}

async function handlePrice(replyToken: string, rawArgs: string) {
  const symbol = (rawArgs || '').trim()

  if (!symbol) {
    return replyText(replyToken, '請提供股票代號，例如：股價 2330')
  }

  const now = new Date().toLocaleString('zh-TW', { hour12: false })

  const mock = {
    symbol,
    name: '示範公司',
    price: 123.45,
    change: -1.23,
    percent: -0.99,
    prevClose: 124.68,
    open: 125.0
  }

  const msg =
    `${mock.name}（${mock.symbol}）\n` +
    `價格：${mock.price}（${mock.change}，${mock.percent}%）\n` +
    `今開：${mock.open}  昨收：${mock.prevClose}\n` +
    `時間：${now}\n` +
    `— 這是範例資料；稍後改為即時/延遲行情`
  return replyText(replyToken, msg)
}

async function handleNews(replyToken: string, rawArg: string) {
  const kw = (rawArg || '').trim()
  if (!kw) return replyText(replyToken, '用法：新聞 <產業|代號>，例如「新聞 半導體」或「新聞 2330」')
  // 假資料列表
  const items = [
    { t: `${kw} 市場動態：需求回溫`, s: 'FinDaily', ts: '2 小時前' },
    { t: `${kw} 供應鏈：庫存趨正常`, s: 'TechBiz', ts: '5 小時前' },
    { t: `${kw} 法說重點與展望`, s: 'MoneyNews', ts: '昨天' }
  ]
  const text = ['最新新聞（示範）：', ...items.map(i => `• ${i.t}（${i.s}｜${i.ts}）`), '— 之後改成真實來源與連結'].join('\n')
  return replyText(replyToken, text)
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  const raw = await readRawBody(req)

  // 驗簽：本地可用 DEBUG=True 跳過；雲端請拿掉
  const shouldSkip = process.env.DEBUG === 'True'

  if (shouldSkip) {
    const secret = process.env.LINE_CHANNEL_SECRET || ''
    const signature = req.headers['x-line-signature'] as string | undefined
    if (!secret || !verifyLineSignature(raw, signature, secret)) {
      res.statusCode = 401
      res.end('Invalid signature')
      return
    }
  }

  // 解析 JSON 與事件
  let payload: any
  try {
    payload = JSON.parse(raw.toString('utf8'))
  } catch {
    res.statusCode = 400
    res.end('Bad JSON')
    return
  }

  const events: any[] = Array.isArray(payload?.events) ? payload.events : []

  // 逐一處理事件（LINE 可能批次推多個）

  for (const ev of events) {
    if (ev.type === 'message' && ev.message?.type === 'text' && ev.replyToken) {
      const { cmd, args } = parseCommand(String(ev.message.text || ''))
      if (cmd === 'help' || cmd === '？' || cmd === '/help') {
        await replyText(ev.replyToken, helpText())
      }
      if (cmd === '股價' || cmd === 'price') {
        await handlePrice(ev.replyToken, args); continue
      }
      if (cmd === '新聞' || cmd === 'news') {
        await handleNews(ev.replyToken, args); continue
      }
      if (cmd === '+自選' || cmd === '-自選') {
        await replyText(ev.replyToken, '自選股維護將在下一步開放'); continue
      } else {
        // 先回教學文；下一步再接真正的指令路由
        await replyText(ev.replyToken, '輸入「help」查看指令。')
      }
    } else if (ev.type === 'follow' && ev.replyToken) {
      await replyText(ev.replyToken, '感謝加入。輸入「help」查看可用指令。')
    }
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true }))
}
