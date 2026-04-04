'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ResearchNode, { ResearchNodeType } from './ResearchNode'
import DeletableEdge from './DeletableEdge'
import ExpandModal from './ExpandModal'
import { NodeData, ConversationMessage } from '@/types'

import { canvasKey } from '@/lib/sessions'

const nodeTypes = { research: ResearchNode }
const edgeTypes = { default: DeletableEdge }

interface ExpandState {
  prompt: string
  content: string
}

interface ThinkCanvasProps {
  sessionId: string
  onTitleChange: (title: string) => void
}

// Parse markdown into intro + sections (with optional ### subsections)
interface SubSection { title: string; body: string }
interface Section { title: string; intro: string; subsections: SubSection[] }

function parseMarkdownSections(content: string): { intro: string; sections: Section[] } {
  const parts = content.split(/\n(?=## )/)
  const intro = parts[0].trim()
  const sections = parts.slice(1).map((s) => {
    const lines = s.split('\n')
    const title = lines[0].replace(/^##\s+/, '').trim()
    const rest = lines.slice(1).join('\n')
    const subParts = rest.split(/\n(?=### )/)
    const sectionIntro = subParts[0].trim()
    const subsections = subParts.slice(1).map((sub) => {
      const subLines = sub.split('\n')
      const subTitle = subLines[0].replace(/^###\s+/, '').trim()
      const subBody = subLines.slice(1).join('\n').trim()
      return { title: subTitle, body: subBody }
    }).filter((sub) => sub.title)
    return { title, intro: sectionIntro, subsections }
  }).filter((s) => s.title)
  return { intro, sections }
}

// Build the path of context from root to a given node
function buildContext(
  nodeId: string,
  nodes: ResearchNodeType[],
  edges: Edge[]
): ConversationMessage[] {
  let current: string | null = nodeId
  const path: string[] = []
  while (current) {
    path.unshift(current)
    const parentEdge = edges.find((e) => e.target === current)
    current = parentEdge ? parentEdge.source : null
  }
  const context: ConversationMessage[] = []
  for (const id of path) {
    const node = nodes.find((n) => n.id === id)
    if (!node) continue
    if (node.data.nodeType === 'note') {
      if (node.data.content) context.push({ role: 'user', content: `My notes: ${node.data.content}` })
    } else {
      if (node.data.prompt) context.push({ role: 'user', content: node.data.prompt })
      if (node.data.content) context.push({ role: 'model', content: node.data.content })
    }
  }
  return context
}

export default function ThinkCanvas({ sessionId, onTitleChange }: ThinkCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ResearchNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [expandState, setExpandState] = useState<ExpandState | null>(null)
  const [seedInput, setSeedInput] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)
  const [layoutDir, setLayoutDir] = useState<'LR' | 'TB'>('LR')
  const seedInputRef = useRef<HTMLInputElement>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const layoutDirRef = useRef<'LR' | 'TB'>('LR')
  const rfInstanceRef = useRef<ReactFlowInstance<ResearchNodeType, Edge> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { layoutDirRef.current = layoutDir }, [layoutDir])

  // Restore canvas when sessionId changes
  useEffect(() => {
    setNodes([])
    setEdges([])
    try {
      const saved = localStorage.getItem(canvasKey(sessionId))
      if (saved) {
        const { nodes: savedNodes, edges: savedEdges } = JSON.parse(saved)
        const restored = (savedNodes as ResearchNodeType[]).map((n) => attachCallbacks(n))
        setNodes(restored)
        setEdges(savedEdges)
      }
      const savedDir = localStorage.getItem(canvasKey(sessionId) + ':dir')
      if (savedDir === 'LR' || savedDir === 'TB') setLayoutDir(savedDir)
      else setLayoutDir('LR')
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Save completed nodes whenever canvas changes
  useEffect(() => {
    if (nodes.length === 0) return
    try {
      const stripped = nodes
        .filter((n) => !n.data.isLoading)
        .map((n) => ({ ...n, data: { ...n.data, onContinue: undefined, onExpand: undefined, onDelete: undefined, onUpdateNote: undefined } }))
      if (stripped.length === 0) return
      localStorage.setItem(canvasKey(sessionId), JSON.stringify({ nodes: stripped, edges }))
      localStorage.setItem(canvasKey(sessionId) + ':dir', layoutDir)
    } catch { /* ignore */ }
  }, [nodes, edges, sessionId, layoutDir])

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }, [setNodes, setEdges])

  const handleDeleteNodeCascade = useCallback((nodeId: string) => {
    const edges = edgesRef.current
    // BFS to collect all descendants
    const toDelete = new Set<string>([nodeId])
    const queue = [nodeId]
    while (queue.length > 0) {
      const cur = queue.shift()!
      edges.filter((e) => e.source === cur).forEach((e) => {
        if (!toDelete.has(e.target)) {
          toDelete.add(e.target)
          queue.push(e.target)
        }
      })
    }
    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)))
    setEdges((prev) => prev.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)))
  }, [setNodes, setEdges])

  const handleUpdateNote = useCallback((nodeId: string, content: string) => {
    setNodes((prev) =>
      prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, content } } : n)
    )
  }, [setNodes])

  const attachCallbacks = useCallback(
    (node: ResearchNodeType): ResearchNodeType => ({
      ...node,
      data: {
        ...node.data,
        onContinue: (text: string, context: ConversationMessage[]) =>
          handleBranch(node.id, text, context),
        onExpand: (content: string, prompt: string) =>
          setExpandState({ content, prompt }),
        onDelete: () => handleDeleteNode(node.id),
        onDeleteCascade: () => handleDeleteNodeCascade(node.id),
        onUpdateNote: (content: string) => handleUpdateNote(node.id, content),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleDeleteNode, handleDeleteNodeCascade]
  )

  const createNode = useCallback(
    (
      id: string,
      nodeType: 'seed' | 'response',
      prompt: string,
      position: { x: number; y: number },
      context: ConversationMessage[]
    ): ResearchNodeType => {
      const node: ResearchNodeType = {
        id,
        type: 'research',
        position,
        style: { width: 400, height: 320 },
        data: { nodeType, content: '', prompt, isLoading: true, context, onContinue: () => {}, onExpand: () => {}, onDelete: () => {}, onDeleteCascade: () => {}, onUpdateNote: () => {} },
      }
      return attachCallbacks(node)
    },
    [attachCallbacks]
  )

  // Expand into mindmap: supports ## sections and ### subsections (two-level tree)
  const expandToMindmap = useCallback(
    (parentId: string, finalContent: string, message: string, context: ConversationMessage[]): boolean => {
      const { sections } = parseMarkdownSections(finalContent)
      if (sections.length < 2) return false

      const parent = nodesRef.current.find((n) => n.id === parentId)
      if (!parent) return false

      const updatedContext: ConversationMessage[] = [
        ...context,
        { role: 'user' as const, content: message },
        { role: 'model' as const, content: finalContent },
      ]

      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== parentId) return node
          const withCbs = attachCallbacks(node)
          return { ...withCbs, data: { ...withCbs.data, content: finalContent, isLoading: false, context: updatedContext } }
        })
      )

      const isLR = layoutDirRef.current === 'LR'
      const SLOT_SPACING = isLR ? 360 : 460   // vertical (LR) or horizontal (TB) slot size
      const L1_OFFSET = isLR ? 560 : 480      // distance from parent along main axis
      const L2_OFFSET = isLR ? 500 : 440      // distance from L1 along main axis
      const SRC_HANDLE = isLR ? 'right' : 'bottom'
      const TGT_HANDLE = isLR ? 'left' : 'top'

      const totalSlots = sections.reduce((sum, s) => sum + (s.subsections.length > 0 ? s.subsections.length : 1), 0)
      // Center the tree on the parent along the cross-axis
      const crossStart = (isLR ? parent.position.y : parent.position.x) - ((totalSlots - 1) * SLOT_SPACING) / 2

      const l1MainPos = isLR ? parent.position.x + L1_OFFSET : parent.position.x
      const l2MainPos = isLR ? parent.position.x + L1_OFFSET + L2_OFFSET : parent.position.x

      let slotIndex = 0
      sections.forEach((section, si) => {
        const hasSubs = section.subsections.length > 0
        const slotCount = hasSubs ? section.subsections.length : 1
        const firstCross = crossStart + slotIndex * SLOT_SPACING
        const lastCross = crossStart + (slotIndex + slotCount - 1) * SLOT_SPACING
        const l1Cross = hasSubs ? (firstCross + lastCross) / 2 : firstCross

        const l1Pos = isLR
          ? { x: l1MainPos, y: l1Cross }
          : { x: l1Cross, y: parent.position.y + L1_OFFSET }
        const l1Style = isLR
          ? { width: 400, height: hasSubs ? Math.max(200, slotCount * 56) : 320 }
          : { width: hasSubs ? Math.max(400, slotCount * 56) : 400, height: 260 }

        const l1Id = `node-${Date.now()}-${si}`
        const l1Node: ResearchNodeType = {
          id: l1Id, type: 'research', position: l1Pos, style: l1Style,
          data: {
            nodeType: 'response', content: section.intro, prompt: section.title,
            isLoading: false, context: updatedContext,
            onContinue: () => {}, onExpand: () => {}, onDelete: () => {}, onDeleteCascade: () => {}, onUpdateNote: () => {},
          },
        }
        setNodes((prev) => [...prev, attachCallbacks(l1Node)])
        setEdges((prev) => [...prev, {
          id: `edge-${parentId}-${l1Id}`, source: parentId, target: l1Id,
          sourceHandle: SRC_HANDLE, targetHandle: TGT_HANDLE, type: 'default',
          style: { stroke: 'hsl(0, 0%, 60%)', strokeWidth: 1.5 },
        }])

        if (hasSubs) {
          section.subsections.forEach((sub, subi) => {
            const l2Cross = crossStart + (slotIndex + subi) * SLOT_SPACING
            const l2Pos = isLR
              ? { x: l2MainPos, y: l2Cross }
              : { x: l2Cross, y: parent.position.y + L1_OFFSET + L2_OFFSET }
            const l2Id = `node-${Date.now()}-${si}-${subi}`
            const l2Node: ResearchNodeType = {
              id: l2Id, type: 'research',
              position: l2Pos,
              style: { width: 400, height: 320 },
              data: {
                nodeType: 'response', content: sub.body, prompt: sub.title,
                isLoading: false, context: updatedContext,
                onContinue: () => {}, onExpand: () => {}, onDelete: () => {}, onDeleteCascade: () => {}, onUpdateNote: () => {},
              },
            }
            setNodes((prev) => [...prev, attachCallbacks(l2Node)])
            setEdges((prev) => [...prev, {
              id: `edge-${l1Id}-${l2Id}`, source: l1Id, target: l2Id,
              sourceHandle: SRC_HANDLE, targetHandle: TGT_HANDLE, type: 'default',
              style: { stroke: 'hsl(0, 0%, 60%)', strokeWidth: 1.5 },
            }])
          })
        }

        slotIndex += slotCount
      })

      setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.12, duration: 400 }), 50)
      return true
    },
    [attachCallbacks, setEdges, setNodes]
  )

  const streamIntoNode = useCallback(
    async (nodeId: string, message: string, context: ConversationMessage[]) => {
      const doFetch = () => fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
      })

      let res = await doFetch()

      if (res.status === 429) {
        const errText = await res.text().catch(() => '')
        const isDaily = errText.includes('PerDay') || errText.includes('per_day')
        const retryMatch = errText.match(/"retryDelay":\s*"(\d+)s"/)
        const retrySeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60

        if (isDaily) {
          // Daily quota exhausted — no point retrying
          setNodes((prev) =>
            prev.map((n) =>
              n.id === nodeId
                ? { ...attachCallbacks(n), data: { ...n.data, content: '⚠️ Daily API quota exhausted (free tier limit: 20 req/day). Please try again tomorrow or upgrade your Gemini API plan.', isLoading: false } }
                : n
            )
          )
          return
        }

        // Temporary rate limit — retry after suggested delay
        const waitSec = Math.min(retrySeconds, 90)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...attachCallbacks(n), data: { ...n.data, content: `Rate limit — retrying in ${waitSec}s…`, isLoading: true } }
              : n
          )
        )
        await new Promise((r) => setTimeout(r, waitSec * 1000))
        res = await doFetch()
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`)
        console.error('[streamIntoNode] API error:', res.status, errText)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...attachCallbacks(n), data: { ...n.data, content: `Error ${res.status}: failed to get response`, isLoading: false } }
              : n
          )
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snap = accumulated
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...attachCallbacks(n), data: { ...n.data, content: snap, isLoading: true } }
              : n
          )
        )
      }

      const finalContent = accumulated

      // Try to expand into mindmap sections
      const expanded = expandToMindmap(nodeId, finalContent, message, context)

      if (!expanded) {
        // Single-node fallback
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? {
                  ...attachCallbacks(n),
                  data: {
                    ...n.data,
                    content: finalContent,
                    isLoading: false,
                    context: [
                      ...n.data.context,
                      { role: 'user' as const, content: message },
                      { role: 'model' as const, content: finalContent },
                    ],
                  },
                }
              : n
          )
        )
      }
    },
    [attachCallbacks, expandToMindmap, setNodes]
  )

  const handleBranch = useCallback(
    (parentId: string, text: string, parentContext: ConversationMessage[]) => {
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current
      const parent = currentNodes.find((n) => n.id === parentId)
      if (!parent) return

      const childCount = currentEdges.filter((e) => e.source === parentId).length
      const isLR = layoutDirRef.current === 'LR'
      const position = isLR
        ? { x: parent.position.x + 520, y: parent.position.y + childCount * 300 }
        : { x: parent.position.x + childCount * 460, y: parent.position.y + 480 }

      const newId = `node-${Date.now()}`
      const newContext = buildContext(parentId, currentNodes, currentEdges)
      const newNode = createNode(newId, 'response', text, position, newContext)

      setNodes((prev) => [...prev, newNode])
      setEdges((prev) => [
        ...prev,
        {
          id: `edge-${parentId}-${newId}`,
          source: parentId,
          target: newId,
          sourceHandle: isLR ? 'right' : 'bottom',
          targetHandle: isLR ? 'left' : 'top',
          type: 'default',
          style: { stroke: 'hsl(25, 45%, 45%)', strokeWidth: 1.5 },
        },
      ])

      streamIntoNode(newId, text, newContext)
    },
    [createNode, setEdges, setNodes, streamIntoNode]
  )

  const handleSeedSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const text = seedInput.trim()
      if (!text) return
      setSeedInput('')
      setShowNewInput(false)

      const currentNodes = nodesRef.current
      const xOffset = currentNodes.length > 0 ? 80 + Math.floor(currentNodes.length / 5) * 600 : 80
      const yOffset = 300 + (currentNodes.length % 5) * 80

      const newId = `node-${Date.now()}`
      const node = createNode(newId, 'seed', text, { x: xOffset, y: yOffset }, [])
      setNodes((prev) => [...prev, node])
      if (nodesRef.current.length === 0) onTitleChange(text)
      streamIntoNode(newId, text, [])
    },
    [seedInput, createNode, setNodes, streamIntoNode]
  )

  const handleCreateNote = () => {
    const NOTE_W = 380
    const NOTE_H = 280
    let cx = 200
    let cy = 300
    const rf = rfInstanceRef.current
    const container = containerRef.current
    if (rf && container) {
      const { x, y, zoom } = rf.getViewport()
      const rect = container.getBoundingClientRect()
      cx = (-x + rect.width / 2) / zoom - NOTE_W / 2
      cy = (-y + rect.height / 2) / zoom - NOTE_H / 2
    }
    const newId = `note-${Date.now()}`
    const noteNode: ResearchNodeType = {
      id: newId,
      type: 'research',
      position: { x: cx, y: cy },
      style: { width: NOTE_W, height: NOTE_H },
      data: {
        nodeType: 'note',
        content: '',
        prompt: '',
        isLoading: false,
        context: [],
        onContinue: () => {},
        onExpand: () => {},
        onDelete: () => handleDeleteNode(newId),
        onDeleteCascade: () => handleDeleteNodeCascade(newId),
        onUpdateNote: (content: string) => handleUpdateNote(newId, content),
      },
    }
    setNodes((prev) => [...prev, attachCallbacks(noteNode)])
  }

  const handleClear = () => {
    setNodes([])
    setEdges([])
    setShowNewInput(false)
    localStorage.removeItem(canvasKey(sessionId))
    setSeedInput('')
    setTimeout(() => seedInputRef.current?.focus(), 50)
  }

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const hasNodes = nodes.length > 0

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => { rfInstanceRef.current = instance }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: 'hsl(0, 0%, 60%)', strokeWidth: 1.5 },
        }}
        style={{ background: 'hsl(0, 0%, 96%)' }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="hsl(0, 0%, 82%)" gap={24} size={1} />
        <Controls
          style={{
            background: 'hsl(0, 0%, 100%)',
            border: '1px solid hsl(0, 0%, 87%)',
            borderRadius: '12px',
          }}
        />
      </ReactFlow>

      {/* Empty state hint */}
      {!hasNodes && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm pointer-events-none"
          style={{ fontFamily: 'var(--font-lora)', color: 'hsl(0, 0%, 60%)', fontStyle: 'italic' }}
        >
          Start a research thread to populate your canvas
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        {/* Input row — when no nodes or new research triggered */}
        {(!hasNodes || showNewInput) && (
          <div className="flex flex-col items-center gap-2">
            <form
              onSubmit={handleSeedSubmit}
              className="flex items-center rounded-2xl overflow-hidden"
              style={{
                background: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(0, 0%, 85%)',
                boxShadow: '0 2px 12px hsla(0, 0%, 0%, 0.08)',
                width: 480,
              }}
            >
              <span className="pl-4 pr-1 text-sm" style={{ color: 'hsl(0, 0%, 60%)' }}>›</span>
              <input
                ref={seedInputRef}
                autoFocus
                className="flex-1 bg-transparent px-2 py-3 text-sm outline-none"
                style={{ color: 'hsl(0, 0%, 12%)' }}
                placeholder="What do you want to research?"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewInput(false); setSeedInput('') } }}
              />
              <button
                type="submit"
                className="shrink-0 w-8 h-8 mr-1 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: 'hsl(0, 0%, 18%)', color: 'white' }}
                disabled={!seedInput.trim()}
              >
                ↑
              </button>
            </form>
            {!hasNodes && (
              <button
                className="text-sm transition-colors"
                style={{ color: 'hsl(0, 0%, 55%)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(38, 55%, 40%)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'hsl(0, 0%, 55%)' }}
                onClick={handleCreateNote}
              >
                + My Note
              </button>
            )}
          </div>
        )}

        {/* Action buttons row — when canvas has nodes */}
        {hasNodes && (
          <div className="flex items-center gap-2">
            {!showNewInput && (
              <button
                className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm transition-colors"
                style={{
                  background: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(0, 0%, 85%)',
                  color: 'hsl(0, 0%, 35%)',
                  boxShadow: '0 2px 8px hsla(0, 0%, 0%, 0.06)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 0%, 93%)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 0%, 100%)' }}
                onClick={() => { setShowNewInput(true); setTimeout(() => seedInputRef.current?.focus(), 50) }}
              >
                + New research
              </button>
            )}
            <button
              className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm transition-colors"
              style={{
                background: 'hsl(48, 80%, 97%)',
                border: '1px solid hsl(48, 55%, 82%)',
                color: 'hsl(38, 55%, 40%)',
                boxShadow: '0 2px 8px hsla(0, 0%, 0%, 0.06)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(48, 75%, 91%)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(48, 80%, 97%)' }}
              onClick={handleCreateNote}
            >
              + Note
            </button>
            <button
              className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm transition-colors"
              style={{
                background: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(0, 0%, 85%)',
                color: 'hsl(0, 0%, 35%)',
                boxShadow: '0 2px 8px hsla(0, 0%, 0%, 0.06)',
              }}
              title={layoutDir === 'LR' ? 'Switch to top-to-bottom layout' : 'Switch to left-to-right layout'}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 0%, 93%)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 0%, 100%)' }}
              onClick={() => setLayoutDir((d) => d === 'LR' ? 'TB' : 'LR')}
            >
              {layoutDir === 'LR' ? '⇄ LR' : '⇅ TB'}
            </button>
            <button
              className="rounded-2xl px-4 py-2.5 text-sm transition-colors"
              style={{
                background: 'hsl(0, 60%, 92%)',
                border: '1px solid hsl(0, 50%, 80%)',
                color: 'hsl(0, 65%, 45%)',
                boxShadow: '0 2px 8px hsla(25, 45%, 12%, 0.08)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 60%, 86%)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(0, 60%, 92%)' }}
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {expandState && (
        <ExpandModal
          prompt={expandState.prompt}
          content={expandState.content}
          onClose={() => setExpandState(null)}
        />
      )}
    </div>
  )
}
