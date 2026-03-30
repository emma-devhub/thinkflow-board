export interface SessionMeta {
  id: string
  title: string
  createdAt: number
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
