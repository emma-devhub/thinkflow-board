'use client'

import { useState } from 'react'
import type { Project } from '@/types'

interface Props {
  projects: Project[]
  selectedProjectId: string | null  // null = All Projects
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
      width: 200,
      background: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0 16px',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', padding: '0 16px 20px', letterSpacing: '-0.02em' }}>
        ThinkFlow
      </div>

      {/* All Projects */}
      <div style={{ padding: '0 16px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#555' }}>
        Overview
      </div>
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

      {/* Divider */}
      <div style={{ height: 1, background: '#2a2a2a', margin: '10px 16px' }} />

      {/* Projects list */}
      <div style={{ padding: '0 16px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#555' }}>
        Projects
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {projects.map((p) => (
          <div key={p.id} style={{ position: 'relative' }}>
            {renamingId === p.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                style={{
                  width: 'calc(100% - 24px)', margin: '2px 12px',
                  background: '#2a2a2a', border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 13, padding: '7px 10px', outline: 'none',
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

        {/* New project input */}
        {adding ? (
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => { handleAdd(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
            placeholder="Project name…"
            style={{
              width: 'calc(100% - 24px)', margin: '4px 12px',
              background: '#2a2a2a', border: '1px solid #444', borderRadius: 6,
              color: '#fff', fontSize: 13, padding: '7px 10px', outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              width: 'calc(100% - 24px)', margin: '4px 12px',
              background: 'transparent', border: '1px dashed #333',
              borderRadius: 6, color: '#555', fontSize: 12,
              padding: '7px 10px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#555'; (e.currentTarget as HTMLElement).style.color = '#888' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#333'; (e.currentTarget as HTMLElement).style.color = '#555' }}
          >
            + New project
          </button>
        )}
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
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '9px 16px', cursor: 'pointer',
        fontSize: 13,
        color: active ? '#fff' : hovered ? '#eee' : '#aaa',
        background: active ? '#242424' : hovered ? '#252525' : 'transparent',
        borderLeft: `2px solid ${active ? (dot ?? '#fff') : 'transparent'}`,
        transition: 'background 100ms, color 100ms',
        userSelect: 'none',
      }}
    >
      {dot ? (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      ) : icon ? (
        <span style={{ color: active ? '#ccc' : '#666', flexShrink: 0, display: 'flex' }}>{icon}</span>
      ) : null}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {hovered && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0, background: 'transparent', border: 'none',
            color: '#555', fontSize: 11, cursor: 'pointer', padding: '0 2px',
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c86e8e' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#555' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
