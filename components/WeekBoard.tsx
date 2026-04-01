'use client'

import { useState, useRef } from 'react'
import type { SessionMeta, Project } from '@/types'

interface Props {
  sessions: SessionMeta[]
  projects: Project[]
  selectedProjectId: string | null
  onSchedule: (id: string, dueDate: string | undefined, estimatedMins: number | undefined) => void
  onDelete: (id: string) => void
  onToggleChecked: (id: string, checked: boolean) => void
  onRename: (id: string, title: string) => void
  onOpenCanvas: (id: string) => void
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekDays(): { label: string; date: string; isToday: boolean }[] {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const mon = new Date(today)
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const date = d.toISOString().slice(0, 10)
    return { label: labels[i], date, isToday: date === todayStr }
  })
}

function formatDayHeader(date: string): string {
  // '2026-03-31' → '3/31'
  const [, m, d] = date.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WeekBoard({
  sessions, projects, selectedProjectId,
  onSchedule, onDelete, onToggleChecked, onRename, onOpenCanvas,
}: Props) {
  const weekDays = getWeekDays()
  const dragId = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null) // 'unscheduled' or date string

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))

  const visibleSessions = selectedProjectId === null
    ? sessions
    : sessions.filter((s) => s.projectId === selectedProjectId)

  const weekDateSet = new Set(weekDays.map((d) => d.date))

  // Card belongs to "unscheduled" if no dueDate or dueDate not in current week
  const getColKey = (s: SessionMeta): string =>
    s.dueDate && weekDateSet.has(s.dueDate) ? s.dueDate : 'unscheduled'

  const handleDrop = (colKey: string) => {
    if (!dragId.current) return
    const s = sessions.find((s) => s.id === dragId.current)
    if (!s) return
    const newDue = colKey === 'unscheduled' ? undefined : colKey
    onSchedule(s.id, newDue, s.estimatedMins)
    dragId.current = null
    setDragOverCol(null)
  }

  const columns: { key: string; label: string; sub?: string; isToday?: boolean }[] = [
    { key: 'unscheduled', label: '未安排' },
    ...weekDays.map((d) => ({ key: d.date, label: d.label, sub: formatDayHeader(d.date), isToday: d.isToday })),
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0efed' }}>
      {/* Columns */}
      <div style={{ flex: 1, display: 'flex', gap: 12, padding: '20px 24px', overflowX: 'auto', overflowY: 'hidden' }}>
        {columns.map((col) => {
          const colSessions = visibleSessions.filter((s) => getColKey(s) === col.key)
          const isDragOver = dragOverCol === col.key
          const isUnscheduled = col.key === 'unscheduled'

          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.key)}
              style={{
                width: isUnscheduled ? 220 : 200,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: isDragOver ? 'rgba(0,0,0,0.04)' : 'transparent',
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
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colSessions.map((s) => {
                  const proj = s.projectId ? projectMap[s.projectId] : null
                  return (
                    <WeekCard
                      key={s.id}
                      session={s}
                      project={proj}
                      onOpenCanvas={() => onOpenCanvas(s.id)}
                      onDelete={() => onDelete(s.id)}
                      onToggleChecked={(v) => onToggleChecked(s.id, v)}
                      onRename={(title) => onRename(s.id, title)}
                      onUpdateTime={(mins) => onSchedule(s.id, s.dueDate, mins)}
                      onDragStart={() => { dragId.current = s.id }}
                    />
                  )
                })}

                {/* Drop hint when dragging over and column is empty */}
                {isDragOver && colSessions.length === 0 && (
                  <div style={{
                    border: '1.5px dashed #ccc', borderRadius: 8, height: 60,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ccc', fontSize: 12,
                  }}>
                    放在这里
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── WeekCard ──────────────────────────────────────────────────────────────────
function WeekCard({ session, project, onOpenCanvas, onDelete, onToggleChecked, onRename, onUpdateTime, onDragStart }: {
  session: SessionMeta
  project: Project | null | undefined
  onOpenCanvas: () => void
  onDelete: () => void
  onToggleChecked: (v: boolean) => void
  onRename: (title: string) => void
  onUpdateTime: (mins: number | undefined) => void
  onDragStart: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const [editingTime, setEditingTime] = useState(false)
  const [timeDraft, setTimeDraft] = useState(String(session.estimatedMins ?? ''))

  const accentColor = project?.color ?? '#ddd'
  const checked = !!session.checked

  const commitTitle = () => {
    const t = draft.trim()
    if (t && t !== session.title) onRename(t)
    else setDraft(session.title)
    setEditing(false)
  }

  const commitTime = () => {
    const n = parseInt(timeDraft)
    onUpdateTime(isNaN(n) || n <= 0 ? undefined : n)
    setEditingTime(false)
  }

  return (
    <div
      draggable={!editing && !editingTime}
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white', borderRadius: 8,
        border: '1px solid #e8e5e0',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.09)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: editing || editingTime ? 'default' : 'grab',
        transform: hovered && !editing && !editingTime ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 120ms, transform 120ms',
        opacity: checked ? 0.65 : 1,
        padding: '8px 10px',
      }}
    >
      {/* Checkbox + title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Checkbox */}
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

        {/* Title */}
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
          <span
            onClick={(e) => { e.stopPropagation(); setDraft(session.title); setEditing(true) }}
            style={{
              flex: 1, fontSize: 13, lineHeight: 1.4,
              textDecoration: checked ? 'line-through' : 'none',
              color: checked ? '#aaa' : '#1a1a1a',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'text',
            } as React.CSSProperties}
          >
            {session.title}
          </span>
        )}

        {/* Hover actions */}
        {hovered && !editing && !editingTime && (
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

      {/* Estimated time row */}
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
    </div>
  )
}
