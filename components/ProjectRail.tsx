'use client'

import { useState } from 'react'
import type { Project } from '@/types'

interface Props {
  projects: Project[]
  selectedProjectId: string | null
  onSelectProject: (id: string | null) => void
  onCreateProject: (title: string) => void
  onDeleteProject: (id: string) => void
  onRenameProject: (id: string, title: string) => void
}

export default function ProjectRail({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
}: Props) {
  const [isOpen, setIsOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleAdd = () => {
    const t = newTitle.trim()
    if (t) onCreateProject(t)
    setNewTitle('')
    setAdding(false)
  }

  const startRename = (p: Project) => {
    setRenamingId(p.id)
    setRenameValue(p.title)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) onRenameProject(renamingId, renameValue.trim())
    setRenamingId(null)
  }

  return (
    <aside style={{
      width: isOpen ? 260 : 48,
      transition: 'width 200ms ease',
      background: 'hsl(0, 0%, 98%)',
      borderRight: '1px solid hsl(0, 0%, 90%)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: 14,
          right: isOpen ? 14 : '50%',
          transform: isOpen ? 'none' : 'translateX(50%)',
          transition: 'right 200ms ease, transform 200ms ease',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          color: 'hsl(0, 0%, 45%)',
          cursor: 'pointer',
          fontSize: 14,
          zIndex: 1,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 0%, 93%)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M5.5 1.5V14.5" stroke="currentColor" strokeWidth="1.3"/>
          {isOpen
            ? <path d="M3 5.5L4.5 7L3 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            : <path d="M4 5.5L2.5 7L4 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          }
        </svg>
      </button>

      {/* Expanded content */}
      <div style={{
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 150ms ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 260,
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', paddingRight: 52 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'hsl(0, 0%, 15%)', letterSpacing: '-0.01em' }}>
            Projects
          </span>
        </div>

        {/* All Projects */}
        <div style={{ padding: '0 8px 4px' }}>
          <RailItem
            label="All Projects"
            active={selectedProjectId === null}
            onClick={() => onSelectProject(null)}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="0.5" y="0.5" width="4.5" height="4.5" rx="1" fill="currentColor" opacity=".7"/>
                <rect x="7" y="0.5" width="4.5" height="4.5" rx="1" fill="currentColor" opacity=".7"/>
                <rect x="0.5" y="7" width="4.5" height="4.5" rx="1" fill="currentColor" opacity=".7"/>
                <rect x="7" y="7" width="4.5" height="4.5" rx="1" fill="currentColor" opacity=".7"/>
              </svg>
            }
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'hsl(0, 0%, 90%)', margin: '6px 16px' }} />

        {/* Projects label */}
        <div style={{ padding: '0 16px 4px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'hsl(0, 0%, 55%)' }}>
          Projects
        </div>

        {/* Projects list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {projects.map((p) => (
            <div key={p.id}>
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                  style={{
                    width: 'calc(100% - 8px)', margin: '2px 4px',
                    background: 'hsl(0, 0%, 93%)', border: '1px solid hsl(0, 0%, 82%)',
                    borderRadius: 6, color: 'hsl(0, 0%, 12%)',
                    fontSize: 13, padding: '7px 10px', outline: 'none',
                  }}
                />
              ) : (
                <RailItem
                  label={p.title}
                  active={selectedProjectId === p.id}
                  onClick={() => onSelectProject(p.id)}
                  onDoubleClick={() => startRename(p)}
                  dot={p.color}
                  onDelete={() => onDeleteProject(p.id)}
                />
              )}
            </div>
          ))}

          {/* New project */}
          {adding ? (
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleAdd}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
              placeholder="Project name…"
              style={{
                width: 'calc(100% - 8px)', margin: '4px 4px',
                background: 'hsl(0, 0%, 93%)', border: '1px solid hsl(0, 0%, 82%)',
                borderRadius: 6, color: 'hsl(0, 0%, 12%)',
                fontSize: 13, padding: '7px 10px', outline: 'none',
              }}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                width: '100%', padding: '7px 12px', margin: '4px 0',
                background: 'transparent', border: '1.5px dashed hsl(0, 0%, 82%)',
                borderRadius: 8, color: 'hsl(0, 0%, 55%)', fontSize: 12,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(0, 0%, 65%)'; (e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 35%)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(0, 0%, 82%)'; (e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 55%)' }}
            >
              + New project
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function RailItem({
  label, active, onClick, onDoubleClick, icon, dot, onDelete,
}: {
  label: string
  active: boolean
  onClick: () => void
  onDoubleClick?: () => void
  icon?: React.ReactNode
  dot?: string
  onDelete?: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
        fontSize: 13,
        color: active ? 'hsl(0, 0%, 12%)' : hovered ? 'hsl(0, 0%, 20%)' : 'hsl(0, 0%, 35%)',
        background: active ? 'hsl(0, 0%, 91%)' : hovered ? 'hsl(0, 0%, 93%)' : 'transparent',
        transition: 'background 100ms, color 100ms',
        userSelect: 'none',
        fontWeight: active ? 500 : 400,
      }}
    >
      {dot ? (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      ) : icon ? (
        <span style={{ color: active ? 'hsl(0, 0%, 30%)' : 'hsl(0, 0%, 55%)', flexShrink: 0, display: 'flex' }}>{icon}</span>
      ) : null}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {hovered && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, background: 'transparent', border: 'none',
            color: 'hsl(0, 0%, 60%)', fontSize: 11, cursor: 'pointer', padding: '0 2px',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 60%, 94%)'; (e.currentTarget as HTMLElement).style.color = 'hsl(0, 65%, 45%)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 60%)' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
