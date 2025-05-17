import * as vscode from 'vscode'
import axios from 'axios'
import { make_api_request } from '../helpers/make-api-request'
import { cleanup_api_response } from '../helpers/cleanup-api-response'
import { FilesCollector } from '../helpers/files-collector'
import {
  LAST_APPLIED_CHANGES_STATE_KEY,
  TEMP_REFACTORING_INSTRUCTION_STATE_KEY
} from '../constants/state-keys'
import { Logger } from '../helpers/logger'
import { ApiProvidersManager } from '../services/api-providers-manager'
import { get_refactoring_instruction } from '@/constants/instructions'
import { PROVIDERS } from '@shared/constants/providers'

export function refactor_command(params: {
  context: vscode.ExtensionContext
  file_tree_provider: any
  open_editors_provider?: any
  use_default_model?: boolean
}) {
  const api_providers_manager = new ApiProvidersManager(params.context)

  return vscode.commands.registerCommand('codeWebChat.refactor', async () => {
    const editor = vscode.window.activeTextEditor

    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.')
      return
    }

    let instruction = params.context.workspaceState.get<string>(
      TEMP_REFACTORING_INSTRUCTION_STATE_KEY
    )

    // If no instruction in workspace state (direct command invocation), prompt for one
    if (!instruction) {
      const last_instruction = params.context.globalState.get<string>(
        'lastRefactoringInstruction',
        ''
      )

      instruction = await vscode.window.showInputBox({
        prompt: 'Enter refactoring instructions',
        placeHolder: 'e.g., "Refactor this code to use async/await"',
        value: last_instruction,
        validateInput: (value) => {
          params.context.globalState.update('lastRefactoringInstruction', value)
          return null
        }
      })

      if (!instruction) {
        return // User cancelled the instruction input
      }
    } else {
      // Clear the temporary instruction immediately after getting it
      await params.context.workspaceState.update(
        TEMP_REFACTORING_INSTRUCTION_STATE_KEY,
        undefined
      )
    }

    const document = editor.document
    const document_path = document.uri.fsPath
    const document_text = document.getText()

    // Store original content for potential reversion
    const original_content = document_text

    // Get the relative path of the file in the workspace
    const file_path = vscode.workspace.asRelativePath(document.uri)

    // Determine which workspace this file belongs to (for multi-root workspaces)
    let workspace_name: string | undefined = undefined
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 1
    ) {
      // Find the workspace folder that contains this file
      const workspace_folder = vscode.workspace.getWorkspaceFolder(document.uri)
      if (workspace_folder) {
        workspace_name = workspace_folder.name
      }
    }

    const refactoring_settings =
      api_providers_manager.get_file_refactoring_tool_config()

    if (!refactoring_settings) {
      vscode.window.showErrorMessage(
        'File Refactoring tool is not configured. Go to Code Web Chat panel -> Settings tab.'
      )
      Logger.warn({
        function_name: 'refactor_command',
        message: 'File Refactoring tool is not configured.'
      })
      return
    }

    const provider = api_providers_manager.get_provider(
      refactoring_settings.provider_name
    )

    if (!provider) {
      vscode.window.showErrorMessage(
        'API provider not found for File Refactoring tool. Go to Code Web Chat panel -> Settings tab.'
      )
      Logger.warn({
        function_name: 'refactor_command',
        message: 'API provider not found for File Refactoring tool.'
      })
      return
    }

    if (!provider.api_key) {
      vscode.window.showErrorMessage(
        'API key is missing. Please add it in the settings.'
      )
      return
    }

    // Create files collector with both providers
    const files_collector = new FilesCollector(
      params.file_tree_provider,
      params.open_editors_provider
    )

    const collected_files = await files_collector.collect_files({
      exclude_path: document_path
    })

    const current_file_path = vscode.workspace.asRelativePath(document.uri)
    const selection = editor.selection
    const selected_text = editor.document.getText(selection)
    let refactoring_instruction = get_refactoring_instruction(file_path)
    if (selected_text) {
      refactoring_instruction += ` Regarding the following snippet \`\`\`${selected_text}\`\`\` ${instruction}`
    } else {
      refactoring_instruction += ` ${instruction}`
    }

    const files = `<files>${collected_files}\n<file path="${current_file_path}"><![CDATA[${document_text}]]></file>\n</files>`
    const content = `${refactoring_instruction}\n${files}\n${refactoring_instruction}`

    const messages = [
      {
        role: 'user',
        content
      }
    ]

    const body = {
      messages,
      model: refactoring_settings.model,
      temperature: refactoring_settings.temperature
    }

    Logger.log({
      function_name: 'refactor_command',
      message: 'Refactor Prompt:',
      data: content
    })

    const cancel_token_source = axios.CancelToken.source()

    // Track total length and received length for progress
    const total_length = document_text.length

    // Variables to hold processing results outside the progress scope
    let result_content = ''
    let success = false

    let endpoint_url = ''
    if (provider.type == 'built-in') {
      const provider_info = PROVIDERS[provider.name]
      endpoint_url = provider_info.base_url
    } else {
      endpoint_url = provider.base_url
    }

    await vscode.window
      .withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Updating file...',
          cancellable: true
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            cancel_token_source.cancel('Cancelled by user.')
          })

          try {
            const refactored_content = await make_api_request(
              endpoint_url,
              provider.api_key,
              body,
              cancel_token_source.token,
              (chunk: string) => {
                progress.report({
                  increment: (chunk.length / total_length) * 100
                })
              }
            )

            if (refactored_content) {
              result_content = cleanup_api_response({
                content: refactored_content
              })
            }
            success = true
            return true
          } catch (error) {
            if (axios.isCancel(error)) return false
            Logger.error({
              function_name: 'refactor_command',
              message: 'Refactoring error',
              data: error
            })
            vscode.window.showErrorMessage(
              'An error occurred during refactoring. See console for details.'
            )
            return false
          }
        }
      )
      .then(async () => {
        // Only proceed if we have successful results
        if (success && result_content) {
          const full_range = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document_text.length)
          )
          await editor.edit((edit_builder) => {
            edit_builder.replace(full_range, result_content)
          })

          await vscode.commands.executeCommand(
            'editor.action.formatDocument',
            document.uri
          )
          await document.save()

          // Store original file state for potential reversion using the revert command
          // Include workspace_name for multi-root workspace support
          await params.context.workspaceState.update(
            LAST_APPLIED_CHANGES_STATE_KEY,
            [
              {
                file_path: file_path,
                content: original_content,
                is_new: false,
                workspace_name
              }
            ]
          )

          // Show success message with Revert option
          const response = await vscode.window.showInformationMessage(
            'File has been refactored.',
            'Revert'
          )

          // Handle revert action if selected
          if (response == 'Revert') {
            await editor.edit((editBuilder) => {
              const full_range = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
              )
              editBuilder.replace(full_range, original_content)
            })
            await document.save()
            vscode.window.showInformationMessage(
              'Refactoring has been reverted.'
            )
            // Clear the saved state since we've reverted
            await params.context.workspaceState.update(
              LAST_APPLIED_CHANGES_STATE_KEY,
              null
            )
          }
        }
      })
  })
}
