const WebSocket = require('ws')
const http = require('http')
const process = require('process')

const {
  DEFAULT_PORT,
  SECURITY_TOKENS
} = require('../../../shared/src/constants/websocket')

const PORT = DEFAULT_PORT
const SECURITY_TOKEN_BROWSERS = SECURITY_TOKENS.BROWSERS
const SECURITY_TOKEN_VSCODE = SECURITY_TOKENS.VSCODE

const vscode_clients = new Set()
let current_browser_client = null
const connections = new Set()

// Storage for saved websites
let saved_websites = []

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url == '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok'
      })
    )
    return
  }

  res.writeHead(404)
  res.end()
})

// Create WebSocket server
const wss = new WebSocket.WebSocketServer({ server })

// Notify VS Code clients about browser connection status
function notify_vscode_clients() {
  const has_connected_browser = current_browser_client !== null
  const message = JSON.stringify({
    action: 'browser-connection-status',
    has_connected_browsers: has_connected_browser
  })

  vscode_clients.forEach((client) => {
    if (client.readyState == WebSocket.OPEN) {
      client.send(message)
    }
  })
}

// Send saved websites to a client
function send_saved_websites_to_client(client) {
  if (saved_websites.length > 0 && client.readyState == WebSocket.OPEN) {
    client.send(
      JSON.stringify({
        action: 'update-saved-websites',
        websites: saved_websites
      })
    )
  }
}

// Send ping to browser client
function ping_clients() {
  if (
    current_browser_client &&
    current_browser_client.ws.readyState == WebSocket.OPEN
  ) {
    current_browser_client.ws.send(JSON.stringify({ action: 'ping' }))
  }
}

// Start periodic ping
setInterval(ping_clients, 10000) // Every 10 seconds

// Log server start information
console.log(`Starting WebSocket server process (PID: ${process.pid})`)

// Handle WebSocket connections
wss.on('connection', (ws, request) => {
  // Verify security token
  const url = new URL(request.url || '', `http://localhost:${PORT}`)
  const token = url.searchParams.get('token')

  if (token != SECURITY_TOKEN_BROWSERS && token != SECURITY_TOKEN_VSCODE) {
    ws.close(1008, 'Invalid security token')
    return
  }

  // Track if this is a browser connection
  const is_browser_client = token == SECURITY_TOKEN_BROWSERS

  if (is_browser_client) {
    // Extract version from URL parameters
    const version = url.searchParams.get('version') || 'unknown'

    // Check if there is already a connected browser client
    if (
      current_browser_client &&
      current_browser_client.ws.readyState === WebSocket.OPEN
    ) {
      console.log(
        `Rejecting new browser client (version: ${version}) - another browser is already connected`
      )
      ws.close(1000, 'Another browser client is already connected')
      return
    }

    // Store the new browser client
    current_browser_client = { ws, version }
    console.log(`Browser client connected (version: ${version})`)
    notify_vscode_clients() // Notify when a browser connects
  } else {
    vscode_clients.add(ws)
    console.log('VS Code client connected')
    // Send initial status to new VS Code client
    ws.send(
      JSON.stringify({
        action: 'browser-connection-status',
        has_connected_browsers: current_browser_client !== null
      })
    )
    
    // Send saved websites to new VS Code client
    send_saved_websites_to_client(ws)
  }

  connections.add(ws)

  // Handle messages from clients
  ws.on('message', (message) => {
    try {
      const msg_string = message.toString()

      // Handle ping message specially
      if (msg_string == 'ping') {
        // Just keep the connection alive, no response needed
        return
      }

      const msg_data = JSON.parse(msg_string)

      // Handle different message types
      if (msg_data.action == 'initialize-chats') {
        connections.forEach((client) => {
          if (client !== ws && client.readyState == WebSocket.OPEN) {
            client.send(msg_string)
          }
        })
      }
      else if (msg_data.action == 'update-saved-websites') {
        // Store the updated websites
        saved_websites = msg_data.websites
        console.log(`Received ${saved_websites.length} saved websites`)
        
        // Forward to VS Code clients
        vscode_clients.forEach((client) => {
          if (client.readyState == WebSocket.OPEN) {
            client.send(msg_string)
          }
        })
      }
    } catch (error) {
      console.error('Error processing message:', error)
    }
  })

  // Handle client disconnection
  ws.on('close', () => {
    if (
      is_browser_client &&
      current_browser_client &&
      current_browser_client.ws === ws
    ) {
      const version = current_browser_client.version
      current_browser_client = null
      console.log(`Browser client disconnected (version: ${version})`)
      notify_vscode_clients() // Notify when the browser disconnects
    } else if (!is_browser_client) {
      vscode_clients.delete(ws)
      console.log('VS Code client disconnected')
    }
    connections.delete(ws)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
    if (
      is_browser_client &&
      current_browser_client &&
      current_browser_client.ws === ws
    ) {
      const version = current_browser_client.version
      current_browser_client = null
      console.log(`Browser client error disconnect (version: ${version})`)
      notify_vscode_clients() // Notify when the browser disconnects due to error
    } else if (!is_browser_client) {
      vscode_clients.delete(ws)
    }
    connections.delete(ws)
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`WebSocket server is running on ws://localhost:${PORT}`)
})

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  shutdown()
})

process.on('SIGTERM', () => {
  shutdown()
})

function shutdown() {
  console.log('Shutting down WebSocket server...')

  // Close all connections
  connections.forEach((ws) => {
    ws.close()
  })
  connections.clear()
  vscode_clients.clear()
  current_browser_client = null
  saved_websites = []

  // Close server
  wss.close()
  server.close(() => {
    console.log('WebSocket server stopped')
    process.exit(0)
  })
}