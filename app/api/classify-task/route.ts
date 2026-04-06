import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export async function POST(req: NextRequest) {
  const { title, projects, dirs } = (await req.json()) as {
    title: string
    projects: { id: string; title: string }[]
    dirs: { id: string; label: string }[]
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ projectId: null, columnId: null })

  // Extract any @mentions from title as strong hints
  const mentionHints = (title.match(/@\S+/g) ?? []).map((m) => m.slice(1).toLowerCase())

  const prompt = `You are a task classifier. Given a task title, pick the best matching project and focus area from the provided lists.

Task: "${title}"

Projects:
${projects.map((p) => `- "${p.title}" (id: ${p.id})`).join('\n')}

Focus areas:
${dirs.map((d) => `- "${d.label}" (id: ${d.id})`).join('\n')}

${mentionHints.length > 0 ? `IMPORTANT: The task contains @mention hints: ${mentionHints.join(', ')}. Try to match these hints against the project/focus lists first (case-insensitive). Only fall back to semantic matching if no hint matches.\n` : ''}Respond with ONLY a JSON object, no explanation:
{"projectId": "<id or null>", "columnId": "<id or null>"}

Rules:
- Use null if no good match exists
- projectId and columnId are independent — either or both can be null`

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })

    if (!res.ok) return NextResponse.json({ projectId: null, columnId: null })

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ projectId: null, columnId: null })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      projectId: parsed.projectId ?? null,
      columnId: parsed.columnId ?? null,
    })
  } catch {
    return NextResponse.json({ projectId: null, columnId: null })
  }
}
