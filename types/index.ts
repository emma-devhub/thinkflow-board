export interface Project {
  id: string
  title: string
  color: string
  createdAt: number
}

export type TaskStatus = 'todo' | 'inprogress' | 'done'

export interface SessionMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  projectId?: string
  status: TaskStatus
  columnId?: string
  checked?: boolean
}

export interface ConversationMessage {
  role: 'user' | 'model'
  content: string
}

export interface NodeData extends Record<string, unknown> {
  nodeType: 'seed' | 'response' | 'note'
  content: string
  prompt: string
  isLoading: boolean
  context: ConversationMessage[]
  onContinue: (text: string, context: ConversationMessage[]) => void
  onExpand: (content: string, prompt: string) => void
  onDelete: () => void
  onDeleteCascade: () => void
  onUpdateNote: (content: string) => void
}
