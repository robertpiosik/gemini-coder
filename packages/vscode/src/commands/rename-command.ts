import * as vscode from 'vscode'
import * as path from 'path'

export function rename_command() {
  return vscode.commands.registerCommand(
    'geminiCoder.rename',
    async (item?: vscode.TreeItem) => {
      // If item is not provided, we can't rename
      if (!item?.resourceUri) {
        return
      }

      const old_path = item.resourceUri.fsPath
      const dir_name = path.dirname(old_path)
      const current_name = path.basename(old_path)

      // Ask user for new name
      const new_name = await vscode.window.showInputBox({
        prompt: 'Enter new name',
        placeHolder: '',
        value: current_name
      })

      // If user cancelled or didn't enter a name, abort
      if (!new_name || new_name == current_name) {
        return
      }

      try {
        // Create full path for new location
        const new_path = path.join(dir_name, new_name)

        // Check if target already exists
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(new_path))
          vscode.window.showErrorMessage(
            `A file or folder named '${new_name}' already exists.`
          )
          return
        } catch {
          // Target doesn't exist, which is what we want
        }

        // Rename the file or folder
        await vscode.workspace.fs.rename(
          vscode.Uri.file(old_path),
          vscode.Uri.file(new_path),
          { overwrite: false }
        )

        // Refresh the workspace tree view
        vscode.commands.executeCommand('geminiCoderViewWorkspace.refresh')
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to rename: ${error.message}`)
      }
    }
  )
}