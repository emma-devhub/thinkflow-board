import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter: max 20 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You are a research assistant building a visual mindmap. ALWAYS structure your response like this:
1. A brief 2–3 sentence introduction (no header).
2. Then 3–5 major sections, each starting with "## Section Title" on its own line.
Each section: focused, 3–6 sentences, self-contained. Use **bold** for key terms.
Never skip the ## section headers — they are required for the mindmap layout.`

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 }
    )
  }

  const { message, context } = (await req.json()) as {
    message: string
    context: ConversationMessage[]
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // Build OpenAI-compatible messages: system + conversation history + new message
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...context.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  const groqRes = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    return NextResponse.json({ error: err }, { status: groqRes.status })
  }

  // Stream SSE from Groq → plain text stream to client
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const text = parsed?.choices?.[0]?.delta?.content
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
