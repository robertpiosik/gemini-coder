type Chat = {
  url: string
  model?: string
  temperature?: number
  system_instructions?: string
}

export type InitializeChatsMessage = {
  action: 'initialize-chats'
  open_in_background: boolean
  text: string
  chats: Chat[]
}

export type Website = {
  url: string
  title: string
  content: string
  favicon?: string
}

export type UpdateSavedWebsitesMessage = {
  action: 'update-saved-websites'
  websites: Array<Website>
}

export type BrowserConnectionStatusMessage = {
  action: 'browser-connection-status'
  has_connected_browsers: boolean
}

export type WebSocketMessage =
  | InitializeChatsMessage
  | UpdateSavedWebsitesMessage
  | BrowserConnectionStatusMessage
