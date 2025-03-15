import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { FileItem } from './workspace-provider'
import { SharedFileState } from './shared-file-state'

export class OpenEditorsProvider
  implements vscode.TreeDataProvider<FileItem>, vscode.Disposable
{
  private _on_did_change_tree_data: vscode.EventEmitter<
    FileItem | undefined | null | void
  > = new vscode.EventEmitter<FileItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<
    FileItem | undefined | null | void
  > = this._on_did_change_tree_data.event

  private _workspace_root: string
  private _checked_items: Map<string, vscode.TreeItemCheckboxState> = new Map()
  private _file_token_counts: Map<string, number> = new Map() // Cache token counts
  private _tab_change_handler: vscode.Disposable
  private _file_change_watcher: vscode.Disposable
  private _ignored_extensions: Set<string> = new Set()
  private _attach_open_files: boolean = true
  private _initialized: boolean = false
  // Track files opened from workspace view
  private _opened_from_workspace_view: Set<string> = new Set()
  // Keep track of files we've already attempted to open in non-preview mode
  private _non_preview_files: Set<string> = new Set()
  // Track which tabs are currently in preview mode
  private _preview_tabs: Map<string, boolean> = new Map()
  private _on_did_change_checked_files = new vscode.EventEmitter<void>()
  readonly onDidChangeCheckedFiles = this._on_did_change_checked_files.event
  // Reference to SharedFileState for checking workspace file states
  private _shared_state: SharedFileState

  constructor(workspace_root: string, ignored_extensions: Set<string>) {
    this._workspace_root = workspace_root
    this._ignored_extensions = ignored_extensions
    this._shared_state = SharedFileState.getInstance()

    // Load user preference for automatically attaching open files
    const config = vscode.workspace.getConfiguration('geminiCoder')
    this._attach_open_files = config.get('attachOpenFiles', true)

    // Initialize the preview tabs map with current tabs
    this._update_preview_tabs_state()

    // Listen for tab changes to update open file checks
    this._tab_change_handler = vscode.window.tabGroups.onDidChangeTabs((e) => {
      this._handle_tab_changes(e)
      this.refresh()
    })

    // Listen for file content changes
    this._file_change_watcher = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.isDirty) return // Only process saved changes

        const file_path = e.document.uri.fsPath
        // Clear token count for this file to force recalculation
        this._file_token_counts.delete(file_path)
        this._on_did_change_tree_data.fire()
      }
    )

    // Initial auto-check of all open editors
    // We'll use setTimeout to ensure VS Code has fully loaded editors
    setTimeout(() => {
      this._auto_check_open_editors()
      this._initialized = true
      this._on_did_change_tree_data.fire() // Fire event to refresh view
    }, 500) // Small delay to ensure VS Code has loaded all editors
  }

  // New method to update the preview tabs state
  private _update_preview_tabs_state(): void {
    // Clear the current state
    this._preview_tabs.clear()

    // Get current state of all tabs
    vscode.window.tabGroups.all.forEach((tab_group) => {
      tab_group.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputText) {
          const uri = tab.input.uri
          this._preview_tabs.set(uri.fsPath, !!tab.isPreview)
        }
      })
    })
  }

  // New method to handle tab changes and detect preview to normal transitions
  private _handle_tab_changes(e: vscode.TabChangeEvent): void {
    // Process tabs that were changed
    for (const tab of e.changed) {
      // Only track text tabs
      if (tab.input instanceof vscode.TabInputText) {
        const file_path = tab.input.uri.fsPath
        const was_preview = this._preview_tabs.get(file_path)
        const is_now_preview = !!tab.isPreview

        // If the file was in preview mode and now is not
        if (was_preview && !is_now_preview) {
          this._handle_file_out_of_preview_state(file_path)
        }

        // Update preview state
        this._preview_tabs.set(file_path, is_now_preview)
      }
    }

    // Process tabs that were opened
    for (const tab of e.opened) {
      if (tab.input instanceof vscode.TabInputText) {
        this._preview_tabs.set(tab.input.uri.fsPath, !!tab.isPreview)
      }
    }

    // Remove closed tabs from tracking
    for (const tab of e.closed) {
      if (tab.input instanceof vscode.TabInputText) {
        this._preview_tabs.delete(tab.input.uri.fsPath)
      }
    }
  }

  private _handle_file_out_of_preview_state(file_path: string): void {
    // Only proceed if the setting is enabled
    if (!this._attach_open_files) return

    // Skip files not in workspace
    if (!file_path.startsWith(this._workspace_root)) return

    const extension = path.extname(file_path).toLowerCase().replace('.', '')
    if (this._ignored_extensions.has(extension)) return

    // Skip if already checked
    if (
      this._checked_items.get(file_path) ===
      vscode.TreeItemCheckboxState.Checked
    )
      return

    // Check if this file was opened from workspace view
    const was_opened_from_workspace_view =
      this._opened_from_workspace_view.has(file_path)

    // Remove from tracking set - we'll process it now regardless
    if (was_opened_from_workspace_view) {
      this._opened_from_workspace_view.delete(file_path)
    }

    // Mark as checked when file is unpinned - even if it was opened from workspace view
    this._checked_items.set(file_path, vscode.TreeItemCheckboxState.Checked)

    // Clear token count to recalculate
    this._file_token_counts.delete(file_path)
  }

  // Mark files opened from workspace view
  mark_opened_from_workspace_view(file_path: string): void {
    this._opened_from_workspace_view.add(file_path)
  }

  dispose(): void {
    this._tab_change_handler.dispose()
    this._file_change_watcher.dispose() // Dispose the file watcher
    this._on_did_change_checked_files.dispose()
  }

  refresh(): void {
    // Clean up closed files from checked_items
    this._clean_up_closed_files()

    // Handle newly opened files (this is the new part)
    this._handle_newly_opened_files()

    // Trigger view update
    this._on_did_change_tree_data.fire()
  }

  // Modified method to handle newly opened files
  private _handle_newly_opened_files(): void {
    // Only auto-check new files if the setting is enabled
    if (!this._attach_open_files) return

    const open_file_paths = this._get_open_editors()

    for (const uri of open_file_paths) {
      const file_path = uri.fsPath

      // Skip files not in workspace
      if (!file_path.startsWith(this._workspace_root)) continue

      const extension = path.extname(file_path).toLowerCase().replace('.', '')
      if (this._ignored_extensions.has(extension)) continue

      // Check if this is a new file that isn't in our map yet
      if (!this._checked_items.has(file_path)) {
        // First, check if this file is already checked in the workspace view
        const is_checked_in_workspace =
          this._is_file_checked_in_workspace(file_path)

        if (is_checked_in_workspace) {
          // If checked in workspace view, use that state
          this._checked_items.set(
            file_path,
            vscode.TreeItemCheckboxState.Checked
          )
        } else if (
          this._opened_from_workspace_view.has(file_path) ||
          this._preview_tabs.get(file_path)
        ) {
          // Don't auto-check if the file was opened from workspace view or is in preview mode
          this._checked_items.set(
            file_path,
            vscode.TreeItemCheckboxState.Unchecked
          )

          // Only remove from set if not in preview mode - keep tracking preview files
          if (!this._preview_tabs.get(file_path)) {
            this._opened_from_workspace_view.delete(file_path)
          }
        } else {
          // Auto-check new files opened through other means and not in preview mode
          this._checked_items.set(
            file_path,
            vscode.TreeItemCheckboxState.Checked
          )
        }

        // Clear token count for this file to force recalculation
        this._file_token_counts.delete(file_path)
      }
    }

    // Force a complete tree refresh
    this._on_did_change_tree_data.fire()
  }

  // New method to check if a file is checked in workspace view
  private _is_file_checked_in_workspace(file_path: string): boolean {
    // Get checked files from workspace provider through SharedFileState
    const workspace_checked_files = this._shared_state.getCheckedFiles()
    return workspace_checked_files.includes(file_path)
  }

  // New method to clean up closed files from workspace view tracking
  private _clean_up_closed_files(): void {
    const open_file_paths = new Set(
      this._get_open_editors().map((uri) => uri.fsPath)
    )

    // Filter out entries that are no longer open
    const keys_to_delete: string[] = []
    this._checked_items.forEach((state, file_path) => {
      if (!open_file_paths.has(file_path)) {
        keys_to_delete.push(file_path)
      }
    })

    // Remove closed files from checked_items
    keys_to_delete.forEach((key) => {
      this._checked_items.delete(key)
      // Also remove from workspace view tracking
      this._opened_from_workspace_view.delete(key)
      // Remove from non-preview files tracking
      this._non_preview_files.delete(key)
      // Remove from preview tabs tracking
      this._preview_tabs.delete(key)
    })

    // Clear token count for closed files
    keys_to_delete.forEach((key) => {
      this._file_token_counts.delete(key)
    })
  }

  getTreeItem(element: FileItem): vscode.TreeItem {
    const key = element.resourceUri.fsPath
    const checkbox_state =
      this._checked_items.get(key) ?? vscode.TreeItemCheckboxState.Unchecked

    element.checkboxState = checkbox_state

    // Get token count and add it to description
    const token_count = element.token_count

    if (token_count !== undefined) {
      // Format token count for display (e.g., 1.2k for 1,200)
      const formatted_token_count =
        token_count >= 1000
          ? `${Math.floor(token_count / 1000)}k`
          : `${token_count}`

      // Add token count to description
      if (element.description) {
        element.description = `${formatted_token_count} ${element.description}`
      } else {
        element.description = formatted_token_count
      }
    }

    return element
  }

  async getChildren(): Promise<FileItem[]> {
    if (!this._workspace_root) {
      vscode.window.showInformationMessage('No workspace folder found.')
      return []
    }

    return this.create_open_editor_items()
  }

  private _get_open_editors(): vscode.Uri[] {
    const open_files: vscode.Uri[] = []

    // Add files from all tab groups
    vscode.window.tabGroups.all.forEach((tab_group) => {
      tab_group.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputText) {
          open_files.push(tab.input.uri)
          // Also update our preview tabs tracking
          this._preview_tabs.set(tab.input.uri.fsPath, !!tab.isPreview)
        }
      })
    })

    return open_files
  }

  // Calculate token count for a file
  private async _calculate_file_tokens(file_path: string): Promise<number> {
    // Check if we've already calculated this file
    if (this._file_token_counts.has(file_path)) {
      return this._file_token_counts.get(file_path)!
    }

    try {
      // Read file content
      const content = await fs.promises.readFile(file_path, 'utf8')

      // Simple token estimation: character count / 4
      const token_count = Math.floor(content.length / 4)

      // Cache the result
      this._file_token_counts.set(file_path, token_count)

      return token_count
    } catch (error) {
      console.error(`Error calculating tokens for ${file_path}:`, error)
      return 0
    }
  }

  // Modified to check workspace state when creating open editor items
  async create_open_editor_items(): Promise<FileItem[]> {
    const items: FileItem[] = []
    const open_files = this._get_open_editors()

    // Get all checked workspace files for reference
    const workspace_checked_files = this._shared_state.getCheckedFiles()

    for (const file_uri of open_files) {
      const file_path = file_uri.fsPath

      // Skip files not in the workspace
      if (!file_path.startsWith(this._workspace_root)) {
        continue
      }

      const file_name = path.basename(file_path)
      const extension = path.extname(file_path).toLowerCase().replace('.', '')

      // Skip files with ignored extensions
      if (this._ignored_extensions.has(extension)) {
        continue
      }

      // Get checkbox state, respect attach_open_files setting
      let checkbox_state = this._checked_items.get(file_path)

      if (checkbox_state === undefined) {
        // Check if the file is checked in the workspace view
        const is_checked_in_workspace =
          workspace_checked_files.includes(file_path)

        if (is_checked_in_workspace) {
          // If it's checked in workspace view, use that state
          checkbox_state = vscode.TreeItemCheckboxState.Checked
        } else {
          const is_preview = this._preview_tabs.get(file_path)
          // Only auto-check if attach_open_files is enabled and file is not in preview mode
          checkbox_state =
            this._attach_open_files && !is_preview
              ? vscode.TreeItemCheckboxState.Checked
              : vscode.TreeItemCheckboxState.Unchecked
        }

        this._checked_items.set(file_path, checkbox_state)
      }

      // Calculate relative path from workspace root
      const relative_path = path.relative(
        this._workspace_root,
        path.dirname(file_path)
      )

      // Create description with relative path and token count
      const token_count = await this._calculate_file_tokens(file_path)
      const description = relative_path ? `${relative_path}` : ''

      const item = new FileItem(
        file_name,
        file_uri,
        vscode.TreeItemCollapsibleState.None,
        false, // not a directory
        checkbox_state,
        false, // isGitIgnored is now irrelevant as we're skipping ignored files
        false, // not a symlink
        true, // is an open file
        token_count,
        description
      )

      items.push(item)
    }

    return items
  }

  // Rest of the class implementation...

  // Modified helper method to open a file in non-preview mode without pinning
  private async _open_file_in_non_preview_mode(uri: vscode.Uri): Promise<void> {
    const file_path = uri.fsPath

    // Skip if we've already tried to open this file in non-preview mode
    if (this._non_preview_files.has(file_path)) {
      return
    }

    // Mark that we've tried to open this file in non-preview mode
    this._non_preview_files.add(file_path)

    try {
      // Open the file in non-preview mode
      await vscode.window.showTextDocument(uri, { preview: false })
    } catch (error) {
      console.error(
        `Error opening file in non-preview mode for ${file_path}:`,
        error
      )
    }
  }

  // Modified updateCheckState method to handle preview mode conversion
  async update_check_state(
    item: FileItem,
    state: vscode.TreeItemCheckboxState
  ): Promise<void> {
    const key = item.resourceUri.fsPath
    this._checked_items.set(key, state)

    // If the checkbox is being checked AND the file is currently in preview mode
    // then convert it to non-preview mode
    if (
      state === vscode.TreeItemCheckboxState.Checked &&
      this._preview_tabs.get(key) === true
    ) {
      await this._open_file_in_non_preview_mode(item.resourceUri)
    }

    this._on_did_change_checked_files.fire()
    this.refresh()
  }

  clear_checks(): void {
    // Instead of clearing the map, explicitly set each open editor to unchecked
    const open_files = this._get_open_editors()

    for (const uri of open_files) {
      const file_path = uri.fsPath

      // Skip files not in workspace
      if (!file_path.startsWith(this._workspace_root)) continue

      // Explicitly set to unchecked state
      this._checked_items.set(file_path, vscode.TreeItemCheckboxState.Unchecked)
    }

    // Force a complete tree refresh by clearing the file token count cache
    this._file_token_counts.clear()

    // Fire the event with undefined to force full tree refresh
    this._on_did_change_tree_data.fire(undefined)

    // Fire the checked files change event to trigger synchronization with workspace view
    this._on_did_change_checked_files.fire()
  }

  async check_all(): Promise<void> {
    const open_files = this._get_open_editors()

    for (const uri of open_files) {
      const file_path = uri.fsPath

      // Skip files not in workspace
      if (!file_path.startsWith(this._workspace_root)) continue

      const extension = path.extname(file_path).toLowerCase().replace('.', '')
      if (this._ignored_extensions.has(extension)) continue

      this._checked_items.set(file_path, vscode.TreeItemCheckboxState.Checked)

      // If file is in preview mode, convert it to non-preview mode
      if (this._preview_tabs.get(file_path) === true) {
        await this._open_file_in_non_preview_mode(uri)
      }
    }

    // Force a complete tree refresh by clearing the file token count cache
    this._file_token_counts.clear()

    // Fire the event with undefined to force full tree refresh
    this._on_did_change_tree_data.fire(undefined)

    // Fire the checked files change event to trigger synchronization with workspace view
    this._on_did_change_checked_files.fire()
  }

  get_checked_files(): string[] {
    return Array.from(this._checked_items.entries())
      .filter(
        ([file_path, state]) =>
          state === vscode.TreeItemCheckboxState.Checked &&
          fs.existsSync(file_path) &&
          (fs.lstatSync(file_path).isFile() ||
            fs.lstatSync(file_path).isSymbolicLink())
      )
      .map(([path, _]) => path)
  }

  async set_checked_files(file_paths: string[]): Promise<void> {
    // Clear existing checks
    this._checked_items.clear()

    // For each file in filePaths, set its checkboxState to Checked
    for (const file_path of file_paths) {
      if (!fs.existsSync(file_path)) continue

      const extension = path.extname(file_path).toLowerCase().replace('.', '')
      if (this._ignored_extensions.has(extension)) continue

      this._checked_items.set(file_path, vscode.TreeItemCheckboxState.Checked)

      // If file is in preview mode, convert it to non-preview mode
      if (this._preview_tabs.get(file_path) === true) {
        await this._open_file_in_non_preview_mode(vscode.Uri.file(file_path))
      }
    }

    this.refresh()

    // Fire the checked files change event to trigger synchronization
    this._on_did_change_checked_files.fire()
  }

  update_attach_open_files_setting(value: boolean): void {
    if (this._attach_open_files == value) {
      return
    }
    this._attach_open_files = value
    this.refresh()
  }

  private async _auto_check_open_editors(): Promise<void> {
    if (!this._attach_open_files) return

    const open_files = this._get_open_editors()
    // Get checked workspace files for reference
    const workspace_checked_files = this._shared_state.getCheckedFiles()

    for (const uri of open_files) {
      const file_path = uri.fsPath

      // Skip files not in workspace
      if (!file_path.startsWith(this._workspace_root)) continue

      const extension = path.extname(file_path).toLowerCase().replace('.', '')
      if (this._ignored_extensions.has(extension)) continue

      // Check if the file is in preview mode
      const is_preview = this._preview_tabs.get(file_path)

      // If the file is checked in workspace view, reflect that state
      if (workspace_checked_files.includes(file_path)) {
        this._checked_items.set(file_path, vscode.TreeItemCheckboxState.Checked)
      }
      // Only auto-check if not already set by user, not in preview mode, and not checked in workspace
      else if (!this._checked_items.has(file_path) && !is_preview) {
        this._checked_items.set(file_path, vscode.TreeItemCheckboxState.Checked)
      }
    }

    // Fire the checked files change event to trigger synchronization
    this._on_did_change_checked_files.fire()
  }

  is_initialized(): boolean {
    return this._initialized
  }
}
