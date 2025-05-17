import * as vscode from 'vscode'
import { Logger } from '../helpers/logger'
import { SAVED_API_PROVIDERS_STATE_KEY } from '@/constants/state-keys'

const MIGRATION_ID = 'api-keys-to-providers-migration-1505251700'

/**
 * Migration to create providers for Gemini and OpenRouter if their API keys are saved.
 * This migration runs only once per extension installation.
 */
export async function migrate_api_keys_to_providers(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    // Check if migration has already run
    if (context.globalState.get(MIGRATION_ID)) {
      Logger.log({
        function_name: 'migrate_create_providers_from_api_keys',
        message:
          'Create providers from API keys migration already completed. Skipping.'
      })
      return
    }

    const gemini_api_key = context.globalState.get<string>('geminiApiKey')
    const open_router_api_key =
      context.globalState.get<string>('openRouterApiKey')
    const existing_providers = context.globalState.get<any[]>(
      SAVED_API_PROVIDERS_STATE_KEY,
      []
    )

    let providers_updated = false
    const new_providers = [...existing_providers]

    // Check if Gemini provider should be added
    if (gemini_api_key && !existing_providers.some((p) => p.name == 'Gemini')) {
      new_providers.push({
        type: 'built-in',
        name: 'Gemini',
        api_key: gemini_api_key
      })
      providers_updated = true
      Logger.log({
        function_name: 'migrate_create_providers_from_api_keys',
        message: 'Added Gemini provider from saved API key'
      })
    }

    // Check if OpenRouter provider should be added
    if (
      open_router_api_key &&
      !existing_providers.some((p) => p.name == 'OpenRouter')
    ) {
      new_providers.push({
        type: 'built-in',
        name: 'OpenRouter',
        api_key: open_router_api_key
      })
      providers_updated = true
      Logger.log({
        function_name: 'migrate_create_providers_from_api_keys',
        message: 'Added OpenRouter provider from saved API key'
      })
    }

    if (providers_updated) {
      await context.globalState.update(SAVED_API_PROVIDERS_STATE_KEY, new_providers)
      Logger.log({
        function_name: 'migrate_create_providers_from_api_keys',
        message: 'Updated providers list with new providers from API keys'
      })
    } else {
      Logger.log({
        function_name: 'migrate_create_providers_from_api_keys',
        message: 'No new providers to add from API keys'
      })
    }

    // Mark migration as completed
    await context.globalState.update(MIGRATION_ID, true)
  } catch (error) {
    Logger.error({
      function_name: 'migrate_create_providers_from_api_keys',
      message: 'Error creating providers from API keys',
      data: error instanceof Error ? error.message : String(error)
    })
    // Do NOT mark as completed if an error occurred
  }
}
