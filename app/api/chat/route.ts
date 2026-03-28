import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent'

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

interface GeminiContent {
  role: string
  parts: { text: string }[]
}

export async function POST(req: NextRequest) {
  const { message, context } = (await req.json()) as {
    message: string
    context: ConversationMessage[]
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // Build Gemini contents from context + new message
  const contents: GeminiContent[] = [
    ...context.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
      systemInstruction: {
        parts: [
          {
            text: `You are a research assistant building a visual mindmap. ALWAYS structure your response like this:
1. A brief 2–3 sentence introduction (no header).
2. Then 3–5 major sections, each starting with "## Section Title" on its own line.
Each section: focused, 3–6 sentences, self-contained. Use **bold** for key terms.
Never skip the ## section headers — they are required for the mindmap layout.`,
          },
        ],
      },
    }),
  })

  if (!geminiRes.ok) {
    const err = await geminiRes.text()
    return NextResponse.json({ error: err }, { status: geminiRes.status })
  }

  // Stream SSE from Gemini → plain text stream to client
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader()
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
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
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
