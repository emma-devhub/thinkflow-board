'use client'

import { useState, useRef, useEffect } from 'react'
import type { SessionMeta, Project, ParsedTask } from '@/types'
import BoardChatPanel from './BoardChatPanel'
import { useIsMobile } from '@/lib/useIsMobile'

interface Props {
  sessions: SessionMeta[]
  projects: Project[]
  selectedProjectId: string | null
  onSchedule: (id: string, dueDate: string | undefined, estimatedMins: number | undefined) => void
  onReorderWeek: (updates: { id: string; weekOrder: number }[]) => void
  onCreateSession: (title: string, projectId?: string, dueDate?: string) => void
  onDelete: (id: string) => void
  onToggleChecked: (id: string, checked: boolean) => void
  onRename: (id: string, title: string) => void
  onOpenCanvas: (id: string) => void
  onCreateTasks: (tasks: ParsedTask[]) => void
  boardView: 'domain' | 'week'
  onBoardViewChange: (v: 'domain' | 'week') => void
}

// ── Week helpers ──────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekDays(): { label: string; date: string; isToday: boolean }[] {
  const today = new Date()
  const todayStr = localDateStr(today)
  const mon = new Date(today)
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const date = localDateStr(d)
    return { label: labels[i], date, isToday: date === todayStr }
  })
}

function formatDayHeader(date: string): string {
  const [, m, d] = date.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// ── Recurring progress helper ─────────────────────────────────────────────────
function getRecurringProgress(
  session: SessionMeta,
  allSessions: SessionMeta[]
): { done: number; total: number } | null {
  if (!session.recurringGroupId || !session.weeklyTarget) return null
  const group = allSessions.filter((s) => s.recurringGroupId === session.recurringGroupId)
  const done = group.filter((s) => s.checked).length
  return { done, total: session.weeklyTarget }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WeekBoard({
  sessions, projects, selectedProjectId,
  onSchedule, onReorderWeek, onCreateSession, onDelete, onToggleChecked, onRename, onOpenCanvas,
  onCreateTasks, boardView, onBoardViewChange,
}: Props) {
  const isMobile = useIsMobile()
  const weekDays = getWeekDays()
  const today = localDateStr(new Date())
  const [isChatOpen, setIsChatOpen] = useState(false)
  const dragId = useRef<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const todayColRef = useRef<HTMLDivElement>(null)

  // Scroll to today — horizontal on desktop, vertical on mobile
  useEffect(() => {
    if (isMobile) {
      setTimeout(() => todayColRef.current?.scrollIntoView({ block: 'start' }), 80)
    } else {
      const container = scrollContainerRef.current
      const todayEl = todayColRef.current
      if (!container || !todayEl) return
      const containerRect = container.getBoundingClientRect()
      const todayRect = todayEl.getBoundingClientRect()
      container.scrollLeft += todayRect.left - containerRect.left - 24
    }
  }, [isMobile])
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null)
  const [dragOverCardPos, setDragOverCardPos] = useState<'above' | 'below'>('below')
  const [addingColKey, setAddingColKey] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState('')

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))

  const visibleSessions = selectedProjectId === null
    ? sessions
    : sessions.filter((s) => s.projectId === selectedProjectId)

  const boardTitle = selectedProjectId ? (projectMap[selectedProjectId]?.title ?? 'Project') : 'All Projects'
  const boardSub = selectedProjectId === null
    ? `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}`
    : `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''}`

  const weekDateSet = new Set(weekDays.map((d) => d.date))

  const getColKey = (s: SessionMeta): string =>
    s.dueDate && weekDateSet.has(s.dueDate) ? s.dueDate : 'unscheduled'

  const getOrder = (s: SessionMeta) => s.weekOrder ?? s.createdAt

  const clearDragState = () => {
    setDragOverCol(null)
    setDragOverCardId(null)
  }

  const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>, cardId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverCardId(cardId)
    setDragOverCardPos(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below')
  }

  const handleDrop = (colKey: string) => {
    if (!dragId.current) return
    const dragged = sessions.find((s) => s.id === dragId.current)
    if (!dragged) return

    const isSameCol = getColKey(dragged) === colKey

    if (isSameCol && dragOverCardId && dragOverCardId !== dragId.current) {
      // ── Same-column reorder ──
      const colSorted = visibleSessions
        .filter((s) => getColKey(s) === colKey)
        .sort((a, b) => getOrder(a) - getOrder(b))

      const fromIdx = colSorted.findIndex((s) => s.id === dragId.current)
      const newArr = [...colSorted]
      const [moved] = newArr.splice(fromIdx, 1)
      // Find target after removal so index is correct
      const toIdx = newArr.findIndex((s) => s.id === dragOverCardId)
      const insertAt = dragOverCardPos === 'above' ? toIdx : toIdx + 1
      newArr.splice(insertAt, 0, moved)
      onReorderWeek(newArr.map((s, i) => ({ id: s.id, weekOrder: (i + 1) * 1000 })))
    } else if (!isSameCol) {
      // ── Cross-column move ──
      const newDue = colKey === 'unscheduled' ? undefined : colKey
      onSchedule(dragged.id, newDue, dragged.estimatedMins)
    }

    dragId.current = null
    clearDragState()
  }

  const handleAddCommit = (colKey: string) => {
    const t = addTitle.trim()
    if (t) {
      const dueDate = colKey === 'unscheduled' ? undefined : colKey
      onCreateSession(t, selectedProjectId ?? undefined, dueDate)
    }
    setAddTitle('')
    setAddingColKey(null)
  }

  const columns: { key: string; label: string; sub?: string; isToday?: boolean }[] = [
    { key: 'unscheduled', label: '未安排' },
    ...weekDays.map((d) => ({ key: d.date, label: d.label, sub: formatDayHeader(d.date), isToday: d.isToday })),
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0efed' }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid #e0ddd9', background: '#f0efed', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{boardTitle}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{boardSub}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['domain', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onBoardViewChange(v)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: '1px solid',
                borderColor: boardView === v ? '#1a1a1a' : '#ddd',
                background: boardView === v ? '#1a1a1a' : 'white',
                color: boardView === v ? 'white' : '#444',
                transition: 'all 120ms',
              }}
              onMouseEnter={(e) => { if (boardView !== v) (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
              onMouseLeave={(e) => { if (boardView !== v) (e.currentTarget as HTMLElement).style.background = 'white' }}
            >
              {v === 'domain' ? 'By Focus' : 'By Time'}
            </button>
          ))}
          <button
            onClick={() => setIsChatOpen((v) => !v)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: '1px solid',
              borderColor: isChatOpen ? '#1a1a1a' : '#ddd',
              background: isChatOpen ? '#1a1a1a' : 'white',
              color: isChatOpen ? 'white' : '#444',
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => { if (!isChatOpen) (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
            onMouseLeave={(e) => { if (!isChatOpen) (e.currentTarget as HTMLElement).style.background = 'white' }}
          >
            ✦ AI
          </button>
        </div>
      </div>

      {/* Body: columns + AI chat panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Columns — desktop: horizontal row, mobile: vertical stack */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'auto' : 'hidden' }}>

      {/* Unscheduled — desktop: fixed left; mobile: first in vertical stack */}
      <div style={isMobile ? { padding: '16px 16px 0' } : { padding: '20px 0 20px 24px', flexShrink: 0, display: 'flex' }}>
        {columns.filter((col) => col.key === 'unscheduled').map((col) => {
          const colSessions = visibleSessions
            .filter((s) => getColKey(s) === col.key)
            .sort((a, b) => getOrder(a) - getOrder(b))
          const isDragOver = dragOverCol === col.key
          const isUnscheduled = true
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) clearDragState()
              }}
              onDrop={() => handleDrop(col.key)}
              style={{
                width: isMobile ? '100%' : 220,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: isDragOver && !dragOverCardId ? 'rgba(0,0,0,0.04)' : 'transparent',
                borderRadius: 10,
                transition: 'background 100ms',
              }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                padding: '0 2px 8px',
                borderBottom: col.isToday ? '2px solid #5578cc' : '1px solid #e0ddd9',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                  color: col.isToday ? '#5578cc' : isUnscheduled ? '#aaa' : '#666',
                }}>
                  {col.label}
                </span>
                {col.sub && (
                  <span style={{ fontSize: 11, color: col.isToday ? '#5578cc' : '#bbb' }}>
                    {col.sub}
                  </span>
                )}
                <span style={{
                  marginLeft: 'auto', fontSize: 10, background: '#e5e3df',
                  color: '#999', padding: '1px 5px', borderRadius: 6,
                }}>
                  {colSessions.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? 'visible' : 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colSessions.map((s) => {
                  const proj = s.projectId ? projectMap[s.projectId] : null
                  const isTarget = dragOverCardId === s.id
                  return (
                    <div key={s.id}>
                      {/* Drop indicator — above */}
                      {isTarget && dragOverCardPos === 'above' && (
                        <div style={{ height: 2, background: '#5578cc', borderRadius: 1, marginBottom: 4 }} />
                      )}
                      <WeekCard
                        session={s}
                        project={proj}
                        recurringProgress={getRecurringProgress(s, sessions)}
                        isOverdue={!s.checked && !!s.recurringGroupId && !!s.dueDate && s.dueDate < today}
                        onOpenCanvas={() => onOpenCanvas(s.id)}
                        onDelete={() => onDelete(s.id)}
                        onToggleChecked={(v) => onToggleChecked(s.id, v)}
                        onRename={(title) => onRename(s.id, title)}
                        onUpdateTime={(mins) => onSchedule(s.id, s.dueDate, mins)}
                        onDragStart={() => { dragId.current = s.id }}
                        onDragOver={(e) => handleCardDragOver(e, s.id)}
                      />
                      {/* Drop indicator — below */}
                      {isTarget && dragOverCardPos === 'below' && (
                        <div style={{ height: 2, background: '#5578cc', borderRadius: 1, marginTop: 4 }} />
                      )}
                    </div>
                  )
                })}

                {/* Drop hint when dragging into an empty column */}
                {isDragOver && colSessions.length === 0 && addingColKey !== col.key && (
                  <div style={{
                    border: '1.5px dashed #ccc', borderRadius: 8, height: 60,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ccc', fontSize: 12,
                  }}>
                    放在这里
                  </div>
                )}

                {/* Inline add input */}
                {addingColKey === col.key && (
                  <div style={{
                    background: 'white', borderRadius: 8, padding: '8px 10px',
                    border: '1px solid #e8e5e0', borderLeft: `3px solid ${col.isToday ? '#5578cc' : '#ddd'}`,
                  }}>
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCommit(col.key)
                        if (e.key === 'Escape') { setAddingColKey(null); setAddTitle('') }
                      }}
                      onBlur={() => handleAddCommit(col.key)}
                      placeholder="Subtask title…"
                      style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#1a1a1a', background: 'transparent' }}
                    />
                  </div>
                )}

                {/* + Add subtask */}
                <button
                  onClick={() => { setAddingColKey(col.key); setAddTitle('') }}
                  style={{
                    border: '1.5px dashed #ddd', borderRadius: 8, padding: '8px 12px',
                    color: '#bbb', fontSize: 12, cursor: 'pointer',
                    display: addingColKey === col.key ? 'none' : 'flex',
                    alignItems: 'center', gap: 6, background: 'transparent', width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#bbb'; (e.currentTarget as HTMLElement).style.color = '#999'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ddd'; (e.currentTarget as HTMLElement).style.color = '#bbb'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  + Add subtask
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Day columns — desktop: horizontal scroll; mobile: vertical stack */}
      <div
        ref={isMobile ? undefined : scrollContainerRef}
        style={isMobile
          ? { display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px 24px' }
          : { flex: 1, display: 'flex', gap: 12, padding: '20px 24px 20px 12px', overflowX: 'auto', overflowY: 'hidden' }
        }
      >
        {columns.filter((col) => col.key !== 'unscheduled').map((col) => {
          const colSessions = visibleSessions
            .filter((s) => getColKey(s) === col.key)
            .sort((a, b) => getOrder(a) - getOrder(b))
          const isDragOver = dragOverCol === col.key
          const isUnscheduled = false
          return (
            <div
              key={col.key}
              ref={col.isToday ? todayColRef : undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) clearDragState()
              }}
              onDrop={() => handleDrop(col.key)}
              style={{
                width: isMobile ? '100%' : 200,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: isDragOver && !dragOverCardId ? 'rgba(0,0,0,0.04)' : 'transparent',
                borderRadius: 10,
                transition: 'background 100ms',
              }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                padding: '0 2px 8px',
                borderBottom: col.isToday ? '2px solid #5578cc' : '1px solid #e0ddd9',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                  color: col.isToday ? '#5578cc' : '#666',
                }}>
                  {col.label}
                </span>
                {col.sub && (
                  <span style={{ fontSize: 11, color: col.isToday ? '#5578cc' : '#bbb' }}>
                    {col.sub}
                  </span>
                )}
                <span style={{
                  marginLeft: 'auto', fontSize: 10, background: '#e5e3df',
                  color: '#999', padding: '1px 5px', borderRadius: 6,
                }}>
                  {colSessions.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ flex: isMobile ? undefined : 1, overflowY: isMobile ? 'visible' : 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colSessions.map((s) => {
                  const proj = s.projectId ? projectMap[s.projectId] : null
                  const isTarget = dragOverCardId === s.id
                  return (
                    <div key={s.id}>
                      {isTarget && dragOverCardPos === 'above' && (
                        <div style={{ height: 2, background: '#5578cc', borderRadius: 1, marginBottom: 4 }} />
                      )}
                      <WeekCard
                        session={s}
                        project={proj}
                        recurringProgress={getRecurringProgress(s, sessions)}
                        isOverdue={!s.checked && !!s.recurringGroupId && !!s.dueDate && s.dueDate < today}
                        onOpenCanvas={() => onOpenCanvas(s.id)}
                        onDelete={() => onDelete(s.id)}
                        onToggleChecked={(v) => onToggleChecked(s.id, v)}
                        onRename={(title) => onRename(s.id, title)}
                        onUpdateTime={(mins) => onSchedule(s.id, s.dueDate, mins)}
                        onDragStart={() => { dragId.current = s.id }}
                        onDragOver={(e) => handleCardDragOver(e, s.id)}
                      />
                      {isTarget && dragOverCardPos === 'below' && (
                        <div style={{ height: 2, background: '#5578cc', borderRadius: 1, marginTop: 4 }} />
                      )}
                    </div>
                  )
                })}

                {isDragOver && colSessions.length === 0 && addingColKey !== col.key && (
                  <div style={{
                    border: '1.5px dashed #ccc', borderRadius: 8, height: 60,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ccc', fontSize: 12,
                  }}>
                    放在这里
                  </div>
                )}

                {addingColKey === col.key && (
                  <div style={{
                    background: 'white', borderRadius: 8, padding: '8px 10px',
                    border: '1px solid #e8e5e0', borderLeft: `3px solid ${col.isToday ? '#5578cc' : '#ddd'}`,
                  }}>
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCommit(col.key)
                        if (e.key === 'Escape') { setAddingColKey(null); setAddTitle('') }
                      }}
                      onBlur={() => handleAddCommit(col.key)}
                      placeholder="Subtask title…"
                      style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#1a1a1a', background: 'transparent' }}
                    />
                  </div>
                )}

                <button
                  onClick={() => { setAddingColKey(col.key); setAddTitle('') }}
                  style={{
                    border: '1.5px dashed #ddd', borderRadius: 8, padding: '8px 12px',
                    color: '#bbb', fontSize: 12, cursor: 'pointer',
                    display: addingColKey === col.key ? 'none' : 'flex',
                    alignItems: 'center', gap: 6, background: 'transparent', width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#bbb'; (e.currentTarget as HTMLElement).style.color = '#999'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ddd'; (e.currentTarget as HTMLElement).style.color = '#bbb'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  + Add subtask
                </button>
              </div>
            </div>
          )
        })}
      </div>

      </div>{/* end columns */}

      {/* AI Chat Panel */}
      <div style={{
        width: isChatOpen ? 320 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 200ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <BoardChatPanel
          projects={projects}
          dirs={[]}
          onCreateTasks={onCreateTasks}
          onClose={() => setIsChatOpen(false)}
        />
      </div>

      </div>{/* end body */}
    </div>
  )
}

// ── WeekCard ──────────────────────────────────────────────────────────────────
function WeekCard({ session, project, recurringProgress, isOverdue, onOpenCanvas, onDelete, onToggleChecked, onRename, onUpdateTime, onDragStart, onDragOver }: {
  session: SessionMeta
  project: Project | null | undefined
  recurringProgress: { done: number; total: number } | null
  isOverdue: boolean
  onOpenCanvas: () => void
  onDelete: () => void
  onToggleChecked: (v: boolean) => void
  onRename: (title: string) => void
  onUpdateTime: (mins: number | undefined) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  // const [editingTime, setEditingTime] = useState(false)
  // const [timeDraft, setTimeDraft] = useState(String(session.estimatedMins ?? ''))

  const accentColor = isOverdue ? '#e8a838' : (project?.color ?? '#ddd')
  const checked = !!session.checked

  const commitTitle = () => {
    const t = draft.trim()
    if (t && t !== session.title) onRename(t)
    else setDraft(session.title)
    setEditing(false)
  }

  // const commitTime = () => {
  //   const n = parseInt(timeDraft)
  //   onUpdateTime(isNaN(n) || n <= 0 ? undefined : n)
  //   setEditingTime(false)
  // }

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white', borderRadius: 8,
        border: '1px solid #e8e5e0',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.09)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: editing ? 'default' : 'grab',
        transform: hovered && !editing ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 120ms, transform 120ms',
        opacity: checked ? 0.65 : 1,
        padding: '8px 10px',
      }}
    >
      {/* Checkbox + title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div
          onClick={(e) => { e.stopPropagation(); onToggleChecked(!checked) }}
          style={{
            width: 15, height: 15, borderRadius: 3, flexShrink: 0, marginTop: 2,
            border: checked ? 'none' : '1.5px solid #ccc',
            background: checked ? (accentColor !== '#ddd' ? accentColor : '#4caf86') : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 120ms',
          }}
        >
          {checked && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
              if (e.key === 'Escape') { setDraft(session.title); setEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, fontSize: 13, lineHeight: 1.4, border: 'none', outline: 'none',
              borderBottom: `1px solid ${accentColor}`, background: 'transparent',
              color: '#1a1a1a', padding: '0 0 1px', width: '100%',
            }}
          />
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              onClick={(e) => { e.stopPropagation(); setDraft(session.title); setEditing(true) }}
              style={{
                fontSize: 13, lineHeight: 1.4,
                textDecoration: checked ? 'line-through' : 'none',
                color: checked ? '#aaa' : '#1a1a1a',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'text',
              } as React.CSSProperties}
            >
              {session.title}
            </span>
            {recurringProgress && (
              <div style={{ marginTop: 3, fontSize: 10, color: recurringProgress.done >= recurringProgress.total ? '#4caf86' : (isOverdue ? '#e8a838' : '#aaa'), fontWeight: 600 }}>
                {recurringProgress.done}/{recurringProgress.total}次
                {isOverdue && !checked && <span style={{ marginLeft: 4, fontWeight: 400 }}>· 逾期</span>}
              </div>
            )}
          </div>
        )}

        {hovered && !editing && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenCanvas() }}
              title="Open canvas"
              style={{ background: 'none', border: 'none', color: '#5578cc', fontSize: 11, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eef2ff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >↗</button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c86e8e'; (e.currentTarget as HTMLElement).style.background = '#fde8f0' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ccc'; (e.currentTarget as HTMLElement).style.background = 'none' }}
            >✕</button>
          </div>
        )}
      </div>

      {/* Estimated time row — temporarily commented out
      <div style={{ marginTop: 5, paddingLeft: 23, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#bbb' }}>⏱</span>
        {editingTime ? (
          <input
            autoFocus
            type="number"
            min={1}
            value={timeDraft}
            onChange={(e) => setTimeDraft(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitTime() }
              if (e.key === 'Escape') { setTimeDraft(String(session.estimatedMins ?? '')); setEditingTime(false) }
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="min"
            style={{
              width: 52, fontSize: 11, border: 'none', outline: 'none',
              borderBottom: '1px solid #ccc', background: 'transparent',
              color: '#888', padding: '0 0 1px',
            }}
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setTimeDraft(String(session.estimatedMins ?? '')); setEditingTime(true) }}
            style={{
              fontSize: 11, color: session.estimatedMins ? '#888' : '#ccc',
              cursor: 'pointer', borderRadius: 3, padding: '0 2px',
            }}
            title="点击设置预计时长"
          >
            {session.estimatedMins ? `${session.estimatedMins} min` : '+ 时长'}
          </span>
        )}
      </div>
      */}
    </div>
  )
}
