'use client'

import { useEffect } from 'react'

interface Props {
  prompt: string
  content: string
  onClose: () => void
}

export default function ExpandModal({ prompt, content, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'hsla(0, 0%, 0%, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{
          background: 'hsl(0, 0%, 100%)',
          border: '1px solid hsl(0, 0%, 85%)',
          boxShadow: '0 20px 60px hsla(0, 0%, 0%, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'hsl(0, 0%, 88%)' }}
        >
          {prompt && (
            <p
              className="text-sm italic flex-1 mr-4"
              style={{ color: 'hsl(0, 0%, 40%)', fontFamily: 'var(--font-lora)' }}
            >
              {prompt}
            </p>
          )}
          <button
            className="text-lg w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0"
            style={{ color: 'hsl(0, 0%, 45%)' }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLElement).style.background = 'hsl(0, 0%, 92%)'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLElement).style.background = 'transparent'
            }}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto">
          <div
            className="text-sm leading-relaxed prose prose-sm max-w-none"
            style={{
              color: 'hsl(0, 0%, 12%)',
              fontFamily: 'var(--font-lora)',
            }}
            dangerouslySetInnerHTML={{ __html: formatContent(content) }}
          />
        </div>
      </div>
    </div>
  )
}

function formatContent(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-semibold mt-3 mb-1">$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^---+$/gm, '<hr style="border-color:hsl(0,0%,85%);margin:8px 0"/>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
