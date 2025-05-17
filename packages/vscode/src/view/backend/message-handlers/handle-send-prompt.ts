import { ViewProvider } from '@/view/backend/view-provider'
import * as vscode from 'vscode'
import { FilesCollector } from '@/helpers/files-collector'
import { replace_selection_placeholder } from '@/utils/replace-selection-placeholder'
import { apply_preset_affixes_to_instruction } from '@/helpers/apply-preset-affixes'

async function validate_presets(
  preset_names: string[],
  is_code_completions_mode: boolean,
  context: vscode.ExtensionContext
): Promise<string[]> {
  const config = vscode.workspace.getConfiguration('codeWebChat')
  const presets = config.get<any[]>('presets', [])
  const available_presets = presets.filter((preset) =>
    !is_code_completions_mode
      ? true
      : !preset.promptPrefix && !preset.promptSuffix
  )
  const available_preset_names = available_presets.map((preset) => preset.name)

  // Filter out any presets that no longer exist
  const valid_presets = preset_names.filter((name) =>
    available_preset_names.includes(name)
  )

  // If no valid presets, show the picker
  if (valid_presets.length == 0) {
    const preset_quick_pick_items = available_presets.map((preset) => ({
      label: preset.name,
      description: `${preset.chatbot}${
        preset.model ? ` - ${preset.model}` : ''
      }`,
      picked: false
    }))

    const placeholder = !is_code_completions_mode
      ? 'Select one or more presets'
      : 'Select one or more presets to use when asking for code completions'

    const selected_presets = await vscode.window.showQuickPick(
      preset_quick_pick_items,
      {
        placeHolder: placeholder,
        canPickMany: true
      }
    )

    if (selected_presets) {
      const selected_names = selected_presets.map((preset) => preset.label)
      const selected_names_key = is_code_completions_mode
        ? 'selectedCodeCompletionPresets'
        : 'selectedPresets'
      await context.globalState.update(selected_names_key, selected_names)

      return selected_names
    }
    return []
  }

  return valid_presets
}

export const handle_send_prompt = async (
  provider: ViewProvider,
  preset_names: string[]
): Promise<void> => {
  // Validate presets first
  const valid_preset_names = await validate_presets(
    preset_names,
    provider.is_code_completions_mode,
    provider.context
  )

  // If no presets were selected in the picker
  if (valid_preset_names.length == 0) {
    vscode.window.showInformationMessage(
      'Please select at least one preset to continue.'
    )
    return
  }

  await vscode.workspace.saveAll()

  const files_collector = new FilesCollector(
    provider.workspace_provider,
    provider.open_editors_provider,
    provider.websites_provider
  )

  const active_editor = vscode.window.activeTextEditor
  const active_path = active_editor?.document.uri.fsPath

  if (provider.is_code_completions_mode && active_editor) {
    const document = active_editor.document
    const position = active_editor.selection.active

    const text_before_cursor = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    )
    const text_after_cursor = document.getText(
      new vscode.Range(position, document.positionAt(document.getText().length))
    )

    const context_text = await files_collector.collect_files({
      exclude_path: active_path
    })

    const workspace_folder = vscode.workspace.workspaceFolders?.[0].uri.fsPath
    const relative_path = active_path!.replace(workspace_folder + '/', '')

    const config = vscode.workspace.getConfiguration('codeWebChat')
    const chat_code_completion_instructions = config.get<string>(
      'chatCodeCompletionInstructions'
    )

    const instructions = `${chat_code_completion_instructions}${
      provider.code_completion_suggestions
        ? ` Follow suggestions: ${provider.code_completion_suggestions}`
        : ''
    }`

    const text = `${instructions}\n<files>\n${context_text}<file path="${relative_path}">\n<![CDATA[\n${text_before_cursor}<missing text>${text_after_cursor}\n]]>\n</file>\n</files>\n${instructions}`

    provider.websocket_server_instance.initialize_chats(
      text,
      valid_preset_names
    )
  } else if (!provider.is_code_completions_mode) {
    if (!provider.instructions) {
      vscode.window.showInformationMessage(
        'Please enter instructions.'
      )
      return
    }

    const context_text = await files_collector.collect_files({
      active_path
    })

    let instructions = provider.instructions
    instructions = replace_selection_placeholder(instructions)
    instructions = apply_preset_affixes_to_instruction(
      instructions,
      valid_preset_names
    )

    // Use the stored edit_format property
    const config = vscode.workspace.getConfiguration('codeWebChat')
    const edit_format_instructions = config.get<string>(
      `editFormatInstructions${
        provider.edit_format.charAt(0).toUpperCase() +
        provider.edit_format.slice(1)
      }`
    )
    if (edit_format_instructions) {
      instructions += `\n${edit_format_instructions}`
    }

    const text = `${
      context_text ? `${instructions}\n<files>\n${context_text}</files>\n` : ''
    }${instructions}`

    provider.websocket_server_instance.initialize_chats(
      text,
      valid_preset_names
    )
  }

  vscode.window.showInformationMessage(
    valid_preset_names.length > 1
      ? 'Chats have been initialized in the connected browser.'
      : 'Chat has been initialized in the connected browser.'
  )
}
