import * as vscode from 'vscode'
import * as fs from 'fs'
import {
  parse_clipboard_content,
  ClipboardFile
} from './utils/clipboard-parser'
import { LAST_APPLIED_CHANGES_STATE_KEY } from '../../constants/state-keys'
import { Logger } from '../../helpers/logger'
import { OriginalFileState } from '../../types/common'
import { revert_files } from './utils/file-operations'
import { handle_fast_replace } from './handlers/fast-replace-handler'
import { handle_intelligent_update } from './handlers/intelligent-update-handler'
import { create_safe_path } from '@/utils/path-sanitizer'
import { check_for_truncated_fragments } from '@/utils/check-for-truncated-fragments'
import { ApiProvidersManager } from '@/services/api-providers-manager'
import { apply_git_patch, DiffPatch } from './utils/patch-handler'
import { PROVIDERS } from '@shared/constants/providers'

async function check_if_all_files_new(
  files: ClipboardFile[]
): Promise<boolean> {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length == 0
  ) {
    return false
  }

  // Create a map of workspace names to their root paths
  const workspace_map = new Map<string, string>()
  vscode.workspace.workspaceFolders.forEach((folder) => {
    workspace_map.set(folder.name, folder.uri.fsPath)
  })

  // Default workspace is the first one
  const default_workspace = vscode.workspace.workspaceFolders[0].uri.fsPath

  for (const file of files) {
    // Determine the correct workspace root for this file
    let workspace_root = default_workspace
    if (file.workspace_name && workspace_map.has(file.workspace_name)) {
      workspace_root = workspace_map.get(file.workspace_name)!
    }

    // Create safe path using the correct workspace root
    const safe_path = create_safe_path(workspace_root, file.file_path)

    if (safe_path && fs.existsSync(safe_path)) {
      return false // At least one file exists
    }
  }

  return true // All files are new
}

export function apply_chat_response_command(params: {
  command: string
  context: vscode.ExtensionContext
  mode?: 'Fast replace' | 'Intelligent update'
}) {
  return vscode.commands.registerCommand(params.command, async () => {
    Logger.log({
      function_name: 'apply_chat_response_command',
      message: 'start',
      data: { command: params.command, mode: params.mode }
    })

    const clipboard_text = await vscode.env.clipboard.readText()

    if (!clipboard_text) {
      vscode.window.showErrorMessage('Clipboard is empty.')
      Logger.warn({
        function_name: 'apply_chat_response_command',
        message: 'Clipboard is empty.'
      })
      return
    }

    // Check if workspace has only one root folder
    const is_single_root_folder_workspace =
      vscode.workspace.workspaceFolders?.length == 1

    // Parse clipboard content which can now contain either files or patches
    const clipboard_content = await parse_clipboard_content(
      clipboard_text,
      is_single_root_folder_workspace
    )

    // Handle patches if found
    if (clipboard_content.type == 'patches' && clipboard_content.patches) {
      if (!vscode.workspace.workspaceFolders?.length) {
        vscode.window.showErrorMessage('No workspace folder open.')
        return
      }

      // Create a map of workspace names to their root paths
      const workspace_map = new Map<string, string>()
      vscode.workspace.workspaceFolders.forEach((folder) => {
        workspace_map.set(folder.name, folder.uri.fsPath)
      })

      const default_workspace = vscode.workspace.workspaceFolders[0].uri.fsPath
      let success_count = 0
      let failure_count = 0
      let all_original_states: OriginalFileState[] = []
      const failed_patches: DiffPatch[] = []

      // Process patches
      const total_patches = clipboard_content.patches.length

      for (let i = 0; i < total_patches; i++) {
        const patch = clipboard_content.patches[i]
        let workspace_path = default_workspace

        if (patch.workspace_name && workspace_map.has(patch.workspace_name)) {
          workspace_path = workspace_map.get(patch.workspace_name)!
        }

        const result = await apply_git_patch(patch.content, workspace_path)

        if (result.success) {
          success_count++
          if (result.original_states) {
            all_original_states = all_original_states.concat(
              result.original_states
            )
          }
        } else {
          failure_count++
          failed_patches.push(patch)
        }
      }

      // Store all original states for potential reversion
      if (all_original_states.length > 0) {
        params.context.workspaceState.update(
          LAST_APPLIED_CHANGES_STATE_KEY,
          all_original_states
        )
      }

      // Handle results
      if (failure_count > 0) {
        const response = await vscode.window.showWarningMessage(
          success_count > 0
            ? `Applied ${success_count} patch${
                success_count != 1 ? 'es' : ''
              } successfully, but ${failure_count} patch${
                failure_count != 1 ? 'es' : ''
              } failed.`
            : `Failed to apply ${failure_count} patch${
                failure_count != 1 ? 'es' : ''
              }.`,
          'Use intelligent update',
          ...(success_count > 0 ? ['Revert'] : [])
        )

        if (response == 'Revert' && all_original_states.length > 0) {
          await revert_files(all_original_states)
          params.context.workspaceState.update(
            LAST_APPLIED_CHANGES_STATE_KEY,
            null
          )
        } else if (response == 'Use intelligent update') {
          const api_providers_manager = new ApiProvidersManager(params.context)
          const file_refactoring_settings =
            api_providers_manager.get_file_refactoring_tool_config()

          if (!file_refactoring_settings) {
            vscode.window.showErrorMessage(
              'API provider or model is not configured for Intelligent update.'
            )
            return
          }

          const provider = api_providers_manager.get_provider(
            file_refactoring_settings.provider_name
          )

          if (!provider) {
            vscode.window.showErrorMessage(
              'API provider not found for Intelligent update.'
            )
            return
          }

          let endpoint_url = ''
          if (provider.type == 'built-in') {
            const provider_info = PROVIDERS[provider.name]
            endpoint_url = provider_info.base_url
          } else {
            endpoint_url = provider.base_url
          }

          // Convert failed patches to clipboard format for intelligent update
          const failed_patches_text = failed_patches
            .map((patch) => `// ${patch.file_path}\n${patch.content}`)
            .join('\n\n')

          try {
            const intelligent_update_states = await handle_intelligent_update({
              endpoint_url,
              api_key: provider.api_key,
              model: file_refactoring_settings.model,
              temperature: file_refactoring_settings.temperature,
              clipboard_text: failed_patches_text,
              context: params.context,
              is_single_root_folder_workspace
            })

            if (intelligent_update_states) {
              // Combine original states from successful patches and intelligent update
              const combined_states = [
                ...all_original_states,
                ...intelligent_update_states
              ]
              params.context.workspaceState.update(
                LAST_APPLIED_CHANGES_STATE_KEY,
                combined_states
              )
              const response = await vscode.window.showInformationMessage(
                `Successfully applied ${failed_patches.length} failed patch${
                  failed_patches.length != 1 ? 'es' : ''
                }.`,
                'Revert'
              )

              if (response == 'Revert') {
                await revert_files(combined_states)
                params.context.workspaceState.update(
                  LAST_APPLIED_CHANGES_STATE_KEY,
                  null
                )
              }
            } else {
              if (success_count > 0 && all_original_states.length > 0) {
                await revert_files(all_original_states)
                params.context.workspaceState.update(
                  LAST_APPLIED_CHANGES_STATE_KEY,
                  null
                )
              }
            }
          } catch (error) {
            // Handle any errors during intelligent update
            Logger.error({
              function_name: 'apply_chat_response_command',
              message: 'Error during intelligent update of failed patches'
            })

            const response = await vscode.window.showErrorMessage(
              'Error during fix attempt with the refactoring tool. Would you like to revert the successfully applied patches?',
              'Keep changes',
              'Revert'
            )

            if (response == 'Revert' && all_original_states.length > 0) {
              await revert_files(all_original_states)
              params.context.workspaceState.update(
                LAST_APPLIED_CHANGES_STATE_KEY,
                null
              )
            }
          }
        }
      } else if (success_count > 0) {
        const response = await vscode.window.showInformationMessage(
          `Successfully applied ${success_count} patch${
            success_count != 1 ? 'es' : ''
          }.`,
          'Revert'
        )

        if (response == 'Revert' && all_original_states.length > 0) {
          await revert_files(all_original_states)
          params.context.workspaceState.update(
            LAST_APPLIED_CHANGES_STATE_KEY,
            null
          )
        }
      }

      return
    } else {
      // If no patches found, continue with regular file handling
      if (!clipboard_content.files || clipboard_content.files.length == 0) {
        vscode.window.showErrorMessage(
          'Clipboard content must contain properly formatted code blocks. Each code block should start with a file path comment or be a diff.'
        )
        return
      }

      // --- Mode Selection ---
      let selected_mode_label:
        | 'Fast replace'
        | 'Intelligent update'
        | undefined = undefined

      const all_files_new = await check_if_all_files_new(
        clipboard_content.files
      )

      if (all_files_new) {
        selected_mode_label = 'Fast replace'
        Logger.log({
          function_name: 'apply_chat_response_command',
          message:
            'All files are new - automatically selecting Fast replace mode'
        })
      } else {
        const has_truncated_fragments = check_for_truncated_fragments(
          clipboard_content.files
        )

        if (has_truncated_fragments) {
          selected_mode_label = 'Intelligent update'
          Logger.log({
            function_name: 'apply_chat_response_command',
            message:
              'Auto-selecting Intelligent update mode due to detected truncated fragments or diff markers'
          })
        } else if (params.mode) {
          selected_mode_label = params.mode
          Logger.log({
            function_name: 'apply_chat_response_command',
            message: 'Mode forced by command parameters',
            data: selected_mode_label
          })
        } else {
          // Instead of showing dialog, default to fast replace
          selected_mode_label = 'Fast replace'
          Logger.log({
            function_name: 'apply_chat_response_command',
            message: 'Defaulting to Fast replace mode'
          })
        }
      }

      // --- Execute Mode Handler ---
      let final_original_states: OriginalFileState[] | null = null
      let operation_success = false

      if (selected_mode_label == 'Fast replace') {
        const result = await handle_fast_replace(clipboard_content.files)
        if (result.success && result.original_states) {
          final_original_states = result.original_states
          operation_success = true
        }
        Logger.log({
          function_name: 'apply_chat_response_command',
          message: 'Fast replace handler finished.',
          data: { success: result.success }
        })
      } else if (selected_mode_label == 'Intelligent update') {
        const api_providers_manager = new ApiProvidersManager(params.context)

        const file_refactoring_settings =
          api_providers_manager.get_file_refactoring_tool_config()

        if (!file_refactoring_settings) {
          vscode.window.showErrorMessage(
            'API provider is not specified for File Refactoring tool. Go to Code Web Chat panel -> Settings tab.'
          )
          Logger.warn({
            function_name: 'apply_chat_response_command',
            message: 'API provider is not specified for File Refactoring tool.'
          })
          return
        } else if (!file_refactoring_settings.provider_name) {
          vscode.window.showErrorMessage(
            'Provider is not specified for File Refactoring tool. Go to Code Web Chat panel -> Settings tab.'
          )
          Logger.warn({
            function_name: 'apply_chat_response_command',
            message: 'Provider is not specified for File Refactoring tool.'
          })
          return
        } else if (!file_refactoring_settings.model) {
          vscode.window.showErrorMessage(
            'Model is not specified for File Refactoring tool. Go to Code Web Chat panel -> Settings tab.'
          )
          Logger.warn({
            function_name: 'apply_chat_response_command',
            message: 'Model is not specified for File Refactoring tool.'
          })
          return
        }

        const provider = api_providers_manager.get_provider(
          file_refactoring_settings.provider_name
        )

        if (!provider) {
          vscode.window.showErrorMessage(
            'API provider not found for File Refactoring tool.'
          )
          return
        }

        let endpoint_url = ''
        if (provider.type == 'built-in') {
          const provider_info = PROVIDERS[provider.name]
          endpoint_url = provider_info.base_url
        } else {
          endpoint_url = provider.base_url
        }

        final_original_states = await handle_intelligent_update({
          endpoint_url,
          api_key: provider.api_key,
          model: file_refactoring_settings.model,
          temperature: file_refactoring_settings.temperature,
          clipboard_text,
          context: params.context,
          is_single_root_folder_workspace
        })

        if (final_original_states) {
          operation_success = true
        }
        Logger.log({
          function_name: 'apply_chat_response_command',
          message: 'Intelligent update handler finished.',
          data: { success: operation_success }
        })
      } else {
        Logger.error({
          function_name: 'apply_chat_response_command',
          message: 'No valid mode selected or determined.'
        })
        return
      }

      // --- Handle Results ---
      if (operation_success && final_original_states) {
        params.context.workspaceState.update(
          LAST_APPLIED_CHANGES_STATE_KEY,
          final_original_states
        )

        // Check how many files were actually new and how many were replaced
        const new_files_count = final_original_states.filter(
          (state) => state.is_new
        ).length
        const replaced_files_count =
          final_original_states.length - new_files_count

        const replaced_or_updated =
          selected_mode_label == 'Intelligent update' ? 'updated' : 'replaced'

        let message = ''
        if (new_files_count > 0 && replaced_files_count > 0) {
          message = `Successfully created ${new_files_count} new ${
            new_files_count == 1 ? 'file' : 'files'
          } and ${replaced_or_updated} ${replaced_files_count} ${
            replaced_files_count == 1 ? 'file' : 'files'
          }.`
        } else if (new_files_count > 0) {
          message = `Successfully created ${new_files_count} new ${
            new_files_count == 1 ? 'file' : 'files'
          }.`
        } else if (replaced_files_count > 0) {
          message = `Successfully ${replaced_or_updated} ${replaced_files_count} ${
            replaced_files_count == 1 ? 'file' : 'files'
          }.`
        } else {
          // Should not happen if operation_success is true and final_original_states is not empty
          message = `Operation completed successfully.`
        }

        // Show appropriate buttons based on whether any existing files were replaced
        if (selected_mode_label == 'Fast replace') {
          // Check if any of the affected files were existing files
          const has_existing_files = final_original_states.some(
            (state) => !state.is_new
          )
          const buttons = has_existing_files
            ? ['Revert', 'Looks off, use intelligent mode']
            : ['Revert']

          const response = await vscode.window.showInformationMessage(
            message,
            ...buttons
          )

          if (response == 'Revert') {
            await revert_files(final_original_states)
            params.context.workspaceState.update(
              LAST_APPLIED_CHANGES_STATE_KEY,
              null
            )
          } else if (response == 'Looks off, use intelligent mode') {
            // First revert the fast replace changes
            await revert_files(final_original_states)

            // Then trigger intelligent update
            const api_providers_manager = new ApiProvidersManager(
              params.context
            )
            const file_refactoring_settings =
              api_providers_manager.get_file_refactoring_tool_config()

            if (!file_refactoring_settings) {
              vscode.window.showErrorMessage(
                'API provider or model is not configured for Intelligent update. Go to Code Web Chat panel -> Settings tab.'
              )
              return
            }

            const provider = api_providers_manager.get_provider(
              file_refactoring_settings.provider_name
            )

            if (!provider) {
              vscode.window.showErrorMessage('API provider not found.')
              return
            }

            let endpoint_url = ''
            if (provider.type == 'built-in') {
              const provider_info = PROVIDERS[provider.name]
              endpoint_url = provider_info.base_url
            } else {
              endpoint_url = provider.base_url
            }

            try {
              final_original_states = await handle_intelligent_update({
                endpoint_url,
                api_key: provider.api_key,
                model: file_refactoring_settings.model,
                temperature: file_refactoring_settings.temperature,
                clipboard_text,
                context: params.context,
                is_single_root_folder_workspace
              })

              if (final_original_states) {
                params.context.workspaceState.update(
                  LAST_APPLIED_CHANGES_STATE_KEY,
                  final_original_states
                )
                // Recalculate counts for the intelligent update result
                const intelligent_new_files_count =
                  final_original_states.filter((state) => state.is_new).length
                const intelligent_replaced_files_count =
                  final_original_states.length - intelligent_new_files_count

                let intelligent_message = ''
                if (
                  intelligent_new_files_count > 0 &&
                  intelligent_replaced_files_count > 0
                ) {
                  intelligent_message = `Successfully created ${intelligent_new_files_count} new ${
                    intelligent_new_files_count == 1 ? 'file' : 'files'
                  } and updated ${intelligent_replaced_files_count} ${
                    intelligent_replaced_files_count == 1 ? 'file' : 'files'
                  } using Intelligent Update.`
                } else if (intelligent_new_files_count > 0) {
                  intelligent_message = `Successfully created ${intelligent_new_files_count} new ${
                    intelligent_new_files_count == 1 ? 'file' : 'files'
                  } using Intelligent Update.`
                } else if (intelligent_replaced_files_count > 0) {
                  intelligent_message = `Successfully updated ${intelligent_replaced_files_count} ${
                    intelligent_replaced_files_count == 1 ? 'file' : 'files'
                  } using Intelligent Update.`
                } else {
                  intelligent_message = `Intelligent Update completed successfully.`
                }

                vscode.window
                  .showInformationMessage(intelligent_message, 'Revert')
                  .then((response) => {
                    if (response == 'Revert') {
                      revert_files(final_original_states!)
                      params.context.workspaceState.update(
                        LAST_APPLIED_CHANGES_STATE_KEY,
                        null
                      )
                    }
                  })
              } else {
                // Intelligent update was canceled after reverting fast replace
                vscode.window.showInformationMessage(
                  'Intelligent update was canceled. Fast replace changes have been reverted.'
                )
                // State is already cleared by the revert_files call above
              }
            } catch (error) {
              // Handle errors during the second intelligent update attempt
              Logger.error({
                function_name: 'apply_chat_response_command',
                message: 'Error during second intelligent update attempt'
              })
              vscode.window.showErrorMessage(
                'Error during intelligent update. Fast replace changes have been reverted.'
              )
              // State is already cleared by the revert_files call above
            }
          }
        } else {
          // For intelligent update, show only Revert button
          const response = await vscode.window.showInformationMessage(
            message,
            'Revert'
          )

          if (response == 'Revert') {
            await revert_files(final_original_states)
            params.context.workspaceState.update(
              LAST_APPLIED_CHANGES_STATE_KEY,
              null
            )
          }
        }
      } else {
        // Handler already showed specific error messages or handled cancellation silently.
        // Clear any potentially partially stored state from a failed operation.
        params.context.workspaceState.update(
          LAST_APPLIED_CHANGES_STATE_KEY,
          null
        )
        Logger.log({
          function_name: 'apply_chat_response_command',
          message: 'Operation concluded without success.'
        })
      }

      Logger.log({
        function_name: 'apply_chat_response_command',
        message: 'end',
        data: {
          command: params.command,
          mode: selected_mode_label,
          success: operation_success
        }
      })
    }
  })
}
