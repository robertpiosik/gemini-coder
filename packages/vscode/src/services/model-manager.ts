import * as vscode from 'vscode'
import {
  DEFAULT_FIM_MODEL_KEY,
  DEFAULT_REFACTORING_MODEL_KEY,
  DEFAULT_APPLY_CHANGES_MODEL_KEY,
  DEFAULT_COMMIT_MESSAGE_MODEL_KEY
} from '../constants/state-keys'
import { log } from '@/helpers/logger'

const default_model = 'Gemini 2.0 Flash'

export class ModelManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  // Get the default models with default values
  get_default_fim_model(): string {
    const stored_model = this.context.globalState.get<string>(
      DEFAULT_FIM_MODEL_KEY
    )
    return stored_model || default_model
  }

  get_default_refactoring_model(): string {
    const stored_model = this.context.globalState.get<string>(
      DEFAULT_REFACTORING_MODEL_KEY
    )
    return stored_model || default_model
  }

  get_default_apply_changes_model(): string {
    const stored_model = this.context.globalState.get<string>(
      DEFAULT_APPLY_CHANGES_MODEL_KEY
    )
    return stored_model || default_model
  }

  get_default_commit_message_model(): string {
    const stored_model = this.context.globalState.get<string>(
      DEFAULT_COMMIT_MESSAGE_MODEL_KEY
    )
    return stored_model || default_model
  }

  // Set the default models
  async set_default_fim_model(model_name: string): Promise<void> {
    log({
      function_name: 'set_default_fim_model',
      message: `Setting default FIM model to: ${model_name}`
    })
    await this.context.globalState.update(DEFAULT_FIM_MODEL_KEY, model_name)
  }

  async set_default_refactoring_model(model_name: string): Promise<void> {
    log({
      function_name: 'set_default_refactoring_model',
      message: `Setting default refactoring model to: ${model_name}`
    })
    await this.context.globalState.update(
      DEFAULT_REFACTORING_MODEL_KEY,
      model_name
    )
  }

  async set_default_apply_changes_model(model_name: string): Promise<void> {
    log({
      function_name: 'set_default_apply_changes_model',
      message: `Setting default apply changes model to: ${model_name}`
    })
    await this.context.globalState.update(
      DEFAULT_APPLY_CHANGES_MODEL_KEY,
      model_name
    )
  }

  async set_default_commit_message_model(model_name: string): Promise<void> {
    log({
      function_name: 'set_default_commit_message_model',
      message: `Setting default commit message model to: ${model_name}`
    })
    await this.context.globalState.update(
      DEFAULT_COMMIT_MESSAGE_MODEL_KEY,
      model_name
    )
  }
}
