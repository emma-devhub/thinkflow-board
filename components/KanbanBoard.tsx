'use client'

import { useState, useRef } from 'react'
import type { SessionMeta, Project, TaskStatus } from '@/types'

interface Direction { id: string; label: string; color: string }

interface Props {
  sessions: SessionMeta[]
  projects: Project[]
  selectedProjectId: string | null
  onOpenCanvas: (sessionId: string) => void
  onCreateSession: (title: string, projectId?: string, columnId?: string) => void
  onDeleteSession: (id: string) => void
  onMoveSession: (id: string, columnId: string) => void
  onToggleChecked: (id: string, checked: boolean) => void
}

// ── Direction (column) persistence ──────────────────────────────────────────
const DIR_KEY = 'thinkflow-directions'
const EXTRA_COLORS = ['#a06ec8', '#c86e6e', '#6ec8c0', '#6e8ec8']

const DEFAULT_DIRS: Direction[] = [
  { id: 'todo',       label: '主业', color: 'hsl(0,0%,72%)' },
  { id: 'inprogress', label: '副业', color: '#f0a843' },
  { id: 'done',       label: '生活', color: '#4caf86' },
]

function loadDirs(): Direction[] {
  try {
    const raw = localStorage.getItem(DIR_KEY)
    return raw ? JSON.parse(raw) : [...DEFAULT_DIRS]
  } catch { return [...DEFAULT_DIRS] }
}

function saveDirs(dirs: Direction[]) {
  try { localStorage.setItem(DIR_KEY, JSON.stringify(dirs)) } catch { /* ignore */ }
}

// Which column does a session belong to?
function sessionDirId(s: SessionMeta): string {
  return s.columnId ?? s.status
}

// ── Component ────────────────────────────────────────────────────────────────
export default function KanbanBoard({
  sessions, projects, selectedProjectId,
  onOpenCanvas, onCreateSession, onDeleteSession, onMoveSession, onToggleChecked,
}: Props) {
  const [dirs, setDirs] = useState<Direction[]>(loadDirs)
  const [addingDirId, setAddingDirId] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [editingDirId, setEditingDirId] = useState<string | null>(null)
  const [dirLabelDraft, setDirLabelDraft] = useState('')
  const [addingNewDir, setAddingNewDir] = useState(false)
  const [newDirTitle, setNewDirTitle] = useState('')
  const [dragOverDirId, setDragOverDirId] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  const visibleSessions = selectedProjectId === null
    ? sessions
    : sessions.filter((s) => s.projectId === selectedProjectId)

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))
  const boardTitle = selectedProjectId ? (projectMap[selectedProjectId]?.title ?? 'Project') : 'All Projects'
  const boardSub = selectedProjectId === null
    ? `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}`
    : `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''}`

  const updateDirs = (next: Direction[]) => { setDirs(next); saveDirs(next) }

  const commitDirLabel = (id: string) => {
    const t = dirLabelDraft.trim()
    if (t) updateDirs(dirs.map((d) => d.id === id ? { ...d, label: t } : d))
    setEditingDirId(null)
  }

  const addDirection = () => {
    const t = newDirTitle.trim()
    if (t) {
      const color = EXTRA_COLORS[dirs.length % EXTRA_COLORS.length]
      const newDir: Direction = { id: `dir-${Date.now()}`, label: t, color }
      updateDirs([...dirs, newDir])
    }
    setNewDirTitle('')
    setAddingNewDir(false)
  }

  const deleteDir = (id: string) => {
    updateDirs(dirs.filter((d) => d.id !== id))
  }

  const handleAddCommit = (dirId: string) => {
    const t = addTitle.trim()
    if (t) onCreateSession(t, selectedProjectId ?? undefined, dirId)
    setAddTitle('')
    setAddingDirId(null)
  }

  const handleDrop = (dirId: string) => {
    if (dragId.current) {
      const s = sessions.find((s) => s.id === dragId.current)
      if (s && sessionDirId(s) !== dirId) onMoveSession(dragId.current, dirId)
    }
    dragId.current = null
    setDragOverDirId(null)
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
          onClick={() => setAddingNewDir(true)}
          style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: 8,
            border: '1px solid #ddd', background: 'white', fontSize: 12,
            color: '#444', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white' }}
        >
          + New Direction
        </button>
      </div>

      {/* Columns */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: '20px 24px', overflowX: 'auto', overflowY: 'hidden' }}>
        {dirs.map((dir) => {
          const dirSessions = visibleSessions.filter((s) => sessionDirId(s) === dir.id)
          const isDragOver = dragOverDirId === dir.id
          return (
            <div
              key={dir.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverDirId(dir.id) }}
              onDragLeave={() => setDragOverDirId(null)}
              onDrop={() => handleDrop(dir.id)}
              style={{
                width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
                background: isDragOver ? 'rgba(0,0,0,0.03)' : 'transparent',
                borderRadius: 10, transition: 'background 100ms',
              }}
            >
              {/* Column header */}
              <ColHeader
                dir={dir}
                count={dirSessions.length}
                editing={editingDirId === dir.id}
                draft={dirLabelDraft}
                onDraftChange={setDirLabelDraft}
                onStartEdit={() => { setEditingDirId(dir.id); setDirLabelDraft(dir.label) }}
                onCommitEdit={() => commitDirLabel(dir.id)}
                onCancelEdit={() => setEditingDirId(null)}
                onAdd={() => { setAddingDirId(dir.id); setAddTitle('') }}
                onDelete={() => deleteDir(dir.id)}
              />

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                {dirSessions.map((s) => {
                  const proj = s.projectId ? projectMap[s.projectId] : null
                  return (
                    <KanbanCard
                      key={s.id}
                      session={s}
                      project={proj}
                      showProject={selectedProjectId === null}
                      onOpen={() => onOpenCanvas(s.id)}
                      onDelete={() => onDeleteSession(s.id)}
                      onToggleChecked={(v) => onToggleChecked(s.id, v)}
                      onDragStart={() => { dragId.current = s.id }}
                    />
                  )
                })}

                {addingDirId === dir.id && (
                  <div style={{
                    background: 'white', borderRadius: 8, padding: '8px 10px',
                    border: '1px solid #e8e5e0', borderLeft: `3px solid ${dir.color}`,
                  }}>
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCommit(dir.id); if (e.key === 'Escape') { setAddingDirId(null); setAddTitle('') } }}
                      onBlur={() => handleAddCommit(dir.id)}
                      placeholder="Subtask title…"
                      style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#1a1a1a', background: 'transparent' }}
                    />
                  </div>
                )}

                <button
                  onClick={() => { setAddingDirId(dir.id); setAddTitle('') }}
                  style={{
                    border: '1.5px dashed #ddd', borderRadius: 8, padding: '8px 12px',
                    color: '#bbb', fontSize: 12, cursor: 'pointer',
                    display: addingDirId === dir.id ? 'none' : 'flex',
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

        {/* New direction inline input */}
        {addingNewDir && (
          <div style={{ width: 240, flexShrink: 0, paddingTop: 2 }}>
            <input
              autoFocus
              value={newDirTitle}
              onChange={(e) => setNewDirTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addDirection(); if (e.key === 'Escape') { setAddingNewDir(false); setNewDirTitle('') } }}
              onBlur={addDirection}
              placeholder="Direction name…"
              style={{
                width: '100%', border: '1px solid #ccc', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, outline: 'none',
                background: 'white', color: '#1a1a1a',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Column header ─────────────────────────────────────────────────────────────
function ColHeader({ dir, count, editing, draft, onDraftChange, onStartEdit, onCommitEdit, onCancelEdit, onAdd, onDelete }: {
  dir: Direction; count: number
  editing: boolean; draft: string
  onDraftChange: (v: string) => void
  onStartEdit: () => void; onCommitEdit: () => void; onCancelEdit: () => void
  onAdd: () => void; onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 6px' }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dir.color, flexShrink: 0 }} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit() }}
          style={{
            fontSize: 11.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
            border: 'none', borderBottom: `1px solid ${dir.color}`, outline: 'none',
            background: 'transparent', color: '#444', width: 90, padding: '1px 0',
          }}
        />
      ) : (
        <span
          onDoubleClick={onStartEdit}
          style={{ fontSize: 11.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.07em', cursor: 'text', userSelect: 'none' }}
          title="Double-click to rename"
        >
          {dir.label}
        </span>
      )}
      <span style={{ fontSize: 11, background: '#e5e3df', color: '#888', padding: '1px 6px', borderRadius: 8 }}>
        {count}
      </span>
      {hovered && (
        <>
          <button onClick={onAdd} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#555' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ccc' }}
          >+</button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c86e8e' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ddd' }}
          >✕</button>
        </>
      )}
      {!hovered && <div style={{ marginLeft: 'auto' }} />}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function KanbanCard({ session, project, showProject, onOpen, onDelete, onToggleChecked, onDragStart }: {
  session: SessionMeta
  project: Project | null | undefined
  showProject: boolean
  onOpen: () => void
  onDelete: () => void
  onToggleChecked: (v: boolean) => void
  onDragStart: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const accentColor = project?.color ?? '#ddd'
  const checked = !!session.checked

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (showProject && project) setTagOpen((v) => !v) }}
      style={{
        background: 'white', borderRadius: 8,
        border: '1px solid #e8e5e0',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.09)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'grab',
        transform: hovered ? 'translateY(-1px)' : 'none',
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
            background: checked ? accentColor !== '#ddd' ? accentColor : '#4caf86' : 'transparent',
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
        <span
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          style={{
            flex: 1, fontSize: 13, lineHeight: 1.4,
            textDecoration: checked ? 'line-through' : 'none',
            color: checked ? '#aaa' : '#1a1a1a',
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'pointer',
          } as React.CSSProperties}
        >
          {session.title}
        </span>

        {/* Hover actions */}
        {hovered && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpen() }}
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

      {/* Project tag — below title, shown on click (no indicator) */}
      {showProject && project && tagOpen && (
        <div style={{ marginTop: 5, paddingLeft: 23, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: project.color }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: project.color, display: 'inline-block' }} />
          {project.title}
        </div>
      )}
    </div>
  )
}
