import * as vscode from 'vscode'
import { context_initialization } from './context/context-initialization'
import { apply_changes_command } from './commands/apply-changes-command/apply-changes-command'
import {
  code_completion_command,
  code_completion_with_command,
  code_completion_with_suggestions_command,
  code_completion_with_suggestions_with_command
} from './commands/code-completion-commands'
import { ChatViewProvider } from './chat-view/chat-view-provider'
import {
  web_chat_command,
  web_chat_with_command
} from './commands/web-chat-commands'
import { chat_to_clipboard_command } from './commands/chat-to-clipboard-command'
import { create_apply_changes_status_bar_item } from './status-bar/create-apply-changes-status-bar-item'
import { create_refactor_status_bar_item } from './status-bar/create-refactor-status-bar-item'
import { refactor_command } from './commands/refactor-command'
import { refactor_to_clipboard_command } from './commands/refactor-to-clipboard-command'
import { WebSocketManager } from './services/websocket-manager'
import { ApiViewProvider } from './api-view/api-view-provider'
import { change_default_model_command } from './commands/change-default-model-command'
import { close_editor_command } from './commands/close-editor-command'
import { close_all_editors_command } from './commands/close-all-editors-command'
import { save_all_command } from './commands/save-all-command'
import { new_file_command } from './commands/new-file-command'
import { open_file_from_workspace_command } from './commands/open-file-from-workspace-command'
import { new_folder_command } from './commands/new-folder-command'
import { rename_command } from './commands/rename-command'
import { delete_command } from './commands/delete-command'
import {
  code_completion_in_chat_command,
  code_completion_in_chat_with_command
} from './commands/code-in-chat-commands'
import { save_context_command } from './commands/save-context-command'
import { revert_command } from './commands/revert-command'
import { migrate_saved_contexts } from './migrations/migrate-saved-contexts'
import { generate_commit_message_command } from './commands/generate-commit-message-command'
import {
  code_completion_to_clipboard_command,
  code_completion_with_suggestions_to_clipboard_command
} from './commands/code-completion-to-clipboard-commands'
import { migrate_provider_settings } from './migrations/migrate-provider-settings'
import { migrate_keybindings } from './migrations/migrate-keybindings'

// Store WebSocketServer instance at module level
let websocket_server_instance: WebSocketManager | null = null

export async function activate(context: vscode.ExtensionContext) {
  websocket_server_instance = new WebSocketManager(context)

  const { workspace_provider, open_editors_provider, websites_provider } =
    context_initialization(context)

  const migrations = async () => {
    // Migrate saved contexts from file-based to workspace state storage
    // Delete a few weeks after 3 Apr 2025
    await migrate_saved_contexts(context)

    // Migrate provider settings from bearerToken to apiKey
    // Delete a few weeks after 8 Apr 2025
    await migrate_provider_settings()

    // Migrate keybindings from old commands to new ones
    // Delete a few weeks after 10 Apr 2025
    await migrate_keybindings()
  }

  await migrations()

  // Connect WebSocketManager with WebsitesProvider
  if (websocket_server_instance && websites_provider) {
    websocket_server_instance.set_websites_provider(websites_provider)
  }

  // Status bar
  create_refactor_status_bar_item(context)
  create_apply_changes_status_bar_item(context)

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
        chat_view_provider,
        {
          webviewOptions: {
            retainContextWhenHidden: true
          }
        }
      )
    )
  }

  // API View
  const api_view_provider = new ApiViewProvider(context.extensionUri, context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'geminiCoderViewApi',
      api_view_provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
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
    apply_changes_command({
      command: 'geminiCoder.applyChangesFastReplace',
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      context,
      use_default_model: true,
      mode: 'Fast replace'
    }),
    apply_changes_command({
      command: 'geminiCoder.applyChangesIntelligentUpdate',
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      context,
      use_default_model: true,
      mode: 'Intelligent update'
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
    code_completion_with_command(
      workspace_provider,
      open_editors_provider,
      context
    ),
    code_completion_command(workspace_provider, open_editors_provider, context),
    code_completion_with_suggestions_command(
      workspace_provider,
      open_editors_provider,
      context
    ),
    code_completion_with_suggestions_with_command(
      workspace_provider,
      open_editors_provider,
      context
    ),
    code_completion_to_clipboard_command(
      workspace_provider,
      open_editors_provider
    ),
    code_completion_with_suggestions_to_clipboard_command(
      workspace_provider,
      open_editors_provider
    ),
    code_completion_in_chat_command(
      context,
      workspace_provider,
      open_editors_provider,
      websocket_server_instance
    ),
    code_completion_in_chat_with_command(
      context,
      workspace_provider,
      open_editors_provider,
      websocket_server_instance
    ),
    change_default_model_command('fim', context),
    change_default_model_command('refactoring', context),
    change_default_model_command('apply_changes', context),
    change_default_model_command('commit_message', context),
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
    new_file_command(),
    new_folder_command(),
    rename_command(),
    delete_command(),
    save_context_command(workspace_provider, context),
    revert_command(context),
    generate_commit_message_command(context),
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
