'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, NodeProps, NodeResizer, type Node } from '@xyflow/react'
import { NodeData } from '@/types'

export type ResearchNodeType = Node<NodeData, 'research'>

export default function ResearchNode({ data }: NodeProps<ResearchNodeType>) {
  const [input, setInput] = useState('')
  const [hovered, setHovered] = useState(false)
  const [noteEditing, setNoteEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingRef = useRef(false)  // ref-based guard — synchronous, survives batched re-renders

  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text || pendingRef.current || data.isLoading) return
    pendingRef.current = true
    setInput('')
    data.onContinue(text, data.context)
    // reset after a tick so the UI unblocks if onContinue is synchronous
    setTimeout(() => { pendingRef.current = false }, 300)
  }, [input, data])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }

  return (
    <div
      style={{ width: '100%', height: '100%', minWidth: 280 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <NodeResizer
        minWidth={280}
        minHeight={160}
        handleStyle={{
          width: 12,
          height: 12,
          background: 'transparent',
          border: 'none',
        }}
        lineStyle={{ borderColor: 'transparent' }}
      />

      {/* Source handles on all 4 sides */}
      {([Position.Left, Position.Right, Position.Top, Position.Bottom] as const).map((pos) => (
        <Handle
          key={pos}
          type="source"
          position={pos}
          id={pos}
          style={{ width: 10, height: 10, background: 'hsl(0, 0%, 55%)', border: '2px solid hsl(0, 0%, 88%)' }}
        />
      ))}

      <div
        className="rounded-xl"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'clip',
          background: data.nodeType === 'note' ? 'hsl(48, 80%, 97%)' : 'hsl(0, 0%, 100%)',
          border: `1px solid ${data.nodeType === 'note' ? 'hsl(48, 55%, 85%)' : 'hsl(0, 0%, 87%)'}`,
          boxShadow: '0 4px 12px hsla(0, 0%, 0%, 0.07)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b"
          style={{ flexShrink: 0, borderColor: data.nodeType === 'note' ? 'hsl(48, 60%, 88%)' : 'hsl(0, 0%, 90%)' }}
        >
          <span
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: data.nodeType === 'note' ? 'hsl(38, 55%, 48%)' : 'hsl(0, 0%, 50%)' }}
          >
            {data.nodeType === 'seed' ? 'Research' : data.nodeType === 'note' ? 'My Note' : 'Response'}
          </span>
          <div className="flex items-center gap-1">
            {data.content && (
              <button
                className="nodrag nopan text-xs px-2 py-1 rounded transition-colors"
                style={{ color: 'hsl(0, 0%, 50%)' }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.background = 'hsl(0, 0%, 93%)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.background = 'transparent'
                }}
                onClick={() => data.onExpand(data.content, data.prompt)}
              >
                ⤢ expand
              </button>
            )}
            {hovered && (
              <div className="flex items-center gap-0.5">
                {/* Delete this node only */}
                <button
                  className="nodrag nopan w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
                  style={{ color: 'hsl(0, 0%, 55%)' }}
                  title="Delete this card"
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'hsl(0, 60%, 94%)'
                    ;(e.currentTarget as HTMLElement).style.color = 'hsl(0, 65%, 45%)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 55%)'
                  }}
                  onClick={() => data.onDelete()}
                >
                  ✕
                </button>
                {/* Delete this node + all children */}
                <button
                  className="nodrag nopan h-6 flex items-center justify-center rounded text-xs transition-colors px-1"
                  style={{ color: 'hsl(0, 0%, 55%)', fontSize: 9, letterSpacing: '-0.5px' }}
                  title="Delete with all children"
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'hsl(0, 60%, 94%)'
                    ;(e.currentTarget as HTMLElement).style.color = 'hsl(0, 65%, 45%)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 55%)'
                  }}
                  onClick={() => data.onDeleteCascade?.()}
                >
                  ✕⊏
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Prompt (research/response only) */}
        {data.nodeType !== 'note' && data.prompt && (
          <div
            className="px-4 py-2 text-sm border-b nowheel"
            style={{
              flexShrink: 0,
              maxHeight: 72,
              overflowY: 'auto',
              borderColor: 'hsl(0, 0%, 90%)',
              color: 'hsl(0, 0%, 40%)',
              fontFamily: 'var(--font-lora)',
              fontStyle: 'italic',
            }}
          >
            {data.prompt}
          </div>
        )}

        {/* Note: view mode (markdown) or edit mode (textarea) */}
        {data.nodeType === 'note' ? (
          noteEditing ? (
            <textarea
              autoFocus
              className="nodrag nopan nowheel flex-1 w-full px-4 py-3 text-sm resize-none outline-none"
              style={{
                color: 'hsl(38, 30%, 25%)',
                fontFamily: 'var(--font-lora)',
                background: 'transparent',
                userSelect: 'text',
                cursor: 'text',
                lineHeight: '1.6',
              }}
              placeholder="Write your thoughts…"
              defaultValue={data.content}
              onChange={(e) => data.onUpdateNote(e.target.value)}
              onBlur={() => setNoteEditing(false)}
            />
          ) : (
            <div
              className="px-4 py-3 overflow-y-auto flex-1 nodrag nopan nowheel"
              style={{ minHeight: 0, cursor: 'text', userSelect: 'text' }}
              onClick={() => setNoteEditing(true)}
            >
              {data.content ? (
                <div
                  className="text-sm leading-relaxed prose prose-sm max-w-none"
                  style={{ color: 'hsl(38, 30%, 25%)', fontFamily: 'var(--font-lora)' }}
                  dangerouslySetInnerHTML={{ __html: formatContent(data.content) }}
                />
              ) : (
                <span className="text-sm" style={{ color: 'hsl(38, 45%, 65%)', fontFamily: 'var(--font-lora)', fontStyle: 'italic' }}>
                  Click to write your thoughts…
                </span>
              )}
            </div>
          )
        ) : (
          <>
            {/* AI Content */}
            <div
              className="px-4 py-3 overflow-y-auto flex-1 nodrag nopan nowheel"
              style={{ userSelect: 'text', cursor: 'text', minHeight: 0 }}
            >
              {data.isLoading && !data.content ? (
                <div className="flex items-center gap-2" style={{ color: 'hsl(0, 0%, 60%)' }}>
                  <span className="animate-pulse text-sm">thinking…</span>
                </div>
              ) : (
                <div
                  className="text-sm leading-relaxed prose prose-sm max-w-none"
                  style={{
                    color: 'hsl(0, 0%, 12%)',
                    fontFamily: 'var(--font-lora)',
                  }}
                  dangerouslySetInnerHTML={{ __html: formatContent(data.content) }}
                />
              )}
            </div>

          </>
        )}

        {/* Continue researching — shared by all node types */}
        <div
          className="px-4 pb-3 pt-1 border-t"
          style={{ flexShrink: 0, borderColor: data.nodeType === 'note' ? 'hsl(48, 55%, 85%)' : 'hsl(0, 0%, 90%)' }}
        >
          <div
            className="flex gap-2 items-end rounded-lg px-3 py-2"
            style={{ background: data.nodeType === 'note' ? 'hsl(48, 65%, 92%)' : 'hsl(0, 0%, 94%)' }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              className="nodrag nopan flex-1 bg-transparent text-sm resize-none outline-none"
              style={{
                color: 'hsl(0, 0%, 12%)',
                maxHeight: '120px',
                fontFamily: 'var(--font-jetbrains)',
              }}
              placeholder="Continue researching…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoResize()
              }}
              onKeyDown={handleKeyDown}
              disabled={data.isLoading}
            />
            <button
              className="nodrag nopan shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
              style={{ background: 'hsl(0, 0%, 20%)', color: 'white' }}
              onClick={handleSubmit}
              disabled={!input.trim() || data.isLoading || submitting}
            >
              ↗
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

function formatContent(text: string): string {
  if (!text) return ''
  // Basic markdown-to-html: bold, headers, bullets
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold mt-2 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-semibold mt-2 mb-1">$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^---+$/gm, '<hr style="border-color:hsl(0,0%,88%);margin:8px 0"/>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
