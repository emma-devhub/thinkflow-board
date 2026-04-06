import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export async function POST(req: NextRequest) {
  const { messages, currentMemory } = (await req.json()) as {
    messages: { role: string; content: string }[]
    currentMemory: string
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ memory: currentMemory })

  const recentConvo = messages
    .slice(-20) // last 20 messages for distillation context
    .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
    .join('\n')

  const prompt = `You are updating a persistent memory file for a personal task/project assistant called ThinkFlow Board Assistant.

Current memory:
${currentMemory || '(empty)'}

Recent conversation:
${recentConvo}

Update the memory to include any new, durable facts worth remembering about this user. Focus on:
- Work context and projects (what projects they have, what they're working on)
- Personal preferences (language, task naming style, scheduling habits)
- Recurring patterns or goals they've mentioned
- Anything that would help personalize future conversations

Rules:
- Write in concise bullet points
- Keep it under 400 words total
- Merge/update existing points rather than duplicating
- Remove outdated information
- Do NOT include ephemeral task details (specific task titles, one-off dates)
- Respond with ONLY the updated memory content, no explanation`

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })

    if (!res.ok) return NextResponse.json({ memory: currentMemory })

    const data = await res.json()
    const memory: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? currentMemory
    return NextResponse.json({ memory: memory.trim() })
  } catch {
    return NextResponse.json({ memory: currentMemory })
  }
}
