'use client'

import { useRef, useState, useEffect } from 'react'
import type { Project, ParsedTask } from '@/types'

interface Direction {
  id: string
  label: string
  color: string
}

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  text: string
  tasks?: ParsedTask[]
  tasksAdded?: boolean
}

interface Props {
  projects: Project[]
  dirs: Direction[]
  onCreateTasks: (tasks: ParsedTask[]) => void
  onClose: () => void
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDueDate(dateStr: string): string {
  const today = localDateStr(new Date())
  const tomorrow = localDateStr(new Date(Date.now() + 86400000))
  if (dateStr === today) return '今天'
  if (dateStr === tomorrow) return '明天'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// Parse <tasks>[...]</tasks> out of accumulated text.
// Returns { displayText, tasks } where displayText has the block removed.
function parseTasksBlock(raw: string): { displayText: string; tasks: ParsedTask[] | null } {
  const match = raw.match(/<tasks>([\s\S]*?)<\/tasks>/)
  if (!match) return { displayText: raw, tasks: null }
  try {
    const tasks = JSON.parse(match[1]) as ParsedTask[]
    const displayText = raw.replace(/<tasks>[\s\S]*?<\/tasks>/, '').trim()
    return { displayText, tasks }
  } catch {
    // Malformed JSON — just strip the block
    const displayText = raw.replace(/<tasks>[\s\S]*?<\/tasks>/, '').trim()
    return { displayText, tasks: null }
  }
}

// While streaming, hide everything from <tasks> onward so raw JSON never shows
function streamingDisplayText(raw: string): string {
  const idx = raw.indexOf('<tasks>')
  return idx === -1 ? raw : raw.slice(0, idx).trimEnd()
}

export default function BoardChatPanel({ projects, dirs, onCreateTasks, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '你好！你可以：\n• 粘贴一段 todo 列表，让我帮你生成 card\n• 问我关于任务或项目的问题',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: ChatMsg = { id: assistantId, role: 'assistant', text: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    // Build context from conversation history (exclude welcome msg)
    const context = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        content: m.text + (m.tasks ? `\n<tasks>${JSON.stringify(m.tasks)}</tasks>` : ''),
      }))

    try {
      const res = await fetch('/api/board-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          projects: projects.map((p) => ({ id: p.id, title: p.title })),
          columns: dirs.map((d) => ({ id: d.id, label: d.label })),
          today: localDateStr(new Date()),
        }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: `Error: ${errText}` } : m
          )
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snap = accumulated
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: streamingDisplayText(snap) }
              : m
          )
        )
      }

      // Stream finished — parse for tasks
      const { displayText, tasks } = parseTasksBlock(accumulated)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: displayText, tasks: tasks ?? undefined }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleAddTasks = (msgId: string, tasks: ParsedTask[]) => {
    onCreateTasks(tasks)
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, tasksAdded: true } : m)
    )
  }

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))
  const dirMap = Object.fromEntries(dirs.map((d) => [d.id, d]))

  return (
    <div style={{
      width: 320,
      flex: 1,
      borderLeft: '1px solid #e0ddd9',
      background: '#faf9f7',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideInRight 180ms ease',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: '1px solid #e0ddd9',
        background: '#f0efed',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>Board Assistant</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>AI 对话助手</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#bbb',
            fontSize: 14, cursor: 'pointer', padding: '2px 4px', borderRadius: 4,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#666' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#bbb' }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '80%', background: '#1a1a1a', color: 'white',
                  borderRadius: '12px 12px 2px 12px',
                  padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Assistant text */}
                {msg.text && (
                  <div style={{
                    maxWidth: '92%', background: 'white',
                    border: '1px solid #e8e5e0',
                    borderRadius: '12px 12px 12px 2px',
                    padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
                    color: '#1a1a1a', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    {msg.text}
                    {isLoading && msg.id === messages[messages.length - 1]?.id && !msg.tasks && (
                      <span style={{ color: '#bbb', marginLeft: 2, animation: 'pulse 1s infinite' }}>▋</span>
                    )}
                  </div>
                )}

                {/* Task suggestion cards */}
                {msg.tasks && msg.tasks.length > 0 && (
                  <div style={{
                    background: 'white', border: '1px solid #e8e5e0',
                    borderRadius: 10, overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    maxWidth: '92%',
                  }}>
                    <div style={{
                      padding: '8px 12px 6px',
                      fontSize: 11, fontWeight: 600, color: '#999',
                      textTransform: 'uppercase', letterSpacing: '.05em',
                      borderBottom: '1px solid #f0ede9',
                    }}>
                      {msg.tasksAdded ? `✓ ${msg.tasks.length} tasks added` : `${msg.tasks.length} tasks`}
                    </div>

                    {!msg.tasksAdded && (
                      <>
                        <div style={{ padding: '6px 0' }}>
                          {msg.tasks.map((task, i) => {
                            const proj = task.projectId ? projectMap[task.projectId] : null
                            const col = task.columnId ? dirMap[task.columnId] : null
                            const isRecurring = !!task.weeklyTarget
                            return (
                              <div
                                key={i}
                                style={{
                                  padding: '5px 12px',
                                  display: 'flex', alignItems: 'flex-start', gap: 7,
                                  borderLeft: `3px solid ${isRecurring ? '#e8a838' : (proj?.color ?? '#e0ddd9')}`,
                                  marginLeft: 8, marginBottom: 2,
                                }}
                              >
                                <div style={{
                                  width: 12, height: 12, borderRadius: 3, marginTop: 2, flexShrink: 0,
                                  border: '1.5px solid #ccc', background: 'transparent',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, color: '#1a1a1a', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                    {task.title}
                                    {isRecurring && (
                                      <span style={{ marginLeft: 5, fontSize: 10, color: '#e8a838', fontWeight: 600 }}>
                                        ×{task.weeklyTarget}次/周
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                                    {proj && (
                                      <span style={{
                                        fontSize: 10, color: proj.color, fontWeight: 600,
                                        background: `${proj.color}18`, padding: '1px 5px', borderRadius: 4,
                                      }}>
                                        {proj.title}
                                      </span>
                                    )}
                                    {col && (
                                      <span style={{
                                        fontSize: 10, color: '#888',
                                        background: '#f0ede9', padding: '1px 5px', borderRadius: 4,
                                      }}>
                                        {col.label}
                                      </span>
                                    )}
                                    {task.dueDate && (
                                      <span style={{
                                        fontSize: 10, color: '#888',
                                        background: '#f0ede9', padding: '1px 5px', borderRadius: 4,
                                      }}>
                                        {formatDueDate(task.dueDate)}
                                      </span>
                                    )}
                                    {isRecurring && task.plannedDays && task.plannedDays.map((d) => (
                                      <span key={d} style={{
                                        fontSize: 10, color: '#e8a838',
                                        background: '#fdf3e3', padding: '1px 5px', borderRadius: 4,
                                      }}>
                                        {formatDueDate(d)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ padding: '8px 12px 10px' }}>
                          <button
                            onClick={() => handleAddTasks(msg.id, msg.tasks!)}
                            style={{
                              width: '100%', padding: '7px 0',
                              background: '#1a1a1a', color: 'white',
                              border: 'none', borderRadius: 7,
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              transition: 'opacity 120ms',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                          >
                            {(() => {
                              const total = msg.tasks!.reduce((sum, t) => sum + (t.weeklyTarget ?? 1), 0)
                              return `Add ${total} card${total !== 1 ? 's' : ''}`
                            })()}
                          </button>
                        </div>
                      </>
                    )}

                    {msg.tasksAdded && (
                      <div style={{ padding: '8px 12px 10px', fontSize: 12, color: '#4caf86' }}>
                        Added to your board ✓
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px 16px',
        borderTop: '1px solid #e8e5e0',
        flexShrink: 0,
        background: '#faf9f7',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: 'white', border: '1px solid #e0ddd9',
          borderRadius: 10, padding: '8px 10px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <textarea
            ref={textareaRef}
            rows={3}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="添加 todo，或问我任何问题…"
            disabled={isLoading}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              fontSize: 13, lineHeight: 1.5, background: 'transparent',
              color: '#1a1a1a', maxHeight: 160, overflow: 'auto',
              minHeight: 60,
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: input.trim() && !isLoading ? '#1a1a1a' : '#e0ddd9',
              color: 'white', border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, flexShrink: 0,
              transition: 'background 120ms',
            }}
          >
            {isLoading ? '…' : '↑'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center', marginTop: 6 }}>
          Enter 发送，Shift+Enter 换行
        </div>
      </div>
    </div>
  )
}
