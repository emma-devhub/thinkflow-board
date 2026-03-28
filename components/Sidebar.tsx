'use client'

import { useState } from 'react'
import type { SessionMeta } from '@/types'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  sessions: SessionMeta[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
}

export default function Sidebar({
  isOpen,
  onToggle,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: SidebarProps) {
  return (
    <aside
      style={{
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
      }}
    >
      {/* Toggle button — always visible */}
      <button
        onClick={onToggle}
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
      <div
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 150ms ease',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 260,
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', paddingRight: 52 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'hsl(0, 0%, 15%)', letterSpacing: '-0.01em' }}>
            ThinkFlow
          </span>
        </div>

        {/* New chat button */}
        <div style={{ padding: '0 8px 8px' }}>
          <button
            onClick={onNewSession}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: 'hsl(0, 0%, 25%)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 0%, 92%)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            New chat
          </button>
        </div>

        {/* Recents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {sessions.length > 0 && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'hsl(0, 0%, 55%)',
                padding: '6px 8px 4px',
              }}
            >
              Recents
            </div>
          )}
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: SessionMeta
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        background: isActive ? 'hsl(0, 0%, 91%)' : hovered ? 'hsl(0, 0%, 93%)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: isActive ? 'hsl(0, 0%, 12%)' : 'hsl(0, 0%, 28%)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: isActive ? 500 : 400,
        }}
      >
        {session.title || 'New session'}
      </span>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'hsl(0, 0%, 50%)',
            fontSize: 11,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'hsl(0, 60%, 94%)'
            ;(e.currentTarget as HTMLElement).style.color = 'hsl(0, 65%, 45%)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 50%)'
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
