import { NextRequest, NextResponse } from 'next/server'

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

interface ProjectInfo {
  id: string
  title: string
}

interface ColumnInfo {
  id: string
  label: string
}

function getMonday(today: string): string {
  const d = new Date(today)
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function buildSystemPrompt(
  projects: ProjectInfo[],
  columns: ColumnInfo[],
  today: string
): string {
  const projectList = projects.length > 0
    ? projects.map((p) => `- "${p.title}" (id: ${p.id})`).join('\n')
    : '(no projects yet)'

  const columnList = columns.length > 0
    ? columns.map((c) => `- "${c.label}" (id: ${c.id})`).join('\n')
    : '(no columns yet)'

  return `You are a helpful board assistant for ThinkFlow, a task and project management tool.
Today's date: ${today}

Available projects:
${projectList}

Available columns (focus areas):
${columnList}

## Your capabilities

**1. Creating tasks**
When the user says things like "添加todo", "add tasks", "create tasks", "帮我加", or pastes a list of items:
- Extract every non-empty line or item as a task title
- If a line is a day/date header (like "周一", "周二", "周三", "周四", "周五", "周六", "周日", "Monday", "Tuesday", etc.), do NOT make it a task — use it as the dueDate for all lines that follow it until the next date header. Calculate the actual YYYY-MM-DD date based on today (${today}).
- For each task, guess the most relevant projectId from the available projects. If unsure, use null.
- For each task, guess the most relevant columnId from the available columns. If unsure, use null.
- Output your suggestions in this EXACT format, embedded anywhere in your response:

<tasks>[{"title":"task title","projectId":"id or null","columnId":"id or null","dueDate":"YYYY-MM-DD or null"}]</tasks>

- You can add a brief friendly message before or after the <tasks> block.
- IMPORTANT: The JSON inside <tasks> must be valid, compact JSON on a single line.

**Recurring / count-based tasks**
When the user mentions a count target like "3次", "每周3次", "3x/week", or specifies planned days like "暂定135"(Mon/Wed/Fri), "246"(Tue/Thu/Sat), "每天" etc:
- Treat this as ONE recurring task with a weekly count goal
- Set "weeklyTarget" to the count (e.g. 3)
- Set "plannedDays" to an array of YYYY-MM-DD dates for this week matching the specified days. If no days specified, spread evenly across weekdays. Always output exactly weeklyTarget dates.
- Day mapping for current week (Mon=${getMonday(today)}): 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
- Leave "dueDate" as null for recurring tasks
- Example output for "去gym 3次 暂定135":
<tasks>[{"title":"去gym","projectId":null,"columnId":null,"dueDate":null,"weeklyTarget":3,"plannedDays":["YYYY-MM-DD(Mon)","YYYY-MM-DD(Wed)","YYYY-MM-DD(Fri)"]}]</tasks>

**2. Answering questions**
You can answer questions about tasks, projects, or productivity. Keep responses concise.

**3. General help**
Help the user think through their work or priorities.

Always respond in the same language the user writes in (中文 or English).`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  const { message, context, projects, columns, today } = (await req.json()) as {
    message: string
    context: ConversationMessage[]
    projects: ProjectInfo[]
    columns: ColumnInfo[]
    today: string
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

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
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
      },
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(projects, columns, today) }],
      },
    }),
  })

  if (!geminiRes.ok) {
    const err = await geminiRes.text()
    return NextResponse.json({ error: err }, { status: geminiRes.status })
  }

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
