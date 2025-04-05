import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { Main } from './Main/Main'
const vscode = acquireVsCodeApi()

import '@vscode/codicons/dist/codicon.css'
import '@ui/styles/global.scss'

function App() {
  const [providers, set_providers] = useState<any[]>([])
  const [api_key, set_api_key] = useState<string>('')
  const [default_fim_model, set_default_fim_model] = useState<string>('')
  const [default_refactoring_model, set_default_refactoring_model] =
    useState<string>('')
  const [default_apply_changes_model, set_default_apply_changes_model] =
    useState<string>('')
  const [default_commit_message_model, set_default_commit_message_model] =
    useState<string>('')

  useEffect(() => {
    vscode.postMessage({ command: 'get_configuration' })

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message.command == 'configuration') {
        set_providers(message.providers)
        set_api_key(message.api_key)
        set_default_fim_model(message.default_fim_model)
        set_default_refactoring_model(message.default_refactoring_model)
        set_default_apply_changes_model(message.default_apply_changes_model)
        set_default_commit_message_model(message.default_commit_message_model)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handle_api_key_change = (api_key: string) => {
    vscode.postMessage({
      command: 'update_api_key',
      api_key
    })
    set_api_key(api_key)
  }

  const handle_fim_model_change = (model: string) => {
    vscode.postMessage({
      command: 'update_fim_model',
      model
    })
    set_default_fim_model(model)
  }

  const handle_refactoring_model_change = (model: string) => {
    vscode.postMessage({
      command: 'update_refactoring_model',
      model
    })
    set_default_refactoring_model(model)
  }

  const handle_apply_changes_model_change = (model: string) => {
    vscode.postMessage({
      command: 'update_apply_changes_model',
      model
    })
    set_default_apply_changes_model(model)
  }

  const handle_commit_message_model_change = (model: string) => {
    vscode.postMessage({
      command: 'update_commit_message_model',
      model
    })
    set_default_commit_message_model(model)
  }

  const handle_open_providers_settings = () => {
    vscode.postMessage({
      command: 'open_providers_settings'
    })
  }

  return (
    <Main
      providers={providers}
      api_key={api_key}
      default_fim_model={default_fim_model}
      default_refactoring_model={default_refactoring_model}
      default_apply_changes_model={default_apply_changes_model}
      default_commit_message_model={default_commit_message_model}
      on_api_key_change={handle_api_key_change}
      on_fim_model_change={handle_fim_model_change}
      on_refactoring_model_change={handle_refactoring_model_change}
      on_apply_changes_model_change={handle_apply_changes_model_change}
      on_commit_message_model_change={handle_commit_message_model_change}
      open_providers_settings={handle_open_providers_settings}
    />
  )
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(<App />)
