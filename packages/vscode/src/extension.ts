import * as vscode from 'vscode'
import { context_initialization } from './context/context-initialization'
import { ViewProvider } from './view/backend/view-provider'
import { WebSocketManager } from './services/websocket-manager'
import { migrate_remove_copilot_presets } from './migrations/migrate-remove-copilot-presets'
import { migrate_api_tool_settings } from './migrations/migrate-api-tool-settings'
import {
  apply_chat_response_command,
  refactor_command,
  refactor_to_clipboard_command,
  code_completion_commands,
  web_chat_command,
  web_chat_with_command,
  chat_to_clipboard_command,
  close_editor_command,
  close_all_editors_command,
  save_all_command,
  new_file_command,
  open_file_from_workspace_command,
  new_folder_command,
  rename_command,
  delete_command,
  code_completion_in_chat_command,
  code_completion_in_chat_with_command,
  save_context_command,
  revert_command,
  generate_commit_message_command,
  code_completion_to_clipboard_command,
  code_completion_with_suggestions_to_clipboard_command,
  reference_in_chat_command,
  open_settings_command,
  open_url_command
} from './commands'
import { migrate_settings_prefix } from './migrations/migrate-settings-prefix'
import { migrate_keybindings } from './migrations/migrate-keybindings'
import { migrate_api_keys_to_providers } from './migrations/migrate-api-keys-to-providers'
import { migrate_api_tool_configs } from './migrations/migrate-api-tool-configs'

// Store WebSocketServer instance at module level
let websocket_server_instance: WebSocketManager | null = null

export async function activate(context: vscode.ExtensionContext) {
  const { workspace_provider, open_editors_provider, websites_provider } =
    context_initialization(context)

  if (!workspace_provider || !open_editors_provider || !websites_provider) {
    // No workspace opened
    return
  }

  websocket_server_instance = new WebSocketManager(context, websites_provider)

  const migrations = async () => {
    // Remove a few weeks after 4 May 2025
    await migrate_remove_copilot_presets(context)
    // Remove a few weeks after 5 May 2025
    await migrate_api_tool_settings(context)
    // Remove a few weeks after 9 May 2025
    await migrate_settings_prefix(context)
    await migrate_keybindings(context)
    await migrate_api_keys_to_providers(context)
    // Remove a few weeks after 17 May 2025
    await migrate_api_tool_configs(context)
  }

  await migrations()

  // View
  if (workspace_provider && open_editors_provider && websites_provider) {
    const view_provider = new ViewProvider(
      context.extensionUri,
      workspace_provider,
      open_editors_provider,
      websites_provider,
      context,
      websocket_server_instance
    )
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'codeWebChatView',
        view_provider,
        {
          webviewOptions: {
            retainContextWhenHidden: true
          }
        }
      ),
      reference_in_chat_command(view_provider, workspace_provider)
    )
  }

  // Register the custom open file command
  context.subscriptions.push(
    open_file_from_workspace_command(open_editors_provider)
  )

  context.subscriptions.push(
    apply_chat_response_command({
      command: 'codeWebChat.applyChatResponse',
      context
    }),
    apply_chat_response_command({
      command: 'codeWebChat.applyChatResponseFastReplace',
      context,
      mode: 'Fast replace'
    }),
    apply_chat_response_command({
      command: 'codeWebChat.applyChatResponseIntelligentUpdate',
      context,
      mode: 'Intelligent update'
    }),
    refactor_command({
      context,
      file_tree_provider: workspace_provider,
      open_editors_provider: open_editors_provider,
      use_default_model: true
    }),
    refactor_to_clipboard_command(
      context,
      workspace_provider,
      open_editors_provider
    ),
    ...code_completion_commands(
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
    open_url_command({
      command: 'codeWebChat.openDocumentation',
      url: 'https://codeweb.chat/'
    }),
    open_url_command({
      command: 'codeWebChat.openRepository',
      url: 'https://github.com/robertpiosik/CodeWebChat'
    }),
    open_url_command({
      command: 'codeWebChat.openX',
      url: 'https://x.com/CodeWebChat'
    }),
    open_url_command({
      command: 'codeWebChat.openReddit',
      url: 'https://www.reddit.com/r/CodeWebChat/'
    }),
    open_url_command({
      command: 'codeWebChat.rateExtension',
      url: 'https://marketplace.visualstudio.com/items?itemName=robertpiosik.gemini-coder&ssr=false#review-details'
    }),
    open_settings_command()
  )
}
