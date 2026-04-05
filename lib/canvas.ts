import type { Edge } from '@xyflow/react'
import type { ResearchNodeType } from '@/components/ResearchNode'
import { supabase } from '@/lib/supabase'

export interface CanvasState {
  nodes: ResearchNodeType[]
  edges: Edge[]
  layoutDir: 'LR' | 'TB'
}

export async function loadCanvas(sessionId: string): Promise<CanvasState | null> {
  const { data, error } = await supabase
    .from('canvas_states')
    .select('nodes, edges, layout_dir')
    .eq('session_id', sessionId)
    .single()
  if (error) {
    if (error.code !== 'PGRST116') console.error('loadCanvas:', error) // PGRST116 = row not found
    return null
  }
  if (!data) return null
  return {
    nodes: (data.nodes as ResearchNodeType[]) ?? [],
    edges: (data.edges as Edge[]) ?? [],
    layoutDir: (data.layout_dir === 'TB' ? 'TB' : 'LR') as 'LR' | 'TB',
  }
}

export async function saveCanvas(
  sessionId: string,
  // Nodes are serialised without callbacks — use unknown[] to allow stripped variants
  nodes: unknown[],
  edges: Edge[],
  layoutDir: 'LR' | 'TB'
): Promise<void> {
  const { error } = await supabase.from('canvas_states').upsert(
    {
      session_id: sessionId,
      nodes: nodes,
      edges: edges,
      layout_dir: layoutDir,
      updated_at: Date.now(),
    },
    { onConflict: 'session_id' }
  )
  if (error) console.error('saveCanvas:', error)
}

export async function clearCanvas(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('canvas_states')
    .delete()
    .eq('session_id', sessionId)
  if (error) console.error('clearCanvas:', error)
}
