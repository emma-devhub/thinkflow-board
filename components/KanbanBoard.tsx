'use client'

import { useState, useRef, useEffect } from 'react'
import type { SessionMeta, Project, TaskStatus, ParsedTask } from '@/types'
import { type Direction, loadDirections, saveDirections, EXTRA_COLORS } from '@/lib/directions'
import { useIsMobile } from '@/lib/useIsMobile'

interface Props {
  sessions: SessionMeta[]
  projects: Project[]
  selectedProjectId: string | null
  onOpenCanvas: (sessionId: string) => void
  onCreateSession: (title: string, projectId?: string, columnId?: string) => void
  onDeleteSession: (id: string) => void
  onMoveSession: (id: string, columnId: string) => void
  onToggleChecked: (id: string, checked: boolean) => void
  onRenameSession: (id: string, title: string) => void
  onCreateTasks: (tasks: ParsedTask[]) => void
  onUpdateTimeSlot: (id: string, startTime: string | null, estimatedMins: number | null) => void
  boardView: 'domain' | 'week'
  onBoardViewChange: (v: 'domain' | 'week') => void
  isChatOpen: boolean
  onToggleChatOpen: () => void
}

// Which column does a session belong to?
function sessionDirId(s: SessionMeta): string {
  return s.columnId ?? s.status
}

function getRecurringProgress(
  session: SessionMeta,
  allSessions: SessionMeta[]
): { done: number; total: number } | null {
  if (!session.recurringGroupId) return null
  const group = allSessions.filter((s) => s.recurringGroupId === session.recurringGroupId)
  if (group.length === 0) return null
  return { done: group.filter((s) => s.checked).length, total: group.length }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function KanbanBoard({
  sessions, projects, selectedProjectId,
  onOpenCanvas, onCreateSession, onDeleteSession, onMoveSession, onToggleChecked, onRenameSession,
  onCreateTasks, onUpdateTimeSlot, boardView, onBoardViewChange, isChatOpen, onToggleChatOpen,
}: Props) {
  const isMobile = useIsMobile()
  const [dirs, setDirs] = useState<Direction[]>([])
  useEffect(() => { loadDirections().then(setDirs) }, [])

  // Auto-scroll past empty 未分类 column on load
  useEffect(() => {
    if (isMobile || !scrollRef.current || dirs.length === 0) return
    const dirIds = new Set(dirs.map((d) => d.id))
    const unclassifiedCount = visibleSessions.filter((s) => !dirIds.has(sessionDirId(s))).length
    if (unclassifiedCount === 0) {
      // Scroll right by one column width + gap
      scrollRef.current.scrollTo({ left: 236, behavior: 'smooth' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirs.length])
  const [addingDirId, setAddingDirId] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [editingDirId, setEditingDirId] = useState<string | null>(null)
  const [dirLabelDraft, setDirLabelDraft] = useState('')
  const [addingNewDir, setAddingNewDir] = useState(false)
  const [newDirTitle, setNewDirTitle] = useState('')
  const [dragOverDirId, setDragOverDirId] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const thisMonday = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d.getTime()
  })()

  const visibleSessions = (selectedProjectId === null
    ? sessions
    : sessions.filter((s) => s.projectId === selectedProjectId)
  ).filter((s) => !(s.checked && (s.checkedAt ?? s.updatedAt) < thisMonday))

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]))
  const boardTitle = selectedProjectId ? (projectMap[selectedProjectId]?.title ?? 'Project') : 'All Projects'
  const boardSub = selectedProjectId === null
    ? `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}`
    : `${visibleSessions.length} subtask${visibleSessions.length !== 1 ? 's' : ''}`

  const updateDirs = (next: Direction[]) => { setDirs(next); saveDirections(next) }

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
    if (t) onCreateSession(t, selectedProjectId ?? undefined, dirId === '__unclassified__' ? undefined : dirId)
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
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Main board area — flex: 1 so it shrinks when panel opens */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0efed',
        borderTopRightRadius: isChatOpen ? 12 : 0, borderBottomRightRadius: isChatOpen ? 12 : 0,
        transition: 'border-radius 200ms ease',
      }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid #e0ddd9', background: '#f0efed', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{boardTitle}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{boardSub}</div>
        </div>
        {/* View toggle + New Focus + AI Chat — all right-aligned */}
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
              onMouseEnter={(e) => {
                if (boardView !== v) (e.currentTarget as HTMLElement).style.background = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                if (boardView !== v) (e.currentTarget as HTMLElement).style.background = 'white'
              }}
            >
              {v === 'domain' ? 'By Focus' : 'By Time'}
            </button>
          ))}
          <button
            onClick={onToggleChatOpen}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              border: '1px solid',
              borderColor: isChatOpen ? '#1a1a1a' : '#ddd',
              background: isChatOpen ? '#1a1a1a' : 'white',
              color: isChatOpen ? 'white' : '#444',
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => {
              if (!isChatOpen) (e.currentTarget as HTMLElement).style.background = '#f5f5f5'
            }}
            onMouseLeave={(e) => {
              if (!isChatOpen) (e.currentTarget as HTMLElement).style.background = 'white'
            }}
          >
            ✦ AI
          </button>
        </div>
      </div>

      {/* Columns — desktop: horizontal scroll row; mobile: vertical stack */}
      <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, padding: '20px 24px', overflowX: 'auto', overflowY: isMobile ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {/* 未分类 column — always visible, shows tasks with no matching focus */}
        {(() => {
          const dirIds = new Set(dirs.map((d) => d.id))
          const unclassified = visibleSessions.filter((s) => !dirIds.has(sessionDirId(s)))
          const isAdding = addingDirId === '__unclassified__'
          return (
            <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingBottom: 8, borderBottom: '1px dashed #ccc' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#aaa' }}>未分类</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, background: '#e5e3df', color: '#999', padding: '1px 5px', borderRadius: 6 }}>{unclassified.length}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                {unclassified.map((s) => {
                  const proj = s.projectId ? projects.find((p) => p.id === s.projectId) : null
                  return (
                    <KanbanCard
                      key={s.id}
                      session={s}
                      project={proj ?? null}
                      showProject={selectedProjectId === null}
                      recurringProgress={getRecurringProgress(s, sessions)}
                      onOpen={() => onOpenCanvas(s.id)}
                      onDelete={() => onDeleteSession(s.id)}
                      onToggleChecked={(v) => onToggleChecked(s.id, v)}
                      onRename={(t) => onRenameSession(s.id, t)}
                      onUpdateTimeSlot={(st, em) => onUpdateTimeSlot(s.id, st, em)}
                      onDragStart={() => { dragId.current = s.id }}
                    />
                  )
                })}
                {isAdding && (
                  <div style={{ background: 'white', borderRadius: 8, padding: '8px 10px', border: '1px solid #e8e5e0', borderLeft: '3px solid #ddd' }}>
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCommit('__unclassified__'); if (e.key === 'Escape') { setAddingDirId(null); setAddTitle('') } }}
                      onBlur={() => handleAddCommit('__unclassified__')}
                      placeholder="Subtask title…"
                      style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: '#1a1a1a', background: 'transparent' }}
                    />
                  </div>
                )}
                <button
                  onClick={() => { setAddingDirId('__unclassified__'); setAddTitle('') }}
                  style={{ border: '1.5px dashed #ddd', borderRadius: 8, padding: '8px 12px', color: '#bbb', fontSize: 12, cursor: 'pointer', display: isAdding ? 'none' : 'flex', alignItems: 'center', gap: 6, background: 'transparent', width: '100%', textAlign: 'left' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#bbb'; (e.currentTarget as HTMLElement).style.color = '#999'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ddd'; (e.currentTarget as HTMLElement).style.color = '#bbb'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  + Add subtask
                </button>
              </div>
            </div>
          )
        })()}
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
                width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
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
                      recurringProgress={getRecurringProgress(s, sessions)}
                      onOpen={() => onOpenCanvas(s.id)}
                      onDelete={() => onDeleteSession(s.id)}
                      onToggleChecked={(v) => onToggleChecked(s.id, v)}
                      onRename={(title) => onRenameSession(s.id, title)}
                      onUpdateTimeSlot={(st, em) => onUpdateTimeSlot(s.id, st, em)}
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

        {/* Add Focus — ghost column at the right edge */}
        {!isMobile && (addingNewDir ? (
          <div style={{ width: 200, flexShrink: 0, paddingTop: 2 }}>
            <input
              autoFocus
              value={newDirTitle}
              onChange={(e) => setNewDirTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addDirection(); if (e.key === 'Escape') { setAddingNewDir(false); setNewDirTitle('') } }}
              onBlur={addDirection}
              placeholder="Focus name…"
              style={{
                width: '100%', border: '1px solid #ccc', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, outline: 'none',
                background: 'white', color: '#1a1a1a',
              }}
            />
          </div>
        ) : (
          <div
            onClick={() => setAddingNewDir(true)}
            style={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: 2, cursor: 'pointer' }}
            title="Add new focus"
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ccc', fontSize: 18, lineHeight: 1,
                transition: 'color 120ms, background 120ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#888'; (e.currentTarget as HTMLElement).style.background = '#e8e5e0' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ccc'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >+</div>
          </div>
        ))}
      </div>
      </div>{/* end main board area */}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDueDateShort(dateStr: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const tom = new Date(now); tom.setDate(now.getDate() + 1)
  const tomStr = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`
  if (dateStr === todayStr) return '今天'
  if (dateStr === tomStr) return '明天'
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function formatTimeRange(startTime: string, estimatedMins?: number | null): string {
  if (!estimatedMins) return startTime
  const [h, m] = startTime.split(':').map(Number)
  const end = new Date(0, 0, 0, h, m + estimatedMins)
  return `${startTime}–${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
}

// ── Card ──────────────────────────────────────────────────────────────────────
function KanbanCard({ session, project, showProject, recurringProgress, onOpen, onDelete, onToggleChecked, onRename, onUpdateTimeSlot, onDragStart }: {
  session: SessionMeta
  project: Project | null | undefined
  showProject: boolean
  recurringProgress: { done: number; total: number } | null
  onOpen: () => void
  onDelete: () => void
  onToggleChecked: (v: boolean) => void
  onRename: (title: string) => void
  onUpdateTimeSlot: (startTime: string | null, estimatedMins: number | null) => void
  onDragStart: () => void
}) {
  const isMobile = useIsMobile()
  const [hovered, setHovered] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const [editingTime, setEditingTime] = useState(false)
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const accentColor = project?.color ?? '#ddd'
  const checked = !!session.checked

  const openTimeEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStartDraft(session.startTime ?? '')
    if (session.startTime && session.estimatedMins) {
      const [h, m] = session.startTime.split(':').map(Number)
      const end = new Date(0, 0, 0, h, m + session.estimatedMins)
      setEndDraft(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)
    } else {
      setEndDraft('')
    }
    setEditingTime(true)
  }

  const commitTime = () => {
    if (!startDraft) {
      onUpdateTimeSlot(null, null)
    } else {
      let mins: number | null = null
      if (endDraft && endDraft > startDraft) {
        const [sh, sm] = startDraft.split(':').map(Number)
        const [eh, em] = endDraft.split(':').map(Number)
        const diff = (eh * 60 + em) - (sh * 60 + sm)
        if (diff > 0) mins = diff
      }
      onUpdateTimeSlot(startDraft, mins)
    }
    setEditingTime(false)
  }

  const commitEdit = () => {
    const t = draft.trim()
    if (t && t !== session.title) onRename(t)
    else setDraft(session.title)
    setEditing(false)
  }

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (showProject && project && !editing) setTagOpen((v) => !v) }}
      style={{
        background: 'white', borderRadius: 8,
        border: '1px solid #e8e5e0',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: hovered ? '0 3px 10px rgba(0,0,0,0.09)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: editing ? 'default' : 'grab',
        transform: hovered && !editing ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 120ms, transform 120ms',
        opacity: checked ? 0.65 : 1,
        padding: isMobile ? '12px 14px' : '8px 10px',
        minHeight: isMobile ? 44 : undefined,
      }}
    >
      {/* Checkbox + title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 12 : 8 }}>
        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggleChecked(!checked) }}
          style={{
            width: isMobile ? 22 : 15, height: isMobile ? 22 : 15,
            borderRadius: isMobile ? '50%' : 3,
            flexShrink: 0, marginTop: isMobile ? 1 : 2,
            border: checked ? 'none' : `${isMobile ? 2 : 1.5}px solid #ccc`,
            background: checked ? accentColor !== '#ddd' ? accentColor : '#4caf86' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 120ms',
          }}
        >
          {checked && (
            <svg width={isMobile ? 12 : 9} height={isMobile ? 9 : 7} viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>

        {/* Title — click to edit inline */}
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
              if (e.key === 'Escape') { setDraft(session.title); setEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, fontSize: isMobile ? 16 : 13, lineHeight: 1.4, border: 'none', outline: 'none',
              borderBottom: `1px solid ${accentColor}`, background: 'transparent',
              color: '#1a1a1a', padding: '0 0 1px', width: '100%',
            }}
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setDraft(session.title); setEditing(true) }}
            style={{
              flex: 1, fontSize: isMobile ? 16 : 13, lineHeight: 1.4,
              textDecoration: checked ? 'line-through' : 'none',
              color: checked ? '#aaa' : '#1a1a1a',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', cursor: 'text',
            } as React.CSSProperties}
          >
            {session.title}
          </span>
        )}

        {/* Recurring progress badge */}
        {recurringProgress && !editing && (
          <span style={{
            fontSize: 10, fontWeight: 600, flexShrink: 0,
            color: recurringProgress.done >= recurringProgress.total ? '#4caf86' : '#aaa',
          }}>
            {recurringProgress.done}/{recurringProgress.total}次
          </span>
        )}

        {/* Hover actions */}
        {hovered && !editing && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpen() }}
              title={session.hasCanvas ? 'Open canvas' : 'Create canvas'}
              style={{ background: 'none', border: 'none', color: session.hasCanvas ? '#5578cc' : '#ccc', fontSize: 11, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = session.hasCanvas ? '#eef2ff' : '#f5f5f5'; (e.currentTarget as HTMLElement).style.color = session.hasCanvas ? '#5578cc' : '#999' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = session.hasCanvas ? '#5578cc' : '#ccc' }}
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

      {/* Project tag — below title, shown on click */}
      {showProject && project && tagOpen && !editing && (
        <div style={{ marginTop: 5, paddingLeft: isMobile ? 34 : 23, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: isMobile ? 12 : 10, fontWeight: 600, color: project.color }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: project.color, display: 'inline-block' }} />
          {project.title}
        </div>
      )}

      {/* Due date + time range */}
      {!editing && (
        <div style={{ marginTop: isMobile ? 6 : 5, paddingLeft: isMobile ? 34 : 23, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {session.dueDate && (
            <span style={{ fontSize: isMobile ? 12 : 10, color: '#888', background: '#f0ede9', padding: isMobile ? '2px 8px' : '1px 6px', borderRadius: 4 }}>
              {formatDueDateShort(session.dueDate)}
            </span>
          )}
          {editingTime ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={(e) => e.stopPropagation()}>
              <input type="time" value={startDraft} onChange={(e) => setStartDraft(e.target.value)}
                style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #ccc', outline: 'none', background: 'transparent', color: '#555', width: 72, padding: '0 0 1px' }} />
              <span style={{ fontSize: 10, color: '#bbb' }}>–</span>
              <input type="time" value={endDraft} onChange={(e) => setEndDraft(e.target.value)}
                style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #ccc', outline: 'none', background: 'transparent', color: '#555', width: 72, padding: '0 0 1px' }} />
              <button onClick={commitTime} style={{ background: 'none', border: 'none', color: '#4caf86', fontSize: 12, cursor: 'pointer', padding: '0 2px' }}>✓</button>
              <button onClick={(e) => { e.stopPropagation(); setEditingTime(false) }} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer', padding: '0 2px' }}>✕</button>
            </div>
          ) : session.startTime ? (
            <span onClick={openTimeEdit} style={{ fontSize: isMobile ? 12 : 10, color: '#888', background: '#f0ede9', padding: isMobile ? '2px 8px' : '1px 6px', borderRadius: 4, cursor: 'pointer' }}
              title="点击编辑时间段">
              ⏱ {formatTimeRange(session.startTime, session.estimatedMins)}
            </span>
          ) : hovered ? (
            <span onClick={openTimeEdit} style={{ fontSize: isMobile ? 12 : 10, color: '#ccc', cursor: 'pointer', padding: '1px 2px', borderRadius: 4 }}
              title="添加时间段">
              + 时段
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
