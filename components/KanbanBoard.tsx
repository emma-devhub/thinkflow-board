'use client'

import { useState, useRef } from 'react'
import type { SessionMeta, Project, TaskStatus } from '@/types'

interface Props {
  sessions: SessionMeta[]
  projects: Project[]
  selectedProjectId: string | null
  onOpenCanvas: (sessionId: string) => void
  onCreateSession: (title: string, projectId?: string, status?: TaskStatus) => void
  onDeleteSession: (id: string) => void
  onUpdateStatus: (id: string, status: TaskStatus) => void
  onUpdateProject: (id: string, projectId: string | undefined) => void
}

const COL_ACCENT: Record<TaskStatus, string> = {
  todo:       'hsl(0,0%,78%)',
  inprogress: '#f0a843',
  done:       '#4caf86',
}

const LABEL_KEY = 'thinkflow-col-labels'
const DEFAULT_LABELS: Record<TaskStatus, string> = {
  todo: '主业',
  inprogress: '副业',
  done: '生活',
}

function loadLabels(): Record<TaskStatus, string> {
  try {
    const raw = localStorage.getItem(LABEL_KEY)
    if (!raw) return { ...DEFAULT_LABELS }
    return { ...DEFAULT_LABELS, ...JSON.parse(raw) }
  } catch { return { ...DEFAULT_LABELS } }
}

function saveLabels(labels: Record<TaskStatus, string>) {
  try { localStorage.setItem(LABEL_KEY, JSON.stringify(labels)) } catch { /* ignore */ }
}

const COLS: TaskStatus[] = ['todo', 'inprogress', 'done']

export default function KanbanBoard({
  sessions, projects, selectedProjectId,
  onOpenCanvas, onCreateSession, onDeleteSession, onUpdateStatus,
}: Props) {
  const [addingCol, setAddingCol] = useState<TaskStatus | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [labels, setLabels] = useState<Record<TaskStatus, string>>(loadLabels)
  const [editingLabel, setEditingLabel] = useState<TaskStatus | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)
  const dragId = useRef<string | null>(null)

  const visibleSessions = selectedProjectId === null
    ? sessions
    : sessions.filter((s) => s.projectId === selectedProjectId)

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))
  const boardTitle = selectedProjectId
    ? (projectMap[selectedProjectId]?.title ?? 'Project')
    : 'All Projects'
  const boardSub = selectedProjectId === null
    ? `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}`
    : `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''}`

  const commitLabel = (col: TaskStatus) => {
    const t = labelDraft.trim()
    if (t) {
      const next = { ...labels, [col]: t }
      setLabels(next)
      saveLabels(next)
    }
    setEditingLabel(null)
  }

  const handleAddCommit = (colId: TaskStatus) => {
    const t = addTitle.trim()
    if (t) onCreateSession(t, selectedProjectId ?? undefined, colId)
    setAddTitle('')
    setAddingCol(null)
  }

  const handleDrop = (col: TaskStatus) => {
    if (dragId.current) {
      const s = sessions.find((s) => s.id === dragId.current)
      if (s && s.status !== col) onUpdateStatus(dragId.current, col)
    }
    dragId.current = null
    setDragOverCol(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0efed' }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid #e0ddd9', background: '#f0efed', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{boardTitle}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{boardSub}</div>
        </div>
        <button
          onClick={() => { setAddingCol('todo'); setAddTitle('') }}
          style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: 8,
            border: '1px solid #ddd', background: 'white', fontSize: 12,
            color: '#444', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white' }}
        >
          + New subtask
        </button>
      </div>

      {/* Kanban columns */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: '20px 24px', overflowX: 'auto', overflowY: 'hidden' }}>
        {COLS.map((colId) => {
          const colSessions = visibleSessions.filter((s) => s.status === colId)
          const isDragOver = dragOverCol === colId
          return (
            <div
              key={colId}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(colId) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(colId)}
              style={{
                width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
                background: isDragOver ? 'rgba(0,0,0,0.03)' : 'transparent',
                borderRadius: 10, transition: 'background 100ms',
              }}
            >
              {/* Column header — double-click to rename */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COL_ACCENT[colId] }} />
                {editingLabel === colId ? (
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(e) => setLabelDraft(e.target.value)}
                    onBlur={() => commitLabel(colId)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(colId); if (e.key === 'Escape') setEditingLabel(null) }}
                    style={{
                      fontSize: 11.5, fontWeight: 700, color: '#444', letterSpacing: '.07em',
                      border: 'none', borderBottom: `1px solid ${COL_ACCENT[colId]}`,
                      outline: 'none', background: 'transparent', width: 100, padding: '1px 0',
                      textTransform: 'uppercase',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => { setEditingLabel(colId); setLabelDraft(labels[colId]) }}
                    style={{ fontSize: 11.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.07em', cursor: 'text', userSelect: 'none' }}
                    title="Double-click to rename"
                  >
                    {labels[colId]}
                  </span>
                )}
                <span style={{ fontSize: 11, background: '#e5e3df', color: '#888', padding: '1px 7px', borderRadius: 10 }}>
                  {colSessions.length}
                </span>
                <button
                  onClick={() => { setAddingCol(colId); setAddTitle('') }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#888' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ccc' }}
                >+</button>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                {colSessions.map((s) => (
                  <KanbanCard
                    key={s.id}
                    session={s}
                    onOpen={() => onOpenCanvas(s.id)}
                    onDelete={() => onDeleteSession(s.id)}
                    onDragStart={() => { dragId.current = s.id }}
                  />
                ))}

                {addingCol === colId && (
                  <div style={{
                    background: 'white', borderRadius: 8, padding: '8px 10px',
                    border: '1px solid #e8e5e0', borderLeft: `3px solid ${COL_ACCENT[colId]}`,
                  }}>
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCommit(colId); if (e.key === 'Escape') { setAddingCol(null); setAddTitle('') } }}
                      onBlur={() => handleAddCommit(colId)}
                      placeholder="Subtask title…"
                      style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#1a1a1a', background: 'transparent' }}
                    />
                  </div>
                )}

                {addingCol !== colId && (
                  <button
                    onClick={() => { setAddingCol(colId); setAddTitle('') }}
                    style={{
                      border: '1.5px dashed #ddd', borderRadius: 8, padding: '8px 12px',
                      color: '#bbb', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', width: '100%',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#bbb'; (e.currentTarget as HTMLElement).style.color = '#999'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ddd'; (e.currentTarget as HTMLElement).style.color = '#bbb'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    + Add subtask
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KanbanCard({ session, onOpen, onDelete, onDragStart }: {
  session: SessionMeta
  onOpen: () => void
  onDelete: () => void
  onDragStart: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white', borderRadius: 8, padding: '9px 12px',
        border: '1px solid #e8e5e0',
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.09)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'grab',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 120ms, transform 120ms',
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: session.status === 'done' ? 0.75 : 1,
      }}
    >
      <span
        onClick={onOpen}
        style={{
          flex: 1, fontSize: 13, color: '#1a1a1a', lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'pointer',
        }}
      >
        {session.title}
      </span>
      {hovered && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen() }}
            style={{ background: 'none', border: 'none', color: '#5578cc', fontSize: 11, cursor: 'pointer', padding: '2px 5px', borderRadius: 4 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eef2ff' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >↗</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer', padding: '2px 5px', borderRadius: 4 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c86e8e'; (e.currentTarget as HTMLElement).style.background = '#fde8f0' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ccc'; (e.currentTarget as HTMLElement).style.background = 'none' }}
          >✕</button>
        </div>
      )}
    </div>
  )
}
