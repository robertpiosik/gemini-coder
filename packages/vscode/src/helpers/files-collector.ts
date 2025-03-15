import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { WorkspaceProvider } from '../context/workspace-provider'
import { OpenEditorsProvider } from '../context/open-editors-provider'
import { WebsitesProvider } from '../context/websites-provider'

export class FilesCollector {
  private file_tree_provider: WorkspaceProvider
  private open_editors_provider?: OpenEditorsProvider
  private websites_provider?: WebsitesProvider
  private workspace_root: string

  constructor(
    file_tree_provider: WorkspaceProvider,
    open_editors_provider?: OpenEditorsProvider,
    websites_provider?: WebsitesProvider
  ) {
    this.file_tree_provider = file_tree_provider
    this.open_editors_provider = open_editors_provider
    this.websites_provider = websites_provider
    // Get workspace root from VS Code API
    const workspace_folders = vscode.workspace.workspaceFolders
    this.workspace_root = workspace_folders
      ? workspace_folders[0].uri.fsPath
      : ''
  }

  async collect_files(params?: {
    disable_xml?: boolean
    exclude_path?: string
    active_path?: string
  }): Promise<string> {
    // Get checked files from both providers
    const workspace_files = this.file_tree_provider.getCheckedFiles()
    const open_editor_files =
      this.open_editors_provider?.get_checked_files() || []

    // Combine and deduplicate files
    const context_files = Array.from(
      new Set([...workspace_files, ...open_editor_files])
    )
    let collected_text = ''

    // Process each checked file
    for (const file_path of context_files) {
      if (params?.exclude_path && params.exclude_path == file_path) continue
      try {
        if (!fs.existsSync(file_path)) continue
        const stats = fs.statSync(file_path)

        // Skip directories
        if (stats.isDirectory()) continue

        const content = fs.readFileSync(file_path, 'utf8')

        // Convert absolute path to workspace-relative path
        const relative_path = path.relative(this.workspace_root, file_path)

        if (params?.disable_xml) {
          // Just add the content without XML wrapping, used for context counting so that it matches values shown in file tree
          collected_text += content
        } else {
          const is_active = params?.active_path == file_path
          collected_text += `<file path="${relative_path}"${
            is_active ? ' active' : ''
          }>\n<![CDATA[\n${content}\n]]>\n</file>\n`
        }
      } catch (error) {
        console.error(`Error reading file ${file_path}:`, error)
      }
    }

    // Add content from checked websites
    if (this.websites_provider) {
      const checked_websites = this.websites_provider.get_checked_websites()

      for (const website of checked_websites) {
        if (params?.disable_xml) {
          // Just add the content without XML wrapping for token counting
          collected_text += website.content
        } else {
          collected_text += `<text title="${website.title}">\n<![CDATA[\n${website.content}\n]]>\n</text>\n`
        }
      }
    }

    return collected_text
  }
}
