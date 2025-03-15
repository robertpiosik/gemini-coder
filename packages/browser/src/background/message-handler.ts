import {
  WebSocketMessage,
  InitializeChatsMessage
} from '@shared/types/websocket-message'
import browser from 'webextension-polyfill'
import { send_saved_websites } from './websocket'
import { is_message } from '@/utils/is-message'

/**
 * Handle different types of incoming WebSocket messages
 */
export function handle_messages(message: WebSocketMessage) {
  if (message.action == 'initialize-chats') {
    handle_initialize_chats_message(message as InitializeChatsMessage)
  }
  // Add handlers for other message types as needed
}

/**
 * Handle initializing chats from VS Code
 */
async function handle_initialize_chats_message(
  message: InitializeChatsMessage
) {
  // Store the prompt in extension storage for content script to access
  await browser.storage.local.set({ message })

  if (message.chats && message.chats.length > 0) {
    for (const chat of message.chats) {
      browser.tabs.create({
        url: `${chat.url}#gemini-coder`,
        active: true
      })
    }
  }
}

/**
 * Set up message listeners for extension
 */
export function setup_message_listeners() {
  browser.runtime.onMessage.addListener((message, _, sendResponse): any => {
    if (
      is_message(message) &&
      message.action == 'update-saved-websites' &&
      message.websites
    ) {
      send_saved_websites(message.websites)
    }
  })
}
