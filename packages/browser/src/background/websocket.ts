import { WebSocketMessage } from '@shared/types/websocket-message'
import { handle_messages } from './message-handler'
import { CONFIG } from './config'
import { DEFAULT_PORT, SECURITY_TOKENS } from '@shared/constants/websocket'
import browser from 'webextension-polyfill'
import type { Website } from '@ui/components/browser/SavedWebsites'
import localforage from 'localforage'

// Store WebSocket instance and connection state
let websocket: WebSocket | null = null
let is_reconnecting = false

/**
 * Check if the server is healthy before attempting connection
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${DEFAULT_PORT}/health`)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Connect to WebSocket server with reconnection logic
 */
export async function connect_websocket() {
  // Prevent concurrent reconnection attempts
  if (is_reconnecting || websocket?.readyState === WebSocket.OPEN) {
    return
  }

  is_reconnecting = true

  try {
    // Check server health before attempting WebSocket connection
    const isHealthy = await checkServerHealth()
    if (!isHealthy) {
      console.debug('Server health check failed, retrying in 5 seconds...')
      setTimeout(() => {
        is_reconnecting = false
        connect_websocket()
      }, CONFIG.RECONNECT_DELAY)
      return
    }

    // Get manifest data for version
    const manifest = browser.runtime.getManifest()
    const version = manifest.version

    websocket = new WebSocket(
      `ws://localhost:${DEFAULT_PORT}?token=${SECURITY_TOKENS.BROWSERS}&version=${version}`
    )

    websocket.onopen = () => {
      console.log('Connected with the VS Code!')
      is_reconnecting = false

      // Send any saved websites immediately after connection is established
      send_current_saved_websites()
    }

    websocket.onmessage = async (event) => {
      const message = JSON.parse(event.data) as WebSocketMessage
      console.debug(message)
      handle_messages(message)
    }

    websocket.onclose = () => {
      console.log('Disconnected from VS Code, attempting to reconnect...')
      websocket = null
      is_reconnecting = false
      setTimeout(connect_websocket, CONFIG.RECONNECT_DELAY)
    }

    websocket.onerror = () => {
      is_reconnecting = false
      websocket = null
    }
  } catch (error) {
    is_reconnecting = false
    setTimeout(connect_websocket, CONFIG.RECONNECT_DELAY)
  }
}

/**
 * Send saved websites to the WebSocket server
 */
export function send_saved_websites(websites: Website[]) {
  if (websocket?.readyState === WebSocket.OPEN) {
    const websitesToSend = websites.map((site) => ({
      url: site.url,
      title: site.title,
      content: site.content,
      favicon: site.favicon
    }))

    const message = {
      action: 'update-saved-websites',
      websites: websitesToSend
    }

    console.log(message)
    websocket.send(JSON.stringify(message))
    return true
  }
  return false
}

/**
 * Retrieve and send current saved websites
 */
async function send_current_saved_websites() {
  try {
    // Create a localforage instance with the same config as in use-websites-store.ts
    const websites_store = localforage.createInstance({
      name: 'gemini-coder-connector',
      storeName: 'websites'
    })

    const websites: Website[] = []

    await websites_store.iterate<any, void>((value) => {
      websites.push({
        url: value.url,
        title: value.title,
        content: value.content,
        favicon: value.favicon
      })
    })

    if (websites.length > 0) {
      send_saved_websites(websites)
    }
  } catch (error) {
    console.error('Error sending saved websites after connection:', error)
  }
}
