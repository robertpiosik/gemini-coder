import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { Main } from './Main'
import { Presets as UiPresets } from '@ui/components/Presets'
const vscode = acquireVsCodeApi()

import '@vscode/codicons/dist/codicon.css'
import '@ui/styles/styles.css'

function App() {
  const [initial_prompt, set_initial_prompt] = useState<string>()
  const [is_connected, set_is_connected] = useState<boolean>()
  const [presets, set_presets] = useState<UiPresets.Preset[]>()
  const [selected_presets, set_selected_presets] = useState<string[]>([])
  const [expanded_presets, set_expanded_presets] = useState<number[]>([])

  useEffect(() => {
    vscode.postMessage({ command: 'getLastPrompt' })
    vscode.postMessage({ command: 'getConnectionStatus' })
    vscode.postMessage({ command: 'getPresets' })
    vscode.postMessage({ command: 'getSelectedPresets' })
    vscode.postMessage({ command: 'getExpandedPresets' })

    const handle_message = (event: MessageEvent) => {
      const message = event.data
      switch (message.command) {
        case 'initialPrompt':
          set_initial_prompt(message.instruction)
          break
        case 'connectionStatus':
          set_is_connected(message.connected)
          break
        case 'presets':
          set_presets(message.presets)
          break
        case 'selectedPresets':
          set_selected_presets(message.names)
          break
        case 'selectedPresetsFromPicker':
          set_selected_presets(message.names)
          break
        case 'expandedPresets':
          set_expanded_presets(message.indices)
          break
      }
    }

    window.addEventListener('message', handle_message)
    return () => window.removeEventListener('message', handle_message)
  }, [])

  const handle_initialize_chats = (params: {
    instruction: string
    preset_names: string[]
  }) => {
    vscode.postMessage({
      command: 'sendPrompt',
      instruction: params.instruction,
      preset_names: params.preset_names
    })
  }

  const handle_show_preset_picker = (
    instruction: string
  ): Promise<string[]> => {
    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data
        if (message.command == 'presetsSelectedFromPicker') {
          window.removeEventListener('message', messageHandler)
          resolve(message.names)
        }
      }
      window.addEventListener('message', messageHandler)

      vscode.postMessage({
        command: 'showPresetPicker',
        instruction
      })
    })
  }

  const handle_copy_to_clipboard = (instruction: string) => {
    vscode.postMessage({
      command: 'copyPrompt',
      instruction
    })
  }

  const handle_instruction_change = (instruction: string) => {
    vscode.postMessage({
      command: 'saveChatInstruction',
      instruction
    })
  }

  const handle_presets_selection_change = (selected_names: string[]) => {
    vscode.postMessage({
      command: 'saveSelectedPresets',
      names: selected_names
    })
    set_selected_presets(selected_names)
  }

  const handle_expanded_presets_change = (expanded_indices: number[]) => {
    vscode.postMessage({
      command: 'saveExpandedPresets',
      indices: expanded_indices
    })
    set_expanded_presets(expanded_indices)
  }

  const handle_open_settings = () => {
    vscode.postMessage({
      command: 'openSettings'
    })
  }

  if (
    initial_prompt === undefined ||
    is_connected === undefined ||
    presets === undefined
  ) {
    return null
  }

  return (
    <Main
      initial_instruction={initial_prompt}
      initialize_chats={handle_initialize_chats}
      show_preset_picker={handle_show_preset_picker}
      copy_to_clipboard={handle_copy_to_clipboard}
      on_instruction_change={handle_instruction_change}
      is_connected={is_connected}
      presets={presets}
      selected_presets={selected_presets}
      expanded_presets={expanded_presets}
      on_selected_presets_change={handle_presets_selection_change}
      on_expanded_presets_change={handle_expanded_presets_change}
      open_settings={handle_open_settings}
    />
  )
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(<App />)
