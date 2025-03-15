import * as vscode from 'vscode'
import { WorkspaceProvider } from './workspace-provider'
import { FileItem } from './workspace-provider'
import { FilesCollector } from '../helpers/files-collector'
import { OpenEditorsProvider } from './open-editors-provider'
import { WebsitesProvider, WebsiteItem } from './websites-provider'
import { ignored_extensions } from './ignored-extensions'
import { SharedFileState } from './shared-file-state'
import { marked } from 'marked'

export function context_initialization(context: vscode.ExtensionContext): {
  workspace_provider: WorkspaceProvider | undefined
  open_editors_provider: OpenEditorsProvider | undefined
  websites_provider: WebsitesProvider | undefined
} {
  const workspace_folders = vscode.workspace.workspaceFolders

  let workspace_provider: WorkspaceProvider | undefined
  let open_editors_provider: OpenEditorsProvider | undefined
  let websites_provider: WebsitesProvider | undefined
  let gemini_coder_file_tree_view: vscode.TreeView<FileItem>
  let gemini_coder_open_editors_view: vscode.TreeView<FileItem>
  let gemini_coder_websites_view: vscode.TreeView<WebsiteItem>

  // Add websites provider to disposables

  if (workspace_folders) {
    const workspace_root = workspace_folders[0].uri.fsPath
    const workspace_name = workspace_folders[0].name
    workspace_provider = new WorkspaceProvider(workspace_root)
    open_editors_provider = new OpenEditorsProvider(
      workspace_root,
      ignored_extensions
    )
    websites_provider = new WebsitesProvider()

    // Create websites tree view
    gemini_coder_websites_view = vscode.window.createTreeView(
      'geminiCoderViewWebsites',
      {
        treeDataProvider: websites_provider,
        manageCheckboxStateManually: true
      }
    )
    context.subscriptions.push(websites_provider, gemini_coder_websites_view)

    // Create FilesCollector instance that can collect from both providers and websites provider
    const files_collector = new FilesCollector(
      workspace_provider,
      open_editors_provider,
      websites_provider
    )

    const update_activity_bar_badge_token_count = async () => {
      let context_text = ''

      try {
        // Use FilesCollector to get all files and websites
        context_text = await files_collector.collect_files({
          disable_xml: true
        })
      } catch (error) {
        console.error('Error collecting files and websites:', error)
        return
      }

      // Calculate tokens from the collected context
      const total_token_count = Math.floor(context_text.length / 4)

      // Update the badge on the workspace files view
      gemini_coder_file_tree_view.badge = {
        value: total_token_count,
        tooltip: `${total_token_count} tokens in the context`
      }
    }

    // Handle checkbox state changes for websites
    gemini_coder_websites_view.onDidChangeCheckboxState(async (e) => {
      for (const [item, state] of e.items) {
        await websites_provider!.update_check_state(item as WebsiteItem, state)
      }
      // Update token count when website checkboxes change
      await update_activity_bar_badge_token_count()
    })

    // Initialize shared state
    const sharedState = SharedFileState.getInstance()
    sharedState.setProviders(workspace_provider, open_editors_provider)

    // Add shared state to disposables
    context.subscriptions.push({
      dispose: () => sharedState.dispose()
    })

    // Create two separate tree views
    gemini_coder_file_tree_view = vscode.window.createTreeView(
      'geminiCoderViewWorkspace',
      {
        treeDataProvider: workspace_provider,
        manageCheckboxStateManually: true
      }
    )
    gemini_coder_file_tree_view.title = workspace_name

    gemini_coder_open_editors_view = vscode.window.createTreeView(
      'geminiCoderViewOpenEditors',
      {
        treeDataProvider: open_editors_provider,
        manageCheckboxStateManually: true
      }
    )

    // Add providers and treeViews to ensure proper disposal
    context.subscriptions.push(
      workspace_provider,
      open_editors_provider,
      gemini_coder_file_tree_view,
      gemini_coder_open_editors_view
    )

    // Register the commands
    context.subscriptions.push(
      vscode.commands.registerCommand('geminiCoder.copyContext', async () => {
        let context_text = ''

        try {
          context_text = await files_collector.collect_files()
        } catch (error: any) {
          console.error('Error collecting files and websites:', error)
          vscode.window.showErrorMessage(
            'Error collecting files and websites: ' + error.message
          )
          return
        }

        if (context_text == '') {
          vscode.window.showWarningMessage(
            'No files or websites selected or open.'
          )
          return
        }

        context_text = `<files>\n${context_text}</files>\n`
        await vscode.env.clipboard.writeText(context_text)
        vscode.window.showInformationMessage(`Context copied to clipboard.`)
      }),
      vscode.commands.registerCommand(
        'geminiCoder.copyContextWithIcon',
        async () => {
          await vscode.commands.executeCommand('geminiCoder.copyContext')
        }
      ),
      // Existing workspace commands
      vscode.commands.registerCommand('geminiCoder.clearChecks', () => {
        workspace_provider!.clearChecks()
        update_activity_bar_badge_token_count()
      }),
      vscode.commands.registerCommand('geminiCoder.checkAll', async () => {
        await workspace_provider!.check_all()
        update_activity_bar_badge_token_count()
      }),
      // New open editors commands
      vscode.commands.registerCommand(
        'geminiCoder.clearChecksOpenEditors',
        () => {
          open_editors_provider!.clear_checks()
          update_activity_bar_badge_token_count()
        }
      ),
      vscode.commands.registerCommand(
        'geminiCoder.checkAllOpenEditors',
        async () => {
          await open_editors_provider!.check_all()
          update_activity_bar_badge_token_count()
        }
      ),
      vscode.commands.registerCommand(
        'geminiCoder.previewWebsite',
        async (website: WebsiteItem) => {
          const panel = vscode.window.createWebviewPanel(
            'websitePreview',
            website.title,
            vscode.ViewColumn.One,
            { enableScripts: false }
          )

          const rendered_content = marked.parse(website.content)

          // Create a simple HTML preview
          panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${website.title}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.4; max-width: 700px; margin: 0 auto; padding: 40px; color: var(--vscode-editor-foreground); }
                body > *:first-child { margin-top: 0; }
                body > *:last-child { margin-bottom: 0; }
                h1 { color: var(--vscode-editor-foreground); }
                a { color: var(--vscode-textLink-foreground); }
                hr { height: 1px; border: none; background-color: var(--vscode-editor-foreground); }
              </style>
            </head>
            <body>
              <h1>${website.title}</h1>
              <p>🔗 <a href="${website.url}" target="_blank">${website.url}</a></p>
              <hr>
              <div>${rendered_content}</div>
            </body>
            </html>
          `
        }
      )
    )

    // Handle checkbox state changes asynchronously for file tree
    gemini_coder_file_tree_view.onDidChangeCheckboxState(async (e) => {
      for (const [item, state] of e.items) {
        await workspace_provider!.updateCheckState(item, state)
      }

      // Update token count after checkbox changes
      await update_activity_bar_badge_token_count()
    })

    // Handle checkbox state changes asynchronously for open editors
    gemini_coder_open_editors_view.onDidChangeCheckboxState(async (e) => {
      for (const [item, state] of e.items) {
        await open_editors_provider!.update_check_state(item, state)
      }

      // Update token count after checkbox changes
      await update_activity_bar_badge_token_count()
    })

    // Subscribe to the onDidChangeCheckedFiles events from both providers
    context.subscriptions.push(
      workspace_provider.onDidChangeCheckedFiles(() => {
        update_activity_bar_badge_token_count()
      }),
      open_editors_provider.onDidChangeCheckedFiles(() => {
        update_activity_bar_badge_token_count()
      }),
      // Also subscribe to websites provider changes
      websites_provider.onDidChangeCheckedWebsites(() => {
        update_activity_bar_badge_token_count()
      }),
      // Fixes badge not updating when websites list changes
      websites_provider.onDidChangeTreeData(() => {
        update_activity_bar_badge_token_count()
      })
    )

    // Update badge when configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('geminiCoder')) {
          // If attachOpenFiles setting changed, refresh the tree views
          if (event.affectsConfiguration('geminiCoder.attachOpenFiles')) {
            const config = vscode.workspace.getConfiguration('geminiCoder')
            const attachOpenFiles = config.get('attachOpenFiles', true)

            // Update the OpenEditorsProvider with the new setting value
            if (open_editors_provider) {
              open_editors_provider.update_attach_open_files_setting(
                attachOpenFiles
              )
            }
          }

          update_activity_bar_badge_token_count()
        }
      })
    )

    // Update badge when tabs change with debouncing to avoid multiple updates
    let tabChangeTimeout: NodeJS.Timeout | null = null
    context.subscriptions.push(
      vscode.window.tabGroups.onDidChangeTabs(() => {
        // Clear previous timeout if it exists
        if (tabChangeTimeout) {
          clearTimeout(tabChangeTimeout)
        }
        // Set a new timeout to update after a short delay
        tabChangeTimeout = setTimeout(() => {
          update_activity_bar_badge_token_count()
          tabChangeTimeout = null
        }, 100) // 100ms debounce
      })
    )

    // Update title when workspace folders change
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (vscode.workspace.workspaceFolders) {
          const workspaceName = vscode.workspace.workspaceFolders[0].name
          gemini_coder_file_tree_view.title = workspaceName
        }
      })
    )

    // Fix for issue when the collapsed item has some of its children selected
    gemini_coder_file_tree_view.onDidCollapseElement(() => {
      workspace_provider!.refresh()
    })

    // Set up event listener for when the open editors provider initializes
    context.subscriptions.push(
      open_editors_provider.onDidChangeTreeData(() => {
        // Update the badge after the open editors provider refreshes
        if (open_editors_provider!.is_initialized()) {
          update_activity_bar_badge_token_count()
        }
      })
    )

    // Also schedule a delayed update for initial badge display
    setTimeout(() => {
      update_activity_bar_badge_token_count()
    }, 1000) // Wait for 1 second to ensure VS Code has fully loaded
  } else {
    vscode.window.showInformationMessage(
      'Please open a workspace folder to use this extension.'
    )
  }

  return {
    workspace_provider: workspace_provider,
    open_editors_provider: open_editors_provider,
    websites_provider: websites_provider
  }
}
