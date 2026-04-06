import { supabase } from './supabase'

export interface PersistedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tasks?: unknown
  createdAt: string
}

export async function loadChatHistory(limit = 80): Promise<PersistedMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) { console.error('loadChatHistory:', error); return [] }
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    tasks: row.tasks ?? undefined,
    createdAt: row.created_at,
  }))
}

export async function saveChatMessage(
  role: 'user' | 'assistant',
  content: string,
  tasks?: unknown
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    role,
    content,
    tasks: tasks ?? null,
  })
  if (error) console.error('saveChatMessage:', error)
}

export async function loadMemory(): Promise<string> {
  const { data, error } = await supabase
    .from('user_memory')
    .select('content')
    .eq('id', 1)
    .single()
  if (error) return ''
  return data?.content ?? ''
}

export async function saveMemory(content: string): Promise<void> {
  const { error } = await supabase
    .from('user_memory')
    .upsert({ id: 1, content, updated_at: new Date().toISOString() })
  if (error) console.error('saveMemory:', error)
}
