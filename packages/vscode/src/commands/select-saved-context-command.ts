import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as glob from 'glob'
import { WorkspaceProvider } from '../context/providers/workspace-provider'
import {
  SAVED_CONTEXTS_STATE_KEY,
  LAST_CONTEXT_READ_LOCATION_KEY
} from '../constants/state-keys'
import { SavedContext } from '@/types/context'
import { Logger } from '../helpers/logger'

// Function to resolve glob patterns to file paths using the workspace provider's cache
async function resolve_glob_patterns(
  patterns: string[],
  workspace_provider: WorkspaceProvider
): Promise<string[]> {
  const all_files_in_cache = new Set<string>()

  // Get all files from workspace provider's cache
  for (const root of workspace_provider.getWorkspaceRoots()) {
    const files = workspace_provider.find_all_files(root)
    files.forEach((file) => all_files_in_cache.add(file))
  }

  let resolved_final_paths: Set<string>
  // Check if there are any positive include patterns (not starting with '!')
  const has_positive_include_directives = patterns.some(
    (p) => !p.startsWith('!')
  )

  if (!has_positive_include_directives) {
    // If no positive includes are specified (e.g., only excludes or empty list),
    // start with all files from the cache. Excludes will then remove from this set.
    resolved_final_paths = new Set(all_files_in_cache)
  } else {
    // If there's at least one positive include, start with an empty set.
    // Includes will add to this set, and excludes will remove from it.
    resolved_final_paths = new Set<string>()
  }

  for (const pattern_string of patterns) {
    const is_exclude = pattern_string.startsWith('!')
    const current_actual_pattern = is_exclude
      ? pattern_string.substring(1)
      : pattern_string

    const files_this_rule_applies_to = new Set<string>()

    // Determine the set of files this specific rule/pattern applies to.
    // This logic is adapted from the original function's way of resolving individual patterns:
    // prioritize direct file matches, then try glob, with a fallback for glob errors.
    let direct_match_found_for_current_pattern = false
    if (all_files_in_cache.has(current_actual_pattern)) {
      files_this_rule_applies_to.add(current_actual_pattern)
      direct_match_found_for_current_pattern = true
    }

    if (!direct_match_found_for_current_pattern) {
      // Only attempt glob resolution if it wasn't a direct file match
      try {
        const glob_matches = glob.sync(current_actual_pattern, {
          // nodir: true,
          // Assuming patterns are absolute at this stage, as per original function's context
          cwd: process.cwd(),
          absolute: true,
          matchBase: true
        })
        glob_matches.forEach((match) => {
          // Check if the glob match is a file directly present in the cache
          if (all_files_in_cache.has(match)) {
            files_this_rule_applies_to.add(match)
          } else {
            // If not a direct file match, 'match' might be a directory returned by glob.sync.
            // We find all files in our cache that are within this directory.
            // Ensure 'match' ends with a path separator for correct startsWith comparison.
            const directory_path_prefix = match.endsWith(path.sep)
              ? match
              : match + path.sep
            for (const cached_file of all_files_in_cache) {
              if (cached_file.startsWith(directory_path_prefix)) {
                files_this_rule_applies_to.add(cached_file)
              }
            }
          }
        })
      } catch (error) {
        console.warn(
          `Failed to resolve glob pattern "${current_actual_pattern}" (during sequential processing):`,
          error
        )
        // Fallback: If glob resolution fails, re-check if the pattern itself is a literal file path in the cache.
        // This covers cases where a pattern might be a valid file path but also a malformed glob.
        if (all_files_in_cache.has(current_actual_pattern)) {
          files_this_rule_applies_to.add(current_actual_pattern)
        }
      }
    }

    // Apply the rule to the resolved_final_paths set
    if (is_exclude) {
      files_this_rule_applies_to.forEach((file) =>
        resolved_final_paths.delete(file)
      )
    } else {
      // Is an include pattern
      files_this_rule_applies_to.forEach((file) =>
        resolved_final_paths.add(file)
      )
    }
    Logger.log({
      message: `Files this pattern ${pattern_string} applies to: ${files_this_rule_applies_to.size}`,
      data: {
        files_this_rule_applies_to
      }
    })
  }

  Logger.log({
    message: `Resolved final paths: ${resolved_final_paths.size}`
  })

  // Return the final list of included paths
  return [...resolved_final_paths]
}

async function apply_saved_context(
  context: SavedContext,
  workspace_root: string,
  workspace_provider: WorkspaceProvider
): Promise<void> {
  const workspace_folders = vscode.workspace.workspaceFolders || []
  const workspace_map = new Map<string, string>()

  for (const folder of workspace_folders) {
    workspace_map.set(folder.name, folder.uri.fsPath)
  }

  // Convert workspace-prefixed paths to absolute paths
  const absolute_paths = context.paths.map((prefixed_path) => {
    const is_exclude = prefixed_path.startsWith('!')
    const path_part = is_exclude ? prefixed_path.substring(1) : prefixed_path

    let resolved_path_part: string

    // Check if path has workspace prefix
    if (path_part.includes(':')) {
      const [prefix, relative_path] = path_part.split(':', 2)

      // Find the root for the given prefix
      const root = workspace_map.get(prefix)

      if (root) {
        resolved_path_part = path.join(root, relative_path)
      } else {
        // Fallback if prefix doesn't match any workspace folder name - treat as a path in the current workspace
        console.warn(
          `Unknown workspace prefix "${prefix}" in path "${path_part}". Treating as relative to current workspace root.`
        )
        resolved_path_part = path.join(workspace_root, relative_path)
      }
    } else {
      // Legacy support for paths without workspace prefix or non-prefixed paths
      resolved_path_part = path.isAbsolute(path_part)
        ? path_part
        : path.join(workspace_root, path_part)
    }

    return is_exclude ? `!${resolved_path_part}` : resolved_path_part
  })

  // Resolve any glob patterns within the absolute paths, filtering against the cache
  const resolved_paths = await resolve_glob_patterns(
    absolute_paths,
    workspace_provider
  )

  // The resolved_glob_patterns function now filters for existing paths using the cache,
  // so we don't need an extra fs.existsSync filter here.
  const existing_paths = resolved_paths

  if (existing_paths.length == 0) {
    vscode.window.showWarningMessage(
      `No valid paths found in context "${context.name}".`
    )
    return
  }

  await workspace_provider.set_checked_files(existing_paths)
  vscode.window.showInformationMessage(`Applied context "${context.name}".`)
}

// Helper function to save contexts to JSON file
async function save_contexts_to_file(
  contexts: SavedContext[],
  file_path: string
): Promise<void> {
  try {
    // Ensure the .vscode directory exists
    const dir_path = path.dirname(file_path)
    if (!fs.existsSync(dir_path)) {
      fs.mkdirSync(dir_path, { recursive: true })
    }

    // Write the contexts to the file
    fs.writeFileSync(file_path, JSON.stringify(contexts, null, 2), 'utf8')
  } catch (error: any) {
    throw new Error(`Failed to save contexts to file: ${error.message}`)
  }
}

export function select_saved_context_command(
  workspace_provider: WorkspaceProvider | undefined,
  on_context_selected: () => void,
  extension_context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'codeWebChat.selectSavedContext',
    async () => {
      if (!workspace_provider) {
        vscode.window.showErrorMessage('No workspace provider available')
        return
      }

      const workspace_root = workspace_provider.getWorkspaceRoot()
      if (!workspace_root) {
        vscode.window.showErrorMessage('No workspace root found.')
        return
      }

      // Get the last used read location from extension context
      const last_read_location = extension_context.workspaceState.get<
        'internal' | 'file'
      >(LAST_CONTEXT_READ_LOCATION_KEY, 'internal')

      // Get saved contexts from workspace state
      let internal_contexts: SavedContext[] =
        extension_context.workspaceState.get(SAVED_CONTEXTS_STATE_KEY, [])

      // Check if .vscode/contexts.json exists
      const contexts_file_path = path.join(
        workspace_root,
        '.vscode',
        'contexts.json'
      )
      let file_contexts: SavedContext[] = []

      try {
        if (fs.existsSync(contexts_file_path)) {
          const content = fs.readFileSync(contexts_file_path, 'utf8')
          // Basic validation: ensure it's an array
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            // Further validation: check if items look like SavedContext
            file_contexts = parsed.filter(
              (item) =>
                typeof item == 'object' &&
                item !== null &&
                typeof item.name == 'string' &&
                Array.isArray(item.paths) &&
                item.paths.every((p: any) => typeof p == 'string')
            ) as SavedContext[]
          } else {
            console.warn('Contexts file is not an array:', contexts_file_path)
          }
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error reading contexts file: ${error.message}`
        )
        console.error('Error reading contexts file:', error)
      }

      // If no contexts found in either location, show message
      if (internal_contexts.length == 0 && file_contexts.length == 0) {
        vscode.window.showInformationMessage('No saved contexts found.')
        return
      }

      let contexts_to_use: SavedContext[] = []
      let context_source: 'internal' | 'file' | undefined = undefined

      // If both sources have contexts, ask user which one to use
      if (internal_contexts.length > 0 && file_contexts.length > 0) {
        // Create quick pick items with last used option first
        const quick_pick_storage_options = [
          {
            label: 'Workspace State',
            description: `${internal_contexts.length} ${
              internal_contexts.length == 1 ? 'context' : 'contexts'
            }`,
            value: 'internal'
          },
          {
            label: 'JSON File (.vscode/contexts.json)',
            description: `${file_contexts.length} ${
              file_contexts.length == 1 ? 'context' : 'contexts'
            }`,
            value: 'file'
          }
        ]

        // Reorder to put the last used option first
        if (last_read_location == 'file') {
          // Find the 'file' option and move it to the front
          const fileOptionIndex = quick_pick_storage_options.findIndex(
            (opt) => opt.value == 'file'
          )
          if (fileOptionIndex > -1) {
            const [fileOption] = quick_pick_storage_options.splice(
              fileOptionIndex,
              1
            )
            quick_pick_storage_options.unshift(fileOption)
          }
        } else {
          // Find the 'internal' option and move it to the front (default behavior, but explicit)
          const internalOptionIndex = quick_pick_storage_options.findIndex(
            (opt) => opt.value == 'internal'
          )
          if (internalOptionIndex > -1) {
            const [internalOption] = quick_pick_storage_options.splice(
              internalOptionIndex,
              1
            )
            quick_pick_storage_options.unshift(internalOption)
          }
        }

        const source = await vscode.window.showQuickPick(
          quick_pick_storage_options,
          {
            placeHolder: 'Select contexts location'
          }
        )

        if (!source) return // User cancelled

        context_source = source.value as 'internal' | 'file'
        contexts_to_use =
          context_source == 'internal' ? internal_contexts : file_contexts

        // Save the selected option as the last used option
        await extension_context.workspaceState.update(
          LAST_CONTEXT_READ_LOCATION_KEY,
          context_source
        )
      } else if (internal_contexts.length > 0) {
        contexts_to_use = internal_contexts
        context_source = 'internal'
        // If only internal exists, set it as last used
        await extension_context.workspaceState.update(
          LAST_CONTEXT_READ_LOCATION_KEY,
          context_source
        )
      } else if (file_contexts.length > 0) {
        contexts_to_use = file_contexts
        context_source = 'file'
        // If only file exists, set it as last used
        await extension_context.workspaceState.update(
          LAST_CONTEXT_READ_LOCATION_KEY,
          context_source
        )
      }

      if (!context_source || contexts_to_use.length == 0) {
        vscode.window.showInformationMessage(
          'No saved contexts found in the selected source.'
        )
        return
      }

      try {
        const edit_button = {
          iconPath: new vscode.ThemeIcon('edit'),
          tooltip: 'Rename'
        }
        const delete_button = {
          iconPath: new vscode.ThemeIcon('trash'),
          tooltip: 'Delete'
        }

        // Function to create quickpick items from contexts
        const create_quick_pick_items = (contexts: SavedContext[]) => {
          return contexts.map((context) => ({
            label: context.name,
            description: `${context.paths.length} ${
              context.paths.length == 1 ? 'path' : 'paths'
            }`,
            context,
            buttons: [edit_button, delete_button]
          }))
        }

        // Create QuickPick with buttons
        const quick_pick = vscode.window.createQuickPick()
        quick_pick.items = create_quick_pick_items(contexts_to_use)
        quick_pick.placeholder = `Select saved context (from ${
          context_source == 'internal'
            ? 'Workspace State'
            : '.vscode/contexts.json'
        })`

        // Create a promise to be resolved when an item is picked or the quick pick is hidden
        const quick_pick_promise = new Promise<
          (vscode.QuickPickItem & { context: SavedContext }) | undefined
        >((resolve) => {
          quick_pick.onDidAccept(() => {
            const selectedItem = quick_pick
              .activeItems[0] as vscode.QuickPickItem & {
              context: SavedContext
            }
            quick_pick.hide()
            resolve(selectedItem)
          })

          quick_pick.onDidHide(() => {
            resolve(undefined)
          })

          quick_pick.onDidTriggerItemButton(async (event) => {
            const item = event.item as vscode.QuickPickItem & {
              context: SavedContext
            }

            if (event.button === edit_button) {
              const current_contexts =
                context_source == 'internal' ? internal_contexts : file_contexts
              const new_name = await vscode.window.showInputBox({
                prompt: 'Enter new name for context',
                value: item.context.name,
                validateInput: (value) => {
                  if (!value.trim()) {
                    return 'Name cannot be empty'
                  }

                  // Check for duplicate names, excluding the current item's original name
                  const duplicate = current_contexts.find(
                    (c) => c.name == value.trim() && c.name != item.context.name
                  )

                  if (duplicate) {
                    return 'A context with this name already exists'
                  }

                  return null
                }
              })

              if (new_name?.trim()) {
                const trimmed_name = new_name.trim()
                let updated_contexts: SavedContext[] = []
                let context_updated = false

                if (context_source == 'internal') {
                  if (trimmed_name != item.context.name) {
                    // Update the context in the internal state
                    updated_contexts = internal_contexts.map((c) =>
                      c.name == item.context.name
                        ? { ...c, name: trimmed_name }
                        : c
                    )

                    // Update workspace state
                    await extension_context.workspaceState.update(
                      SAVED_CONTEXTS_STATE_KEY,
                      updated_contexts
                    )
                    internal_contexts = updated_contexts // Update the cached array
                    context_updated = true
                  } else {
                    updated_contexts = internal_contexts // No change needed
                  }

                  // Update quick pick items
                  quick_pick.items = create_quick_pick_items(internal_contexts)
                  quick_pick.show() // Ensure quick pick is visible
                } else if (context_source == 'file') {
                  if (trimmed_name != item.context.name) {
                    updated_contexts = file_contexts.map((c) =>
                      c.name == item.context.name
                        ? { ...c, name: trimmed_name }
                        : c
                    )
                    context_updated = true
                  } else {
                    updated_contexts = file_contexts // No change needed
                  }

                  if (context_updated) {
                    try {
                      await save_contexts_to_file(
                        updated_contexts,
                        contexts_file_path
                      )
                      file_contexts = updated_contexts // Update the cached file contexts
                    } catch (error: any) {
                      vscode.window.showErrorMessage(
                        `Error updating context name in file: ${error.message}`
                      )
                      console.error(
                        'Error updating context name in file:',
                        error
                      )
                      // Revert if save failed
                      updated_contexts = file_contexts
                      context_updated = false
                    }
                  }

                  // Update quick pick items
                  quick_pick.items = create_quick_pick_items(file_contexts)
                  quick_pick.show() // Ensure quick pick is visible
                }

                if (context_updated) {
                  vscode.window.showInformationMessage(
                    `Renamed context to "${trimmed_name}".`
                  )
                }
              }
              return
            }

            if (event.button === delete_button) {
              const confirm_delete = await vscode.window.showWarningMessage(
                `Are you sure you want to delete context "${item.context.name}"?`,
                { modal: true },
                'Delete'
              )

              if (confirm_delete == 'Delete') {
                if (context_source == 'internal') {
                  // Remove the context from the state
                  const updated_contexts = internal_contexts.filter(
                    (c) => c.name != item.context.name
                  )

                  // Update workspace state
                  await extension_context.workspaceState.update(
                    SAVED_CONTEXTS_STATE_KEY,
                    updated_contexts
                  )
                  internal_contexts = updated_contexts // Update the cached array

                  vscode.window.showInformationMessage(
                    `Deleted context "${item.context.name}" from workspace state`
                  )

                  // Update the quick pick items
                  if (internal_contexts.length == 0) {
                    quick_pick.hide()
                    vscode.window.showInformationMessage(
                      'No saved contexts remaining in the Workspace State.'
                    )
                  } else {
                    // Update items and ensure the quick pick stays visible
                    quick_pick.items =
                      create_quick_pick_items(internal_contexts)
                    quick_pick.show() // Ensure quick pick is visible
                  }
                } else if (context_source == 'file') {
                  // Remove the context from the file
                  const updated_contexts = file_contexts.filter(
                    (c) => c.name != item.context.name
                  )

                  try {
                    await save_contexts_to_file(
                      updated_contexts,
                      contexts_file_path
                    )
                    vscode.window.showInformationMessage(
                      `Deleted context "${item.context.name}" from the JSON file`
                    )
                    file_contexts = updated_contexts // Update the cached file contexts

                    // Update the quick pick items
                    if (updated_contexts.length == 0) {
                      quick_pick.hide()
                      vscode.window.showInformationMessage(
                        'No saved contexts remaining in the JSON file.'
                      )
                    } else {
                      // Update items and ensure the quick pick stays visible
                      quick_pick.items =
                        create_quick_pick_items(updated_contexts)
                      quick_pick.show() // Ensure quick pick is visible
                    }
                  } catch (error: any) {
                    vscode.window.showErrorMessage(
                      `Error deleting context from file: ${error.message}`
                    )
                    console.error('Error deleting context from file:', error)
                  }
                }
              }
              return
            }
          })
        })

        quick_pick.show()
        const selected = await quick_pick_promise
        if (!selected) return

        // Find the potentially updated context object before applying
        // This handles the case where the context was renamed just before selection
        let context_to_apply: SavedContext | undefined
        if (context_source == 'internal') {
          context_to_apply = internal_contexts.find(
            (c) => c.name == selected.label // Use label as it reflects the current name
          )
        } else {
          context_to_apply = file_contexts.find(
            (c) => c.name == selected.label // Use label as it reflects the current name
          )
        }

        if (!context_to_apply) {
          // This should ideally not happen if the quick pick items are updated correctly
          vscode.window.showErrorMessage(
            `Could not find the selected context "${selected.label}" after potential edits.`
          )
          console.error(
            'Could not find selected context after potential edits:',
            selected.label
          )
          return
        }

        await apply_saved_context(
          context_to_apply,
          workspace_root,
          workspace_provider
        )

        // Only update recent contexts list for internal contexts
        if (context_source == 'internal') {
          // Move the selected context (using its current name) to the top of the list
          const updated_contexts = internal_contexts.filter(
            (c) => c.name != context_to_apply!.name
          )
          updated_contexts.unshift(context_to_apply!) // Add the applied context to the beginning
          await extension_context.workspaceState.update(
            SAVED_CONTEXTS_STATE_KEY,
            updated_contexts
          )
          internal_contexts = updated_contexts // Update cache
        }

        on_context_selected()
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error selecting saved context: ${error.message}`
        )
        console.error('Error selecting saved context:', error)
      }
    }
  )
}
