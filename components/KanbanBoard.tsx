'use client'

import { useState } from 'react'
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

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
]

const COL_ACCENT: Record<TaskStatus, string> = {
  todo:       'hsl(0,0%,78%)',
  inprogress: '#f0a843',
  done:       '#4caf86',
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function KanbanBoard({
  sessions, projects, selectedProjectId,
  onOpenCanvas, onCreateSession, onDeleteSession, onUpdateStatus, onUpdateProject,
}: Props) {
  const [addingCol, setAddingCol] = useState<TaskStatus | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [movingId, setMovingId] = useState<string | null>(null)

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

  const handleAddCommit = (colId: TaskStatus) => {
    const t = addTitle.trim()
    if (t) onCreateSession(t, selectedProjectId ?? undefined, colId)
    setAddTitle('')
    setAddingCol(null)
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
        {COLUMNS.map((col) => {
          const colSessions = visibleSessions.filter((s) => s.status === col.id)
          return (
            <div key={col.id} style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COL_ACCENT[col.id] }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  {col.label}
                </span>
                <span style={{ fontSize: 11, background: '#e5e3df', color: '#888', padding: '1px 7px', borderRadius: 10 }}>
                  {colSessions.length}
                </span>
                <button
                  onClick={() => { setAddingCol(col.id); setAddTitle('') }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#888' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ccc' }}
                >
                  +
                </button>
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
                {colSessions.map((s) => {
                  const proj = s.projectId ? projectMap[s.projectId] : null
                  return (
                    <KanbanCard
                      key={s.id}
                      session={s}
                      project={proj ?? null}
                      showProject={selectedProjectId === null}
                      projects={projects}
                      isMoving={movingId === s.id}
                      onOpen={() => onOpenCanvas(s.id)}
                      onDelete={() => onDeleteSession(s.id)}
                      onStatusChange={(status) => onUpdateStatus(s.id, status)}
                      onMoveToProject={(pid) => { onUpdateProject(s.id, pid); setMovingId(null) }}
                      onToggleMove={() => setMovingId(movingId === s.id ? null : s.id)}
                    />
                  )
                })}

                {/* Add card inline input */}
                {addingCol === col.id && (
                  <div style={{
                    background: 'white', borderRadius: 10, padding: '10px 12px',
                    border: '1px solid #e8e5e0', borderLeft: `4px solid ${COL_ACCENT[col.id]}`,
                  }}>
                    {selectedProjectId === null && projects.length > 0 && (
                      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>
                        Tip: select a project first to assign automatically
                      </div>
                    )}
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCommit(col.id); if (e.key === 'Escape') { setAddingCol(null); setAddTitle('') } }}
                      onBlur={() => { handleAddCommit(col.id) }}
                      placeholder="Subtask title…"
                      style={{
                        width: '100%', border: 'none', outline: 'none',
                        fontSize: 13, color: '#1a1a1a', background: 'transparent',
                      }}
                    />
                  </div>
                )}

                {/* Add card button */}
                {addingCol !== col.id && (
                  <button
                    onClick={() => { setAddingCol(col.id); setAddTitle('') }}
                    style={{
                      border: '1.5px dashed #ddd', borderRadius: 10, padding: '11px 14px',
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

function KanbanCard({
  session, project, showProject, projects,
  isMoving, onOpen, onDelete, onStatusChange, onMoveToProject, onToggleMove,
}: {
  session: SessionMeta
  project: Project | null
  showProject: boolean
  projects: Project[]
  isMoving: boolean
  onOpen: () => void
  onDelete: () => void
  onStatusChange: (s: TaskStatus) => void
  onMoveToProject: (pid: string | undefined) => void
  onToggleMove: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const accentColor = project?.color ?? '#ccc'

  return (
    <div style={{ position: 'relative' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: 'white', borderRadius: 10, padding: '13px 14px 12px',
          border: '1px solid #e8e5e0',
          borderLeft: `4px solid ${accentColor}`,
          cursor: 'pointer',
          boxShadow: hovered ? '0 4px 14px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
          transform: hovered ? 'translateY(-1px)' : 'none',
          transition: 'box-shadow 120ms, transform 120ms',
          opacity: session.status === 'done' ? 0.8 : 1,
        }}
      >
        {/* Project badge */}
        {showProject && project && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, fontWeight: 600, marginBottom: 7,
            padding: '2px 7px 2px 5px', borderRadius: 5,
            background: hexToRgba(project.color, 0.12),
            color: project.color,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: project.color }} />
            {project.title}
          </div>
        )}

        {/* Title */}
        <div
          onClick={onOpen}
          style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.4, marginBottom: 10 }}
        >
          {session.title}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Status pill */}
          <select
            value={session.status}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10.5, border: '1px solid #eee', borderRadius: 5,
              padding: '2px 4px', background: '#fafafa', color: '#888',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="todo">To Do</option>
            <option value="inprogress">In Progress</option>
            <option value="done">Done</option>
          </select>

          {/* Open canvas */}
          <button
            onClick={(e) => { e.stopPropagation(); onOpen() }}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: hovered ? '#5578cc' : '#ccc', fontSize: 11,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
              transition: 'color 120ms',
            }}
          >
            Open ↗
          </button>

          {/* Move to project */}
          {showProject && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMove() }}
              style={{
                background: 'none', border: 'none',
                color: isMoving ? '#5578cc' : hovered ? '#aaa' : '#ddd',
                fontSize: 11, cursor: 'pointer', transition: 'color 120ms',
              }}
              title="Move to project"
            >
              ⤵
            </button>
          )}

          {/* Delete */}
          {hovered && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 11, cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c86e8e' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#ddd' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Move dropdown */}
      {isMoving && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
          background: 'white', border: '1px solid #e0e0e0', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 4px' }}>
            <div style={{ fontSize: 10.5, color: '#aaa', padding: '4px 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Move to…
            </div>
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => onMoveToProject(p.id)}
                style={{
                  padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', borderRadius: 6, margin: '0 4px',
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: session.projectId === p.id ? hexToRgba(p.color, 0.10) : 'transparent',
                  color: session.projectId === p.id ? p.color : '#333',
                  fontWeight: session.projectId === p.id ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (session.projectId !== p.id) (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
                onMouseLeave={(e) => { if (session.projectId !== p.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                {p.title}
                {session.projectId === p.id && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓</span>}
              </div>
            ))}
            <div style={{ height: 1, background: '#eee', margin: '4px 0' }} />
            <div
              onClick={() => onMoveToProject(undefined)}
              style={{ padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', borderRadius: 6, margin: '0 4px', color: '#aaa' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              Remove from project
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
