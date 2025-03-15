import { connect_websocket } from './websocket'
import { setup_keep_alive } from './keep-alive'
import { setup_message_listeners } from './message-handler'

// Initialize extension
function init() {
  // Connect to WebSocket
  connect_websocket()

  // Setup keep-alive for service worker
  setup_keep_alive()

  // Setup message listeners
  setup_message_listeners()
}

init()
