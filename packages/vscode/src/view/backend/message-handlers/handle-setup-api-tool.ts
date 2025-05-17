import { ViewProvider } from '@/view/backend/view-provider'
import * as vscode from 'vscode'
import {
  ApiProvidersManager,
  Provider,
  ToolConfig
} from '@/services/api-providers-manager'
import { ModelFetcher } from '@/services/model-fetcher'
import { PROVIDERS } from '@shared/constants/providers'

export const handle_setup_api_tool = async (
  provider: ViewProvider,
  tool: 'file-refactoring' | 'commit-messages'
): Promise<void> => {
  const providers_manager = new ApiProvidersManager(provider.context)
  const model_fetcher = new ModelFetcher()
  const default_temperature = tool == 'file-refactoring' ? 0 : 0.3

  const get_tool_config = () => {
    return tool == 'file-refactoring'
      ? providers_manager.get_file_refactoring_tool_config()
      : providers_manager.get_commit_messages_tool_config()
  }

  const save_tool_config = async (config: ToolConfig) => {
    if (tool == 'file-refactoring') {
      await providers_manager.save_file_refactoring_tool_config(config)
    } else {
      await providers_manager.save_commit_messages_tool_config(config)
    }
  }

  const current_config = get_tool_config()

  if (!current_config) {
    await setup_new_config()
  } else {
    await update_existing_config(current_config)
  }

  async function setup_new_config() {
    // Step 1: Select provider
    const provider_info = await select_provider()
    if (!provider_info) return

    // Step 2: Select model
    const model = await select_model(provider_info)
    if (!model) return

    const config: ToolConfig = {
      provider_type: provider_info.type,
      provider_name: provider_info.name,
      model,
      temperature: default_temperature
    }

    await save_tool_config(config)
    vscode.window.showInformationMessage(
      `${tool} tool configuration completed successfully.`
    )
  }

  async function update_existing_config(config: ToolConfig) {
    const api_provider_label = 'API Provider'
    const model_label = 'Model'
    const temperature_label = 'Temperature'
    const show_config_options = async () => {
      const options = [
        { label: api_provider_label, description: config.provider_name },
        { label: model_label, description: config.model },
        {
          label: temperature_label,
          description: `${config.temperature.toString()}${
            config.temperature == default_temperature ? ' (default)' : ''
          }`
        }
      ]

      const selection = await vscode.window.showQuickPick(options, {
        title: `Update ${
          tool == 'commit-messages' ? 'Commit Messages' : 'File Refactoring'
        } Configuration`,
        placeHolder: 'Select setting to update'
      })

      if (!selection) return

      let updated = false

      if (selection.label == api_provider_label) {
        const provider_info = await select_provider()
        if (!provider_info) {
          await show_config_options()
          return
        }

        const model = await select_model(provider_info)
        if (!model) {
          await show_config_options()
          return
        }

        config = {
          ...config,
          provider_type: provider_info.type,
          provider_name: provider_info.name,
          model,
          temperature: default_temperature
        }
        updated = true
      } else if (selection.label == model_label) {
        const provider_info: {
          type: Provider['type']
          name: Provider['name']
        } = {
          type: config.provider_type as any,
          name: config.provider_name
        }
        const new_model = await select_model(provider_info)
        if (!new_model) {
          await show_config_options()
          return
        }
        config.model = new_model
        config.temperature = default_temperature
        updated = true
      } else if (selection.label == temperature_label) {
        const new_temperature = await set_temperature(config.temperature)
        if (new_temperature === undefined) {
          await show_config_options()
          return
        }
        config.temperature = new_temperature
        updated = true
      }
      if (updated) {
        await save_tool_config(config)
      }
      await show_config_options()
    }
    await show_config_options()
  }

  async function select_provider(): Promise<
    Pick<Provider, 'type' | 'name'> | undefined
  > {
    const providers = providers_manager.get_providers()

    if (providers.length == 0) {
      vscode.window.showErrorMessage(
        'No API providers configured. Please configure an API provider first.'
      )
      return undefined
    }

    const provider_items = providers.map((p) => ({
      label: p.name,
      description: p.type == 'built-in' ? 'Built-in' : 'Custom',
      provider: p
    }))

    const selected = await vscode.window.showQuickPick(provider_items, {
      title: 'Select API Provider',
      placeHolder: 'Choose an API provider'
    })

    if (!selected) return undefined

    return {
      type: selected.provider.type,
      name: selected.provider.name
    }
  }

  async function select_model(
    provider_info: Pick<Provider, 'type' | 'name'>
  ): Promise<string | undefined> {
    try {
      const provider = providers_manager.get_provider(provider_info.name)
      if (!provider) {
        throw new Error(`Provider ${provider_info.name} not found`)
      }

      const base_url =
        provider.type == 'built-in'
          ? PROVIDERS[provider.name].base_url
          : provider.base_url

      if (!base_url) {
        throw new Error(`Base URL not found for provider ${provider_info.name}`)
      }

      const models = await model_fetcher.get_models({
        base_url,
        api_key: provider.api_key
      })

      if (!models.length) {
        vscode.window.showWarningMessage(
          `No models found for ${provider_info.name}.`
        )
      }

      const model_items = models.map((model) => ({
        label: model.name || model.id,
        description: model.name ? model.id : undefined,
        detail: model.description
      }))

      const selected = await vscode.window.showQuickPick(model_items, {
        title: 'Select Model',
        placeHolder: 'Choose an AI model'
      })

      return selected?.label
    } catch (error) {
      console.error('Error fetching models:', error)
      vscode.window.showErrorMessage(
        `Failed to fetch models: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  async function set_temperature(
    temperature: number
  ): Promise<number | undefined> {
    const temperature_input = await vscode.window.showInputBox({
      title: 'Set Temperature',
      prompt: 'Enter a value between 0 and 1 (required)',
      value: temperature.toString(),
      placeHolder: '',
      validateInput: (value) => {
        const num = Number(value)
        if (isNaN(num)) return 'Please enter a valid number'
        if (num < 0 || num > 1) return 'Temperature must be between 0 and 1'
        return null
      }
    })

    if (temperature_input === undefined || temperature_input == '') {
      return default_temperature
    }

    return Number(temperature_input)
  }
}
