import * as vscode from 'vscode'
import { ModelManager } from '../services/model-manager'

export class ApiViewProvider implements vscode.WebviewViewProvider {
  private _webview_view: vscode.WebviewView | undefined
  private _model_manager: ModelManager
  private _config_listener: vscode.Disposable | undefined

  constructor(
    private readonly _extension_uri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this._model_manager = new ModelManager(context)

    // Add configuration change listener
    this._config_listener = vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (
          (event.affectsConfiguration('geminiCoder.providers') ||
            event.affectsConfiguration('geminiCoder.apiKey')) &&
          this._webview_view
        ) {
          this._send_updated_configuration()
        }
      }
    )

    // Add the listener to context subscriptions for proper disposal
    this.context.subscriptions.push(this._config_listener)
  }

  private async _send_updated_configuration() {
    if (!this._webview_view) return

    const config = vscode.workspace.getConfiguration('geminiCoder')
    const providers = config.get('providers', [])
    const api_key = config.get('apiKey', '')
    const default_fim_model = this._model_manager.get_default_fim_model()
    const default_refactoring_model =
      this._model_manager.get_default_refactoring_model()
    const default_apply_changes_model =
      this._model_manager.get_default_apply_changes_model()
    const default_commit_message_model =
      this._model_manager.get_default_commit_message_model()

    this._webview_view.webview.postMessage({
      command: 'configuration',
      providers,
      api_key,
      default_fim_model,
      default_refactoring_model,
      default_apply_changes_model,
      default_commit_message_model
    })
  }

  public resolveWebviewView(
    webview_view: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._webview_view = webview_view

    webview_view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extension_uri]
    }

    webview_view.webview.html = this._get_html_for_webview(webview_view.webview)

    // Handle messages from the webview
    webview_view.webview.onDidReceiveMessage(async (message) => {
      if (message.command == 'get_configuration') {
        const config = vscode.workspace.getConfiguration('geminiCoder')
        const providers = config.get('providers', [])
        const api_key = config.get('apiKey', '')
        const default_fim_model = this._model_manager.get_default_fim_model()
        const default_refactoring_model =
          this._model_manager.get_default_refactoring_model()
        const default_apply_changes_model =
          this._model_manager.get_default_apply_changes_model()
        const default_commit_message_model =
          this._model_manager.get_default_commit_message_model()

        webview_view.webview.postMessage({
          command: 'configuration',
          providers,
          api_key,
          default_fim_model,
          default_refactoring_model,
          default_apply_changes_model,
          default_commit_message_model
        })
      } else if (message.command == 'update_api_key') {
        await vscode.workspace
          .getConfiguration('geminiCoder')
          .update('apiKey', message.api_key, true)
      } else if (message.command == 'update_fim_model') {
        await this._model_manager.set_default_fim_model(message.model)
      } else if (message.command == 'update_refactoring_model') {
        await this._model_manager.set_default_refactoring_model(message.model)
      } else if (message.command == 'update_apply_changes_model') {
        await this._model_manager.set_default_apply_changes_model(message.model)
      } else if (message.command == 'update_commit_message_model') {
        await this._model_manager.set_default_commit_message_model(
          message.model
        )
      } else if (message.command == 'open_providers_settings') {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'geminiCoder.providers'
        )
      }
    })
  }

  private _get_html_for_webview(webview: vscode.Webview) {
    const script_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extension_uri, 'out', 'api.js')
    )
    const style_uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extension_uri, 'out', 'api.css')
    )

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${style_uri}">
      </head>
      <body>
          <div id="root"></div>
          <script src="${script_uri}"></script>
      </body>
      </html>
    `
  }
}
