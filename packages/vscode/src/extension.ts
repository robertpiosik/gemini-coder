import * as vscode from 'vscode'
import { context_initialization } from './context/context-initialization'
import { apply_changes_command } from './commands/apply-changes-command'
import { fim_completion_command } from './commands/fim-completion-command'
import { fim_completion_to_clipboard_command } from './commands/fim-completion-to-clipboard-command'
import { ChatViewProvider } from './chat-view/chat-view-provider'
import {
  web_chat_command,
  web_chat_with_command
} from './commands/web-chat-command'
import { apply_changes_to_clipboard_command } from './commands/apply-changes-to-clipboard-command'
import { chat_to_clipboard_command } from './commands/chat-to-clipboard-command'
import { create_apply_changes_status_bar_item } from './status-bar/create-apply-changes-status-bar-item'
import { create_refactor_status_bar_item } from './status-bar/create-refactor-status-bar-item'
import { refactor_command } from './commands/refactor-command'
import { refactor_to_clipboard_command } from './commands/refactor-to-clipboard-command'
import { WebSocketManager } from './services/websocket-manager'
import { create_fim_status_bar_item } from './status-bar/create-fim-status-bar-item'
import { ApiViewProvider } from './api-view/api-view-provider'
import { change_default_model_command } from './commands/change-default-model-command'
import { close_editor_command } from './commands/close-editor-command'
import { close_all_editors_command } from './commands/close-all-editors-command'
import { save_all_command } from './commands/save-all-command'
import { create_file_command } from './commands/create-file-command'
import { open_file_from_workspace_command } from './commands/open-file-from-workspace-command'
import { create_folder_command } from './commands/create-folder-command'

// Store WebSocketServer instance at module level
let websocket_server_instance: WebSocketManager | null = null

export function activate(context: vscode.ExtensionContext) {
  websocket_server_instance = new WebSocketManager(context)

  const { workspace_provider, open_editors_provider, websites_provider } =
    context_initialization(context)

  // Connect WebSocketManager with WebsitesProvider
  if (websocket_server_instance && websites_provider) {
    websocket_server_instance.set_websites_provider(websites_provider)
  }

  // Status bar
  create_refactor_status_bar_item(context)
  create_apply_changes_status_bar_item(context)
  create_fim_status_bar_item(context)

  // Chat View
  if (workspace_provider && open_editors_provider && websites_provider) {
    const chat_view_provider = new ChatViewProvider(
      context.extensionUri,
      workspace_provider,
      open_editors_provider,
      websites_provider,
      context,
      websocket_server_instance
    )
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'geminiCoderViewChat',
        chat_view_provider
      )
    )
  }

  // API View
  const api_view_provider = new ApiViewProvider(context.extensionUri, context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'geminiCoderViewApi',
      api_view_provider
    )
  )

  // Register the custom open file command
  context.subscriptions.push(
    open_file_from_workspace_command(open_editors_provider)
  )

  context.subscriptions.push(
    apply_changes_command({
      command: 'geminiCoder.applyChanges',
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      context,
      use_default_model: true
    }),
    apply_changes_command({
      command: 'geminiCoder.applyChangesWith',
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      context
    }),
    refactor_command({
      command: 'geminiCoder.refactor',
      context,
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      use_default_model: true
    }),
    refactor_command({
      command: 'geminiCoder.refactorWith',
      context,
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider
    }),
    refactor_to_clipboard_command(
      context,
      workspace_provider,
      open_editors_provider
    ),
    fim_completion_command({
      command: 'geminiCoder.fimCompletionWith',
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      context
    }),
    fim_completion_command({
      command: 'geminiCoder.fimCompletion',
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      context,
      use_default_model: true
    }),
    fim_completion_to_clipboard_command(
      workspace_provider,
      open_editors_provider
    ),
    change_default_model_command('fim', context),
    change_default_model_command('refactoring', context),
    change_default_model_command('apply_changes', context),
    apply_changes_to_clipboard_command(
      workspace_provider,
      open_editors_provider
    ),
    web_chat_command(
      context,
      workspace_provider,
      open_editors_provider,
      websocket_server_instance
    ),
    web_chat_with_command(
      context,
      workspace_provider,
      open_editors_provider,
      websocket_server_instance
    ),
    chat_to_clipboard_command(
      context,
      workspace_provider,
      open_editors_provider
    ),
    close_editor_command(),
    close_all_editors_command(),
    save_all_command(),
    create_file_command(),
    create_folder_command(),
    {
      dispose: () => {
        if (websocket_server_instance) {
          websocket_server_instance.dispose()
          websocket_server_instance = null
        }
      }
    }
  )
}

export function deactivate() {
  if (websocket_server_instance) {
    websocket_server_instance.dispose()
    websocket_server_instance = null
  }
}
