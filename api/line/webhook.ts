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
      const { cmd } = parseCommand(String(ev.message.text || ''))
      if (cmd === 'help' || cmd === '？' || cmd === '/help') {
        await replyText(ev.replyToken, helpText())
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
