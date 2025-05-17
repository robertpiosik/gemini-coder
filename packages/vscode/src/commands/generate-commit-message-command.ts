import * as vscode from 'vscode'
import axios from 'axios'
import * as path from 'path'
import * as fs from 'fs'
import { make_api_request } from '../helpers/make-api-request'
import { execSync } from 'child_process'
import { Logger } from '@/helpers/logger'
import { should_ignore_file } from '../context/utils/extension-utils'
import { process_single_trailing_dot } from '@/utils/process-single-trailing-dot/process-single-trailing-dot'
import { ApiProvidersManager } from '../services/api-providers-manager'
import { ignored_extensions } from '@/context/constants/ignored-extensions'
import { PROVIDERS } from '@shared/constants/providers'

export function generate_commit_message_command(
  context: vscode.ExtensionContext
) {
  return vscode.commands.registerCommand(
    'codeWebChat.generateCommitMessage',
    async (source_control: vscode.SourceControl) => {
      const git_extension = vscode.extensions.getExtension('vscode.git')
      if (!git_extension) {
        vscode.window.showErrorMessage('Git extension not found.')
        return
      }

      const git_api = git_extension.exports.getAPI(1)

      const repositories = git_api.repositories
      if (!repositories || repositories.length == 0) {
        vscode.window.showErrorMessage('No Git repository found.')
        return
      }

      const repository = repositories.find(
        (repo: any) =>
          repo.rootUri.toString() == source_control.rootUri?.toString()
      )

      if (!repository) {
        vscode.window.showErrorMessage('Repository not found.')
        return
      }

      try {
        // Check for staged changes first
        const staged_changes = repository.state.indexChanges || []

        // If 0 staged changes, stage all changes
        if (staged_changes.length == 0) {
          await repository.add([]) // Stage all changes
          await new Promise((resolve) => setTimeout(resolve, 500))
        }

        const diff = execSync('git diff --staged', {
          cwd: repository.rootUri.fsPath
        }).toString()

        if (!diff || diff.length == 0) {
          vscode.window.showInformationMessage('No changes to commit.')
          return
        }

        // Get configuration
        const config = vscode.workspace.getConfiguration('codeWebChat')
        const commit_message_prompt = config.get<string>('commitMessagePrompt')
        const config_ignored_extensions = new Set(
          config
            .get<string[]>('ignoredExtensions', [])
            .map((ext) => ext.toLowerCase().replace(/^\./, ''))
        )
        const all_ignored_extensions = new Set([
          ...ignored_extensions,
          ...config_ignored_extensions
        ])

        const api_providers_manager = new ApiProvidersManager(context)
        const commit_message_config =
          api_providers_manager.get_commit_messages_tool_config()

        if (!commit_message_config) {
          vscode.window.showErrorMessage(
            'Commit Messages tool is not configured. Go to Code Web Chat panel -> Settings tab.'
          )
          Logger.warn({
            function_name: 'generate_commit_message_command',
            message: 'Commit Messages tool is not configured.'
          })
          return
        }

        const provider = api_providers_manager.get_provider(
          commit_message_config.provider_name
        )

        if (!provider) {
          vscode.window.showErrorMessage(
            'API provider not found for Commit Messages tool. Go to Code Web Chat panel -> Settings tab.'
          )
          Logger.warn({
            function_name: 'generate_commit_message_command',
            message: 'API provider not found for Commit Messages tool.'
          })
          return
        }

        if (!provider.api_key) {
          vscode.window.showErrorMessage(
            'API key is missing for the selected provider. Please add it in the settings.'
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

        // Collect the changed files with their original, unmodified content
        const affected_files = await collect_affected_files(
          repository,
          all_ignored_extensions
        )

        const message = `${affected_files}\n${commit_message_prompt}\n${diff}`

        Logger.log({
          function_name: 'generate_commit_message_command',
          message: 'Getting commit message...',
          data: message
        })

        const token_count = Math.ceil(message.length / 4)
        const formatted_token_count =
          token_count > 1000 ? Math.ceil(token_count / 1000) + 'K' : token_count

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Waiting for a commit message... (Sent ~${formatted_token_count} tokens)`,
            cancellable: true
          },
          async (_, token) => {
            // Prepare request to AI model
            const messages = [
              {
                role: 'user',
                content: message
              }
            ]

            const body = {
              messages,
              model: commit_message_config.model,
              temperature: commit_message_config.temperature
            }

            // Make API request
            const cancel_token_source = axios.CancelToken.source()

            token.onCancellationRequested(() => {
              cancel_token_source.cancel('Operation cancelled by user')
            })

            try {
              const response = await make_api_request(
                endpoint_url,
                provider.api_key,
                body,
                cancel_token_source.token
              )

              if (!response) {
                vscode.window.showErrorMessage(
                  'Failed to generate commit message.'
                )
              } else {
                let commit_message = process_single_trailing_dot(response)
                commit_message = strip_wrapping_quotes(commit_message)
                repository.inputBox.value = commit_message
              }
            } catch (error) {
              if (axios.isCancel(error)) {
                vscode.window.showInformationMessage(
                  'Commit message generation cancelled.'
                )
                return
              }
              Logger.error({
                function_name: 'generate_commit_message_command',
                message: 'Error during API request',
                data: error
              })
              throw error
            }
          }
        )
      } catch (error) {
        Logger.error({
          function_name: 'generate_commit_message_command',
          message: 'Error generating commit message',
          data: error
        })
        vscode.window.showErrorMessage(
          'Error generating commit message. See console for details.'
        )
      }
    }
  )
}

async function collect_affected_files(
  repository: any,
  ignored_extensions: Set<string>
): Promise<string> {
  try {
    const root_path = repository.rootUri.fsPath
    const staged_changes = repository.state.indexChanges || []

    if (!staged_changes.length) {
      return ''
    }

    let files_content = '<files>\n'

    for (const change of staged_changes) {
      const file_path = change.uri.fsPath
      const relative_path = path.relative(root_path, file_path)

      if (should_ignore_file(file_path, ignored_extensions)) {
        continue
      }

      try {
        let content = ''
        if (change.status != 6) {
          try {
            content = fs.readFileSync(file_path, 'utf8')
            const estimated_tokens = Math.ceil(content.length / 4)
            if (estimated_tokens > 20000) {
              content = `[Large file not included]\n`
            }
          } catch (err) {
            Logger.error({
              function_name: 'collect_affected_files',
              message: `Error reading file ${file_path}`,
              data: err
            })
          }
        }

        files_content += `<file path="${relative_path}">\n<![CDATA[\n${content}\n]]>\n</file>\n`
      } catch (err) {
        Logger.error({
          function_name: 'collect_affected_files',
          message: `Error processing file ${file_path}`,
          data: err
        })
      }
    }

    files_content += '</files>'
    return files_content
  } catch (error) {
    Logger.error({
      function_name: 'collect_affected_files',
      message: 'Error collecting changed files',
      data: error
    })
    return ''
  }
}

function strip_wrapping_quotes(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim()
  }
  return text
}
