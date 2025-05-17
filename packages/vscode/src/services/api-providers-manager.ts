import * as vscode from 'vscode'
import { PROVIDERS } from '@shared/constants/providers'
import {
  SAVED_API_PROVIDERS_STATE_KEY,
  TOOL_CONFIG_FILE_REFACTORING_STATE_KEY,
  TOOL_CONFIG_COMMIT_MESSAGES_STATE_KEY,
  TOOL_CONFIG_CODE_COMPLETIONS_STATE_KEY
} from '@/constants/state-keys'

export type BuiltInProvider = {
  type: 'built-in'
  name: keyof typeof PROVIDERS
  api_key: string
}

export type CustomProvider = {
  type: 'custom'
  name: string
  base_url: string
  api_key: string
}

export type Provider = BuiltInProvider | CustomProvider

export type ToolConfig = {
  provider_type: string
  provider_name: string
  model: string
  temperature: number
}

export type CodeCompletionsConfigs = ToolConfig[]

export class ApiProvidersManager {
  private _providers: Provider[] = []

  constructor(private readonly _vscode: vscode.ExtensionContext) {
    this._load_providers()
  }

  private async _load_providers() {
    const saved_providers = this._vscode.globalState
      .get<Provider[]>(SAVED_API_PROVIDERS_STATE_KEY, [])
      // Make sure all built-in providers exist
      .filter(
        (provider) => provider.type == 'custom' || PROVIDERS[provider.name]
      )
    this._providers = saved_providers
  }

  public async save_providers(providers: Provider[]) {
    await this._vscode.globalState.update(
      SAVED_API_PROVIDERS_STATE_KEY,
      providers
    )
    this._providers = providers
  }

  public get_providers() {
    return this._providers
  }

  public get_provider(name: string): Provider | undefined {
    return this._providers.find((provider) => provider.name == name)
  }

  private _validate_tool_config(
    config: ToolConfig | undefined
  ): ToolConfig | undefined {
    if (!config) return undefined

    const provider = this._providers.find(
      (p) => p.type == config.provider_type && p.name == config.provider_name
    )

    if (!provider) {
      return undefined
    }

    return config
  }

  public get_code_completions_tool_configs(): CodeCompletionsConfigs {
    const configs = this._vscode.globalState.get<CodeCompletionsConfigs>(
      TOOL_CONFIG_CODE_COMPLETIONS_STATE_KEY,
      []
    )
    return configs.filter((c) => this._validate_tool_config(c) !== undefined)
  }

  public get_file_refactoring_tool_config(): ToolConfig | undefined {
    const config = this._vscode.globalState.get<ToolConfig>(
      TOOL_CONFIG_FILE_REFACTORING_STATE_KEY
    )
    return this._validate_tool_config(config)
  }

  public get_commit_messages_tool_config(): ToolConfig | undefined {
    const config = this._vscode.globalState.get<ToolConfig>(
      TOOL_CONFIG_COMMIT_MESSAGES_STATE_KEY
    )
    return this._validate_tool_config(config)
  }

  public async save_code_completions_tool_configs(
    configs: CodeCompletionsConfigs
  ) {
    await this._vscode.globalState.update(
      TOOL_CONFIG_CODE_COMPLETIONS_STATE_KEY,
      configs
    )
  }

  public async save_file_refactoring_tool_config(config: ToolConfig) {
    await this._vscode.globalState.update(
      TOOL_CONFIG_FILE_REFACTORING_STATE_KEY,
      config
    )
  }

  public async save_commit_messages_tool_config(config: ToolConfig) {
    await this._vscode.globalState.update(
      TOOL_CONFIG_COMMIT_MESSAGES_STATE_KEY,
      config
    )
  }

  /**
   * Updates provider name references in all tool configurations
   * when a provider is renamed
   */
  public async update_provider_name_in_configs(params: {
    old_name: string
    new_name: string
  }): Promise<void> {
    const { old_name, new_name } = params

    // Update code completions configs
    const completionsConfig =
      this._vscode.globalState.get<CodeCompletionsConfigs>(
        TOOL_CONFIG_CODE_COMPLETIONS_STATE_KEY,
        []
      )

    const updatedCompletionsConfig = completionsConfig.map((config) => {
      if (
        config.provider_type === 'custom' &&
        config.provider_name === old_name
      ) {
        return { ...config, provider_name: new_name }
      }
      return config
    })

    await this._vscode.globalState.update(
      TOOL_CONFIG_CODE_COMPLETIONS_STATE_KEY,
      updatedCompletionsConfig
    )

    // Update file refactoring config
    const fileRefactoringConfig = this._vscode.globalState.get<ToolConfig>(
      TOOL_CONFIG_FILE_REFACTORING_STATE_KEY
    )

    if (
      fileRefactoringConfig &&
      fileRefactoringConfig.provider_type === 'custom' &&
      fileRefactoringConfig.provider_name === old_name
    ) {
      await this._vscode.globalState.update(
        TOOL_CONFIG_FILE_REFACTORING_STATE_KEY,
        { ...fileRefactoringConfig, provider_name: new_name }
      )
    }

    // Update commit messages config
    const commitMessagesConfig = this._vscode.globalState.get<ToolConfig>(
      TOOL_CONFIG_COMMIT_MESSAGES_STATE_KEY
    )

    if (
      commitMessagesConfig &&
      commitMessagesConfig.provider_type === 'custom' &&
      commitMessagesConfig.provider_name === old_name
    ) {
      await this._vscode.globalState.update(
        TOOL_CONFIG_COMMIT_MESSAGES_STATE_KEY,
        { ...commitMessagesConfig, provider_name: new_name }
      )
    }
  }
}
