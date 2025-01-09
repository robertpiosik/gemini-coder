import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { get_chat_url } from '../helpers/get-chat-url'

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'geminiCoderViewChat'

  constructor(
    private readonly _extension_uri: vscode.Uri,
    private readonly file_tree_provider: any,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webview_view: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webview_view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extension_uri]
    }

    webview_view.webview.html = this._get_html_for_webview(webview_view.webview)

    // Handle messages from the webview
    webview_view.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'getLastChatInstruction':
          const last_instruction =
            this._context.globalState.get<string>('lastChatInstruction') || ''
          webview_view.webview.postMessage({
            command: 'initialInstruction',
            instruction: last_instruction
          })
          break

        case 'processChatInstruction':
          const { instruction } = message

          // Get context from selected files
          let context_text = ''
          const added_files = new Set<string>()

          // Add selected files from the file tree
          if (this.file_tree_provider) {
            const selected_files_paths =
              this.file_tree_provider.getCheckedFiles()
            for (const file_path of selected_files_paths) {
              try {
                const file_content = fs.readFileSync(file_path, 'utf8')
                const relative_path = path.relative(
                  vscode.workspace.workspaceFolders![0].uri.fsPath,
                  file_path
                )
                context_text += `\n<file path="${relative_path}">\n<![CDATA[\n${file_content}\n]]>\n</file>`
                added_files.add(file_path)
              } catch (error) {
                console.error(`Error reading file ${file_path}:`, error)
              }
            }
          }

          // Add currently open files
          const open_tabs = vscode.window.tabGroups.all
            .flatMap((group) => group.tabs)
            .map((tab) =>
              tab.input instanceof vscode.TabInputText ? tab.input.uri : null
            )
            .filter((uri): uri is vscode.Uri => uri !== null)

          for (const open_file_uri of open_tabs) {
            const file_path = open_file_uri.fsPath
            if (!added_files.has(file_path)) {
              try {
                const file_content = fs.readFileSync(file_path, 'utf8')
                const relative_path = path.relative(
                  vscode.workspace.workspaceFolders![0].uri.fsPath,
                  file_path
                )
                context_text += `\n<file path="${relative_path}">\n${file_content}\n</file>`
                added_files.add(file_path)
              } catch (error) {
                console.error(`Error reading open file ${file_path}:`, error)
              }
            }
          }

          // Get the chat prompt intro from the configuration
          const chat_instruction_preamble = vscode.workspace
            .getConfiguration()
            .get<string>('geminiCoder.chatInstructionPreamble', '')

          // Construct the final text
          const final_text = `<instruction>\n${chat_instruction_preamble} ${instruction}\n</instruction>\n<files>${context_text}\n</files>`

          await vscode.env.clipboard.writeText(final_text)

          // Open the corresponding URL based on the default chat UI provider
          const chat_ui_provider = vscode.workspace
            .getConfiguration()
            .get<string>('geminiCoder.webChat')

          const url = get_chat_url(chat_ui_provider)

          vscode.env.openExternal(vscode.Uri.parse(url))
          break

        case 'showError':
          vscode.window.showErrorMessage(message.message)
          break
      }
    })
  }

  private _get_html_for_webview(webview: vscode.Webview) {
    const script_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extension_uri, 'out', 'chat.js')
    )
    const style_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extension_uri, 'media', 'chat.css')
    )

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chat</title>
        <link href="${style_uri}" rel="stylesheet">
      </head>
      <body>
          <div id="root"></div>
        <script src="${script_uri}"></script>
      </body>
      </html>
    `
  }
}
